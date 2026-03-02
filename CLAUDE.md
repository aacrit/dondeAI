# DondeAI Frontend

Last updated: 2026-03-02

AI restaurant recommendations for Chicago. One craving in, one perfect spot out.

## Session Protocol (Token Minimization)

1. **Read MD files first** — `CLAUDE.md` → `docs/DESIGN-SYSTEM.md`. These contain all context needed for most tasks.
2. **Read code on demand** — Only open source files when you need to modify or inspect specific sections. Use Grep/Glob to find exact locations.
3. **Use the doc index below** — Each doc covers a specific domain. Only read what's relevant to your task.

## Documentation Index

| Doc | When to read |
|-----|-------------|
| `docs/DESIGN-SYSTEM.md` | UI, animation, layout, theme, or visual tasks |
| `docs/FEATURES.md` | Feature status, what's implemented vs planned |
| `docs/TEST-CRITICAL.md` | Quick 10-item smoke test before pushing |
| `docs/TEST-CASES.md` | Full manual test matrix |

## Architecture — v11 "One Input, Instant Depth"

### Core Concept: Morphing Surface

No pages, no routing. One `<main id="surface">` element morphs between 4 phases via `data-phase` attribute:

| Phase | Header | Body |
|-------|--------|------|
| `idle` | Expanded (centered input + prompt + history) | Empty |
| `loading` | Collapsed (query text + ✕) | Ink ripple |
| `result` | Collapsed (query text + ✕) | Scrollable result card |
| `error` | Collapsed (query text + ✕) | Error message + retry |

### State Machine

```
IDLE → (Enter) → LOADING → (success) → RESULT
                          → (error)   → ERROR → (retry) → LOADING
RESULT → (Try Another + queue) → RESULT (swap)
RESULT → (Try Another + empty) → LOADING (new API)
RESULT → (✕ / Start Over) → IDLE
ERROR  → (✕) → IDLE
```

### File Structure

```
index.html          — Semantic markup (morphing surface)
css/
  tokens.css        — Design tokens (spacing, type, motion, z-index)
  reset.css         — CSS reset
  themes/           — 5 culture theme files (neutral, indian, japanese, etc.)
  app.css           — Phase-based layout + components
  animations.css    — Keyframes (ink ripple, card swap, score count-up)
js/
  app.js            — Phase state machine orchestrator
  state.js          — Pub/sub store (phase-based)
  input.js          — Input handling, filter strip, history
  render.js         — Tier 1 + Tier 2 result card rendering
  queue.js          — Ranked queue, try another, feedback
  api.js            — API client (fetchRecommendation, sendFeedback)
  theme.js          — Theme engine (5 cultures × 2 modes)
  utils.js          — SVG icons, score helpers, greetings
  persistence.js    — localStorage CRUD
  voice.js          — Web Speech Recognition
  audio.js          — Theme-aware sounds
  auth.js           — Supabase auth
_archive/v10-frontend/ — Previous v10 frontend (archived)
```

### Click Count

| Path | Clicks |
|------|--------|
| Basic search → result | **1** (type + Enter) |
| With filters | **2** (type + tap filter + Enter) |
| Try Another | **1** (button) |
| Deep details | **0** (scroll) |
| New search | **1** (tap ✕ + type + Enter) |

## Design Philosophy — "Ink & Momentum"

**Core idea:** Every interaction feels like writing a wish on paper and watching it come to life.

### v11 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UX model | Morphing surface (no routing) | Minimum clicks to result |
| Score display | SVG ring + RAG colors | Instant quality signal |
| Tier 1 | Photos → Score + Name → Blurb → Tip → Actions | Content-first |
| Tier 2 | Glyphs → Rating → Factor bars → Known for → Details → Hours | Scroll to reveal |
| Filters | Hidden by default, inline chips | Don't gate the path |
| Loading | Ink ripple (400ms loop) | No skeleton, no carousel |
| Try Another | Button only (no swipe) | Explicit |
| History | Recent searches on home | Quick re-search |
| Card swap | 300ms slide left/right | Queue of 5 |

### Animation Rules

| Pattern | Duration | Easing |
|---------|----------|--------|
| Header morph | 300ms | var(--ease-out) |
| Ink ripple | 2s loop | ease-in-out |
| Result fade-in | 300ms | var(--ease-out) |
| Card swap out/in | 300ms | var(--ease-out) |
| Score count-up | 1200ms | cubic ease-out |
| Bottom sheet | 300ms | var(--ease-out) |

## Skill

**`/frontenddesign`** — auto-activates on UI/animation/layout tasks. See `.claude/skills/frontenddesign/SKILL.md`.

## API Contract (Immutable)

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
Authorization: Bearer <supabase-anon-key>
apikey: <supabase-anon-key>
Timeout: 15s (AbortController)
```

Request: `{ special_request, occasion, neighborhood, price_level, exclude[], dietary_restrictions[], user_id, feedback, time_of_day, open_now }`

Key response fields: `{ success, restaurant{...}, recommendation, insider_tip, donde_match(0-99), scoring_v7{ food, vibe, service, reputation, convenience }, match_narrative{ summary }, ranked_queue[{ rank, restaurant, donde_match, scoring_v7 }], deep_context, tags[] }`

## State Shape (`state.js`)

```js
{ phase, craving,
  filters: { occasion, neighborhood, priceLevel, dietaryRestrictions, openNow },
  result, error, excludeIds,
  rankedQueue: [], rankedQueueIndex: 0,
  theme: { culture, mode }, colorMode, soundEnabled,
  history, pendingFeedback, user, isAuthenticated }
```

## Run

Open `index.html` in browser. No build step, no dependencies, no env vars.

## Coding Standards

- **HTML:** Semantic, `data-phase` surface, all interactives focusable
- **CSS:** Custom properties only, mobile-first `min-width`, `clamp()` fluid, no `!important`
- **JS:** ES modules, plain objects + functions, `requestAnimationFrame`, cached DOM queries, `AbortController`, no circular deps
- **Motion:** Duration tokens from `tokens.css`, all → 0ms under `prefers-reduced-motion`. Spring for user, ease-out for system.
- **Z-index:** `--z-base`(1) → `--z-sheet`(200)
- **RAG colors:** `--rag-green`(≥80), `--rag-amber`(≥60), `--rag-red`(<60) — theme-independent

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus input |
| `Enter` | Submit search |
| `Escape` | Go back / close |
| `T` | Cycle theme (idle) |
| `F` | Toggle filters (idle) |
| `R` | Try another (result) / Retry (error) |
