# DondeAI — Handwritten Sliding Cockpit UI

## Project Identity

**What:** AI-powered restaurant recommendation engine for Chicago (expandable).
**How it feels:** Writing a wish on paper and watching it come to life — Arc Browser × Apple Notes × Notion.
**Design language:** "Ink & Momentum" — confident pen strokes, spring-physics choreography, handwritten texture over precision engineering.
**Logo:** "Donde" in Playfair Display roman bold + "AI" superscript in JetBrains Mono accent color. Pin-fork SVG mark. Left-aligned header, accent-color underline on hover, breathing dot animation.
**Stack:** Vanilla HTML + CSS + JavaScript. Zero frameworks. Zero build steps. Files served as-is.

---

## Available Skills

### `/frontenddesign`
Elite motion designer + front-end engineer skill. Use when designing, building, reviewing, or refining any UI component, animation, theme, layout, or interaction pattern. Located at `.claude/skills/frontenddesign/SKILL.md`.

Invoke with `/frontenddesign` or it auto-activates on design/UI/animation/layout tasks. Enforces the "Ink & Momentum" design system, three-voice typography, spring motion grammar, 12-variant theme compatibility, WCAG AA accessibility, and mobile-first responsive patterns.

---

## Architecture & File Structure

```
dondeAI/
├── .claude/
│   └── skills/
│       └── frontenddesign/
│           └── SKILL.md        # /frontenddesign skill — design system enforcement
├── index.html                  # Single entry point — entire SPA lives here
├── css/
│   ├── reset.css               # Minimal reset (box-sizing, margin, safe-area)
│   ├── tokens.css              # All CSS custom properties (colors, spacing, type, motion)
│   ├── themes/
│   │   ├── neutral.css         # Default theme (light + dark variables)
│   │   ├── indian.css          # Indian/Middle Eastern cultural theme
│   │   ├── nepalese.css        # Nepalese/Tibetan cultural theme
│   │   ├── japanese.css        # Japanese/Korean cultural theme
│   │   ├── african.css         # African/Black American cultural theme
│   │   └── southamerican.css   # South American/Puerto Rican cultural theme
│   ├── layout.css              # Viewport canvas, step container, slide mechanics
│   ├── typography.css          # Three-voice type system (emotional, structural, data)
│   ├── components.css          # All component styles (chips, cards, buttons, inputs)
│   ├── animations.css          # Keyframes, spring curves, particle system, score ring
│   └── responsive.css          # Breakpoints (320px → 2560px), safe areas, keyboard adapt
├── js/
│   ├── app.js                  # Main orchestrator — initializes all modules, manages flow
│   ├── state.js                # Central state store (inputs, step index, results, history)
│   ├── router.js               # Client-side step navigation (History API, no hash)
│   ├── api.js                  # Backend integration (fetch wrapper, retry, error handling)
│   ├── theme.js                # Theme engine (culture + light/dark, instant swap, persistence)
│   ├── audio.js                # Web Audio API chime synthesis per culture, sound toggle
│   ├── voice.js                # Web Speech Recognition integration, auto-advance on confidence
│   ├── animations.js           # Spring physics engine, particle system, score ring animator
│   ├── share.js                # Share sheet logic (clipboard, WhatsApp, SMS, X, etc.)
│   ├── persistence.js          # localStorage wrapper (theme, sound, history — 3 keys)
│   ├── accessibility.js        # Focus management, screen reader announcements, skip nav
│   ├── offline.js              # Connectivity detection, banner management
│   └── utils.js                # Cuisine emoji mapper, time-of-day logic, helpers
├── assets/
│   ├── textures/               # Grain/noise SVG patterns per culture
│   └── icons/                  # Minimal icon set (mic, share, map, phone, web, arrow)
├── UI_UX_Requirements.md       # Canonical business requirements (immutable reference)
├── CLAUDE.md                   # This file — project context & implementation guide
└── README.md                   # Project overview
```

---

## Core Design Principles (Non-Negotiable)

1. **One Decision Per Frame** — Each step shows exactly ONE input category. Never two unrelated decisions on screen simultaneously.
2. **Momentum Over Confirmation** — Optional filters auto-advance ~600ms after selection. Forward is default; backward is explicit.
3. **Commit and Forgive** — Selections animate with confidence but are instantly reversible from the review step.
4. **The Screen Is the Canvas** — Full viewport, no scrollbars during input flow. Content IS the interface. Minimal chrome.
5. **Three Voices of Type:**
   - **Emotional** (serif) — prompts, greetings, headings. Feels like confident penmanship.
   - **Structural** (geometric sans) — buttons, labels, navigation. Feels authoritative.
   - **Data** (monospace) — scores, tags, badges. Feels like annotated measurements.
6. **Motion Has Grammar:**
   - **Spring physics** (overshoot + settle) for user-initiated transitions
   - **Gentle easing** for system-initiated reveals
   - **Instant fallback** when `prefers-reduced-motion: reduce` is set
7. **Cultural Personality** — Themes change palette, accent tones, textures, iconography, AND terminology. Not just a color swap.

---

## User Flow (Sliding Cockpit Sequence)

```
[Step 0: Landing]     → Greeting + craving input + quick picks + surprise me
    ↓ slide right
[Step 1: Occasion]    → Single-select vibe (9 options). Optional — skip or auto-advance.
    ↓ slide right
[Step 2: Neighborhood]→ Single-select hood (15 options). Optional — skip or auto-advance.
    ↓ slide right
[Step 3: Budget]      → Single-select price tier (5 options). Optional — skip or auto-advance.
    ↓ slide right
[Step 4: Review]      → Summary of all selections. Tap any to jump back. Submit button.
    ↓ submit (particle loading animation)
[Step 5: Result]      → Full recommendation card with score, radar, actions, share.
    ↓ try again OR start over
```

**Navigation model:** Steps slide horizontally. Left = past, Right = future. Back button / swipe-left returns to previous step. Logo tap = full reset to Step 0.

---

## Backend Integration Contract (IMMUTABLE)

```
POST https://donde.app.n8n.cloud/webhook-test/donde-recommend
Content-Type: application/json
```

### Request — exactly 4 fields:

```json
{
  "special_request": "string",     // from craving input (required, non-empty)
  "occasion": "string",            // from vibe filter (default: "Any")
  "neighborhood": "string",        // from hood filter (default: "Anywhere")
  "price_level": "string"          // from budget filter (default: "Any")
}
```

### Response shape:

```json
{
  "success": true,
  "restaurant": {
    "name": "string",
    "best_for_oneliner": "string",
    "address": "string",
    "phone": "string | null",
    "website": "string | null",
    "price_level": "string",
    "noise_level": "string | null",
    "cuisine_type": "string | null",
    "google_rating": "string (numeric) | null",
    "google_review_count": "string | null",
    "google_place_id": "string | null",
    "parking_availability": "string | null",
    "lighting_ambiance": "string | null",
    "dress_code": "string | null",
    "outdoor_seating": "boolean | null",
    "live_music": "boolean | null",
    "pet_friendly": "boolean | null",
    "sentiment_breakdown": "string | null",
    "sentiment_score": "string (numeric 0-1) | null"
  },
  "recommendation": "string",
  "insider_tip": "string | null",
  "donde_score": "string (numeric 0-10)",
  "scores": {
    "date_friendly_score": "string | null",
    "group_friendly_score": "string | null",
    "family_friendly_score": "string | null",
    "business_lunch_score": "string | null",
    "solo_dining_score": "string | null",
    "hole_in_wall_factor": "string | null",
    "romantic_rating": "string | null"
  },
  "tags": ["string"] | null
}
```

### Error handling:

| Condition | Action |
|---|---|
| HTTP error (non-200) | Show friendly error, return to review, re-enable submit |
| `success: false` | Show `recommendation` field value as error message |
| Network failure | Show "Couldn't reach the engine.", return to review |
| Offline (pre-check) | Block submission entirely with offline banner |
| All inputs empty/default | Block submission with hint message |

---

## Theme System (6 Cultures x 2 Modes = 12 Variants)

### Cultures:

| ID | Name | Personality |
|---|---|---|
| `neutral` | Neutral | Clean, minimal, universally accessible default |
| `indian` | Indian / Middle Eastern | Warm golds, marigold, ornate patterns, Devanagari-inspired curves |
| `nepalese` | Nepalese / Tibetan | Prayer flag colors, mountain earth tones, mandala textures |
| `japanese` | Japanese / Korean | Ink wash, cherry blossom accents, wabi-sabi restraint |
| `african` | African / Black American | Kente-inspired geometry, warm earth + bold accent, Afrofuturist energy |
| `southamerican` | South American / Puerto Rican | Tropical vivid palette, fiesta energy, hand-painted tile patterns |

### What changes per theme:

- 40+ CSS custom properties (colors, accents, backgrounds, glass/blur intensity)
- Border radius, shadow depth, background texture/pattern
- Vibe icon set
- ALL UI label text (prompt, placeholder, CTA, section headings, button text — see `THEME_LABELS`)
- Ambient blob colors and timing
- Audio chime signature (Web Audio synthesized)

### Theme label keys (override per culture):

| Key | Controls | Example values |
|---|---|---|
| `vibe` | Occasion step heading | "Mood", "Vibe", "Type" |
| `hood` | Neighborhood step heading | "Spot", "Barrio", "Area" |
| `blurb` | Recommendation section title | "The Liner Notes", "El Cuento", "Notes" |
| `prompt` | Craving input label | "What are you craving?", "Que quieres?" |
| `placeholder` | Craving input placeholder | "cozy ramen with killer sake..." |
| `cta` | Submit button label | "Manifest", "Dale", "Search" |
| `again` | Try again button label | "Again", "Otra vez", "Reset" |
| `share` | Share button label | "Share", "Comparte", "Copy" |

### Switching rules:

- Instant swap — no page reload, no layout shift, zero flash
- Culture and light/dark persist independently in localStorage
- Theme picker shows gallery with visual preview (color swatch, name, description)

---

## Score Visualization

### DondeAI Score (0-10):

| Range | Tier | CSS Token | Verdict Label |
|---|---|---|---|
| 9-10 | High | `--green` | "Outstanding" |
| 8 | High | `--green` | "Excellent" |
| 6-7 | Mid | `--ac` | "Solid Pick" |
| 4-5 | Mid | `--ac` | "Worth a Try" |
| 0-3 | Low | `--rose` | "Adventurous" |

**Animation:** Ring fill with spring easing -> number counts up -> color tier indicator -> orbit dot at score angle -> verdict label fade-in.

### Radar Chart (Vibe Profile):

6 dimensions. Render only if >=3 are present.

| Backend Key | Short | Full |
|---|---|---|
| `date_friendly_score` | DT | Date |
| `group_friendly_score` | GR | Group |
| `family_friendly_score` | FM | Family |
| `business_lunch_score` | BZ | Business |
| `solo_dining_score` | SL | Solo |
| `hole_in_wall_factor` | GM | Gem |

---

## Cuisine Visual Mapping

Derive emoji + color hue from keyword matching against name, one-liner, cuisine_type, recommendation, tags:

| Keywords | Hue (HSL) | Emoji |
|---|---|---|
| sushi, japanese, ramen | 210 | 🍣 |
| mexican, taco | 25-30 | 🌮 |
| italian, pasta, pizza | 95-100 | 🍝 |
| indian, curry | 35-40 | 🍛 |
| thai, vietnamese | 140-150 | 🍜 |
| chinese, dim sum | 5 | 🥟 |
| korean, bbq | 350 | 🥩 |
| french, bistro | 45 | 🥐 |
| seafood, fish | 195 | 🦞 |
| steak | 10 | 🥩 |
| burger, american | 35-220 | 🍔 |
| coffee, cafe | 30 | ☕ |
| cocktail, bar | 280 | 🍸 |
| vegan | 130 | 🥗 |
| brunch | — | 🥞 |
| *(no match)* | — | 🍽 |

---

## Client-Side Persistence (localStorage)

| Key | Data | Retention |
|---|---|---|
| `dondeai-theme` | `{ culture: "neutral", mode: "light" }` | Permanent |
| `dondeai-sound` | `true / false` | Permanent |
| `dondeai-history` | Last 3 search payloads (FIFO, deduped by label) | Permanent |

---

## Accessibility (WCAG 2.1 AA)

- Skip navigation link for keyboard users
- `<main>` landmark for content area
- Screen reader announcements on step transitions (`aria-live`)
- Proper ARIA roles for all selectors (`radiogroup`, `radio`, `aria-pressed`/`aria-checked`)
- Errors announced with `aria-live="assertive"`
- Focus moves to primary interactive element on step change
- All animations disabled when `prefers-reduced-motion: reduce`
- Full keyboard operability (Tab, Enter, Escape, Arrow keys)
- Color contrast meets AA across all 12 theme variants

---

## Responsive Targets

| Breakpoint | Target |
|---|---|
| 320px | Minimum supported width |
| 375px | Primary design target (mobile-first) |
| 768px | Tablet |
| 1024px | Desktop |
| 2560px | Maximum supported width |

- Respect `env(safe-area-inset-*)` for notched devices
- Virtual keyboard adaptation: hide branding, reduce padding, shift content up
- No visible scrollbars during input flow
- Touch support for all interactions

---

## Features by Priority

### Critical (MVP):
- [BR-C1] Free-text craving input with voice support and smart chips
- [BR-C2] Occasion/vibe single-select filter (9 options)
- [BR-C3] Neighborhood single-select filter (15 options)
- [BR-C4] Budget single-select filter (5 tiers)
- [BR-C6] Full recommendation display with all data points
- [BR-C7] Try another / reject with swipe-to-dismiss
- [BR-C8] Start over / reset

### High (Enhanced UX):
- [BR-H0] Animated score visualization (ring fill, count-up, verdict)
- [BR-H1] Surprise Me one-tap recommendation
- [BR-H2] Quick Picks time-aware shortcut tiles
- [BR-H3] Search history (last 3, persisted)
- [BR-H4] Share recommendation (8 channels)
- [BR-H5] Cultural theming system (6 cultures x light/dark)
- [BR-H6] Sound & haptic feedback (Web Audio, opt-in)
- [BR-H7] Time-of-day intelligence (greeting, placeholder, quick picks)
- [BR-H8] Voice input (Web Speech Recognition)

### Low (Polish & Delight):
- [BR-L1] Ambient visual layer (gradient blobs, grain, cursor glow)
- [BR-L2] Particle loading animation (converge -> logo -> disperse -> reveal)
- [BR-L3] Full keyboard navigation (arrows, Enter, Escape)
- [BR-L4] Offline detection banner
- [BR-L5] Virtual keyboard adaptation
- [BR-L7] Smart chips (input augmentation on focus)

---

## Coding Standards

### HTML:
- Semantic elements (`<main>`, `<section>`, `<nav>`, `<button>`)
- No divitis — use semantic tags where possible
- All interactive elements must be focusable and have accessible names
- `lang` attribute on `<html>`

### CSS:
- All colors, spacing, and typography through CSS custom properties (tokens)
- Theme switching via swapping `data-theme` and `data-mode` attributes on `<html>`
- Mobile-first media queries (`min-width` breakpoints)
- Use `clamp()` for fluid typography and spacing
- Spring physics via CSS `cubic-bezier()` approximations or JS-driven `transform`
- No `!important` unless overriding third-party
- BEM-like naming: `.step`, `.step__title`, `.step--active`

### JavaScript:
- ES modules (`type="module"` on script tag)
- No classes for state — use plain objects and functions
- Event delegation where possible
- `requestAnimationFrame` for all visual animations
- Graceful degradation for Web Speech API and Vibration API
- All DOM queries cached at module scope
- No global variables — module scope only

### Motion:
- Spring curve: `cubic-bezier(0.34, 1.56, 0.64, 1)` for overshoot + settle
- Gentle ease: `cubic-bezier(0.4, 0, 0.2, 1)` for system reveals
- Step transition duration: 400-500ms
- Auto-advance delay: ~600ms after selection
- Score count-up: 1200ms with spring easing
- Particle animation: 2-3s total (converge -> hold -> disperse)
- All durations -> 0ms when `prefers-reduced-motion` is active

---

## Implementation Notes

### Sliding Cockpit Mechanics:
- All steps live in a horizontal track (`display: flex; overflow: hidden`)
- Active step positioned via `translateX()` with spring easing
- Each step is exactly `100vw` wide
- Swipe gestures use touch events with rubber-band resistance (dampened, not 1:1)
- Step transitions use `will-change: transform` for GPU compositing

### State Management:
- Single source of truth in `state.js` (plain object)
- State shape:
  ```js
  {
    step: 0,                    // current step index
    craving: "",                // free-text input
    occasion: "Any",            // selected vibe
    neighborhood: "Anywhere",   // selected hood
    priceLevel: "Any",          // selected budget
    result: null,               // API response object
    loading: false,             // API request in flight
    error: null,                // error message string
    theme: { culture: "neutral", mode: "light" },
    soundEnabled: false,
    history: []                 // last 3 searches
  }
  ```
- Reactive updates: state changes trigger DOM updates through a simple publish/subscribe pattern

### Audio Synthesis:
- Each culture has a distinct chime defined as Web Audio oscillator parameters
- Chime plays on: theme switch, recommendation reveal
- Sound is off by default, toggled via UI, persisted in localStorage
- Graceful no-op if Web Audio API is unavailable

### Voice Input:
- Web Speech Recognition API (`webkitSpeechRecognition` / `SpeechRecognition`)
- Shows recording indicator while active
- On final result with confidence > 0.7 and length > 5 chars: auto-advance to review + submit
- Button is hidden on unsupported browsers (feature detection)

### Share:
- Uses `navigator.share()` where available (mobile)
- Falls back to bottom sheet with platform-specific share buttons
- Share text format includes: restaurant name, one-liner, recommendation excerpt, insider tip, address, website, "via DondeAI" attribution

---

## Quick Picks by Time of Day

| Period | Hours | Tile Options |
|---|---|---|
| Morning | 5am-11am | Brunch, Coffee, Bakery, Healthy |
| Lunch | 11am-2pm | Quick Bite, Healthy, Noodles, Tacos |
| Afternoon | 2pm-5pm | Coffee, Snacks, Happy Hour, Tea |
| Dinner | 5pm-9pm | Date Night, Drinks, Trendy, Family |
| Late Night | 9pm-5am | Late Night, Cocktails, Comfort Food, Pizza |

If search history exists, the most recent search replaces the last tile.

---

## Occasion Options

`Date Night`, `Group Hangout`, `Family Dinner`, `Business Lunch`, `Solo Dining`, `Special Occasion`, `Treat Myself`, `Adventure`, `Chill Hangout`

## Neighborhood Options

`Anywhere`, `Pilsen`, `Wicker Park`, `Logan Square`, `Lincoln Park`, `West Loop`, `Bucktown`, `Hyde Park`, `Chinatown`, `Little Italy`, `Andersonville`, `River North`, `Old Town`, `Lakeview`, `Fulton Market`

## Budget Options

`Any` (default), `$` (Budget), `$$` (Mid), `$$$` (Upscale), `$$$$` (Splurge)

---

## Recommendation Display — Required Elements

| Element | Priority | Notes |
|---|---|---|
| Restaurant name | Must show | Animated reveal |
| One-liner | Must show | Subtitle under name |
| AI recommendation paragraph | Must show | Main body text |
| DondeAI Score (0-10) | Must show | Animated ring + count-up + verdict |
| Google rating + stars | Must show | 5-star viz + numeric + review count |
| Price level | Must show | As-is from response |
| Address | Must show | Tappable -> opens maps |
| Insider tip | If present | Highlighted callout |
| Vibe radar | If >=3 dimensions | Canvas/SVG spider chart |
| Cuisine emoji + gradient | Computed | From keyword matching |
| Action buttons | If data present | Website, Call, Reviews links |
| Atmosphere tags | If data present | Lighting, dress code, patio, music, pets |
| Parking info | If present | Display as-is |
| Sentiment breakdown | If present | Positive/neutral/negative stacked bar |
| Tags | If present | Pill-shaped tag cloud |
| Noise level | If present | Display as-is |
