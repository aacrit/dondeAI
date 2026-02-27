# Frontend Architecture

Last updated: 2026-02-27

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Vanilla HTML/CSS/JS, ES modules (`type="module"`), no build step |
| State | Custom pub/sub store (`js/state.js`) |
| Routing | 2-view sliding cockpit (`js/router.js`) |
| Themes | 5 cultures x 2 modes = 10 CSS variants |
| Backend | Supabase Edge Function V7.3b (see `dondeBackend`) |

## File Tree

```
index.html                     # SPA entry point (loads all CSS, then JS modules)
css/
  reset.css                    # Box-sizing, margin, safe-area reset
  tokens.css                   # Custom properties (spacing, type, motion, z-index, glass)
  typography.css               # .type-emotional, .type-structural, .type-data
  layout.css                   # .app, .cockpit, .step-track, .step, .header
  components.css               # All component styles (~100 KB, largest file)
  animations.css               # @keyframes, score-ring, factor-ring, particles, progressive reveal
  responsive.css               # min-width breakpoints (375, 768, 1024, 1440, 2560)
  themes/
    neutral.css, indian.css, middleeastern.css, japanese.css, southamerican.css
js/
  app.js                       # Orchestrator (init, event delegation, result rendering)
  state.js                     # Pub/sub store: getState(), setState(patch), subscribe(fn)
  router.js                    # Canvas<->Result via translateX
  api.js                       # Supabase Edge Function client + V7 response normalization
  animations.js                # Score ring, factor constellation, petal radar, factor bars, particles
  theme.js                     # Theme engine + labels + wash transition
  audio.js                     # Web Audio chimes per culture (opt-in)
  voice.js                     # Web Speech Recognition
  share.js                     # 8-channel share sheet + canvas card
  persistence.js               # localStorage + server sync for auth users
  accessibility.js             # Focus, announcements, keyboard shortcuts
  offline.js                   # Connectivity detection
  utils.js                     # 50+ SVG icons, cuisine mapper, 320 greetings
  auth.js                      # Supabase Auth client (Google SSO)
```

## Module Dependency Graph

```
index.html
  └── js/app.js (orchestrator — imports from all others)
        ├── js/state.js          (no deps)
        ├── js/router.js         (<- state)
        ├── js/persistence.js    (<- localStorage only)
        ├── js/theme.js          (<- state, persistence)
        ├── js/audio.js          (<- state, persistence)
        ├── js/voice.js          (<- state)
        ├── js/animations.js     (<- utils.js for svgIcon)
        ├── js/share.js          (<- state)
        ├── js/offline.js        (no deps)
        ├── js/accessibility.js  (no deps)
        ├── js/api.js            (no deps)
        ├── js/auth.js           (no deps)
        └── js/utils.js          (no deps, pure functions)
```

No circular dependencies. Each module exposes an `init*()` function called once at boot.

## CSS Load Order

`reset.css` → `tokens.css` → `themes/*.css` → `layout.css` → `typography.css` → `components.css` → `animations.css` → `responsive.css`

## State Shape (`state.js`)

```js
{ step, craving, occasion, neighborhood, priceLevel, dietaryRestrictions,
  result, loading, error, excludeIds,
  rankedQueue: [],       // V7: pre-computed top-5 for instant Try Again
  rankedQueueIndex: 0,   // V7: current position in rankedQueue
  theme: {culture, mode}, colorMode, soundEnabled, history, pendingFeedback }
```

`setState(patch)` shallow-merges, then calls all subscribers with `(newState, prevState)`.

## V7 Score Hero Structure (`index.html`)

```html
<div class="score-hero__gauge">
  <svg viewBox="0 0 200 130">
    <!-- 5 factor constellation rings (concentric semicircles) -->
    <circle class="score-hero__factor-ring" data-factor="food" r="92" />
    <circle class="score-hero__factor-ring" data-factor="vibe" r="86" />
    <circle class="score-hero__factor-ring" data-factor="service" r="80" />
    <circle class="score-hero__factor-ring" data-factor="reputation" r="74" />
    <circle class="score-hero__factor-ring" data-factor="convenience" r="68" />
    <!-- Main score arc -->
    <path class="score-hero__arc-fill" id="score-hero-arc-fill" />
  </svg>
  <span class="score-hero__narrative" id="score-hero-narrative"></span>
</div>
```

## Event System

Single delegation handler on `document` via `data-action` attributes. No inline `onclick`. All interactions route through `switch(btn.dataset.action)` in `app.js`.

## Try Again Flow (V7 Instant Queue)

1. API response includes `ranked_queue` (pre-computed top 2-5)
2. `api.js` extracts and stores in state as `rankedQueue`
3. Try Again handler: if `rankedQueueIndex < rankedQueue.length` → instant render from queue (no API call)
4. Card swap animation: `result-card--swapping-out` (250ms) → update → `result-card--swapping-in`
5. If queue exhausted → fall back to API call with current excludeIds

## Performance Patterns

- DOM queries cached at module scope
- `will-change: transform` only on `.step-track` during transitions
- Animation timers tracked and cleared on re-render
- `AbortController` cancels in-flight fetch on back navigation
- Particle canvas uses `requestAnimationFrame` loop, stopped on cleanup
- Reduced-motion: all animation durations → 0ms, factor rings skip to final state
