# Cadence — Design System

> The aesthetic is the product's voice. Treat the visual language with the seriousness most apps reserve for code.

This document is the canonical reference for Cadence's visual language. When in doubt, this file wins over any inconsistency found in code. Reference this before adding any new component, color, or layout pattern.

---

## Contents

1. [Aesthetic philosophy](#1-aesthetic-philosophy)
2. [Color tokens](#2-color-tokens)
3. [Typography](#3-typography)
4. [Spacing & layout](#4-spacing--layout)
5. [Border radii](#5-border-radii)
6. [Shadows & elevation](#6-shadows--elevation)
7. [Iconography](#7-iconography)
8. [Component patterns](#8-component-patterns)
9. [Animation principles](#9-animation-principles)
10. [Accessibility](#10-accessibility)
11. [NativeWind setup](#11-nativewind-setup)
12. [Things we never do](#12-things-we-never-do)

---

## 1. Aesthetic philosophy

Cadence is Headspace-adjacent, not Duolingo-adjacent. Calm, earthy, considered.

**The five aesthetic commitments:**

1. **Quiet, not loud.** Saturated colors are used sparingly and only as accents. Most of the screen is paper, cream, and soft moss.
2. **Serif headlines, sans body.** Headlines feel like a journal. Body text feels like a well-designed interface.
3. **Generous whitespace.** Cards have padding. Sections have margins. Density is the enemy.
4. **No hard edges, no hard contrasts.** Border radii are present everywhere. Borders are 0.5px hairlines, not 1px lines.
5. **Earth tones, not pastels.** The palette draws from moss, sand, clay, and paper — not Instagram pastels.

If a screen feels busy, energetic, or app-like in the wrong way, return to these commitments.

---

## 2. Color tokens

The full palette. Every color used anywhere in Cadence is in this list. **Never introduce a new color without adding it here first.**

### Ink (text)

| Token | Hex | Use |
|---|---|---|
| `ink` | `#2C3528` | Primary text. Almost-black with a green undertone. |
| `ink-2` | `#5A5A52` | Secondary text. Captions, metadata. |
| `ink-3` | `#9A9A92` | Tertiary text. Labels, helper text, placeholders. |

### Surfaces

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F4F3ED` | App background. Paper-like, warm cream. |
| `bg-deeper` | `#ECE9DC` | Deeper paper. Rare; for nested surfaces. |
| `card` | `#FFFFFF` | Card background. The only pure white in the app. |
| `paper` | `#F4F3ED` | Same as bg; used inside cards for sub-sections. |
| `paper-2` | `#EAE8DE` | Slightly darker paper. For pressed states or filled inputs. |

### Borders

| Token | Hex | Use |
|---|---|---|
| `border` | `rgba(44, 53, 40, 0.08)` | Default hairline border. |
| `border-2` | `rgba(44, 53, 40, 0.16)` | Slightly stronger border. For input fields, separators. |

### Moss (primary action color)

| Token | Hex | Use |
|---|---|---|
| `moss` | `#4A5A40` | Primary action color. Buttons, active states, today's date. |
| `moss-light` | `#7A8A6F` | Lighter moss. Secondary accents, chart bars. |
| `moss-lighter` | `#A3B39A` | Lightest moss. Backgrounds of completed habit cards. |
| `moss-bg` | `#EEF1E8` | Moss tinted background. Insight cards, selected pills. |
| `moss-bg-2` | `#E3EBD9` | Slightly deeper moss tint. Gradient endpoints. |

### Sand (warning, grace, gentle attention)

| Token | Hex | Use |
|---|---|---|
| `sand` | `#F5EFDE` | Sand background. For grace days, gentle notices. |
| `sand-deep` | `#C9B380` | Deeper sand. For sand-tinted accents and bars. |
| `sand-text` | `#8A7A52` | Text on sand backgrounds. Streak pills. |
| `sand-text-deep` | `#5A4D2A` | Darker sand text. Inside sand cards. |

### Clay (retired, over-zone, warm)

| Token | Hex | Use |
|---|---|---|
| `clay` | `#D4A890` | Clay accent. For retired shoes, over-MAF bars. |
| `clay-bg` | `#F4E6DC` | Clay tinted background. |
| `clay-text` | `#6B4A36` | Text on clay backgrounds. |

### Dust tones (circle members, avatars)

Used only for differentiating people in Circle feeds and avatars. Never as primary accents.

| Token | Hex | Use |
|---|---|---|
| `dust-blue` | `#D8E0E8` | Blue dust. Avatar background. |
| `dust-blue-text` | `#3D4A55` | Text on dust-blue. |
| `dust-pink` | `#E8D8D4` | Pink dust. Avatar background. |
| `dust-pink-text` | `#6B3D3A` | Text on dust-pink. |
| `dust-cream` | `#E6DCC4` | Cream dust. Avatar background. |
| `dust-cream-text` | `#6B5A32` | Text on dust-cream. |
| `dust-lilac` | `#D8D4E2` | Lilac dust. Avatar background. |
| `dust-lilac-text` | `#4A4263` | Text on dust-lilac. |

### Color usage rules

- **One saturated color per screen, max.** That color is almost always moss. The only exception is a single accent of sand for grace days or clay for retired-shoe warnings.
- **Never use red.** Errors and warnings use sand or clay, not red. A "broken streak" does not warrant alarm-color treatment.
- **Never use blue or purple.** Even though they are calm colors, they are not in our palette. Stick to earth tones.
- **Avatars get dust colors deterministically.** Hash the user's display name to one of the four dust tones. Same person → same color, every time.

---

## 3. Typography

### Font stacks

- **Serif (headlines):** `'Iowan Old Style', 'Palatino', 'Georgia', serif`
- **Sans (body):** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (default platform sans)
- **Mono (code, when needed):** `'JetBrains Mono', 'SF Mono', 'Menlo', monospace`

**Rationale:** Iowan Old Style is on every iOS and macOS device. Palatino is the fallback on older Apple devices. Georgia is the cross-platform fallback. No webfont loading, no FOUT, no performance penalty.

### Type scale

| Token | Size | Line | Weight | Use |
|---|---|---|---|---|
| `display` | 32 / 40 | 1.1 | 500 | Splash wordmark, big stat values |
| `h1` | 24 / 28 | 1.2 | 500 | Page titles (Reflect, Circles, You) |
| `h2` | 20 / 24 | 1.25 | 500 | Section headings, recovery card title |
| `h3` | 18 / 22 | 1.3 | 500 | Card titles, habit names in detail |
| `body` | 14 / 20 | 1.5 | 400 | Default body text |
| `body-sm` | 13 / 18 | 1.55 | 400 | Card metadata, sub-text |
| `caption` | 12 / 16 | 1.5 | 400 | Helper text, run meta |
| `micro` | 11 / 14 | 1.4 | 500 | Pill text, badges |
| `eyebrow` | 11 / 14 | 1.4 | 500 | All-caps section labels (letter-spacing 0.08em) |

### Type rules

- **Serif for headlines only.** Body text and UI labels use the sans stack. The contrast between the two is part of the brand.
- **Italics are used in serif, never sans.** "The quiet rhythm of becoming" is serif italic. Body italics are reserved for direct quotes or insight emphasis.
- **Numbers in stat values use serif.** "47" as a streak count is serif. The label "current streak" below is sans.
- **All-caps for eyebrow labels only.** Letter-spaced at 0.08em. Never use all-caps for body or button text.
- **Weight 500 is the bold.** Never use 600 or 700. Cadence has no "heavy" weight.

---

## 4. Spacing & layout

### Spacing scale

Based on a 4px base unit. NativeWind classes map directly.

| Token | Value | NativeWind |
|---|---|---|
| `space-1` | 4 | `p-1`, `gap-1` |
| `space-2` | 8 | `p-2`, `gap-2` |
| `space-3` | 12 | `p-3`, `gap-3` |
| `space-4` | 16 | `p-4`, `gap-4` |
| `space-5` | 20 | `p-5`, `gap-5` |
| `space-6` | 24 | `p-6`, `gap-6` |
| `space-8` | 32 | `p-8`, `gap-8` |
| `space-10` | 40 | `p-10`, `gap-10` |
| `space-12` | 48 | `p-12`, `gap-12` |

### Layout rules

- **Screen padding:** 22px horizontal on mobile (the unusual number is on purpose — 24 felt too institutional in prototypes, 20 too cramped).
- **Card padding:** 16-20px internal padding for cards. Use 16 for small cards, 20 for hero cards.
- **Section gaps:** 22-24px between major sections inside a screen. Section labels sit 10-12px above their content.
- **Bottom nav:** 14-18px vertical padding, items spaced via `justify-around`.
- **Safe area:** always respect iOS safe areas. Top header padding is 18-20px below safe area top.

---

## 5. Border radii

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4 | Tiny tags, todo checkboxes |
| `rounded-md` | 8 | Form inputs, small cards |
| `rounded-lg` | 10 | Standard buttons, secondary cards |
| `rounded-xl` | 12 | Cards, integration tiles |
| `rounded-2xl` | 14-16 | Primary cards, hero surfaces |
| `rounded-3xl` | 18-20 | Recovery card, hero gradient cards |
| `rounded-full` | 9999 | Avatars, pills, dot indicators |
| `phone-bezel` | 24-28 | The phone bezel itself in prototypes |

**Rule:** never use sharp 90° corners on interactive elements. Even the smallest button has at least `rounded-md`.

---

## 6. Shadows & elevation

Cadence is mostly flat. Shadows are rare and always soft.

| Level | Shadow | Use |
|---|---|---|
| `flat` | none | Default. Most cards have no shadow, only a hairline border. |
| `subtle` | `0 1px 2px rgba(0,0,0,0.04)` | Floating buttons, tappable cards under finger |
| `card` | `0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(44,53,40,0.08)` | Phone bezel in prototypes; the only deep shadow |

**Rule:** if you're reaching for a shadow to make something feel important, return to the design instead. Hairline borders and proper spacing do more work than shadows.

---

## 7. Iconography

**Icon library: [Tabler Icons](https://tabler.io/icons).** Single source of truth. Available as `@tabler/icons-react-native`.

### Sizing

| Use | Size |
|---|---|
| In pills and badges | 11-12px |
| Inline with body text | 14px |
| Bottom nav | 18px |
| Standalone icon button | 20-22px |
| Hero icon (empty state, illustration) | 36-48px |

### Icon rules

- **Stroke width: 1.5px** (Tabler's default). Never override.
- **No filled icons** for actions. Outline only. Filled icons can be used for completed states (a checked habit shows a filled check inside a moss circle, but that's the circle that's filled, not the check).
- **Pair icons with text** wherever possible. Bottom nav has labels. Buttons say "Done today" not just a check.

### Approved icons by use case

| Use | Tabler icon |
|---|---|
| Today (nav) | `home` |
| Reflect (nav) | `chart-bar` |
| Circles (nav) | `users` |
| You (nav) | `user` |
| Add habit | `plus` |
| Done check | `check` |
| Running | `run` |
| Meditation/yoga | `yoga` |
| Reading | `book-2` |
| Walking | `footprint` |
| Music/practice | `music` |
| Streak flame | `flame` |
| Insight sparkle | `sparkles` |
| Pact | `knot` |
| Reaction | `flower` |
| Recovery leaf | `leaf` |
| Settings | `settings` |
| Back | `arrow-left` |
| Forward | `arrow-right` / `chevron-right` |
| Privacy/lock | `lock` |
| Sleep | `moon` |
| Mood happy | `mood-happy` |
| Heart rate | `heart-rate-monitor` |
| Shoe | `shoe` |
| Activity | `activity` |
| Apple | `brand-apple` |
| Google | `brand-google` |

If a use case isn't listed above, pick the closest Tabler icon and add it here.

---

## 8. Component patterns

The components below are the canonical building blocks. Reference these when implementing screens.

### Button — primary

```tsx
<Pressable className="bg-moss rounded-lg py-3 px-4 items-center">
  <Text className="text-white text-base font-medium">Run this morning</Text>
</Pressable>
```

- Background: `moss`
- Text: white, 14px, weight 500
- Padding: 12-13px vertical
- Border radius: `rounded-lg` (10px)
- Pressed state: `bg-moss/90`

### Button — ghost

```tsx
<Pressable className="py-2.5 items-center">
  <Text className="text-ink-2 text-sm">Use a grace day · 2 left</Text>
</Pressable>
```

- No background, no border
- Text: `ink-2`, 12-13px
- Used for secondary actions

### Pill

```tsx
<View className="bg-moss-bg border border-moss-light rounded-full px-3 py-1.5">
  <Text className="text-moss text-xs font-medium">Bad sleep</Text>
</View>
```

- Selected: `bg-moss-bg` with `moss-light` border, `moss` text
- Unselected: transparent bg with `border-2` border, `ink-2` text
- 11-12px text, weight 500

### Card

```tsx
<View className="bg-card border border-border rounded-2xl p-4">
  {/* content */}
</View>
```

- Background: `card` (white) or `paper` (warm cream)
- Border: 0.5px `border` hairline
- Border radius: `rounded-2xl` (14px)
- Padding: 16-20px

### Habit row (Today list)

```tsx
<Pressable className="flex-row items-center gap-3 bg-card border border-border rounded-xl p-3">
  <View className={done ? "bg-moss border-moss" : "border-border-2"}
        // 24x24 rounded-full check
  />
  <View className="flex-1">
    <Text className="text-base font-medium">{name}</Text>
    <Text className="text-xs text-ink-3 mt-0.5">{meta}</Text>
  </View>
  {streak && <StreakPill count={streak} />}
</Pressable>
```

### Streak pill

```tsx
<View className="bg-sand rounded-full px-2 py-0.5 flex-row items-center gap-1">
  <Flame size={11} color="#8A7A52" />
  <Text className="text-sand-text text-xs font-medium">{count}</Text>
</View>
```

### Insight card

```tsx
<View className="bg-moss-bg border-l-2 border-l-moss-light rounded-r-xl pl-4 pr-4 py-3.5">
  <View className="flex-row items-center gap-1 mb-1.5">
    <Sparkles size={12} color="#5A6A4E" />
    <Text className="text-xs uppercase tracking-wider text-moss font-medium">
      Pattern noticed
    </Text>
  </View>
  <Text className="text-sm text-ink leading-relaxed">
    You run <Text className="font-medium">2.3× more often</Text> after nights over 7 hours of sleep.
  </Text>
</View>
```

### Section label (eyebrow)

```tsx
<Text className="text-xs uppercase tracking-wider text-ink-3 font-medium mt-5 mb-3">
  Habits · 2 of 4
</Text>
```

- 11px, uppercase, letter-spacing 0.08em
- `ink-3` color
- Weight 500
- Margin top 18-22px from previous section

### Bottom nav item

```tsx
<Pressable className="items-center gap-1 px-2 py-1">
  <Home size={18} color={active ? "#4A5A40" : "#9A9A92"} />
  <Text className={`text-[10px] ${active ? "text-moss" : "text-ink-3"}`}>
    Today
  </Text>
</Pressable>
```

### Avatar

```tsx
<View
  className="rounded-full items-center justify-center"
  style={{ width: 32, height: 32, backgroundColor: dustColor }}>
  <Text className="text-xs font-medium" style={{ color: dustTextColor }}>
    {initial}
  </Text>
</View>
```

- Background: one of the four dust tones, deterministic by name hash
- Text: matching dust-text color, 12px, weight 500
- Sizes: 26 (small, in stacks), 32 (default), 40 (in member lists), 72 (profile hero)

---

## 9. Animation principles

You have a Flutter-trained eye for animation. Use it. Cadence's brand depends on motion feeling considered.

### Core principles

1. **Use Reanimated 3 worklets, not state.** Animations should run on the UI thread. If you're using `setState` inside an animation, you're doing it wrong.
2. **No JS-bridge animations.** Everything visible runs on the UI thread via worklets or Skia.
3. **Easing is `easeOut`, not `linear`.** Things slow down at the end, like physical objects. Use `Easing.bezier(0.2, 0, 0.13, 1)` as the default.
4. **Durations: short.** 150ms for tappable feedback, 240ms for screen transitions, 320ms for hero moments. Never longer.
5. **Never animate just to animate.** If a motion doesn't serve the user's understanding, drop it.

### Specific motion guidance

- **Habit check-off:** the circle fills moss in 200ms with a tiny scale bounce (1.0 → 1.1 → 1.0 over 240ms). The strikethrough on text appears at 150ms.
- **Insight card rotation:** new insight fades in (opacity 0 → 1) with a slight upward translate (8px → 0) over 280ms.
- **Recovery card breathing:** the central illustration breathes — subtle scale 1.0 → 1.03 → 1.0 over 4 seconds, looping. Use Skia for this.
- **Pact dot fill:** when a pact participant completes their share, their dot fills moss with a 200ms scale bounce and a subtle ripple.
- **Screen transitions:** push transitions are iOS-native (slide from right). Modal transitions are sheet-style from the bottom. Never use fade-in for screen navigation.
- **Splash mark:** three concentric circles draw in sequence on first launch — outer first, then middle, then inner — over 800ms total. Use Skia for the draw-on path animation.

### Things to avoid

- Confetti or particle effects (anti-brand)
- Bouncy spring physics on UI elements (we're calm, not playful)
- Skeleton screens with shimmer (use the "Cadence is listening" empty state instead)
- Hero animations across screens (overkill at this scale; standard transitions are honest)

---

## 10. Accessibility

Cadence is small but must be usable.

- **Dynamic Type:** all text scales with iOS Dynamic Type. Test at the largest accessibility size.
- **VoiceOver labels:** every interactive element has an `accessibilityLabel`. Icons are decorative (`accessibilityElementsHidden`) when paired with text.
- **Touch targets:** minimum 44x44pt. Smaller-looking elements (like the small streak pill) must have padding extending the tappable area.
- **Color contrast:** body text on bg meets WCAG AA. The moss-on-cream combo passes. The dust avatars are decorative; the initial inside meets contrast against the dust background.
- **Reduce Motion:** respect the iOS Reduce Motion setting. Disable the recovery card breathing, the insight card translate, and the pact dot bounce. Fades remain.
- **Reduce Transparency:** the moss-bg insight card has solid color fallback. No blur-behind effects in v1.

---

## 11. NativeWind setup

### tailwind.config.js

```js
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ink (text)
        ink: '#2C3528',
        'ink-2': '#5A5A52',
        'ink-3': '#9A9A92',

        // Surfaces
        bg: '#F4F3ED',
        'bg-deeper': '#ECE9DC',
        card: '#FFFFFF',
        paper: '#F4F3ED',
        'paper-2': '#EAE8DE',

        // Moss (primary)
        moss: '#4A5A40',
        'moss-light': '#7A8A6F',
        'moss-lighter': '#A3B39A',
        'moss-bg': '#EEF1E8',
        'moss-bg-2': '#E3EBD9',

        // Sand
        sand: '#F5EFDE',
        'sand-deep': '#C9B380',
        'sand-text': '#8A7A52',
        'sand-text-deep': '#5A4D2A',

        // Clay
        clay: '#D4A890',
        'clay-bg': '#F4E6DC',
        'clay-text': '#6B4A36',

        // Dust (avatars, circle members)
        'dust-blue': '#D8E0E8',
        'dust-blue-text': '#3D4A55',
        'dust-pink': '#E8D8D4',
        'dust-pink-text': '#6B3D3A',
        'dust-cream': '#E6DCC4',
        'dust-cream-text': '#6B5A32',
        'dust-lilac': '#D8D4E2',
        'dust-lilac-text': '#4A4263',
      },
      fontFamily: {
        serif: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(44, 53, 40, 0.08)',
        '2': 'rgba(44, 53, 40, 0.16)',
      },
      letterSpacing: {
        eyebrow: '0.08em',
      },
    },
  },
  plugins: [],
};
```

### Component file structure

```
src/
  components/
    primitives/        # Button, Card, Pill, Avatar, Icon
    habit/             # HabitRow, HabitDetail, CreateHabit
    circle/            # CircleCard, PactCard, FeedItem, Reaction
    insight/           # InsightCard, ScatterPlot, Heatmap
    recovery/          # RecoveryMoment, GraceCard
    running/           # WeekCard, MAFCard, RunRow, ShoeRow
    layout/            # Screen, Header, BottomNav, Section
  screens/
    today/
    reflect/
    circles/
    you/
    habit-detail/
    onboarding/
    running/
    run-detail/
```

---

## 12. Things we never do

The non-goals of the design system. These are as important as the dos.

- **No red.** Errors, warnings, deletions never use red. Use sand for warnings, clay for "over-zone," ink-2 for muted destructive actions.
- **No emoji as UI.** Mood is a 5-dot scale, not 😢 😐 😊. Reactions are a flower icon, not 👍.
- **No gradients on text.** No "rainbow" or shifting gradients on titles. The serif on a calm background is enough.
- **No drop shadows on text.** Ever.
- **No glassmorphism, neumorphism, or skeuomorphism.** Cadence is flat with hairlines.
- **No badges with numbers > 99.** If you're showing "127," you're already wrong somewhere.
- **No "PRO" labels visible to users in v1.** Monetization is deferred. Don't pre-design a paywall UX.
- **No progress bars that fill to 100% with celebration.** Cadence does not celebrate completion in a Duolingo way. Progress is shown as collective dots, not bars.
- **No animated emoji or stickers.** No Lottie animations. If a motion exists, it's coded in Reanimated or Skia.
- **No dark mode in v1.** Cadence is a light-mode app. Dark mode is v2 territory. The single exception is the splash screen, which is dark moss `#2C3528` background.

---

## A closing note

The visual system is the product's voice. A new component that violates these tokens is a bug, not a feature. When you find yourself reaching for a new color, a new shadow, a new icon style — return here first.

If something is genuinely needed that's not in this document, add it here. The system grows, but only through this file.

· · ·
