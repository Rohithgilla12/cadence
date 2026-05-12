# Onboarding Flow + HealthKit Prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** First-time users land on an onboarding flow — intent, pillars, optional Apple Health, suggested first practices — before they ever see the Today screen. Once HealthKit is granted, the sleep tile on Today auto-fills from `readDailySummary(today).sleepHours` when the user hasn't manually logged sleep for the day.

**Architecture:**
- **Server:** new `PATCH /v1/me` endpoint that accepts `{intent?, pillars?, displayName?}` and updates the `users` row. The existing `GET /v1/me` response gains an `onboardingCompleted` boolean (derived: `intent IS NOT NULL`). No new tables — the `users.intent` and `users.pillars` columns are already in the Phase 1 migration.
- **Mobile:** `/onboarding/*` stack with 4 screens (intent → pillars → health → practices). `AuthGate` in the root layout redirects to `/onboarding/intent` when `me.onboardingCompleted === false`. The final practices step posts the selected habits via the existing `createHabit` endpoint (one POST per habit; small batches) and patches `intent + pillars` via `PATCH /v1/me` before routing to `/`.
- **HealthKit prefill:** `readDailySummary(today)` runs alongside the `getCheckIn` query on the Today screen. When HealthKit is authorized **and** the server check-in has no `sleepHours`, the CheckInRow renders the HealthKit value with a small "from Apple Health" caption. No server write yet — that's a separate sync plan.

**Tech Stack:** existing — pgx/v5, chi, TanStack Query 5, NativeWind 4, `@kingstinct/react-native-healthkit`. No new deps.

**Out of scope (follow-ups):**
- Daily summary upload to the server (`POST /v1/health/summaries`) — needed before correlation engine can run
- Circle invite step in onboarding (Circles not built yet)
- Manual sleep editor on the CheckInRow (next plan covers the mood-picker + sleep-editor sheet)
- Custom habit naming during onboarding (suggestions are accepted verbatim; rename via habit detail in a later plan)
- Onboarding skip flow / re-onboarding from settings (PRD §3 principle — gentle, but not in scope)

---

## File map

### `cadence-api/`

```
internal/user/repository.go           # MOD — add UpdateProfile method
internal/user/repository_test.go      # MOD — test for UpdateProfile
internal/http/me.go                    # MOD — add PatchMe handler, extend meResponse with onboardingCompleted
internal/http/me_test.go               # MOD — tests for PATCH /v1/me
internal/http/router.go                # MOD — mount PATCH /v1/me
README.md                              # MOD — endpoint table + Phase 1 checklist
```

### `cadence-mobile/`

```
src/lib/api/types.ts                                  # MOD — Me gains onboardingCompleted; UpdateMeInput type
src/lib/api/endpoints.ts                              # MOD — updateMe method
src/lib/onboarding/intents.ts                         # NEW — intent options
src/lib/onboarding/pillars.ts                         # NEW — pillar options
src/lib/onboarding/suggestions.ts                     # NEW — suggested habits per pillar set
src/lib/onboarding/index.ts                           # NEW — barrel
app/_layout.tsx                                       # MOD — AuthGate routes unfinished onboarders to /onboarding/intent
app/onboarding/_layout.tsx                            # NEW — internal stack, no header
app/onboarding/intent.tsx                             # NEW
app/onboarding/pillars.tsx                            # NEW
app/onboarding/health.tsx                             # NEW (replaces /connect-health for the onboarding flow)
app/onboarding/practices.tsx                          # NEW (finalizer)
src/components/onboarding/StepHeader.tsx              # NEW — shared serif-title + subhead block
src/components/onboarding/StepProgressDots.tsx        # NEW — 4-dot progress indicator
src/components/onboarding/OptionTile.tsx              # NEW — selectable tile (intent + pillars + practices reuse this)
src/components/onboarding/index.ts                    # NEW — barrel
src/components/today/CheckInRow.tsx                   # MOD — accept optional fallbackSleepHours + healthSource caption
app/(tabs)/index.tsx                                  # MOD — read readDailySummary on focus, pass to CheckInRow
```

---

# Server side

## Task 1: `UpdateProfile` repository method (TDD)

**Files:**
- Modify: `cadence-api/internal/user/repository.go`
- Modify: `cadence-api/internal/user/repository_test.go`

- [ ] **Step 1: Failing test**

Append to `repository_test.go`:

```go
func TestUpdateProfile_PartialFieldsPreserveOthers(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)
	ctx := context.Background()

	created, err := repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
		FirebaseUID: "uid-upd",
		Email:       "u@x.com",
		DisplayName: "Original",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	intent := "train_honestly"
	pillars := []string{"movement", "rest"}
	updated, err := repo.UpdateProfile(ctx, created.ID, user.UpdateProfileInput{
		Intent:  &intent,
		Pillars: &pillars,
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Intent != "train_honestly" {
		t.Fatalf("intent: %q", updated.Intent)
	}
	if len(updated.Pillars) != 2 || updated.Pillars[0] != "movement" {
		t.Fatalf("pillars: %+v", updated.Pillars)
	}
	if updated.DisplayName != "Original" {
		t.Fatalf("display name overwritten: %q", updated.DisplayName)
	}

	// Second update — only displayName.
	newName := "Renamed"
	updated2, err := repo.UpdateProfile(ctx, created.ID, user.UpdateProfileInput{
		DisplayName: &newName,
	})
	if err != nil {
		t.Fatalf("update2: %v", err)
	}
	if updated2.DisplayName != "Renamed" {
		t.Fatalf("display name: %q", updated2.DisplayName)
	}
	if updated2.Intent != "train_honestly" {
		t.Fatalf("intent cleared: %q", updated2.Intent)
	}
	if len(updated2.Pillars) != 2 {
		t.Fatalf("pillars cleared: %+v", updated2.Pillars)
	}
}
```

- [ ] **Step 2: Run — expect compile failure on `user.UpdateProfileInput`.**

```bash
cd cadence-api && set -a; source .env; set +a; make test-integration 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

Append to `cadence-api/internal/user/repository.go`:

```go
type UpdateProfileInput struct {
	Intent      *string
	Pillars     *[]string
	DisplayName *string
}

func (r *Repository) UpdateProfile(ctx context.Context, id uuid.UUID, in UpdateProfileInput) (User, error) {
	// Partial update via COALESCE so nil fields preserve existing values.
	row := r.pool.QueryRow(ctx, `
		UPDATE users SET
			intent       = COALESCE($2, intent),
			pillars      = COALESCE($3, pillars),
			display_name = COALESCE($4, display_name),
			updated_at   = now()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, firebase_uid, COALESCE(email,''), COALESCE(display_name,''),
		          COALESCE(handle,''), COALESCE(intent,''), pillars, created_at, updated_at
	`, id, in.Intent, in.Pillars, in.DisplayName)
	var u User
	if err := row.Scan(&u.ID, &u.FirebaseUID, &u.Email, &u.DisplayName,
		&u.Handle, &u.Intent, &u.Pillars, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, fmt.Errorf("update profile: %w", err)
	}
	return u, nil
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add cadence-api/internal/user
git commit -m "feat(api): user.UpdateProfile partial update

COALESCE on intent, pillars, display_name preserves fields the caller
didn't supply — same pattern the check-in repository uses for mood
and sleep. updated_at bumps on every call.

PRD §11."
```

---

## Task 2: `PATCH /v1/me` handler

**Files:**
- Modify: `cadence-api/internal/http/me.go`
- Modify: `cadence-api/internal/http/me_test.go`
- Modify: `cadence-api/internal/http/router.go`
- Modify: `cadence-api/internal/http/Deps` adds `Users *user.Repository` (router already has the resolver; the repo is constructed in `main.go`)

Actually — the router currently does not hold a `*user.Repository`. The resolver closes over it. We need to add the repository to `Deps` so handlers can call it directly. Update Deps and main.go accordingly.

- [ ] **Step 1: Failing test**

Append to `me_test.go`:

```go
func TestPatchMe_UpdatesIntentAndPillars(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	userRepo := user.NewRepository(pool)

	router := cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:     pool,
		Verifier: stubVerifier{id: auth.Identity{FirebaseUID: "uid-patch", Email: "p@x.com", Name: "P"}},
		Resolver: auth.UserResolverFromRepository(userRepo),
		Users:    userRepo,
		// the remaining repos are nil here — PATCH /v1/me doesn't touch them
	})
	server := httptest.NewServer(router)
	defer server.Close()

	body := []byte(`{"intent":"train_honestly","pillars":["movement","rest"]}`)
	req, _ := http.NewRequest(http.MethodPatch, server.URL+"/v1/me", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer anything")
	req.Header.Set("Content-Type", "application/json")
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}

	var got struct {
		Intent              string   `json:"intent"`
		Pillars             []string `json:"pillars"`
		OnboardingCompleted bool     `json:"onboardingCompleted"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Intent != "train_honestly" {
		t.Fatalf("intent: %q", got.Intent)
	}
	if len(got.Pillars) != 2 || got.Pillars[0] != "movement" {
		t.Fatalf("pillars: %+v", got.Pillars)
	}
	if !got.OnboardingCompleted {
		t.Fatalf("expected onboardingCompleted=true after intent set")
	}
}

func TestGetMe_OnboardingCompletedFalseWhenIntentEmpty(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	userRepo := user.NewRepository(pool)

	router := cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:     pool,
		Verifier: stubVerifier{id: auth.Identity{FirebaseUID: "uid-fresh", Email: "f@x.com", Name: "F"}},
		Resolver: auth.UserResolverFromRepository(userRepo),
		Users:    userRepo,
	})
	server := httptest.NewServer(router)
	defer server.Close()

	req, _ := http.NewRequest(http.MethodGet, server.URL+"/v1/me", nil)
	req.Header.Set("Authorization", "Bearer anything")
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	var got struct {
		OnboardingCompleted bool `json:"onboardingCompleted"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&got)
	if got.OnboardingCompleted {
		t.Fatalf("fresh user should have onboardingCompleted=false")
	}
}
```

- [ ] **Step 2: Run — expect compile failure** on `Users` field of `Deps`.

- [ ] **Step 3: Extend `me.go`**

Replace `cadence-api/internal/http/me.go`:

```go
package http

import (
	"encoding/json"
	"net/http"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

type meResponse struct {
	ID                  string   `json:"id"`
	FirebaseUID         string   `json:"firebaseUid"`
	Email               string   `json:"email"`
	DisplayName         string   `json:"displayName"`
	Handle              string   `json:"handle"`
	Intent              string   `json:"intent"`
	Pillars             []string `json:"pillars"`
	OnboardingCompleted bool     `json:"onboardingCompleted"`
}

func toMeResponse(u user.User) meResponse {
	return meResponse{
		ID:                  u.ID.String(),
		FirebaseUID:         u.FirebaseUID,
		Email:               u.Email,
		DisplayName:         u.DisplayName,
		Handle:              u.Handle,
		Intent:              u.Intent,
		Pillars:             u.Pillars,
		OnboardingCompleted: u.Intent != "",
	}
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusInternalServerError, "no user in context")
		return
	}
	writeJSON(w, http.StatusOK, toMeResponse(u))
}

type patchMeRequest struct {
	Intent      *string   `json:"intent,omitempty"`
	Pillars     *[]string `json:"pillars,omitempty"`
	DisplayName *string   `json:"displayName,omitempty"`
}

func PatchMe(users *user.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusInternalServerError, "no user in context")
			return
		}
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		var req patchMeRequest
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		updated, err := users.UpdateProfile(r.Context(), u.ID, user.UpdateProfileInput{
			Intent:      req.Intent,
			Pillars:     req.Pillars,
			DisplayName: req.DisplayName,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "update failed")
			return
		}
		writeJSON(w, http.StatusOK, toMeResponse(updated))
	}
}
```

- [ ] **Step 4: Add `Users` to `Deps` and mount PATCH route**

Modify `cadence-api/internal/http/router.go`:

```go
type Deps struct {
	Pool      *pgxpool.Pool
	Verifier  auth.Verifier
	Resolver  auth.UserResolver
	Users     *user.Repository
	Habits    *habit.Repository
	HabitLogs *habit.LogRepository
	CheckIns  *checkin.Repository
}
```

And inside the `/v1` route block, after `r.Get("/me", GetMe)`:

```go
r.Patch("/me", PatchMe(deps.Users))
```

Add the `user` import to `router.go`.

- [ ] **Step 5: Wire in `main.go`**

Modify `cadence-api/cmd/api/main.go` to pass `Users: repo` to `cadencehttp.Deps{...}` alongside the existing `Resolver` field.

- [ ] **Step 6: Run — expect PASS.**

```bash
make test-integration
```

12 cases — the existing 10 plus the 2 new ones.

- [ ] **Step 7: Commit**

```bash
git add cadence-api/internal/http cadence-api/cmd/api/main.go
git commit -m "feat(api): PATCH /v1/me + onboardingCompleted flag

GetMe response gains onboardingCompleted (derived: intent != ''). The
client uses it to route unfinished onboarders to /onboarding before
they see the tab stack. PATCH /v1/me accepts {intent?, pillars?,
displayName?} with partial-update semantics.

PRD §6, §11."
```

---

## Task 3: Update server README

**Files:** `cadence-api/README.md`

- [ ] **Step 1: Add to the endpoints table**

```markdown
| PATCH  | /v1/me                          | Partial update of intent, pillars, displayName |
```

And bump the phase checklist:

```markdown
- [x] Phase 1: Onboarding write-side (PATCH /v1/me + onboardingCompleted flag)
- [ ] Phase 1: Onboarding UI
```

- [ ] **Step 2: Commit**

```bash
git add cadence-api/README.md
git commit -m "docs(api): PATCH /v1/me in endpoint reference"
```

---

# Mobile side

## Task 4: API types + endpoint helper

**Files:**
- Modify: `cadence-mobile/src/lib/api/types.ts`
- Modify: `cadence-mobile/src/lib/api/endpoints.ts`

- [ ] **Step 1: Extend `Me` type**

Edit `types.ts` — replace the existing `Me` interface:

```typescript
export interface Me {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  handle: string;
  intent: string;
  pillars: string[];
  onboardingCompleted: boolean;
}

export interface UpdateMeInput {
  intent?: string;
  pillars?: string[];
  displayName?: string;
}
```

- [ ] **Step 2: Add `updateMe` endpoint**

Add to the `endpoints` object in `endpoints.ts`:

```typescript
updateMe: (client: ApiClient) => (input: UpdateMeInput) =>
  client.request<Me>('/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
```

Also add `UpdateMeInput` to the import list at the top.

- [ ] **Step 3: Typecheck**

```bash
cd cadence-mobile && bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add cadence-mobile/src/lib/api
git commit -m "feat(mobile): API client gains updateMe + onboardingCompleted

The onboarding screens use updateMe at each step transition (intent,
pillars) and the AuthGate uses onboardingCompleted to decide the
initial route."
```

---

## Task 5: Onboarding data — intents, pillars, suggested habits

**Files:**
- Create: `cadence-mobile/src/lib/onboarding/intents.ts`
- Create: `cadence-mobile/src/lib/onboarding/pillars.ts`
- Create: `cadence-mobile/src/lib/onboarding/suggestions.ts`
- Create: `cadence-mobile/src/lib/onboarding/index.ts`

- [ ] **Step 1: Intents**

Create `src/lib/onboarding/intents.ts`:

```typescript
export type IntentId =
  | 'train_honestly'
  | 'calmer_day'
  | 'back_in_rhythm'
  | 'with_friends';

export interface IntentOption {
  id: IntentId;
  label: string;
  description: string;
}

// Voice anchors from PRD §20 — "rhythm", "practice", "coming back".
export const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'train_honestly',
    label: 'Train more honestly',
    description: 'Runners, athletes, anyone who wants signal over performance.',
  },
  {
    id: 'calmer_day',
    label: 'Build a calmer day',
    description: 'Mindfulness, rest, gentler mornings.',
  },
  {
    id: 'back_in_rhythm',
    label: 'Come back into rhythm',
    description: 'Returning after a quiet stretch.',
  },
  {
    id: 'with_friends',
    label: 'Try this with friends',
    description: 'A small circle holding each other to a shared practice.',
  },
];
```

- [ ] **Step 2: Pillars**

Create `src/lib/onboarding/pillars.ts`:

```typescript
export type PillarId =
  | 'movement'
  | 'rest'
  | 'mind'
  | 'mood'
  | 'nourish'
  | 'practice';

export interface PillarOption {
  id: PillarId;
  label: string;
  description: string;
}

export const PILLAR_OPTIONS: PillarOption[] = [
  { id: 'movement', label: 'Movement', description: 'Running, walking, training.' },
  { id: 'rest', label: 'Rest', description: 'Sleep, recovery, quiet.' },
  { id: 'mind', label: 'Mind', description: 'Focus, meditation, attention.' },
  { id: 'mood', label: 'Mood', description: 'Noticing how you feel.' },
  { id: 'nourish', label: 'Nourish', description: 'Hydration, eating well.' },
  { id: 'practice', label: 'Practice', description: 'Reading, writing, learning.' },
];
```

- [ ] **Step 3: Suggested habits per pillar**

Create `src/lib/onboarding/suggestions.ts`:

```typescript
import type { PillarId } from './pillars';

export interface SuggestedHabit {
  id: string;           // local id used only for the picker
  name: string;
  icon: string;         // matches IconPicker slugs
  timeOfDay: 'morning' | 'midday' | 'evening' | 'anytime';
}

// Two suggestions per pillar. Names are intentionally calm — the user can
// rename after creation. Slugs map to Tabler icons we already render in
// IconPicker.
const BY_PILLAR: Record<PillarId, SuggestedHabit[]> = {
  movement: [
    { id: 'mv-1', name: 'Morning run',     icon: 'run',     timeOfDay: 'morning' },
    { id: 'mv-2', name: 'Walk after dinner', icon: 'walk',  timeOfDay: 'evening' },
  ],
  rest: [
    { id: 'rs-1', name: 'Bedtime by 10pm', icon: 'leaf',    timeOfDay: 'evening' },
    { id: 'rs-2', name: 'Stretch before bed', icon: 'yoga', timeOfDay: 'evening' },
  ],
  mind: [
    { id: 'mn-1', name: 'Mindful 10',      icon: 'yoga',    timeOfDay: 'morning' },
    { id: 'mn-2', name: 'Quiet morning',   icon: 'sparkles', timeOfDay: 'morning' },
  ],
  mood: [
    { id: 'md-1', name: 'Mood check at noon', icon: 'sparkles', timeOfDay: 'midday' },
    { id: 'md-2', name: 'Three good things', icon: 'pencil',    timeOfDay: 'evening' },
  ],
  nourish: [
    { id: 'nr-1', name: 'Glass of water',  icon: 'coffee',  timeOfDay: 'morning' },
    { id: 'nr-2', name: 'Eat slowly',      icon: 'sparkles', timeOfDay: 'midday' },
  ],
  practice: [
    { id: 'pr-1', name: 'Read 20 min',     icon: 'book-2',  timeOfDay: 'evening' },
    { id: 'pr-2', name: 'Write something', icon: 'pencil',  timeOfDay: 'morning' },
  ],
};

export function suggestedHabitsFor(pillars: PillarId[]): SuggestedHabit[] {
  const set = new Map<string, SuggestedHabit>();
  for (const pillar of pillars) {
    for (const habit of BY_PILLAR[pillar] ?? []) {
      set.set(habit.id, habit);
    }
  }
  return Array.from(set.values());
}
```

- [ ] **Step 4: Barrel**

Create `src/lib/onboarding/index.ts`:

```typescript
export { INTENT_OPTIONS } from './intents';
export type { IntentId, IntentOption } from './intents';
export { PILLAR_OPTIONS } from './pillars';
export type { PillarId, PillarOption } from './pillars';
export { suggestedHabitsFor } from './suggestions';
export type { SuggestedHabit } from './suggestions';
```

- [ ] **Step 5: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/src/lib/onboarding
git commit -m "feat(mobile): onboarding option data + suggested habits

Intent options, pillar options, and a pillar→suggestions map. Voice
anchors from PRD §20 ('rhythm', 'coming back', 'practice'). Slugs
match the existing IconPicker; no new Tabler icons introduced."
```

---

## Task 6: Shared onboarding components

**Files:**
- Create: `cadence-mobile/src/components/onboarding/StepHeader.tsx`
- Create: `cadence-mobile/src/components/onboarding/StepProgressDots.tsx`
- Create: `cadence-mobile/src/components/onboarding/OptionTile.tsx`
- Create: `cadence-mobile/src/components/onboarding/index.ts`

- [ ] **Step 1: `StepHeader`**

```tsx
// src/components/onboarding/StepHeader.tsx
import { Text, View } from 'react-native';

interface StepHeaderProps {
  title: string;
  subtitle?: string;
}

export function StepHeader({ title, subtitle }: StepHeaderProps) {
  return (
    <View>
      <Text className="font-serif text-h1 text-ink">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-body text-ink-2">{subtitle}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: `StepProgressDots`**

```tsx
// src/components/onboarding/StepProgressDots.tsx
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

interface StepProgressDotsProps {
  current: number;   // 1-indexed
  total: number;
}

export function StepProgressDots({ current, total }: StepProgressDotsProps) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => {
        const filled = step <= current;
        return (
          <View
            key={step}
            style={{
              width: filled ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: filled ? colors.moss : colors.hairline2,
            }}
          />
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: `OptionTile`** — selectable card used by intent, pillars, practices

```tsx
// src/components/onboarding/OptionTile.tsx
import { IconCheck } from '@tabler/icons-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface OptionTileProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}

export function OptionTile({ label, description, selected, onPress, trailing }: OptionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.mossBg : colors.card,
        borderColor: selected ? colors.mossLight : colors.hairline,
        borderWidth: 0.5,
        borderRadius: 14,
        padding: 16,
        opacity: pressed && !selected ? 0.9 : 1,
      })}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className={`text-body font-medium ${selected ? 'text-moss' : 'text-ink'}`}>
            {label}
          </Text>
          {description ? (
            <Text className="text-caption text-ink-2 mt-1">{description}</Text>
          ) : null}
        </View>
        {trailing ?? (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: selected ? colors.moss : 'transparent',
              borderWidth: selected ? 0 : 0.5,
              borderColor: colors.hairline2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected ? <IconCheck size={14} color="#FFFFFF" strokeWidth={2} /> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Barrel**

```typescript
// src/components/onboarding/index.ts
export { StepHeader } from './StepHeader';
export { StepProgressDots } from './StepProgressDots';
export { OptionTile } from './OptionTile';
```

- [ ] **Step 5: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/src/components/onboarding
git commit -m "feat(mobile): shared onboarding components

StepHeader (serif title + body subhead), StepProgressDots (filled
elongated dot for current step), OptionTile (selectable card used by
intent + pillars + practices). All NativeWind, no new tokens."
```

---

## Task 7: Onboarding stack layout + intent screen

**Files:**
- Create: `cadence-mobile/app/onboarding/_layout.tsx`
- Create: `cadence-mobile/app/onboarding/intent.tsx`

- [ ] **Step 1: Stack layout**

```tsx
// app/onboarding/_layout.tsx
import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    />
  );
}
```

- [ ] **Step 2: Intent screen**

```tsx
// app/onboarding/intent.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionTile, StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { INTENT_OPTIONS } from '@/lib/onboarding';
import type { IntentId } from '@/lib/onboarding';
import type { Me } from '@/lib/api/types';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function IntentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<IntentId | null>(null);

  const mutation = useMutation({
    mutationFn: (intent: IntentId) => endpoints.updateMe(apiClient)({ intent }),
    onSuccess: (me) => {
      queryClient.setQueryData<Me>(queryKeys.me, me);
      router.push('/onboarding/pillars');
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={1} total={4} />
        <View className="mt-6">
          <StepHeader
            title="Why are you here?"
            subtitle="Pick one. You can change this later."
          />
        </View>
        <View className="mt-8 gap-3">
          {INTENT_OPTIONS.map((opt) => (
            <OptionTile
              key={opt.id}
              label={opt.label}
              description={opt.description}
              selected={selected === opt.id}
              onPress={() => setSelected(opt.id)}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPaddingX,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 0.5,
          borderTopColor: colors.hairline,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={mutation.isPending ? 'Saving…' : 'Continue'}
          variant="primary"
          fullWidth
          disabled={!selected || mutation.isPending}
          onPress={() => selected && mutation.mutate(selected)}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/app/onboarding
git commit -m "feat(mobile): onboarding step 1 — intent

Single-select intent with 4 options, Continue persists via
PATCH /v1/me and advances to /onboarding/pillars. Cache is updated
in place so AuthGate doesn't bounce."
```

---

## Task 8: Pillars screen

**Files:**
- Create: `cadence-mobile/app/onboarding/pillars.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/onboarding/pillars.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionTile, StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { PILLAR_OPTIONS } from '@/lib/onboarding';
import type { PillarId } from '@/lib/onboarding';
import type { Me } from '@/lib/api/types';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function PillarsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<PillarId>>(new Set());

  function toggle(id: PillarId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: (pillars: PillarId[]) => endpoints.updateMe(apiClient)({ pillars }),
    onSuccess: (me) => {
      queryClient.setQueryData<Me>(queryKeys.me, me);
      router.push('/onboarding/health');
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={2} total={4} />
        <View className="mt-6">
          <StepHeader
            title="What matters to you?"
            subtitle="Pick the parts of your life Cadence should pay attention to."
          />
        </View>
        <View className="mt-8 gap-3">
          {PILLAR_OPTIONS.map((opt) => (
            <OptionTile
              key={opt.id}
              label={opt.label}
              description={opt.description}
              selected={selected.has(opt.id)}
              onPress={() => toggle(opt.id)}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPaddingX,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 0.5,
          borderTopColor: colors.hairline,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={mutation.isPending ? 'Saving…' : 'Continue'}
          variant="primary"
          fullWidth
          disabled={selected.size === 0 || mutation.isPending}
          onPress={() => mutation.mutate(Array.from(selected))}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/app/onboarding/pillars.tsx
git commit -m "feat(mobile): onboarding step 2 — pillars

Multi-select pillars; saves on Continue. At least one required.
Same OptionTile primitive as intent."
```

---

## Task 9: Health step

**Files:**
- Create: `cadence-mobile/app/onboarding/health.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/onboarding/health.tsx
import {
  IconBolt,
  IconHeartbeat,
  IconMoon,
  IconRun,
} from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { getStatus, requestPermissions } from '@/lib/health';
import type { HealthAuthStatus } from '@/lib/health';
import { colors, screenPaddingX } from '@/theme/tokens';

interface Scope {
  label: string;
  icon: React.ReactNode;
}

const SCOPES: Scope[] = [
  { label: 'Sleep duration and stages',           icon: <IconMoon size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Steps and active energy',             icon: <IconBolt size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Workouts (runs, walks, yoga, swim)',  icon: <IconRun size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Resting heart rate and HRV',          icon: <IconHeartbeat size={18} color={colors.moss} strokeWidth={1.5} /> },
];

export default function OnboardingHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [status, setStatus] = useState<HealthAuthStatus>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  async function handleConnect() {
    setBusy(true);
    try {
      const next = await requestPermissions();
      setStatus(next);
    } catch (err) {
      Alert.alert('Could not connect', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function handleContinue() {
    router.push('/onboarding/practices');
  }

  const primaryLabel =
    status === 'authorized'
      ? 'Continue'
      : busy
        ? 'Connecting…'
        : 'Connect Apple Health';

  const onPrimary = status === 'authorized' ? handleContinue : handleConnect;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={3} total={4} />
        <View className="mt-6">
          <StepHeader
            title="Connect Apple Health"
            subtitle="Cadence reads what your phone already knows so we can show you what moves your rhythm. Nothing leaves this device."
          />
        </View>

        <View className="mt-8 gap-3">
          {SCOPES.map((scope) => (
            <View key={scope.label} className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-moss-bg items-center justify-center">
                {scope.icon}
              </View>
              <Text className="text-body text-ink flex-1">{scope.label}</Text>
            </View>
          ))}
        </View>

        {status === 'authorized' ? (
          <Text className="mt-8 text-body text-moss font-medium">Connected.</Text>
        ) : null}

        {status === 'unavailable' || Platform.OS !== 'ios' ? (
          <Text className="mt-8 text-caption text-ink-3">
            Apple Health is iOS-only. Health Connect for Android is coming soon.
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPaddingX,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 0.5,
          borderTopColor: colors.hairline,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={primaryLabel}
          variant="primary"
          fullWidth
          disabled={busy}
          onPress={onPrimary}
        />
        <View className="mt-2">
          <Button label="Skip for now" variant="ghost" onPress={handleContinue} />
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/app/onboarding/health.tsx
git commit -m "feat(mobile): onboarding step 3 — Apple Health

Reuses the existing health module. Primary button doubles as connect
then continue. 'Skip for now' is always available — never punish a
decline (PRD §3 principle 2)."
```

---

## Task 10: Practices screen — finalizes onboarding

**Files:**
- Create: `cadence-mobile/app/onboarding/practices.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/onboarding/practices.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionTile, StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { suggestedHabitsFor } from '@/lib/onboarding';
import type { PillarId, SuggestedHabit } from '@/lib/onboarding';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function PracticesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });

  const suggestions = useMemo(() => {
    const pillars = (meQuery.data?.pillars ?? []) as PillarId[];
    return suggestedHabitsFor(pillars);
  }, [meQuery.data]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default: every suggestion checked, but capped at 4 to keep the start gentle.
  useEffect(() => {
    if (suggestions.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const defaults = new Set<string>();
      suggestions.slice(0, 4).forEach((h) => defaults.add(h.id));
      return defaults;
    });
  }, [suggestions]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const finishMutation = useMutation({
    mutationFn: async () => {
      const chosen = suggestions.filter((h) => selected.has(h.id));
      const create = endpoints.createHabit(apiClient);
      // Serial to avoid hammering the API for a small set; ~150ms each is fine.
      for (const habit of chosen) {
        await create({
          name: habit.name,
          icon: habit.icon,
          timeOfDay: habit.timeOfDay,
          trackContext: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
      router.replace('/');
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  if (meQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={4} total={4} />
        <View className="mt-6">
          <StepHeader
            title="Pick a few practices to start."
            subtitle="Two is plenty for the first week."
          />
        </View>
        {suggestions.length === 0 ? (
          <Text className="mt-8 text-body text-ink-2">
            We'll surface suggestions once your pillars are set. You can add practices manually from Today.
          </Text>
        ) : (
          <View className="mt-8 gap-3">
            {suggestions.map((habit) => (
              <OptionTile
                key={habit.id}
                label={habit.name}
                description={timeOfDayLabel(habit.timeOfDay)}
                selected={selected.has(habit.id)}
                onPress={() => toggle(habit.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPaddingX,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 0.5,
          borderTopColor: colors.hairline,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={finishMutation.isPending ? 'Setting up…' : 'Begin'}
          variant="primary"
          fullWidth
          disabled={finishMutation.isPending}
          onPress={() => finishMutation.mutate()}
        />
      </View>
    </View>
  );
}

function timeOfDayLabel(t: SuggestedHabit['timeOfDay']): string {
  switch (t) {
    case 'morning': return 'Morning';
    case 'midday':  return 'Midday';
    case 'evening': return 'Evening';
    default:        return 'Anytime';
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/app/onboarding/practices.tsx
git commit -m "feat(mobile): onboarding step 4 — first practices

Suggestions derive from chosen pillars (2 per pillar, deduped).
Defaults to the first 4 checked — 'two is plenty' applies but four
gives the user something to deselect. Creates serially via the
existing POST /v1/habits, then routes to /."
```

---

## Task 11: AuthGate routes incomplete onboarders

**Files:**
- Modify: `cadence-mobile/app/_layout.tsx`

- [ ] **Step 1: Add the Me query inside the gate**

Replace the contents of `_layout.tsx`. Key change: `AuthGate` calls `useQuery` for `/v1/me` once auth is signed in. If `me.onboardingCompleted === false`, it redirects to `/onboarding/intent` (unless the user is already in the `onboarding` group).

```tsx
import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth, configureGoogleSignIn } from '@/lib/auth';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { QueryProvider } from '@/lib/query';
import { colors } from '@/theme/tokens';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (webClientId) {
  configureGoogleSignIn(webClientId);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
    enabled: status === 'signed-in',
  });

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0];
    const inTabs = root === '(tabs)';
    const inOnboarding = root === 'onboarding';

    if (status === 'signed-out') {
      if (inTabs || inOnboarding) router.replace('/sign-in');
      return;
    }

    if (root === 'sign-in') {
      router.replace('/');
      return;
    }

    if (meQuery.isLoading || !meQuery.data) return;

    if (!meQuery.data.onboardingCompleted && !inOnboarding) {
      router.replace('/onboarding/intent');
    } else if (meQuery.data.onboardingCompleted && inOnboarding) {
      router.replace('/');
    }
  }, [status, segments, router, meQuery.isLoading, meQuery.data]);

  if (status === 'loading' || (status === 'signed-in' && meQuery.isLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen
                  name="add-habit"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
            </AuthGate>
            <StatusBar style="dark" />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/app/_layout.tsx
git commit -m "feat(mobile): AuthGate routes incomplete onboarders

When me.onboardingCompleted is false and the user isn't already in
the /onboarding group, redirect to /onboarding/intent. When complete
and they wander back into /onboarding, send them home. Loading
spinner now also covers the brief /v1/me fetch on first auth."
```

---

## Task 12: HealthKit sleep prefill on CheckInRow

**Files:**
- Modify: `cadence-mobile/src/components/today/CheckInRow.tsx`
- Modify: `cadence-mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: CheckInRow accepts a HealthKit fallback**

Replace `CheckInRow.tsx`:

```tsx
import { View, Text } from 'react-native';

import { Card } from '@/components/primitives';
import type { CheckIn, Mood } from '@/types';

interface CheckInRowProps {
  checkIn: CheckIn | null;
  // Provided when Apple Health is connected and has sleep data for today.
  // Used only when checkIn.sleepHours is undefined — the user's manual log
  // is always canonical (CLAUDE.md "never auto-uncheck").
  healthSleepHours?: number;
}

function formatSleepHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

const MOOD_DOTS: Mood[] = [1, 2, 3, 4, 5];

function MoodSection({ mood }: { mood?: Mood }) {
  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">MOOD</Text>
      <View className="flex-row gap-1.5">
        {MOOD_DOTS.map((dotValue) => (
          <View
            key={dotValue}
            style={{ width: 8, height: 8 }}
            className={`rounded-full ${mood !== undefined && dotValue <= mood ? 'bg-moss' : 'bg-paper-2'}`}
          />
        ))}
      </View>
    </View>
  );
}

interface SleepSectionProps {
  manualHours?: number;
  fallbackHours?: number;
}

function SleepSection({ manualHours, fallbackHours }: SleepSectionProps) {
  const hours = manualHours ?? fallbackHours;
  const fromHealth = manualHours === undefined && fallbackHours !== undefined;

  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">SLEEP</Text>
      {hours !== undefined ? (
        <>
          <Text className="text-h3 font-serif text-ink">{formatSleepHours(hours)}</Text>
          {fromHealth ? (
            <Text className="text-caption text-ink-3 mt-1">from Apple Health</Text>
          ) : null}
        </>
      ) : (
        <Text className="text-body text-ink-3">—</Text>
      )}
    </View>
  );
}

export function CheckInRow({ checkIn, healthSleepHours }: CheckInRowProps) {
  const ci = checkIn ?? {};
  return (
    <Card padding="md">
      <View className="flex-row">
        <MoodSection mood={ci.mood} />
        <View className="w-px bg-hairline mx-4" />
        <SleepSection manualHours={ci.sleepHours} fallbackHours={healthSleepHours} />
      </View>
    </Card>
  );
}
```

- [ ] **Step 2: Today screen reads HealthKit and passes the value**

Modify `app/(tabs)/index.tsx`:

1. Import `readDailySummary` and `getStatus` from `@/lib/health`.
2. Add a query for the daily summary, scoped by today's ISO date. Only `enabled` when iOS auth is `authorized`.
3. Pass `healthSleepHours={dailySummaryQuery.data?.sleepHours}` to `CheckInRow`.

Concrete additions inside `TodayScreen`:

```tsx
import { getStatus, readDailySummary } from '@/lib/health';

// ... existing code ...

const healthStatusQuery = useQuery({
  queryKey: ['health-status'],
  queryFn: getStatus,
  staleTime: 60_000,
});

const dailySummaryQuery = useQuery({
  queryKey: ['health-summary', todayIso],
  queryFn: () => readDailySummary(new Date()),
  enabled: healthStatusQuery.data === 'authorized',
  staleTime: 5 * 60_000,
});

// ... replace the CheckInRow render ...
<CheckInRow
  checkIn={checkInQuery.data ? {
    mood: checkInQuery.data.mood,
    sleepHours: checkInQuery.data.sleepHours,
  } : null}
  healthSleepHours={dailySummaryQuery.data?.sleepHours}
/>
```

- [ ] **Step 3: Typecheck + commit**

```bash
bunx tsc --noEmit
git add cadence-mobile/src/components/today/CheckInRow.tsx cadence-mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): HealthKit sleep prefill on CheckInRow

When Apple Health is authorized AND the server has no manual sleep
entry for today, the sleep tile renders the on-device HealthKit value
with a 'from Apple Health' caption. Manual log is always canonical —
never overwritten silently (CLAUDE.md auth/health rule).

Daily summary query is 5-min stale; status query is 1-min. Both are
disabled when HealthKit isn't authorized so non-iOS / non-granted
users never load the native module.

PRD §9."
```

---

## Plan complete

After Task 12:

- Fresh user signs in → Apple/Google auth → `/v1/me` returns `onboardingCompleted: false` → AuthGate redirects to `/onboarding/intent`.
- Intent → Pillars → Health → Practices, with state persisted to the server after each step.
- On Begin, the chosen practices land as `habits` rows, then router replaces to `/`. AuthGate sees `onboardingCompleted: true` and lets the tabs render.
- Today screen shows the just-created habits, and if HealthKit was granted, the sleep tile pre-fills from the device.

**Manual smoke test the user runs after `bunx expo run:ios`:**
1. Sign out from You (or wipe app data). Sign back in with a new identity.
2. Onboarding intent screen appears. Pick one. Continue.
3. Pillars. Pick 2-3. Continue.
4. Health. Tap Connect. Grant. Tap Continue.
5. Practices. Deselect a couple. Begin.
6. Land on Today with the new practices and a sleep number from Apple Health.

Server check:
```bash
make db-shell
SELECT id, email, intent, pillars FROM users WHERE firebase_uid = '<your uid>';
SELECT name, icon, time_of_day FROM habits WHERE user_id = '<your user id>';
```

**Next plan candidates:**
- **Mood + sleep editor sheet** — tap the CheckInRow → bottom sheet to set mood (5 dots tappable) and override sleep manually. Writes via PUT /v1/check-ins/:date.
- **Daily summary upload** — POST /v1/health/summaries + nightly client sync.
- **Reflect tab + first correlation insights** — the wedge (PRD §1) finally surfaces.

· · ·
