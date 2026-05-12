# Cadence — Asset Brief

> Brief for the AI designer (or any human designer) producing brand and app assets for Cadence. Self-contained — everything they need is in this file plus the linked references.

**Related docs (do not need to read all, but they're authoritative):**
- [`PRD.md`](PRD.md) §1 (vision), §4 (audience), §20 (voice)
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — §1 aesthetic, §2 colors, §9 motion, §12 anti-patterns

---

## The product in one paragraph

Cadence is a calm, earth-toned habit tracker built first for runners who think — MAF-trained aerobic-base athletes who care about training honestly. It correlates what you do with how you slept and how you feel, and surfaces those patterns as plain-English insights. Headspace-adjacent, not Duolingo-adjacent. Light mode only in v1.

## The brand mark

**Three concentric circles** — outer, middle, inner. Symbolizes rhythm. Per `DESIGN_SYSTEM.md` §9, on first launch these draw on in sequence (outer → middle → inner, ~800ms total) using Skia. The static icon should look like the final state of that animation.

No "C" letterform. No mascot. No characters. The mark is the rhythm itself.

## Hard rules (do not violate)

- **No red.** Cadence has no red anywhere — never use it, even as an accent.
- **No gradients.** Solid colors only. No background gradient on the icon, no ring gradient.
- **No drop shadows on the mark.** Hairline borders and spacing do the work.
- **No inner glow, no halo, no neon.** This is earth tones, not 80s sci-fi.
- **No emojis, no mascots, no characters.** Not even subtle ones.
- **No "C" letterform anywhere.** The mark is geometric, not typographic.
- **No additional decorative motifs** — no leaves, waves, abstract shapes around the rings.

## Color palette (use these exactly)

| Token | Hex | Use in assets |
|---|---|---|
| **moss-ink** | `#2C3528` | App icon background; splash screen background |
| **moss** | `#4A5A40` | Primary mark on cream backgrounds (wordmark, marketing) |
| **moss-light** | `#7A8A6F` | Reserved (not used in v1 assets) |
| **moss-lighter** | `#A3B39A` | Ring strokes on dark backgrounds (icon, favicon) |
| **paper / cream** | `#F4F3ED` | Splash mark, inner-circle fill on dark, Android adaptive background |
| **card / white** | `#FFFFFF` | Reserved (not used in v1 assets) |

---

## Asset list

Listed in priority order. File names match what `app.json` references — drop the files into `cadence-mobile/assets/` and they'll be picked up.

### 1. App icon — `cadence-mobile/assets/icon.png`

- **Dimensions:** 1024×1024 PNG
- **Background:** Solid `#2C3528` (moss-ink). Edge-to-edge — iOS applies the rounded-corner mask itself.
- **Mark:** Three concentric circles, centered, occupying **~60%** of canvas
  - **Outer ring:** 1.5px stroke `#A3B39A` (moss-lighter)
  - **Middle ring:** 1.5px stroke `#A3B39A`
  - **Inner circle:** filled `#F4F3ED` (paper cream)
- **Spacing:** Equal radial spacing between rings (~10% of icon size between each)
- **No text. No subtitle. No company name.**

### 2. Adaptive icon foreground — `cadence-mobile/assets/adaptive-icon.png`

- **Dimensions:** 1024×1024 PNG with **transparent background**
- **Mark:** Same three-ring motif, **enlarged** to occupy ~70% of Android's central safe zone (the safe zone is the central 66% of the image; the mark itself ends up roughly the central 46% of the full canvas)
- **Strokes:** Same as the app icon — 1.5px `#A3B39A` rings, filled `#F4F3ED` inner circle
- **No background color in the PNG** — Android's adaptive icon background `#F4F3ED` is set in `app.json` and surrounds the foreground

### 3. Splash mark — `cadence-mobile/assets/splash-icon.png`

- **Dimensions:** 1024×1024 PNG, transparent background
- **Background context:** The splash screen background is `#2C3528` (set in `app.json`)
- **Mark:** Three concentric circles, centered
  - **Outer ring:** 1.5px stroke `#F4F3ED` (paper cream — high contrast against the dark splash)
  - **Middle ring:** 1.5px stroke `#F4F3ED`
  - **Inner circle:** filled `#F4F3ED`
- **Proportions:** Identical to the app icon (~60% of canvas)
- **Note:** This static image is the *final* state of the Skia draw-on animation. The animation draws each ring sequentially; the PNG just captures the resting frame.

### 4. Favicon — `cadence-mobile/assets/favicon.png`

- **Dimensions:** 32×32 PNG
- **Background:** Solid `#2C3528` (moss-ink), edge-to-edge
- **Mark:** Simplified — the middle ring drops away (too cramped at this size)
  - **Outer ring:** 1px stroke `#A3B39A` (moss-lighter)
  - **Center dot:** filled circle, 4px diameter, `#F4F3ED` (paper cream)
- **Web only.** Not seen by mobile users.

### 5. Brand mark — vector — `docs/brand/mark.svg` (new directory)

- **Dimensions:** 240×240 viewBox SVG
- **Two variants required** (deliver both files):
  - **`mark-on-cream.svg`** — rings in `#4A5A40` (moss), inner fill in `#4A5A40`. Use on cream/paper surfaces.
  - **`mark-on-ink.svg`** — rings in `#F4F3ED`, inner fill in `#F4F3ED`. Use on moss-ink surfaces.
- **Geometry:** Match the icon proportions exactly so the mark feels coherent across contexts.
- **Used for:** landing page, README, GitHub social card, About screen (future).

### 6. Wordmark — `docs/brand/wordmark.png` + `docs/brand/wordmark.svg`

- **Dimensions:** 480×120 (PNG) and matching viewBox SVG
- **Type:** "Cadence" set in **Iowan Old Style**, 64px, weight 500
- **Color:** `#2C3528` (moss-ink) on transparent background
- **Letter-spacing:** Default (do not track-out the letters — Iowan's natural spacing is intentional)
- **No symbol next to it** — the wordmark is text-only. Pair with the brand mark manually in compositions.
- **Used for:** landing page hero, README header.

### 7. Bonus — GitHub social card — `docs/brand/social-card.png`

- **Dimensions:** 1280×640 PNG (GitHub social preview size)
- **Background:** Solid `#F4F3ED` (paper cream)
- **Composition:**
  - Brand mark (cream variant, ~200px) on the left, centered vertically
  - Wordmark "Cadence" to the right of the mark (Iowan Old Style 96px, `#2C3528`)
  - Below the wordmark in `#5A5A52` (ink-2), Iowan Old Style italic 28px: "The quiet rhythm of becoming."
- **Generous padding** — at least 120px on all sides
- No additional graphics. No grid, no dots, no texture.

---

## Delivery format

For each asset, deliver:

1. **PNG** at the exact dimensions specified above (24-bit color, sRGB color space).
2. **Source file** if the designer's workflow produces one (Figma export, Illustrator AI, Procreate, etc.) — saved at `docs/brand/source/` for future edits.
3. **No JPEGs.** Mark assets are flat-color and must be lossless.

File destinations:

```
cadence-mobile/assets/
  icon.png              # asset 1
  adaptive-icon.png     # asset 2
  splash-icon.png       # asset 3
  favicon.png           # asset 4

docs/brand/
  mark-on-cream.svg     # asset 5a
  mark-on-ink.svg       # asset 5b
  wordmark.png          # asset 6
  wordmark.svg          # asset 6
  social-card.png       # asset 7
  source/               # optional editable source files
```

## Acceptance checklist for each delivery

- [ ] Exact pixel dimensions per spec above
- [ ] Color values match the palette table — no eyeballed approximations
- [ ] No gradients, no shadows, no glows, no inner strokes
- [ ] No red anywhere
- [ ] No text, mascot, or character motifs
- [ ] No "C" letterform inside the brand mark
- [ ] PNG with sRGB color profile
- [ ] Mark proportions consistent across icon, adaptive icon, splash, and SVG (same ring spacing ratios)

---

## After delivery

When the assets land in `cadence-mobile/assets/`, run:

```bash
cd cadence-mobile
bunx expo prebuild --clean
bunx expo run:ios
```

The new brand mark will replace the placeholder Expo icon on first install.

· · ·
