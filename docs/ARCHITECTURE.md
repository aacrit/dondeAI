# Frontend Architecture

Last updated: 2026-03-13

## Tech Stack

Vanilla HTML/CSS/JS, ES modules (`type="module"`), no build step. Custom pub/sub store (`js/state.js`). 2-view sliding cockpit (`js/router.js`). 5 cultures × 2 modes = 10 CSS theme variants. Backend: Supabase Edge Function V11.

## File Tree

```
index.html              # SPA entry (loads all CSS, then JS modules)
css/
  reset.css             # Box-sizing, margin, safe-area
  tokens.css            # Custom properties (spacing, type, motion, z-index, RAG colors)
  typography.css        # .type-emotional, .type-structural, .type-data
  layout.css            # .app, .cockpit, .step-track, .step, .header, .back-btn
  components.css        # All component styles (~6600 lines, largest file)
  animations.css        # @keyframes, score-ring, card-swap, ink transitions
  responsive.css        # min-width breakpoints (375, 768, 1024, 1440, 2560)
  arcade-ops.css        # Arcade Ops easter egg styles (~1000 lines)
  themes/               # neutral.css, indian.css, middleeastern.css, japanese.css, southamerican.css
js/
  app.js                # Orchestrator (~5000 lines): init, event delegation, rendering, loading flow
  state.js              # Pub/sub: getState(), setState(patch), subscribe(fn)
  router.js             # Canvas↔Result via translateX
  api.js                # Supabase client + V9 response normalization + progressive blurb fetch
  globals.js            # Shared DOM refs ($dom), haptics (HAPTICS), AbortController, animation timers
  render.js             # Render module scaffold (monolith breakup target — functions still in app.js)
  transitions.js        # Transitions module scaffold (monolith breakup target — functions still in app.js)
  events.js             # Events module scaffold (monolith breakup target — functions still in app.js)
  motion.js             # Animation timeline API, RAF cleanup, micro-interaction helpers
  spring.js             # Spring physics via Motion One CDN (named presets: snappy, smooth, gentle, bouncy, score)
  debug-motion.js       # Motion debug overlay (?debug=motion or Ctrl+Shift+M)
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
  arcade-ops.js         # Arcade Ops easter egg (~1000 lines)
command-center.html     # CEO Command Center dashboard (~825 lines)
css/command-center.css  # Command Center dark theme (~5500 lines)
js/
  cc-config.js          # CC constants, agent definitions, state, helpers (~365 lines)
  cc-agents.js          # CC agent orchestration, API calls, XP system (~660 lines)
  cc-analytics.js       # CC gauntlet data loading, quality metrics (~1077 lines)
  cc-ui.js              # CC pulse cards, live feed, query detail panel (~3300 lines)
  cc-queries.js         # CC 1,042 Chicago test queries (~1057 lines)
  cc-tests.js           # CC 6 test runners, live result streaming (~893 lines)
  cc-compare.js         # CC comparative run view (~738 lines)
  cc-grading.js         # CC score fit + blurb quality grading (~440 lines)
  cc-generated-queries.js # CC persona-driven generated queries browser (~222 lines)
```

## Module Graph

```
index.html → js/app.js (imports all)
  ├── state.js, router.js, persistence.js, theme.js, audio.js
  ├── voice.js, animations.js, share.js, offline.js
  ├── accessibility.js, api.js, auth.js, utils.js
  ├── globals.js, motion.js, spring.js, debug-motion.js
  ├── render.js, transitions.js, events.js (scaffold modules)
  └── arcade-ops.js
```

**External dependency:** Motion One via importmap CDN (`https://cdn.jsdelivr.net/npm/motion@11/+esm`, ~6.5KB). Provides real spring physics for `spring.js`.

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
