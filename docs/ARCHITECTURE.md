# Frontend Architecture

Last updated: 2026-02-26

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Vanilla HTML/CSS/JS, ES modules (`type="module"`), no build step |
| State | Custom pub/sub store (`js/state.js`) |
| Routing | 2-view sliding cockpit (`js/router.js`) |
| Themes | 5 cultures x 2 modes = 10 CSS variants |
| Backend | Supabase Edge Function V5 (see `dondeBackend`) |

## File Tree

```
index.html                     # SPA entry point (loads all CSS, then JS modules)
css/
  reset.css                    # Box-sizing, margin, safe-area reset
  tokens.css                   # Custom properties (spacing, type, motion, z-index, glass)
  typography.css               # .type-emotional, .type-structural, .type-data
  layout.css                   # .app, .cockpit, .step-track, .step, .header
  components.css               # All component styles (98 KB, largest file)
  animations.css               # @keyframes, score-ring, particles, progressive reveal
  responsive.css               # min-width breakpoints (375, 768, 1024, 1440, 2560)
  themes/
    neutral.css                # Studio (18deg terracotta)
    indian.css                 # Desi (28deg marigold)
    middleeastern.css          # Bazaar (48deg gold)
    japanese.css               # Zen (220deg indigo)
    southamerican.css          # Sabor (350deg chili)
js/
  app.js                       # Orchestrator (init, event delegation, result rendering) — 134 KB
  state.js                     # Pub/sub store: getState(), setState(patch), subscribe(fn)
  router.js                    # Canvas<->Result via translateX
  api.js                       # Supabase Edge Function client
  theme.js                     # Theme engine + labels + wash transition — 42 KB
  audio.js                     # Web Audio chimes per culture (opt-in)
  voice.js                     # Web Speech Recognition
  animations.js                # Score ring, petal radar, bloom cycle, particles, logo — 38 KB
  share.js                     # 8-channel share sheet + canvas card
  persistence.js               # localStorage + server sync for auth users
  accessibility.js             # Focus, announcements, keyboard shortcuts
  offline.js                   # Connectivity detection
  utils.js                     # 50+ SVG icons, cuisine mapper, 320 greetings — 46 KB
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

Load order matters — tokens before themes, layout before components:

`reset.css` → `tokens.css` → `themes/*.css` → `layout.css` → `typography.css` → `components.css` → `animations.css` → `responsive.css`

## State Shape (`state.js`)

```js
{ step, craving, occasion, neighborhood, priceLevel, dietaryRestrictions,
  result, loading, error, excludeIds, theme: {culture, mode},
  colorMode, soundEnabled, history, pendingFeedback }
```

`setState(patch)` shallow-merges, then calls all subscribers with `(newState, prevState)`. Subscribers diff to determine what changed.

## Event System

Single delegation handler on `document` via `data-action` attributes. No inline `onclick`. All interactions route through a `switch(btn.dataset.action)` in `app.js`.

## Performance Patterns

- DOM queries cached at module scope
- `will-change: transform` only on `.step-track` during transitions
- Animation timers tracked and cleared on re-render
- `AbortController` cancels in-flight fetch on back navigation
- Particle canvas uses `requestAnimationFrame` loop, stopped on cleanup
