# Design System

Last updated: 2026-02-26

## Philosophy

**"Ink & Momentum"** — every interaction feels like writing a wish on paper and watching it come to life. Pen strokes are confident, fluid, irreversible in feeling but forgivable in practice.

## Design Principles (Non-Negotiable)

1. **Canvas + Result** — 2 sliding views only. No multi-step wizard.
2. **Ink Rule** — Accent color (`--ac`) earned, not given. See table below.
3. **3 Type Voices** — Emotional, Structural, Data. See typography section.
4. **Motion Grammar** — Spring for user, ease for system. See motion section.
5. **Cultural Personality** — Themes change palette + textures + terminology + audio + border/shadow depth.

## Ink Rule (Color Discipline)

The most important visual rule. Restraint creates hierarchy.

| Accent (`--ac`) Allowed | Always Neutral (grayscale) |
|-------------------------|---------------------------|
| Score ring fill stroke | All detail badges |
| Restaurant name heading | Score tile backgrounds |
| Active CTA buttons (primary) | Google stars (`--star-gold`) |
| Selected filter pills (`aria-checked`) | Atmosphere tags |
| Logo pin dot | Navigation tile, quick links |
| Input caret | Insider tip callout |
| Petal radar (8% fill, 25% stroke) | Secondary buttons |

RAG colors (`--rag-green`, `--rag-amber`, `--rag-red`) are universal and theme-independent.

## Typography

| Voice | Font | Role | CSS Class |
|-------|------|------|-----------|
| Emotional | Playfair Display | Prompts, greetings, headings | `.type-emotional` |
| Structural | Inter | Buttons, labels, navigation, body | `.type-structural` |
| Data | JetBrains Mono | Scores, tags, badges, metadata | `.type-data` |

## Motion Grammar

| Trigger | Curve | Duration |
|---------|-------|----------|
| User-initiated | `var(--spring)` = `cubic-bezier(0.34, 1.56, 0.64, 1)` | 400-500ms |
| System reveal | `var(--ease-out)` = `cubic-bezier(0.4, 0, 0.2, 1)` | 300-600ms |
| Score animation | Spring easing | 1200ms |
| Reduced motion | `none` / instant | 0ms |

All duration tokens in `css/tokens.css` (`--dur-instant` through `--dur-score`) auto-zero under `prefers-reduced-motion: reduce`.

## Themes (5 x 2 = 10 variants)

| ID | Display Name | Hue | Scope |
|----|-------------|-----|-------|
| `neutral` | Studio | 18deg terracotta | Western, European, American, Global |
| `indian` | Desi | 28deg marigold | South Asian |
| `middleeastern` | Bazaar | 48deg gold | Middle Eastern + Mediterranean + North African |
| `japanese` | Zen | 220deg indigo | Pan-Asian |
| `southamerican` | Sabor | 350deg chili | Latin + Caribbean |

Applied via `data-theme` + `data-mode` on `<html>`. Auto-theme on typing (cuisine keywords trigger culture preview). Each culture has unique labels, smart chips, greetings, audio frequencies, textures, and ambient blob speeds.

Theme switch: radial clip-path wash transition from cycle button origin.

Legacy migration: nepalese→indian, eastasian→japanese, african→neutral.

### What Themes Change Beyond Color

Border radius (sharp for Zen, rounded for Sabor), shadow depth, glass/blur intensity, textile SVG patterns, UI labels via `THEME_LABELS` in `js/theme.js`, Web Audio oscillator params, ambient blob colors/speeds/opacity.

## Breakpoints

`320px` (min) → `375px` (primary mobile) → `500px` max-h (virtual keyboard) → `768px` (tablet) → `1024px` (desktop) → `2560px` (max UHD)

All use `clamp()` for fluid scaling. Mobile-first `min-width` media queries.

## Score Display

- **Match (0-100):** 90+ "Outstanding" | 85-89 "Excellent" | 75-84 "Solid Pick" | 60-74 "Worth a Try" | <60 "Adventurous"
- **Vibe Radar (6 axes):** date, group, family, business, solo, gem — teardrop petals, accent 8%/25%. Hidden if <3 dimensions.
- **Bloom cycle:** compact ring → petal radar → V2 bars → compact (tap to cycle)
- **Sentiment:** 4px RAG bar, defaults 33/33/34 when no data
- **Glyph bar:** 32px spring-pop icons (price as monospace text, noise/ambiance context-mapped)
- **Google rating:** Stars + numeric + count. Links to Maps. Always `--star-gold`.

## Progressive Reveal Timing

Blocks stagger: 0/120/240/360/480ms. Score ring: 800ms. Sentiment: 800ms. Google: 900ms. Petals: 400ms + 80ms stagger. Glyphs: 500ms + 50ms stagger.

## Accessibility (WCAG 2.1 AA)

- Skip nav, `<main>` landmark, `aria-live` announcements
- `radiogroup` + `radio` pills, `switch` + `aria-pressed` toggles
- Focus management on view transitions, `:focus-visible` outlines
- `prefers-reduced-motion`: all durations → 0ms
- Full keyboard nav across all 10 theme variants
- Touch targets >= 44x44px on mobile

## Keyboard Shortcuts

`/` focus craving | `T` toggle color mode | `F` toggle filters | `R` try again | `Escape` close modal | Arrows navigate pills

## Spatial Logic

Left = past (back), Right = future (forward), Up = reveal (modals), Down = dismiss (close). Cards dismissed go down or left, new content enters from right.

## Enforcement

The `/frontenddesign` skill (`.claude/skills/frontenddesign/SKILL.md`) auto-enforces these rules during code review. See SKILL.md for the full component checklist.
