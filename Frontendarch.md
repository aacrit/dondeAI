# DondeAI — Frontend Architecture

## Overview

Single-page vanilla application. Two sliding views (Canvas + Result) connected by a 3-act loading transition. No framework, no build step, no bundler.

## Module Dependency Graph

```
index.html
  └── js/app.js (orchestrator)
        ├── js/state.js          (pub/sub store — no deps)
        ├── js/router.js         (← state)
        ├── js/persistence.js    (← localStorage only)
        ├── js/theme.js          (← state, persistence)
        ├── js/audio.js          (← state, persistence)
        ├── js/voice.js          (← state)
        ├── js/animations.js     (← imports svgIcon from utils.js, pure DOM)
        ├── js/share.js          (← state)
        ├── js/offline.js        (← no deps)
        ├── js/accessibility.js  (← no deps)
        ├── js/api.js            (← no deps)
        └── js/utils.js          (← no deps, pure functions)
```

**app.js** is the only module that imports from all others. No circular dependencies. Each module exposes an `init*()` function called once at boot.

## CSS Architecture

```
reset.css       → Box-sizing, margin, safe-area reset
tokens.css      → Custom properties (spacing, type, motion, z-index, glass)
themes/*.css    → Per-culture color variables (6 files, light + dark selectors)
layout.css      → .app, .cockpit, .step-track, .step, .header, .back-btn
typography.css  → .type-emotional, .type-structural, .type-data + variants
components.css  → All component styles (input, pills, cards, tiles, badges)
animations.css  → @keyframes, score-ring, particles, progressive reveal
responsive.css  → min-width breakpoints (375, 768, 1024, 1440, 2560)
```

Load order matters — tokens before themes, layout before components.

## State Flow

```
User action → setState(patch) → subscribers notified → DOM updates

  setState({ craving: "..." })
    ↓
  subscriber in app.js checks diff
    ↓
  updates DOM (input, CTA state, filter summary, etc.)
```

State is a plain object. `setState()` shallow-merges a patch, then calls all subscribers with `(newState, prevState)`. Subscribers diff the two to determine what changed.

Key subscribers:
- **app.js**: result arrived → `orchestrateReveal()`, loading → `toggleLoading()`, error → `showToast()`
- **router.js**: step changed → `renderStep()` (slides track, manages aria, moves focus)
- **theme.js**: theme changed → `applyTheme()` (sets data-attrs, updates labels, triggers wash)

## View Model

### View 0: Canvas

All input consolidated into one scrollable view:
- Greeting (time-aware via `getGreeting()`)
- Craving text input + voice button + smart chips
- Collapsible filter drawer (occasion, neighborhood, budget pills + randomize)
- CTA button (disabled until craving non-empty)
- Taste Memory (last 3 searches from localStorage)

### View 1: Result

5-block card rendered by `renderResult()` in app.js:

```
.result-identity    → name, one-liner toggle, navigation tile
.result-story       → recommendation (collapsible), insider tip
.score-section      → score-row (DondeAI Match™ ring + DondeAI Vibe™ radar side-by-side),
                      sentiment-bar (labeled RAG horizontal bar),
                      google-rating-inline (stars + count)
.result-profile     → glyph-bar (icon-only collapsed, value-based symbols),
                      profile-details > profile-facts (expandable badge grid)
.result-actions-block → quick links, Try Another / Start Over
```

### Loading Overlay

Fixed-position overlay with 3 acts:

1. **Defocus**: `.step--defocused` on canvas (blur + scale down)
2. **Search**: particle canvas + SVG logo draw-in + sonar pulse + "Searching..." dots
3. **Reveal**: `resolveLogoToFound()` → crossfade overlay out, result card in

Orchestrated by `orchestrateReveal()` in app.js. The step-track slides to view 1 instantly under the overlay via `goToStepInstant(1)`.

## Event System

Single event delegation handler on `document`:

```js
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  switch (btn.dataset.action) {
    case 'submit':      handleSubmit(); break;
    case 'reset':       resetState(); break;
    case 'try-again':   handleSubmit(); break;  // re-submits same craving
    case 'select-occasion':    selectFilter('occasion', btn); break;
    case 'select-neighborhood': selectFilter('neighborhood', btn); break;
    case 'select-budget':      selectFilter('priceLevel', btn); break;
    case 'toggle-filters':     // expand/collapse drawer
    case 'cycle-theme':        // rotate to next culture
    case 'toggle-mode':        // light ↔ dark
    case 'share':              // open share sheet
    // ... etc
  }
});
```

All interactive elements use `data-action="..."` attributes. No inline `onclick`.

## Theme Engine

Themes are applied via `data-theme` and `data-mode` attributes on `<html>`:

```html
<html data-theme="japanese" data-mode="dark">
```

Each theme CSS file defines variables under attribute selectors:
```css
[data-theme="japanese"][data-mode="light"] { --bg: ...; --ac: ...; }
[data-theme="japanese"][data-mode="dark"]  { --bg: ...; --ac: ...; }
```

Theme switch triggers a **radial clip-path wash** transition: a fullscreen div gets the new theme, clip-path expands from the cycle button, then root attributes update and wash hides.

`THEME_LABELS` in `theme.js` hold per-culture UI strings applied via `applyLabels()`.

## Animation Architecture

### CSS Animations (animations.css)
- `@keyframes` for: chip-pop, shake, pulse, spin, card-enter, tag-stagger
- Progressive reveal via `.result-card--revealing > *:nth-child(n)` with staggered delays

### JS Animations (animations.js)
- `animateScoreRing()`: stroke-dashoffset + count-up via rAF
- `renderPetalRadar()`: 6-axis teardrop SVG petals with spring-scale entrance + icon/label placement
- `renderSentimentBar()`: horizontal flex bar with animated segment grow
- `startParticles()` / `stopParticles()`: canvas-based particle system
- `initLogoAnimation()`: SVG stroke draw-in via dasharray manipulation
- `chaosToOrderReveal()`: text scramble → settle animation

### Value-Based Glyph Rendering (app.js)
- `getNoiseIcon()`: maps noise level keywords → `speakerNone` / `speakerWave` / `speakerHigh`
- `getAmbianceIcon()`: maps ambiance keywords → `moon` (dim/cozy) / `sun` (bright)
- Price badge renders "$"/"$$" as text instead of tag icon in glyph bar

### Reduced Motion
All duration tokens in `tokens.css` zero out under `prefers-reduced-motion: reduce`. JS animations check `matchMedia('(prefers-reduced-motion: reduce)')` and skip to final state.

## Icon System

`utils.js` exports `ICON_SVG` — a registry of Phosphor-compatible SVG path data (256x256 viewBox). Rendered via:

```js
export function svgIcon(name, size = 20) {
  const paths = ICON_SVG[name];
  if (!paths) return '';
  return `<svg viewBox="0 0 256 256" width="${size}" height="${size}">${paths}</svg>`;
}
```

No external icon fonts. No emoji in result card UI. All icons are inline SVG.

## Share System

Two modes:
1. **Native**: `navigator.share()` on supported mobile browsers
2. **Fallback**: Bottom sheet modal with 8 channel buttons (clipboard, WhatsApp, SMS, X, email, Telegram, Facebook, iMessage)

Share includes a **canvas-rendered card** (post 1:1 or story 9:16 format) with restaurant name, score, and branding. Rendered via `renderShareCanvas()` in app.js.

## Key Patterns

### Filter Selection
```
User taps pill → ink ripple animation → deselect siblings →
select this one (aria-checked + chip-pop) → setState → update filter summary
```

### Submit Flow
```
handleSubmit() → validate craving → check online → abort previous →
set loading state → toggleLoading(true) → fetchRecommendation() →
on success: setState({ result }) → orchestrateReveal() → renderResult()
on error: toggleLoading(false) → showToast() → goToStep(0)
```

### Taste Memory
Last 3 searches stored in localStorage with: `{ label, payload, cuisineIcon, timestamp }`. Displayed on canvas view. Clicking a memory pre-fills the craving input.

## Performance Notes

- DOM queries cached at module scope (e.g., `const $cravingInput = document.getElementById(...)`)
- `will-change: transform` only on `.step-track` during transitions
- Animation timers tracked in array, cleared on re-render to prevent stacking
- `AbortController` cancels in-flight fetch on back navigation
- Particle canvas uses `requestAnimationFrame` loop, stopped on cleanup
