# Frontend Architecture

Last updated: 2026-03-05

## Tech Stack

Vanilla HTML/CSS/JS, ES modules (`type="module"`), no build step. Custom pub/sub store (`js/state.js`). 2-view sliding cockpit (`js/router.js`). 5 cultures × 2 modes = 10 CSS theme variants. Backend: Supabase Edge Function V9.

## File Tree

```
index.html              # SPA entry (loads all CSS, then JS modules)
css/
  reset.css             # Box-sizing, margin, safe-area
  tokens.css            # Custom properties (spacing, type, motion, z-index, RAG colors)
  typography.css        # .type-emotional, .type-structural, .type-data
  layout.css            # .app, .cockpit, .step-track, .step, .header, .back-btn
  components.css        # All component styles (~5500 lines, largest file)
  animations.css        # @keyframes, score-ring, card-swap, ink transitions
  responsive.css        # min-width breakpoints (375, 768, 1024, 1440, 2560)
  themes/               # neutral.css, indian.css, middleeastern.css, japanese.css, southamerican.css
js/
  app.js                # Orchestrator (~3800 lines): init, event delegation, rendering, loading flow
  state.js              # Pub/sub: getState(), setState(patch), subscribe(fn)
  router.js             # Canvas↔Result via translateX
  api.js                # Supabase client + V9 response normalization
  animations.js         # Score hero ring, factor bars, particles
  theme.js              # Theme engine + labels + wash transition
  audio.js              # Web Audio chimes per culture
  voice.js              # Web Speech Recognition
  share.js              # 8-channel share sheet + canvas card
  persistence.js        # localStorage + server sync
  accessibility.js      # Focus, announcements, keyboard shortcuts
  offline.js            # Connectivity detection
  utils.js              # 50+ SVG icons, cuisine mapper, score threshold functions
  auth.js               # Supabase Auth (Google SSO)
```

## Module Graph

```
index.html → js/app.js (imports all)
  ├── state.js, router.js, persistence.js, theme.js, audio.js
  ├── voice.js, animations.js, share.js, offline.js
  ├── accessibility.js, api.js, auth.js, utils.js
```

No circular dependencies. Each module exposes `init*()` called once at boot.

## CSS Load Order

`reset` → `tokens` → `themes/*` → `layout` → `typography` → `components` → `animations` → `responsive`

## Event System

Single delegation handler on `document` via `data-action` attributes. All interactions route through `switch(btn.dataset.action)` in `app.js`.

## V10 Loading Flow

1. `beginCanvasFold()`: Add `canvas-layout--morphing` (400ms inkDissolve), then `goToStep(1)` at 400ms
2. API fetch runs concurrently
3. `manifestResult()`: Render DOM, fade card in (300ms ease-out), score count-up (1200ms)
4. `settleResult()`: Clean canvas morph class at 800ms

**Removed in V10:** `renderScaffold()`, `startScaffoldPulse()`, `startPhraseCarousel()`, `wordGroupReveal()`, staggered manifest reveals.

## Try Again Flow (Ranked Queue)

1. API returns `ranked_queue` (top 2-5 pre-computed)
2. Try Again: if queue has items → instant render (no API call)
3. Card swap: `swapping-out` (300ms) → render → `swapping-in` (300ms) → score count-up at 300ms
4. Queue exhausted → API call with current excludeIds

## Canvas History (V10 "Your Spots")

Single unified section combining recent searches (clock icon), saved spots (heart), visited spots (check). Max 6 items. Rendered by `renderYourSpots()`.

**Replaced:** separate `renderTasteMemory()`, `renderSavedSpots()`, `renderVisitedSpots()`.

## Key Functions in app.js (search by name)

| Function | Purpose |
|----------|---------|
| `beginCanvasFold()` | Start canvas→result transition |
| `manifestResult(data)` | Render result + fade in card |
| `reverseCanvasFold()` | Error/back during loading |
| `unfoldResultToCanvas()` | Animated back navigation |
| `renderResult(data)` | Populate all DOM elements |
| `renderPhotos(data)` | Scroll strip photos |
| `renderKnownFor(data)` | Inline pills in Tier 2 |
| `renderYourSpots()` | Unified canvas history |
| `animateScoreCountUp($el, score)` | RAG-colored count-up |

## Performance Patterns

- DOM queries cached at module scope
- `will-change: transform` only on `.step-track` during transitions
- Animation timers tracked and cleared on re-render
- `AbortController` cancels in-flight fetch on back navigation
- Reduced-motion: all durations → 0ms, rings skip to final state
