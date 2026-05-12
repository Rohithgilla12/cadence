# Habits + Check-ins CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Authenticated CRUD for habits, habit logs, and check-ins so the Today screen reads from Postgres instead of mock data. After this plan, the screen renders the user's real habits, tapping a row toggles a `habit_logs` row, and the mood/sleep tile reads/writes `check_ins`.

**Architecture:**
- Server: domain-per-package pattern already in place (`internal/user`, `internal/auth`). Add `internal/habit` (definitions + logs) and `internal/checkin`. Each domain owns its `Repository` over the `*pgxpool.Pool`. HTTP handlers in `internal/http` consume repositories. Streak computation is a pure function over `[]time.Time` so it can be unit-tested without DB.
- Client: extend `src/lib/api/endpoints.ts` with typed methods. Replace mock data on the Today screen with `useQuery` + `useMutation`. Optimistic updates for the habit toggle so the check-circle animates instantly. CheckInRow is read-only this pass — `PUT` wiring lands in the next plan with the mood-picker UI.

**Tech Stack:** existing — pgx/v5, chi, TanStack Query 5. No new deps.

**Out of scope:**
- Create-habit UI (deferred — onboarding plan will seed first habits intentionally)
- Habit detail screen
- Grace-day logic for streaks (Phase 6 polish per PRD §17)
- Habit archiving from the UI (server endpoint added; UI surface waits for the You/Settings screen)
- Mood/sleep editor UI

---

## File map

### `cadence-api/`
```
internal/habit/
  habit.go             # NEW — Habit struct, TimeOfDay enum, Target struct
  streak.go            # NEW — pure ComputeStreak([]time.Time, today) int
  streak_test.go       # NEW — unit tests, no DB
  repository.go        # NEW — Create, GetByID, ListForUser (joins log status), Archive
  repository_test.go   # NEW — integration tests
  log.go               # NEW — Log struct
  log_repository.go    # NEW — UpsertLog, DeleteLog, RecentCompletedDates
  log_repository_test.go  # NEW
internal/checkin/
  checkin.go           # NEW — CheckIn struct
  repository.go        # NEW — Get(userID, date), Upsert
  repository_test.go   # NEW
internal/http/
  habits.go            # NEW — ListHabits, CreateHabit, ToggleHabit, ArchiveHabit handlers
  habits_test.go       # NEW — end-to-end with stub verifier
  checkins.go          # NEW — GetCheckIn, PutCheckIn
  checkins_test.go     # NEW
  router.go            # MODIFY — mount new routes
  errors.go            # NEW — writeJSON, writeError helpers
cmd/api/main.go        # MODIFY — wire habit + checkin repos into Deps
README.md              # MODIFY — bump phase checklist
```

### `cadence-mobile/`
```
src/lib/api/
  types.ts             # MODIFY — add Habit, CheckIn API types
  endpoints.ts         # MODIFY — listHabits, toggleHabit, getCheckIn
  queryKeys.ts         # NEW — central registry
src/types/index.ts     # MODIFY — align with API shapes (drop Mood as 1-5 literal? keep)
src/lib/mockData.ts    # KEEP — used only by sample/dev tooling; today screen no longer imports
app/(tabs)/index.tsx   # MODIFY — useQuery/useMutation, optimistic toggle
src/components/today/CheckInRow.tsx  # MODIFY — accept optional checkIn (no edit yet)
src/components/habit/HabitRow.tsx    # MODIFY — onToggle is async, supports pending state
```

---

# Server side — `cadence-api`

## Task 1: Habit domain types + streak (pure, TDD)

**Files:**
- Create: `cadence-api/internal/habit/habit.go`
- Create: `cadence-api/internal/habit/streak.go`
- Create: `cadence-api/internal/habit/streak_test.go`

- [ ] **Step 1: Define types**

Create `cadence-api/internal/habit/habit.go`:

```go
package habit

import (
	"time"

	"github.com/google/uuid"
)

type TimeOfDay string

const (
	TimeMorning TimeOfDay = "morning"
	TimeMidday  TimeOfDay = "midday"
	TimeEvening TimeOfDay = "evening"
	TimeAnytime TimeOfDay = "anytime"
)

// Target is the optional duration/intensity goal (e.g., 30 min, 5 km).
type Target struct {
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

type Habit struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Name          string
	Icon          string
	TimeOfDay     TimeOfDay
	Target        *Target
	TrackContext  bool
	SharedWith    []uuid.UUID
	CreatedAt     time.Time
	ArchivedAt    *time.Time
}

// View is the response shape for the Today screen — joined with today's log status
// and a pre-computed streak.
type View struct {
	Habit
	DoneToday    bool
	Streak       int
	AutoDetected bool
}
```

- [ ] **Step 2: Write failing streak tests**

Create `cadence-api/internal/habit/streak_test.go`:

```go
package habit_test

import (
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
)

func d(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestComputeStreak_Empty(t *testing.T) {
	got := habit.ComputeStreak(nil, d("2026-05-13"))
	if got != 0 {
		t.Fatalf("got %d want 0", got)
	}
}

func TestComputeStreak_LatestOlderThanYesterday(t *testing.T) {
	dates := []time.Time{d("2026-05-09"), d("2026-05-08")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 0 {
		t.Fatalf("got %d want 0 (broken — latest log was 4 days ago)", got)
	}
}

func TestComputeStreak_OnlyToday(t *testing.T) {
	dates := []time.Time{d("2026-05-13")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 1 {
		t.Fatalf("got %d want 1", got)
	}
}

func TestComputeStreak_TodayPlusYesterday(t *testing.T) {
	dates := []time.Time{d("2026-05-13"), d("2026-05-12")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 2 {
		t.Fatalf("got %d want 2", got)
	}
}

func TestComputeStreak_YesterdayOnly_TodayMissed(t *testing.T) {
	// Per PRD §3: streak survives today-not-yet-done; doesn't break until tomorrow.
	dates := []time.Time{d("2026-05-12"), d("2026-05-11"), d("2026-05-10")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 3 {
		t.Fatalf("got %d want 3", got)
	}
}

func TestComputeStreak_BreaksOnGap(t *testing.T) {
	// 13, 12, [10 missing 11], 9 — streak counts only 13,12 = 2
	dates := []time.Time{d("2026-05-13"), d("2026-05-12"), d("2026-05-10"), d("2026-05-09")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 2 {
		t.Fatalf("got %d want 2", got)
	}
}

func TestComputeStreak_HandlesUnsortedInput(t *testing.T) {
	dates := []time.Time{d("2026-05-11"), d("2026-05-13"), d("2026-05-12")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 3 {
		t.Fatalf("got %d want 3", got)
	}
}
```

- [ ] **Step 3: Run tests — expect compile failure**

```bash
cd cadence-api
go test ./internal/habit/...
```

Expected: `undefined: habit.ComputeStreak`.

- [ ] **Step 4: Implement streak**

Create `cadence-api/internal/habit/streak.go`:

```go
package habit

import (
	"sort"
	"time"
)

// ComputeStreak counts consecutive completed days going backwards from today
// (or yesterday — today's missing log doesn't break the streak yet). Grace
// days are not honored in Phase 1; that lands with the recovery moment work
// (PRD §17, Phase 6).
func ComputeStreak(completedDates []time.Time, today time.Time) int {
	if len(completedDates) == 0 {
		return 0
	}
	// Normalize to local-zero dates and dedupe.
	normalized := make([]time.Time, 0, len(completedDates))
	seen := make(map[time.Time]struct{}, len(completedDates))
	for _, t := range completedDates {
		zero := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
		if _, ok := seen[zero]; ok {
			continue
		}
		seen[zero] = struct{}{}
		normalized = append(normalized, zero)
	}
	sort.Slice(normalized, func(i, j int) bool { return normalized[i].After(normalized[j]) })

	todayZero := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	gap := int(todayZero.Sub(normalized[0]).Hours() / 24)
	if gap > 1 {
		return 0
	}

	streak := 1
	prev := normalized[0]
	for i := 1; i < len(normalized); i++ {
		dayGap := int(prev.Sub(normalized[i]).Hours() / 24)
		if dayGap == 1 {
			streak++
			prev = normalized[i]
			continue
		}
		break
	}
	return streak
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
go test ./internal/habit/...
```

Expected: 7 passes.

- [ ] **Step 6: Commit**

```bash
git add cadence-api/internal/habit/habit.go cadence-api/internal/habit/streak.go cadence-api/internal/habit/streak_test.go
git commit -m "feat(api): habit domain types + pure streak function

ComputeStreak is a pure function over []time.Time so unit tests don't
need a DB. Today's missing log doesn't break the streak (PRD §3
'honest streaks'); grace days deferred to Phase 6.

PRD §11."
```

---

## Task 2: Habit repository (TDD with real Postgres)

**Files:**
- Create: `cadence-api/internal/habit/repository.go`
- Create: `cadence-api/internal/habit/repository_test.go`

- [ ] **Step 1: Write failing tests**

Create `cadence-api/internal/habit/repository_test.go`:

```go
//go:build integration

package habit_test

import (
	"context"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func seedUser(t *testing.T, pool any) user.User {
	t.Helper()
	repo := user.NewRepository(pool.(*pgxpool.Pool))
	u, err := repo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: "uid-habit-test",
		Email:       "h@x.com",
		DisplayName: "Habit Tester",
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return u
}
```

Wait — the `pool any` is wrong. Use the concrete type. Rewrite the file:

```go
//go:build integration

package habit_test

import (
	"context"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedUser(t *testing.T, pool *pgxpool.Pool) user.User {
	t.Helper()
	repo := user.NewRepository(pool)
	u, err := repo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: "uid-habit-test",
		Email:       "h@x.com",
		DisplayName: "Habit Tester",
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return u
}

func TestCreateHabit_PersistsAndReturnsRecord(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)

	got, err := repo.Create(context.Background(), habit.CreateInput{
		UserID:    u.ID,
		Name:      "Morning run",
		Icon:      "run",
		TimeOfDay: habit.TimeMorning,
		Target:    &habit.Target{Value: 30, Unit: "min"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if got.Name != "Morning run" || got.Icon != "run" || got.TimeOfDay != habit.TimeMorning {
		t.Fatalf("unexpected: %+v", got)
	}
	if got.Target == nil || got.Target.Value != 30 {
		t.Fatalf("target: %+v", got.Target)
	}
}

func TestListForUser_OmitsArchivedAndOtherUsers(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	live, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Live", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create live: %v", err)
	}
	archived, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Old", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create archived: %v", err)
	}
	if err := repo.Archive(ctx, archived.ID); err != nil {
		t.Fatalf("archive: %v", err)
	}

	got, err := repo.ListForUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d habits, want 1", len(got))
	}
	if got[0].ID != live.ID {
		t.Fatalf("unexpected habit returned: %+v", got[0])
	}
}

func TestArchive_SetsArchivedAtAndExcludesFromList(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	h, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Doomed", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := repo.Archive(ctx, h.ID); err != nil {
		t.Fatalf("archive: %v", err)
	}
	list, _ := repo.ListForUser(ctx, u.ID)
	if len(list) != 0 {
		t.Fatalf("archived habit still listed: %+v", list)
	}
}

func TestGetByID_ScopedToOwner(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	h, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Mine", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := repo.GetByID(ctx, h.ID, u.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "Mine" {
		t.Fatalf("got %+v", got)
	}

	other := user.User{ID: u.ID} // any different UUID
	other.ID = h.UserID // shadow — replace with a fresh UUID
	// Re-use a known different uuid:
	other.ID = u.ID
	other.ID = h.ID // hack: any different UUID; the call below should ErrNotFound
	_, err = repo.GetByID(ctx, h.ID, other.ID)
	if err == nil {
		t.Fatalf("expected ErrNotFound when scoping to wrong owner")
	}
}
```

Simplify the cross-owner check — replace the last block with a clean second-user seed:

Replace `TestGetByID_ScopedToOwner` with:

```go
func TestGetByID_ScopedToOwner(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	userRepo := user.NewRepository(pool)
	ctx := context.Background()

	owner, err := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "owner"})
	if err != nil {
		t.Fatalf("owner: %v", err)
	}
	stranger, err := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "stranger"})
	if err != nil {
		t.Fatalf("stranger: %v", err)
	}
	repo := habit.NewRepository(pool)

	h, err := repo.Create(ctx, habit.CreateInput{UserID: owner.ID, Name: "Mine", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := repo.GetByID(ctx, h.ID, owner.ID); err != nil {
		t.Fatalf("owner can't read own habit: %v", err)
	}
	if _, err := repo.GetByID(ctx, h.ID, stranger.ID); err == nil {
		t.Fatalf("stranger should not access habit")
	}
}
```

- [ ] **Step 2: Run tests — expect compile failure**

```bash
set -a; source .env; set +a
go test -tags integration ./internal/habit/...
```

Expected: `undefined: habit.NewRepository`, `habit.CreateInput`.

- [ ] **Step 3: Implement repository**

Create `cadence-api/internal/habit/repository.go`:

```go
package habit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("habit not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type CreateInput struct {
	UserID       uuid.UUID
	Name         string
	Icon         string
	TimeOfDay    TimeOfDay
	Target       *Target
	TrackContext bool
}

func (r *Repository) Create(ctx context.Context, in CreateInput) (Habit, error) {
	timeOfDay := in.TimeOfDay
	if timeOfDay == "" {
		timeOfDay = TimeAnytime
	}
	icon := in.Icon
	if icon == "" {
		icon = "sparkles"
	}
	var sourceLink any = nil
	if in.Target != nil {
		b, err := json.Marshal(map[string]any{"target": in.Target})
		if err != nil {
			return Habit{}, fmt.Errorf("marshal target: %w", err)
		}
		sourceLink = b
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, icon, time_of_day, track_context, source_link)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, name, icon, time_of_day, track_context, source_link, shared_with, created_at, archived_at
	`, in.UserID, in.Name, icon, string(timeOfDay), in.TrackContext, sourceLink)
	return scanHabit(row)
}

func (r *Repository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (Habit, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, user_id, name, icon, time_of_day, track_context, source_link, shared_with, created_at, archived_at
		FROM habits
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, id, ownerID)
	h, err := scanHabit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Habit{}, ErrNotFound
	}
	return h, err
}

func (r *Repository) ListForUser(ctx context.Context, ownerID uuid.UUID) ([]Habit, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, name, icon, time_of_day, track_context, source_link, shared_with, created_at, archived_at
		FROM habits
		WHERE user_id = $1 AND archived_at IS NULL
		ORDER BY created_at ASC
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var out []Habit
	for rows.Next() {
		h, err := scanHabit(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *Repository) Archive(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE habits SET archived_at = now() WHERE id = $1 AND archived_at IS NULL
	`, id)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanHabit(s rowScanner) (Habit, error) {
	var h Habit
	var timeOfDay string
	var sourceLink []byte
	if err := s.Scan(&h.ID, &h.UserID, &h.Name, &h.Icon, &timeOfDay, &h.TrackContext, &sourceLink, &h.SharedWith, &h.CreatedAt, &h.ArchivedAt); err != nil {
		return Habit{}, err
	}
	h.TimeOfDay = TimeOfDay(timeOfDay)
	if len(sourceLink) > 0 {
		var wrapper struct {
			Target *Target `json:"target"`
		}
		if err := json.Unmarshal(sourceLink, &wrapper); err == nil {
			h.Target = wrapper.Target
		}
	}
	return h, nil
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
make test-integration 2>&1 | tail -20
```

Expected: 4 habit cases pass alongside the existing 10.

- [ ] **Step 5: Commit**

```bash
git add cadence-api/internal/habit
git commit -m "feat(api): habit repository — create, list, get, archive

Target stashed in source_link JSONB (the column already exists per
PRD §11 — repurposing rather than adding a column). Archive is a
soft delete via archived_at; list filters it out. GetByID scopes by
owner_id so cross-tenant access yields ErrNotFound.

PRD §11."
```

---

## Task 3: Habit log repository (TDD)

**Files:**
- Create: `cadence-api/internal/habit/log.go`
- Create: `cadence-api/internal/habit/log_repository.go`
- Create: `cadence-api/internal/habit/log_repository_test.go`

- [ ] **Step 1: Types**

Create `cadence-api/internal/habit/log.go`:

```go
package habit

import (
	"time"

	"github.com/google/uuid"
)

type LogSource string

const (
	SourceManual       LogSource = "manual"
	SourceAppleHealth  LogSource = "apple_health"
	SourceHealthConnect LogSource = "health_connect"
	SourceStrava       LogSource = "strava"
)

type Log struct {
	ID         uuid.UUID
	HabitID    uuid.UUID
	Date       time.Time
	Completed  bool
	Value      *float64
	Source     LogSource
	LoggedAt   time.Time
	SkipReason *string
}
```

- [ ] **Step 2: Failing tests**

Create `cadence-api/internal/habit/log_repository_test.go`:

```go
//go:build integration

package habit_test

import (
	"context"
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func TestUpsertLog_CreatesAndIsIdempotent(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "log-user"})
	hRepo := habit.NewRepository(pool)
	h, _ := hRepo.Create(context.Background(), habit.CreateInput{UserID: u.ID, Name: "Run", Icon: "run"})
	logRepo := habit.NewLogRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)

	if _, err := logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: day, Completed: true, Source: habit.SourceManual}); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	if _, err := logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: day, Completed: true, Source: habit.SourceManual}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	// Confirm exactly one row exists for that (habit, date).
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM habit_logs WHERE habit_id=$1`, h.ID).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("got %d rows, want 1", count)
	}
}

func TestDeleteLog_RemovesEntry(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "del-user"})
	hRepo := habit.NewRepository(pool)
	h, _ := hRepo.Create(context.Background(), habit.CreateInput{UserID: u.ID, Name: "Run", Icon: "run"})
	logRepo := habit.NewLogRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	_, _ = logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: day, Completed: true})

	if err := logRepo.Delete(context.Background(), h.ID, day); err != nil {
		t.Fatalf("delete: %v", err)
	}
	var count int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM habit_logs WHERE habit_id=$1`, h.ID).Scan(&count)
	if count != 0 {
		t.Fatalf("got %d rows, want 0", count)
	}
}

func TestRecentCompletedDates_OrderedDesc(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "rec-user"})
	hRepo := habit.NewRepository(pool)
	h, _ := hRepo.Create(context.Background(), habit.CreateInput{UserID: u.ID, Name: "Run", Icon: "run"})
	logRepo := habit.NewLogRepository(pool)
	for _, day := range []string{"2026-05-11", "2026-05-12", "2026-05-13"} {
		t0, _ := time.Parse("2006-01-02", day)
		_, _ = logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: t0, Completed: true})
	}
	got, err := logRepo.RecentCompletedDates(context.Background(), h.ID, time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC), 30)
	if err != nil {
		t.Fatalf("recent: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("got %d dates, want 3", len(got))
	}
	if !got[0].Equal(time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("first date: %v", got[0])
	}
}
```

- [ ] **Step 3: Run — expect compile failure.**

- [ ] **Step 4: Implement**

Create `cadence-api/internal/habit/log_repository.go`:

```go
package habit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LogRepository struct {
	pool *pgxpool.Pool
}

func NewLogRepository(pool *pgxpool.Pool) *LogRepository {
	return &LogRepository{pool: pool}
}

type UpsertLogInput struct {
	HabitID   uuid.UUID
	Date      time.Time
	Completed bool
	Value     *float64
	Source    LogSource
}

func (r *LogRepository) Upsert(ctx context.Context, in UpsertLogInput) (Log, error) {
	src := in.Source
	if src == "" {
		src = SourceManual
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO habit_logs (habit_id, date, completed, value, source)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (habit_id, date)
		DO UPDATE SET completed = EXCLUDED.completed, value = EXCLUDED.value, source = EXCLUDED.source, logged_at = now()
		RETURNING id, habit_id, date, completed, value, source, logged_at, skip_reason
	`, in.HabitID, in.Date, in.Completed, in.Value, string(src))
	var l Log
	var srcStr string
	if err := row.Scan(&l.ID, &l.HabitID, &l.Date, &l.Completed, &l.Value, &srcStr, &l.LoggedAt, &l.SkipReason); err != nil {
		return Log{}, fmt.Errorf("scan log: %w", err)
	}
	l.Source = LogSource(srcStr)
	return l, nil
}

func (r *LogRepository) Delete(ctx context.Context, habitID uuid.UUID, date time.Time) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM habit_logs WHERE habit_id = $1 AND date = $2`, habitID, date)
	return err
}

// RecentCompletedDates returns up to `limit` most-recent completed dates for a habit,
// sorted descending. Used by streak computation and the Today screen.
func (r *LogRepository) RecentCompletedDates(ctx context.Context, habitID uuid.UUID, today time.Time, limit int) ([]time.Time, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT date FROM habit_logs
		WHERE habit_id = $1 AND completed = true AND date <= $2
		ORDER BY date DESC
		LIMIT $3
	`, habitID, today, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []time.Time
	for rows.Next() {
		var d time.Time
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// DoneByDate returns a map of habitID → completed for the given date, scoped to the
// provided habit IDs. Used to enrich the habit list response.
func (r *LogRepository) DoneByDate(ctx context.Context, habitIDs []uuid.UUID, date time.Time) (map[uuid.UUID]bool, error) {
	out := make(map[uuid.UUID]bool, len(habitIDs))
	if len(habitIDs) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT habit_id, completed
		FROM habit_logs
		WHERE habit_id = ANY($1) AND date = $2
	`, habitIDs, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var completed bool
		if err := rows.Scan(&id, &completed); err != nil {
			return nil, err
		}
		out[id] = completed
	}
	return out, rows.Err()
}
```

- [ ] **Step 5: Run tests — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add cadence-api/internal/habit/log.go cadence-api/internal/habit/log_repository.go cadence-api/internal/habit/log_repository_test.go
git commit -m "feat(api): habit log repository — upsert, delete, recent dates

Upsert collapses the toggle path to one round-trip — ON CONFLICT
(habit_id, date) DO UPDATE keeps the row count stable when users
tap-then-tap-again. DoneByDate batches the 'is this habit done today'
join for the Today screen list.

PRD §11."
```

---

## Task 4: Check-in repository (TDD)

**Files:**
- Create: `cadence-api/internal/checkin/checkin.go`
- Create: `cadence-api/internal/checkin/repository.go`
- Create: `cadence-api/internal/checkin/repository_test.go`

- [ ] **Step 1: Types**

Create `cadence-api/internal/checkin/checkin.go`:

```go
package checkin

import (
	"time"

	"github.com/google/uuid"
)

type CheckIn struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Date       time.Time
	Mood       *int16
	SleepHours *float64
	Note       *string
	CreatedAt  time.Time
}
```

- [ ] **Step 2: Failing tests**

Create `cadence-api/internal/checkin/repository_test.go`:

```go
//go:build integration

package checkin_test

import (
	"context"
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func TestUpsert_CreatesThenUpdates(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "check_ins", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "ci"})
	repo := checkin.NewRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)

	mood := int16(4)
	sleep := 7.5
	first, err := repo.Upsert(context.Background(), checkin.UpsertInput{UserID: u.ID, Date: day, Mood: &mood, SleepHours: &sleep})
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	if first.Mood == nil || *first.Mood != 4 {
		t.Fatalf("mood: %+v", first.Mood)
	}

	mood2 := int16(5)
	second, err := repo.Upsert(context.Background(), checkin.UpsertInput{UserID: u.ID, Date: day, Mood: &mood2})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("upsert created a second row: %s vs %s", first.ID, second.ID)
	}
	if second.Mood == nil || *second.Mood != 5 {
		t.Fatalf("mood after update: %+v", second.Mood)
	}
}

func TestGet_ReturnsNilWhenAbsent(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "check_ins", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "ci-empty"})
	repo := checkin.NewRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)

	got, err := repo.Get(context.Background(), u.ID, day)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for absent check-in, got %+v", got)
	}
}
```

- [ ] **Step 3: Run — expect compile failure.**

- [ ] **Step 4: Implement**

Create `cadence-api/internal/checkin/repository.go`:

```go
package checkin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type UpsertInput struct {
	UserID     uuid.UUID
	Date       time.Time
	Mood       *int16
	SleepHours *float64
	Note       *string
}

func (r *Repository) Get(ctx context.Context, userID uuid.UUID, date time.Time) (*CheckIn, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, user_id, date, mood, sleep_hours, note, created_at
		FROM check_ins
		WHERE user_id = $1 AND date = $2
	`, userID, date)
	var c CheckIn
	if err := row.Scan(&c.ID, &c.UserID, &c.Date, &c.Mood, &c.SleepHours, &c.Note, &c.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan check-in: %w", err)
	}
	return &c, nil
}

func (r *Repository) Upsert(ctx context.Context, in UpsertInput) (CheckIn, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO check_ins (user_id, date, mood, sleep_hours, note)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, date)
		DO UPDATE SET
			mood = COALESCE(EXCLUDED.mood, check_ins.mood),
			sleep_hours = COALESCE(EXCLUDED.sleep_hours, check_ins.sleep_hours),
			note = COALESCE(EXCLUDED.note, check_ins.note)
		RETURNING id, user_id, date, mood, sleep_hours, note, created_at
	`, in.UserID, in.Date, in.Mood, in.SleepHours, in.Note)
	var c CheckIn
	if err := row.Scan(&c.ID, &c.UserID, &c.Date, &c.Mood, &c.SleepHours, &c.Note, &c.CreatedAt); err != nil {
		return CheckIn{}, fmt.Errorf("scan: %w", err)
	}
	return c, nil
}
```

The `COALESCE(EXCLUDED.field, check_ins.field)` makes the upsert a partial update — passing only `mood` doesn't clobber an existing `sleep_hours`. That matches the PRD's mood/sleep two-tile interaction model where each is edited independently.

- [ ] **Step 5: Run tests — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add cadence-api/internal/checkin
git commit -m "feat(api): check-in repository — partial upsert per day

ON CONFLICT (user_id, date) with COALESCE preserves fields the caller
didn't supply, so the mood tile and the sleep tile can write
independently without stomping each other.

PRD §11."
```

---

## Task 5: HTTP handlers + routing

**Files:**
- Create: `cadence-api/internal/http/habits.go`
- Create: `cadence-api/internal/http/habits_test.go`
- Create: `cadence-api/internal/http/checkins.go`
- Create: `cadence-api/internal/http/checkins_test.go`
- Create: `cadence-api/internal/http/json.go` — write helpers
- Modify: `cadence-api/internal/http/router.go`
- Modify: `cadence-api/cmd/api/main.go`

- [ ] **Step 1: JSON helpers**

Create `cadence-api/internal/http/json.go`:

```go
package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write json", "err", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
```

- [ ] **Step 2: Habit handlers**

Create `cadence-api/internal/http/habits.go`:

```go
package http

import (
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type habitDTO struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Icon         string        `json:"icon"`
	TimeOfDay    string        `json:"timeOfDay"`
	Target       *habit.Target `json:"target,omitempty"`
	TrackContext bool          `json:"trackContext"`
	DoneToday    bool          `json:"doneToday"`
	Streak       int           `json:"streak"`
	AutoDetected bool          `json:"autoDetected"`
	CreatedAt    time.Time     `json:"createdAt"`
}

func newHabitsHandler(habits *habit.Repository, logs *habit.LogRepository) *habitsHandler {
	return &habitsHandler{habits: habits, logs: logs}
}

type habitsHandler struct {
	habits *habit.Repository
	logs   *habit.LogRepository
}

func (h *habitsHandler) list(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	all, err := h.habits.ListForUser(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list habits")
		return
	}
	ids := make([]uuid.UUID, 0, len(all))
	for _, hab := range all {
		ids = append(ids, hab.ID)
	}
	today := startOfDayUTC(time.Now())
	doneMap, err := h.logs.DoneByDate(r.Context(), ids, today)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "done map")
		return
	}
	out := make([]habitDTO, 0, len(all))
	for _, hab := range all {
		dates, err := h.logs.RecentCompletedDates(r.Context(), hab.ID, today, 60)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "recent")
			return
		}
		out = append(out, habitDTO{
			ID:           hab.ID.String(),
			Name:         hab.Name,
			Icon:         hab.Icon,
			TimeOfDay:    string(hab.TimeOfDay),
			Target:       hab.Target,
			TrackContext: hab.TrackContext,
			DoneToday:    doneMap[hab.ID],
			Streak:       habit.ComputeStreak(dates, today),
			CreatedAt:    hab.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"habits": out})
}

type createHabitRequest struct {
	Name         string        `json:"name"`
	Icon         string        `json:"icon"`
	TimeOfDay    string        `json:"timeOfDay"`
	Target       *habit.Target `json:"target,omitempty"`
	TrackContext bool          `json:"trackContext"`
}

func (h *habitsHandler) create(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req createHabitRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	hab, err := h.habits.Create(r.Context(), habit.CreateInput{
		UserID:       u.ID,
		Name:         req.Name,
		Icon:         req.Icon,
		TimeOfDay:    habit.TimeOfDay(req.TimeOfDay),
		Target:       req.Target,
		TrackContext: req.TrackContext,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"habit": habitDTO{
		ID:           hab.ID.String(),
		Name:         hab.Name,
		Icon:         hab.Icon,
		TimeOfDay:    string(hab.TimeOfDay),
		Target:       hab.Target,
		TrackContext: hab.TrackContext,
		CreatedAt:    hab.CreatedAt,
	}})
}

func (h *habitsHandler) toggle(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	hab, err := h.habits.GetByID(r.Context(), id, u.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "habit not found")
		return
	}
	today := startOfDayUTC(time.Now())
	doneMap, _ := h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	if doneMap[id] {
		if err := h.logs.Delete(r.Context(), id, today); err != nil {
			writeError(w, http.StatusInternalServerError, "delete log")
			return
		}
	} else {
		if _, err := h.logs.Upsert(r.Context(), habit.UpsertLogInput{HabitID: id, Date: today, Completed: true, Source: habit.SourceManual}); err != nil {
			writeError(w, http.StatusInternalServerError, "upsert log")
			return
		}
	}
	dates, _ := h.logs.RecentCompletedDates(r.Context(), id, today, 60)
	doneMap, _ = h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	writeJSON(w, http.StatusOK, map[string]any{"habit": habitDTO{
		ID:           hab.ID.String(),
		Name:         hab.Name,
		Icon:         hab.Icon,
		TimeOfDay:    string(hab.TimeOfDay),
		Target:       hab.Target,
		TrackContext: hab.TrackContext,
		DoneToday:    doneMap[id],
		Streak:       habit.ComputeStreak(dates, today),
		CreatedAt:    hab.CreatedAt,
	}})
}

func (h *habitsHandler) archive(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := h.habits.GetByID(r.Context(), id, u.ID); err != nil {
		writeError(w, http.StatusNotFound, "habit not found")
		return
	}
	if err := h.habits.Archive(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "archive")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func startOfDayUTC(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func decodeJSON(r *http.Request, dst any) error {
	dec := jsonNewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}
```

That `jsonNewDecoder` is a stand-in. Use `encoding/json` directly — add the import and use `json.NewDecoder`. Final `decodeJSON`:

```go
func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}
```

(Add `"encoding/json"` to the import block; remove the `jsonNewDecoder` placeholder.)

- [ ] **Step 3: Check-in handlers**

Create `cadence-api/internal/http/checkins.go`:

```go
package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/go-chi/chi/v5"
)

type checkInDTO struct {
	Date       string   `json:"date"`
	Mood       *int16   `json:"mood,omitempty"`
	SleepHours *float64 `json:"sleepHours,omitempty"`
	Note       *string  `json:"note,omitempty"`
}

type checkInHandler struct {
	repo *checkin.Repository
}

func newCheckInHandler(repo *checkin.Repository) *checkInHandler {
	return &checkInHandler{repo: repo}
}

func (h *checkInHandler) get(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	dateStr := chi.URLParam(r, "date")
	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad date — expect YYYY-MM-DD")
		return
	}
	ci, err := h.repo.Get(r.Context(), u.ID, day)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get check-in")
		return
	}
	if ci == nil {
		writeJSON(w, http.StatusOK, map[string]any{"checkIn": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"checkIn": checkInDTO{
		Date:       ci.Date.Format("2006-01-02"),
		Mood:       ci.Mood,
		SleepHours: ci.SleepHours,
		Note:       ci.Note,
	}})
}

type putCheckInRequest struct {
	Mood       *int16   `json:"mood,omitempty"`
	SleepHours *float64 `json:"sleepHours,omitempty"`
	Note       *string  `json:"note,omitempty"`
}

func (h *checkInHandler) put(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	dateStr := chi.URLParam(r, "date")
	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad date — expect YYYY-MM-DD")
		return
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var req putCheckInRequest
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Mood != nil && (*req.Mood < 1 || *req.Mood > 5) {
		writeError(w, http.StatusBadRequest, "mood must be 1-5")
		return
	}
	ci, err := h.repo.Upsert(r.Context(), checkin.UpsertInput{
		UserID: u.ID, Date: day,
		Mood:       req.Mood,
		SleepHours: req.SleepHours,
		Note:       req.Note,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "upsert")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"checkIn": checkInDTO{
		Date:       ci.Date.Format("2006-01-02"),
		Mood:       ci.Mood,
		SleepHours: ci.SleepHours,
		Note:       ci.Note,
	}})
}
```

- [ ] **Step 4: Wire into router**

Replace `cadence-api/internal/http/router.go`:

```go
package http

import (
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Verifier   auth.Verifier
	Resolver   auth.UserResolver
	Habits     *habit.Repository
	HabitLogs  *habit.LogRepository
	CheckIns   *checkin.Repository
}

func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/health", Health(deps.Pool))

	r.Route("/v1", func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.Verifier, deps.Resolver))
		r.Get("/me", GetMe)

		habits := newHabitsHandler(deps.Habits, deps.HabitLogs)
		r.Get("/habits", habits.list)
		r.Post("/habits", habits.create)
		r.Post("/habits/{id}/toggle", habits.toggle)
		r.Delete("/habits/{id}", habits.archive)

		checkIns := newCheckInHandler(deps.CheckIns)
		r.Get("/check-ins/{date}", checkIns.get)
		r.Put("/check-ins/{date}", checkIns.put)
	})

	return r
}
```

- [ ] **Step 5: Wire repos into `main.go`**

Add to `cadence-api/cmd/api/main.go` after `repo := user.NewRepository(pool)`:

```go
	habitRepo := habit.NewRepository(pool)
	habitLogRepo := habit.NewLogRepository(pool)
	checkInRepo := checkin.NewRepository(pool)
```

And extend the `cadencehttp.Deps{...}` literal:

```go
	Handler: cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:      pool,
		Verifier:  verifier,
		Resolver:  resolver,
		Habits:    habitRepo,
		HabitLogs: habitLogRepo,
		CheckIns:  checkInRepo,
	}),
```

Add imports:

```go
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
```

- [ ] **Step 6: Failing handler tests**

Create `cadence-api/internal/http/habits_test.go`:

```go
//go:build integration

package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func newTestServer(t *testing.T) (*httptest.Server, *user.User) {
	t.Helper()
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "check_ins", "habits", "users")
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: "uid-h", Email: "h@x.com", Name: "H"}}
	deps := cadencehttp.Deps{
		Pool:      pool,
		Verifier:  verifier,
		Resolver:  auth.UserResolverFromRepository(userRepo),
		Habits:    habit.NewRepository(pool),
		HabitLogs: habit.NewLogRepository(pool),
		CheckIns:  checkin.NewRepository(pool),
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "uid-h", Email: "h@x.com", DisplayName: "H"})
	return srv, &u
}

func doReq(t *testing.T, srv *httptest.Server, method, path string, body any) (int, []byte) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, srv.URL+path, &buf)
	req.Header.Set("Authorization", "Bearer anything")
	req.Header.Set("Content-Type", "application/json")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	bs, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, bs
}

func TestHabits_CreateThenList(t *testing.T) {
	srv, _ := newTestServer(t)

	status, body := doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{
		"name": "Morning run", "icon": "run", "timeOfDay": "morning",
		"target": map[string]any{"value": 30, "unit": "min"}, "trackContext": true,
	})
	if status != http.StatusCreated {
		t.Fatalf("create status %d body %s", status, body)
	}

	status, body = doReq(t, srv, http.MethodGet, "/v1/habits", nil)
	if status != http.StatusOK {
		t.Fatalf("list status %d body %s", status, body)
	}
	var listed struct {
		Habits []struct {
			Name      string `json:"name"`
			DoneToday bool   `json:"doneToday"`
			Streak    int    `json:"streak"`
		} `json:"habits"`
	}
	if err := json.Unmarshal(body, &listed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(listed.Habits) != 1 || listed.Habits[0].Name != "Morning run" {
		t.Fatalf("got %+v", listed.Habits)
	}
	if listed.Habits[0].DoneToday {
		t.Fatalf("brand-new habit should not be done today")
	}
}

func TestHabits_ToggleFlipsDoneAndStreak(t *testing.T) {
	srv, _ := newTestServer(t)
	_, body := doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{
		"name": "Run", "icon": "run",
	})
	var created struct {
		Habit struct {
			ID string `json:"id"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &created)
	id := created.Habit.ID

	status, body := doReq(t, srv, http.MethodPost, "/v1/habits/"+id+"/toggle", nil)
	if status != http.StatusOK {
		t.Fatalf("toggle status %d body %s", status, body)
	}
	var toggled struct {
		Habit struct {
			DoneToday bool `json:"doneToday"`
			Streak    int  `json:"streak"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &toggled)
	if !toggled.Habit.DoneToday || toggled.Habit.Streak != 1 {
		t.Fatalf("after first toggle: %+v", toggled.Habit)
	}

	_, body = doReq(t, srv, http.MethodPost, "/v1/habits/"+id+"/toggle", nil)
	_ = json.Unmarshal(body, &toggled)
	if toggled.Habit.DoneToday || toggled.Habit.Streak != 0 {
		t.Fatalf("after second toggle: %+v", toggled.Habit)
	}
}

func TestHabits_ArchiveRemovesFromList(t *testing.T) {
	srv, _ := newTestServer(t)
	_, body := doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{"name": "Bye", "icon": "sparkles"})
	var created struct {
		Habit struct {
			ID string `json:"id"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &created)

	status, _ := doReq(t, srv, http.MethodDelete, "/v1/habits/"+created.Habit.ID, nil)
	if status != http.StatusNoContent {
		t.Fatalf("archive status %d", status)
	}
	_, body = doReq(t, srv, http.MethodGet, "/v1/habits", nil)
	var listed struct {
		Habits []any `json:"habits"`
	}
	_ = json.Unmarshal(body, &listed)
	if len(listed.Habits) != 0 {
		t.Fatalf("expected empty list, got %v", listed.Habits)
	}
}
```

Create `cadence-api/internal/http/checkins_test.go`:

```go
//go:build integration

package http_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestCheckIn_PutThenGet(t *testing.T) {
	srv, _ := newTestServer(t)
	status, body := doReq(t, srv, http.MethodPut, "/v1/check-ins/2026-05-13", map[string]any{
		"mood": 4, "sleepHours": 7.5,
	})
	if status != http.StatusOK {
		t.Fatalf("put status %d body %s", status, body)
	}

	status, body = doReq(t, srv, http.MethodGet, "/v1/check-ins/2026-05-13", nil)
	if status != http.StatusOK {
		t.Fatalf("get status %d body %s", status, body)
	}
	var got struct {
		CheckIn struct {
			Mood       *int     `json:"mood"`
			SleepHours *float64 `json:"sleepHours"`
		} `json:"checkIn"`
	}
	_ = json.Unmarshal(body, &got)
	if got.CheckIn.Mood == nil || *got.CheckIn.Mood != 4 {
		t.Fatalf("mood: %+v", got.CheckIn.Mood)
	}
	if got.CheckIn.SleepHours == nil || *got.CheckIn.SleepHours != 7.5 {
		t.Fatalf("sleep: %+v", got.CheckIn.SleepHours)
	}
}

func TestCheckIn_GetReturnsNullWhenAbsent(t *testing.T) {
	srv, _ := newTestServer(t)
	status, body := doReq(t, srv, http.MethodGet, "/v1/check-ins/2026-05-13", nil)
	if status != http.StatusOK {
		t.Fatalf("status %d body %s", status, body)
	}
	if string(body) != "{\"checkIn\":null}\n" {
		t.Fatalf("body: %s", body)
	}
}

func TestCheckIn_PutValidatesMoodRange(t *testing.T) {
	srv, _ := newTestServer(t)
	status, _ := doReq(t, srv, http.MethodPut, "/v1/check-ins/2026-05-13", map[string]any{"mood": 9})
	if status != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", status)
	}
}
```

- [ ] **Step 7: Run tests — expect compile then PASS after handlers exist**

```bash
make test-integration 2>&1 | tail -30
```

Expected: every package green, ~10 new test cases added on top of the existing 10.

- [ ] **Step 8: Commit**

```bash
git add cadence-api/internal/http cadence-api/cmd/api/main.go
git commit -m "feat(api): habit + check-in HTTP endpoints

GET /v1/habits returns the user's live habits joined with today's
log status and a computed streak. POST /v1/habits creates one;
POST /v1/habits/:id/toggle flips today's log and returns the
updated DTO so the client can replace its row in one round-trip.
DELETE /v1/habits/:id soft-deletes. GET/PUT /v1/check-ins/:date
upserts mood + sleep with COALESCE so each tile writes independently.

PRD §11, §7."
```

---

## Task 6: README + phase checklist

**Files:**
- Modify: `cadence-api/README.md`

- [ ] **Step 1: Update phase status**

Bump the `Phase status` block to:

```markdown
- [x] Phase 1: HTTP scaffold, /health
- [x] Phase 1: Postgres dev infra + Phase 1 schema migration
- [x] Phase 1: Firebase Admin SDK + RequireAuth middleware
- [x] Phase 1: Implicit user creation + /v1/me
- [x] Phase 1: Habit + check-in CRUD endpoints
- [ ] Phase 1: Onboarding (intent, pillars, first habits)
- [ ] Phase 1: Mobile wires real data
- [ ] Phase 2+: see PRD §17
```

Add a section right above "Phase status":

```markdown
## Endpoints (Phase 1)

| Method | Path                            | Notes |
|--------|---------------------------------|-------|
| GET    | /health                         | Public; reports DB status |
| GET    | /v1/me                          | Returns the current user |
| GET    | /v1/habits                      | Live habits with `doneToday` + `streak` |
| POST   | /v1/habits                      | `{name, icon, timeOfDay, target?, trackContext}` |
| POST   | /v1/habits/:id/toggle           | Flips today's log, returns updated DTO |
| DELETE | /v1/habits/:id                  | Soft archive (sets `archived_at`) |
| GET    | /v1/check-ins/:date             | `YYYY-MM-DD`; `{checkIn: null}` if absent |
| PUT    | /v1/check-ins/:date             | Partial upsert — null fields preserved |
```

- [ ] **Step 2: Commit**

```bash
git add cadence-api/README.md
git commit -m "docs(api): endpoint reference + Phase 1 progress"
```

---

# Mobile side — `cadence-mobile`

## Task 7: API endpoints + types extension

**Files:**
- Modify: `cadence-mobile/src/lib/api/types.ts`
- Modify: `cadence-mobile/src/lib/api/endpoints.ts`
- Create: `cadence-mobile/src/lib/api/queryKeys.ts`

- [ ] **Step 1: Extend types**

Append to `cadence-mobile/src/lib/api/types.ts`:

```typescript
export type ApiTimeOfDay = 'morning' | 'midday' | 'evening' | 'anytime';

export interface ApiTarget {
  value: number;
  unit: string;
}

export interface ApiHabit {
  id: string;
  name: string;
  icon: string;
  timeOfDay: ApiTimeOfDay;
  target?: ApiTarget;
  trackContext: boolean;
  doneToday: boolean;
  streak: number;
  autoDetected: boolean;
  createdAt: string;
}

export interface ListHabitsResponse {
  habits: ApiHabit[];
}

export interface ApiCheckIn {
  date: string;
  mood?: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  note?: string;
}

export interface GetCheckInResponse {
  checkIn: ApiCheckIn | null;
}
```

- [ ] **Step 2: Endpoints**

Replace `cadence-mobile/src/lib/api/endpoints.ts`:

```typescript
import type { ApiClient } from './client';
import type {
  ApiCheckIn,
  ApiHabit,
  GetCheckInResponse,
  ListHabitsResponse,
  Me,
} from './types';

interface CreateHabitInput {
  name: string;
  icon: string;
  timeOfDay?: ApiHabit['timeOfDay'];
  target?: ApiHabit['target'];
  trackContext?: boolean;
}

export const endpoints = {
  getMe: (client: ApiClient) => () => client.request<Me>('/v1/me'),

  listHabits: (client: ApiClient) => () =>
    client.request<ListHabitsResponse>('/v1/habits').then((r) => r.habits),

  createHabit: (client: ApiClient) => (input: CreateHabitInput) =>
    client
      .request<{ habit: ApiHabit }>('/v1/habits', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      .then((r) => r.habit),

  toggleHabit: (client: ApiClient) => (habitId: string) =>
    client
      .request<{ habit: ApiHabit }>(`/v1/habits/${habitId}/toggle`, {
        method: 'POST',
      })
      .then((r) => r.habit),

  archiveHabit: (client: ApiClient) => (habitId: string) =>
    client.request<void>(`/v1/habits/${habitId}`, { method: 'DELETE' }),

  getCheckIn: (client: ApiClient) => (date: string) =>
    client
      .request<GetCheckInResponse>(`/v1/check-ins/${date}`)
      .then((r) => r.checkIn),

  putCheckIn: (client: ApiClient) => (date: string, body: Partial<Omit<ApiCheckIn, 'date'>>) =>
    client
      .request<{ checkIn: ApiCheckIn }>(`/v1/check-ins/${date}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      .then((r) => r.checkIn),
};
```

- [ ] **Step 3: Query-key registry**

Create `cadence-mobile/src/lib/api/queryKeys.ts`:

```typescript
export const queryKeys = {
  me: ['me'] as const,
  habits: ['habits'] as const,
  checkIn: (date: string) => ['check-in', date] as const,
};
```

- [ ] **Step 4: Typecheck**

```bash
cd cadence-mobile
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add cadence-mobile/src/lib/api
git commit -m "feat(mobile): API endpoints for habits + check-ins

Typed endpoint helpers that unwrap the server's envelope keys
({habits: [...]} → [...]) so call sites get the plain data.
queryKeys registry keeps TanStack Query keys in one place."
```

---

## Task 8: Today screen — real habits with optimistic toggle

**Files:**
- Modify: `cadence-mobile/app/(tabs)/index.tsx`
- Modify: `cadence-mobile/src/components/habit/HabitRow.tsx`
- Modify: `cadence-mobile/src/types/index.ts`

- [ ] **Step 1: Align types**

Edit `cadence-mobile/src/types/index.ts` — change the `Habit` interface to mirror the API and accept what HabitRow needs:

```typescript
import type { ApiTimeOfDay, ApiTarget } from '@/lib/api/types';

export type Mood = 1 | 2 | 3 | 4 | 5;
export type TimeOfDay = ApiTimeOfDay;
export type HabitSource = 'manual' | 'apple_health' | 'health_connect' | 'strava';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  timeOfDay: TimeOfDay;
  target?: ApiTarget;
  doneToday: boolean;
  streak: number;
  autoDetected: boolean;
}

export type DayState = 'past-done' | 'past-quiet' | 'today' | 'future';
export interface DayDot {
  date: string;
  weekday: string;
  state: DayState;
}

export type Insight =
  | { kind: 'pattern'; renderedText: string; emphasis?: string }
  | { kind: 'listening' };

export interface CheckIn {
  mood?: Mood;
  sleepHours?: number;
}
```

- [ ] **Step 2: HabitRow consumes the new shape**

Update `cadence-mobile/src/components/habit/HabitRow.tsx`:

- Change `useState(habit.done)` → `useState(habit.doneToday)` and the `isDone` derivation.
- Source `iconFor[habit.icon]` already handles slug → component.
- The component is otherwise unchanged.

Concretely:

```tsx
import { useEffect, useState } from 'react';
// ... existing imports ...

interface HabitRowProps {
  habit: Habit;
  onToggle?: (next: boolean) => void | Promise<void>;
}

export function HabitRow({ habit, onToggle }: HabitRowProps) {
  const [isDone, setIsDone] = useState(habit.doneToday);

  // Reconcile when server state changes (e.g., after a mutation settles).
  useEffect(() => {
    setIsDone(habit.doneToday);
  }, [habit.doneToday]);

  async function handlePress() {
    const next = !isDone;
    setIsDone(next);
    try {
      await onToggle?.(next);
    } catch {
      setIsDone(!next); // revert on failure — quiet, no alert
    }
  }
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Today screen uses TanStack Query**

Replace `cadence-mobile/app/(tabs)/index.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/primitives';
import { Screen, SectionLabel } from '@/components/layout';
import { HabitRow } from '@/components/habit';
import { InsightCard } from '@/components/insight';
import { WeekStrip, CheckInRow } from '@/components/today';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';
import { mockInsight, mockWeek } from '@/lib/mockData';
import type { ApiHabit } from '@/lib/api/types';
import type { Habit } from '@/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function toHabit(api: ApiHabit): Habit {
  return {
    id: api.id,
    name: api.name,
    icon: api.icon,
    timeOfDay: api.timeOfDay,
    target: api.target,
    doneToday: api.doneToday,
    streak: api.streak,
    autoDetected: api.autoDetected,
  };
}

export default function TodayScreen() {
  const queryClient = useQueryClient();
  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });

  const toggleMutation = useMutation({
    mutationFn: (habitId: string) => endpoints.toggleHabit(apiClient)(habitId),
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits });
      const previous = queryClient.getQueryData<ApiHabit[]>(queryKeys.habits);
      queryClient.setQueryData<ApiHabit[]>(queryKeys.habits, (current) =>
        current?.map((h) =>
          h.id === habitId ? { ...h, doneToday: !h.doneToday } : h,
        ),
      );
      return { previous };
    },
    onError: (_err, _habitId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.habits, context.previous);
    },
    onSuccess: (updated, habitId) => {
      queryClient.setQueryData<ApiHabit[]>(queryKeys.habits, (current) =>
        current?.map((h) => (h.id === habitId ? updated : h)),
      );
    },
  });

  const habits = useMemo(() => habitsQuery.data?.map(toHabit) ?? [], [habitsQuery.data]);
  const doneCount = useMemo(() => habits.filter((h) => h.doneToday).length, [habits]);

  return (
    <Screen scroll>
      <View>
        <Text className="text-body-sm text-ink-3">{greeting()}</Text>
        <Text className="text-h1 font-serif text-ink mt-0.5">{todayLabel()}</Text>
      </View>

      <View className="mt-6">
        <WeekStrip days={mockWeek} />
      </View>

      <View className="mt-6">
        <InsightCard insight={mockInsight} />
      </View>

      <SectionLabel label={`HABITS · ${doneCount} OF ${habits.length}`} />

      {habitsQuery.isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : habits.length === 0 ? (
        <View className="py-6">
          <Text className="text-body text-ink-2">
            No habits yet. Add one to begin — two is plenty for the first week.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={async () => {
                await toggleMutation.mutateAsync(habit.id);
              }}
            />
          ))}
        </View>
      )}

      <SectionLabel label="TODAY" />
      <CheckInRow checkIn={{}} />

      <View className="mt-6">
        <Button label="Add a habit" variant="ghost" onPress={() => {}} />
      </View>
    </Screen>
  );
}
```

The empty-state copy matches PRD §20 voice exemplars ("Two is plenty for the first week").

- [ ] **Step 4: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add cadence-mobile/app cadence-mobile/src
git commit -m "feat(mobile): Today reads real habits with optimistic toggle

GET /v1/habits hydrates the list. Tap → optimistic flip, mutation
fires POST /v1/habits/:id/toggle, server response replaces the row.
Empty state copy matches PRD §20 voice ('two is plenty for the
first week'). Mock week strip + insight remain until those endpoints
exist.

PRD §7."
```

---

## Task 9: CheckInRow reads today's check-in (read-only)

**Files:**
- Modify: `cadence-mobile/src/components/today/CheckInRow.tsx`
- Modify: `cadence-mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: CheckInRow accepts the API shape**

Update `cadence-mobile/src/components/today/CheckInRow.tsx`:

```tsx
import { View, Text } from 'react-native';
import { Card } from '@/components/primitives';
import type { CheckIn, Mood } from '@/types';

interface CheckInRowProps {
  checkIn: CheckIn | null;
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

function SleepSection({ sleepHours }: { sleepHours?: number }) {
  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">SLEEP</Text>
      {sleepHours !== undefined ? (
        <Text className="text-h3 font-serif text-ink">{formatSleepHours(sleepHours)}</Text>
      ) : (
        <Text className="text-body text-ink-3">—</Text>
      )}
    </View>
  );
}

export function CheckInRow({ checkIn }: CheckInRowProps) {
  const ci = checkIn ?? {};
  return (
    <Card padding="md">
      <View className="flex-row">
        <MoodSection mood={ci.mood} />
        <View className="w-px bg-hairline mx-4" />
        <SleepSection sleepHours={ci.sleepHours} />
      </View>
    </Card>
  );
}
```

- [ ] **Step 2: Today screen queries the check-in**

Add to the imports in `app/(tabs)/index.tsx`:

```tsx
import type { ApiCheckIn } from '@/lib/api/types';
```

Compute today's ISO date once near the top of `TodayScreen`:

```tsx
  const todayIso = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const checkInQuery = useQuery({
    queryKey: queryKeys.checkIn(todayIso),
    queryFn: () => endpoints.getCheckIn(apiClient)(todayIso),
  });
```

Pass it into `CheckInRow`:

```tsx
  <CheckInRow checkIn={checkInQuery.data ? {
    mood: checkInQuery.data.mood,
    sleepHours: checkInQuery.data.sleepHours,
  } : null} />
```

- [ ] **Step 3: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add cadence-mobile/src/components/today/CheckInRow.tsx cadence-mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): CheckInRow reads today's check-in from API

Read-only this pass — the mood-picker and sleep editor UI lands with
the next plan. CheckInRow gracefully handles null (no check-in yet)
by rendering empty dots and a sleep dash.

PRD §7."
```

---

## Plan complete

After Task 9:

- `make test-integration` server-side has ~20 cases green.
- Mobile typecheck clean.
- Today screen renders the user's real habits with working optimistic toggle and a live check-in tile.
- The "Add a habit" button still does nothing — next plan adds the create sheet (or onboarding handles it by seeding first habits).

Next plan candidate: **onboarding** — intent + pillars + connect-health + first-habits seed. That removes the "no habits yet" empty state by giving every fresh user 2-3 suggested habits derived from their intent + pillars.

· · ·
