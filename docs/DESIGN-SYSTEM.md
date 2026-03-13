# Design System

Last updated: 2026-03-13

## Philosophy — "Ink & Momentum"

Every interaction feels like writing a wish on paper and watching it come to life. Pen strokes are confident, fluid, irreversible in feeling but forgivable in practice.

## Design Principles

1. **Canvas + Result** — 2 sliding views only. No multi-step wizard.
2. **Ink Rule** — Accent color (`--ac`) earned, not given. See table below.
3. **3 Type Voices** — Emotional (Playfair), Structural (Inter), Data (JetBrains Mono).
4. **Motion Grammar** — Spring for user, ease for system. Symmetric open/close.
5. **Cultural Personality** — 5 themes change palette + textures + terminology + audio.
6. **Content-First** — Remove anything that duplicates or doesn't add user value.

## Ink Rule (Color Discipline)

| Accent (`--ac`) Allowed | Always Neutral (grayscale) |
|-------------------------|---------------------------|
| Score ring fill stroke | All detail badges |
| Restaurant name heading | Score tile backgrounds |
| Active CTA, selected pills | Google stars (`--star-gold`) |
| Logo pin dot, input caret | Navigation tile, quick links |
| | Insider tip, secondary buttons |

RAG colors (`--rag-green/amber/red`) are universal, theme-independent.

## RAG Score System (V10)

| Threshold | Color | Verdict |
|-----------|-------|---------|
| ≥80 | `--rag-green` | Outstanding / Excellent |
| ≥60 | `--rag-amber` | Solid Pick / Worth a Try |
| <60 | `--rag-red` | Adventurous |

Applied to: score ring stroke, score number, verdict text. Consistent across Tier 1 (match-mini) and Tier 2 (score-hero).

## Typography

| Voice | Font | Role | CSS |
|-------|------|------|-----|
| Emotional | Playfair Display | Prompts, greetings, headings | `.type-emotional` |
| Structural | Inter | Buttons, labels, nav, body | `.type-structural` |
| Data | JetBrains Mono | Scores, tags, badges | `.type-data` |

## Motion Grammar

### Duration Tokens (`tokens.css`)

`--dur-instant`(0) → `--dur-fast`(150) → `--dur-normal`(300) → `--dur-morph`(400) → `--dur-step`(450) → `--dur-slow`/`--dur-advance`/`--dur-ink`(600) → `--dur-score`(1200)

All → 0ms under `prefers-reduced-motion: reduce`.

### Animation Symmetry (V10 — enforced)

Every open/close, in/out, show/hide transition uses **identical duration and easing** in both directions:

| Pattern | Duration | Easing | Notes |
|---------|----------|--------|-------|
| Step track | 450ms | var(--spring) | Canvas ↔ Result |
| Filter drawer | 300ms | var(--ease-out) | Open = close |
| Tier 2 expand | 450ms | var(--ease-out) | max-height + opacity aligned |
| Card swap | 300ms | var(--ease-out) | Out = In |
| Canvas morph | 400ms | var(--ease-out) | inkDissolve ↔ inkRestore mirrored (20px) |
| Back button | 300ms | var(--spring) | opacity + transform aligned |
| Score count-up | 1200ms | cubic ease-out | Only brand animation during loading |

**Sequencing rule:** Canvas morph completes (400ms) before step slide begins. No overlapping animations.

### Easing Reference

| Trigger | Curve | Variable |
|---------|-------|----------|
| User-initiated | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `var(--spring)` |
| System reveal | `cubic-bezier(0.4, 0, 0.2, 1)` | `var(--ease-out)` |

### Spring Physics (Motion One)

Real spring animations via Motion One CDN (`js/spring.js`). Named presets:

| Preset | Stiffness | Damping | Use |
|--------|-----------|---------|-----|
| `snappy` | 500 | 30 | Buttons, toggles |
| `smooth` | 300 | 25 | Cards, panels |
| `gentle` | 200 | 20 | Page transitions |
| `bouncy` | 400 | 15 | Celebrations, pops |
| `score` | 120 | 14 | Score ring fill |

## V10 Result Card Layout

### Tier 1 (Glance — visible immediately)
Photos (scroll strip) → Score ring + Name → Recommendation blurb → Address + Actions → Show More → Footer

**Removed from Tier 1:** Match headline, signal chips, one-liner, quick tags.

### Tier 2 (Lean-in — behind "Show More")
Score Hero (full ring) → Factor bars → Known For (inline pills) → Story extras → Profile facts

### Loading Flow
1. Canvas elements dissolve (inkDissolve, 400ms)
2. Step track slides to result (450ms spring, starts at 400ms)
3. Card fades in as unit (300ms ease-out) when data arrives
4. Score counts up (1200ms) — only animated element

**Removed:** Scaffold skeleton, phrase carousel, progress ink, staggered manifest, word-group reveal.

### Footer (2-row compact)
Row 1: Going + Try Another (equal width)
Row 2: Feedback icons + Start Over

## Themes (5 cultures × 2 modes)

| ID | Name | Hue | Scope |
|----|------|-----|-------|
| `neutral` | Studio | 18° terracotta | Western, European, American |
| `indian` | Desi | 28° marigold | South Asian |
| `middleeastern` | Bazaar | 48° gold | Middle Eastern, Mediterranean |
| `japanese` | Zen | 220° indigo | Pan-Asian |
| `southamerican` | Sabor | 350° chili | Latin, Caribbean |

Applied via `data-theme` + `data-mode` on `<html>`. Auto-theme on typing. Wash transition: radial clip-path from cycle button.

Themes change: palette, border-radius, shadow depth, glass/blur, textile SVG patterns, UI labels, audio frequencies, ambient blob speeds.

## Breakpoints

`320px` (min) → `375px` (primary mobile) → `768px` (tablet) → `1024px` (desktop) → `2560px` (max)

All use `clamp()` fluid scaling. Mobile-first `min-width`.

## Accessibility (WCAG 2.1 AA)

- Skip nav, `<main>` landmark, `aria-live` announcements
- `radiogroup` pills, `switch` toggles, `:focus-visible` outlines
- `prefers-reduced-motion`: all durations → 0ms
- Touch targets ≥ 44×44px. Keyboard: `/` focus, `T` mode, `F` filters, `R` retry, `Esc` close

## Spatial Logic

Left = past, Right = future, Up = reveal, Down = dismiss.

## Enforcement

`/frontenddesign` skill auto-enforces during code review. See `.claude/skills/frontenddesign/SKILL.md`.
