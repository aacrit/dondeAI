# DondeAI — Handwritten Sliding Cockpit UI

## Project Identity

**What:** AI-powered restaurant recommendation engine for Chicago (expandable).
**How it feels:** Writing a wish on paper and watching it come to life — Arc Browser x Apple Notes x Notion.
**Design language:** "Ink & Momentum" — confident pen strokes, spring-physics choreography, handwritten texture over precision engineering.
**Logo:** Question Pin mark (fork tines merge into question-mark curve, pin dot at base). "Donde" in Playfair Display roman bold + "AI" superscript in JetBrains Mono. Breathing dot animation. SVG stroke draw-in during loading.
**Stack:** Vanilla HTML + CSS + JavaScript. Zero frameworks. Zero build steps. Files served as-is.

---

## Available Skills

### `/frontenddesign`
Elite motion designer + front-end engineer skill. Use when designing, building, reviewing, or refining any UI component, animation, theme, layout, or interaction pattern. Located at `.claude/skills/frontenddesign/SKILL.md`.

Invoke with `/frontenddesign` or it auto-activates on design/UI/animation/layout tasks. Enforces the "Ink & Momentum" design system, Ink Rule color discipline, three-voice typography, spring motion grammar, 12-variant theme compatibility, WCAG AA accessibility, and mobile-first responsive patterns.

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
│   ├── layout.css              # Viewport canvas, 2-view slide mechanics
│   ├── typography.css          # Three-voice type system (emotional, structural, data)
│   ├── components.css          # All component styles (chips, cards, buttons, inputs)
│   ├── animations.css          # Keyframes, spring curves, particle system, score ring
│   └── responsive.css          # Breakpoints (320px → 2560px), safe areas, keyboard adapt
├── js/
│   ├── app.js                  # Main orchestrator — init, event delegation, result rendering
│   ├── state.js                # Central state store (pub/sub, plain object)
│   ├── router.js               # 2-view navigation (Canvas ↔ Result via translateX)
│   ├── api.js                  # Backend integration (fetch wrapper, error handling)
│   ├── theme.js                # Theme engine (culture + light/dark, labels, radial wash)
│   ├── audio.js                # Web Audio API chime synthesis per culture, sound toggle
│   ├── voice.js                # Web Speech Recognition integration
│   ├── animations.js           # Spring physics, particle system, score ring, logo draw-in
│   ├── share.js                # Share sheet + canvas card rendering (8 channels)
│   ├── persistence.js          # localStorage wrapper (theme, sound, history — 3 keys)
│   ├── accessibility.js        # Focus management, screen reader announcements, skip nav
│   ├── offline.js              # Connectivity detection, banner management
│   └── utils.js                # SVG icon registry, cuisine mapper, time-of-day, helpers
├── Frontendarch.md             # Frontend architecture reference
├── UI_UX_Requirements.md       # Canonical business requirements (immutable reference)
├── CLAUDE.md                   # This file — project context & implementation guide
└── README.md                   # Project overview
```

---

## Core Design Principles (Non-Negotiable)

1. **Canvas + Result** — Two views only. Canvas holds ALL input (craving, collapsible filters). Result holds ALL output. No multi-step wizard.
2. **The Ink Rule** — Accent color (`--ac`) is earned, not given. Only the Score Ring, Restaurant Name, active CTAs, and selected filter pills use accent color. Everything else is grayscale (foreground/background tokens). Badges, tiles, and metadata are always neutral.
3. **Three Voices of Type:**
   - **Emotional** (Playfair Display serif) — prompts, greetings, headings. Confident penmanship.
   - **Structural** (Inter sans) — buttons, labels, navigation. Authoritative, clean.
   - **Data** (JetBrains Mono) — scores, tags, badges, metadata. Annotated measurements.
4. **Motion Has Grammar:**
   - **Spring** `cubic-bezier(0.34, 1.56, 0.64, 1)` — user-initiated transitions (step slide, selection commit)
   - **Gentle ease** `cubic-bezier(0.4, 0, 0.2, 1)` — system-initiated reveals (data fade-in, tag stagger)
   - **Instant fallback** when `prefers-reduced-motion: reduce` is set
5. **Cultural Personality** — Themes change palette, textures, terminology, audio chimes, AND border/shadow depth. Not just a color swap.
6. **The Screen Is the Canvas** — Full viewport, no scrollbars during input. Minimal chrome. Content IS the interface.

---

## Actual User Flow (2-View Model)

```
[View 0: Canvas]
  ├── Greeting (time-of-day aware)
  ├── Craving text input + voice button + smart chips
  ├── Collapsible filter drawer (toggle):
  │   ├── Occasion (9 pill-style radio buttons)
  │   ├── Neighborhood (15 pills)
  │   ├── Budget (5 pills)
  │   └── Randomize link
  ├── CTA submit button (disabled until craving entered)
  ├── Hint text
  └── Taste Memory (last 3 searches, if any)

    ↓ submit triggers 3-act loading transition

[Loading Overlay]  (covers both views)
  Act 1: Defocus — blur input behind overlay
  Act 2: Search  — particle drift + logo SVG draw-in + sonar pulse
  Act 3: Reveal  — logo resolves "found" → result card crossfades in

[View 1: Result]
  ├── Block 1: Identity (name + click-to-reveal one-liner + navigation tile)
  ├── Block 2: Story (recommendation paragraph + read more + insider tip)
  ├── Block 3: Scores (DondeAI ring + Google stars + Vibe Radar — 3 tiles)
  ├── Block 4: Profile (fact badges + atmosphere tags + sentiment bar)
  └── Block 5: Actions (quick links + Try Another / Start Over CTAs)
```

**Navigation:** Swipe-right on result returns to canvas. Back button visible only on result. Logo tap = full reset.

---

## Backend Integration Contract (IMMUTABLE)

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
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
| HTTP error (non-200) | Show toast error, return to canvas, re-enable submit |
| `success: false` | Show `recommendation` field value as toast error |
| Network failure | Show "Couldn't reach the engine." toast |
| Offline (pre-check) | Block submission with offline banner |
| Empty craving | Shake input, show toast, refocus |

---

## The Ink Rule (Color Discipline)

Accent color (`--ac`) is scarce and intentional. This creates visual hierarchy through restraint.

**Earns accent color:**
- Score Ring fill stroke
- Restaurant name (result heading)
- Active CTA buttons (primary)
- Selected filter pills (`aria-checked="true"`)
- Logo pin dot
- Cursor caret

**Always neutral (grayscale):**
- All detail badges (cuisine, price, parking, noise, ambiance, dress)
- Score tile backgrounds
- Google stars (amber, `hsl(45 93% 47%)`, NOT accent)
- Atmosphere tags (patio, music, pets)
- Navigation tile
- Quick links (website, call, share)
- Insider tip callout

---

## Theme System (6 Cultures x 2 Modes = 12 Variants)

### Cultures (display names used in UI):

| ID | Display Name | Personality |
|---|---|---|
| `neutral` | Studio | Clean, minimal, universally accessible default |
| `indian` | Saffron | Warm golds, marigold, ornate patterns |
| `nepalese` | Summit | Prayer flag colors, mountain earth tones |
| `japanese` | Inkwell | Ink wash, cherry blossom accents, wabi-sabi restraint |
| `african` | Kente | Bold geometry, warm earth + bold accent, Afrofuturist energy |
| `southamerican` | Fiesta | Tropical vivid palette, fiesta energy, hand-painted tiles |

### Theme label keys (override per culture in `THEME_LABELS`):

| Key | Controls |
|---|---|
| `vibe` | Occasion filter heading |
| `hood` | Neighborhood filter heading |
| `blurb` | Recommendation section title |
| `prompt` | Craving input label |
| `placeholder` | Craving input placeholder text |
| `cta` | Submit button label |
| `again` | Try again button label |
| `share` | Share button label |

### Theme switching:

- Radial clip-path wash transition from cycle button origin
- `data-theme` and `data-mode` attributes on `<html>`
- Culture and light/dark persist independently in localStorage
- Cycle button in header rotates through cultures; theme picker modal for full gallery
- System `prefers-color-scheme` respected when no user preference saved

---

## Result Card — 5-Block Architecture

| Block | Section | Contents |
|---|---|---|
| **Identity** | "What? Where?" | Restaurant name (click toggles one-liner), navigation tile (address -> maps) |
| **Story** | "Why this spot?" | AI recommendation (collapsible, 7-line clamp), insider tip callout |
| **Scores** | Evaluative metrics | DondeAI Score ring, Google Rating stars, Vibe Radar chart (3 tiles) |
| **Profile** | "About This Spot" | Neutral fact badges, boolean atmosphere tags, sentiment stacked bar |
| **Actions** | "Now what?" | Quick links (website, call, share), Try Another + Start Over CTAs |

### Progressive reveal timing:
- Blocks stagger in: 0ms, 120ms, 240ms, 360ms, 480ms
- Score ring animates at 800ms, Google rating at 900ms
- Atmosphere tags spring-pop stagger at 980ms + 60ms intervals
- Reveal class auto-removes at 1600ms

---

## Score Visualization

### DondeAI Score (0-10):

| Range | Tier | Verdict Label |
|---|---|---|
| 9-10 | High | "Outstanding" |
| 8 | High | "Excellent" |
| 6-7 | Mid | "Solid Pick" |
| 4-5 | Mid | "Worth a Try" |
| 0-3 | Low | "Adventurous" |

Score ring always uses `--ac` for fill stroke. Ring is expandable (tap opens modal).

### Radar Chart (Vibe Profile):

6 dimensions. Render only if >=3 are present. Also expandable.

| Backend Key | Short Label |
|---|---|
| `date_friendly_score` | Date |
| `group_friendly_score` | Group |
| `family_friendly_score` | Family |
| `business_lunch_score` | Business |
| `solo_dining_score` | Solo |
| `hole_in_wall_factor` | Gem |

---

## SVG Icon System

Icons are inline SVG paths stored in `ICON_SVG` registry in `utils.js`. Phosphor-compatible 256x256 viewBox. Rendered via `svgIcon(name, size)` helper. Categories:

- **Cuisine:** sushi, taco, pasta, curry, noodles, dumpling, meat, croissant, seafood, burger, coffee, cocktail, salad, brunch, plate
- **Atmosphere:** patio, music, pet
- **Facts:** tag, car, speakerWave, sun, shirt
- **Stars:** starFull, starHalf, starEmpty
- **Actions:** globe, phone, shareNetwork, pin, refresh, home, chevronRight

---

## State Management

Single source of truth in `state.js`. Plain object + pub/sub.

```js
{
  step: 0,                    // 0 = canvas, 1 = result
  craving: "",
  occasion: "Any",
  neighborhood: "Anywhere",
  priceLevel: "Any",
  result: null,               // full API response object
  loading: false,
  error: null,
  theme: { culture: "neutral", mode: "light" },
  soundEnabled: false,
  history: []                 // last 3 searches (FIFO)
}
```

---

## Coding Standards

### HTML:
- Semantic elements (`<main>`, `<section>`, `<button>`)
- All interactive elements focusable with accessible names
- `lang="en"` on `<html>`

### CSS:
- All values through CSS custom properties (tokens in `tokens.css`)
- Theme via `data-theme` + `data-mode` on `<html>`
- Mobile-first `min-width` breakpoints
- `clamp()` for fluid typography/spacing
- No `!important` unless overriding third-party
- BEM-like naming: `.step`, `.step__title`, `.step--active`

### JavaScript:
- ES modules (`type="module"`)
- Plain objects + functions (no classes for state)
- Event delegation on `document`
- `requestAnimationFrame` for animations
- DOM queries cached at module scope
- No global variables — module scope only

### Motion:
- Spring: `var(--spring)` = `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Ease: `var(--ease-out)` = `cubic-bezier(0.4, 0, 0.2, 1)`
- Duration tokens: `--dur-step` (450ms), `--dur-score` (1200ms), etc.
- All durations -> 0ms via `prefers-reduced-motion` media query in `tokens.css`

---

## Client-Side Persistence (localStorage)

| Key | Data | Retention |
|---|---|---|
| `dondeai-theme` | `{ culture: "neutral", mode: "light" }` | Permanent |
| `dondeai-sound` | `true / false` | Permanent |
| `dondeai-history` | Last 3 searches with label, payload, cuisineIcon, timestamp | Permanent |

---

## Accessibility (WCAG 2.1 AA)

- Skip navigation link
- `<main>` landmark
- Screen reader announcements on view transitions (`aria-live="polite"`)
- `radiogroup` + `radio` roles on filter pills with `aria-checked`
- Errors announced with `aria-live="assertive"`
- Focus moves to primary element on view change
- All animations disabled when `prefers-reduced-motion: reduce`
- Full keyboard operability (Tab, Enter, Escape)
- Color contrast AA across all 12 theme variants

---

## Responsive Targets

| Breakpoint | Target |
|---|---|
| 320px | Minimum supported |
| 375px | Primary design target (mobile-first) |
| 768px | Tablet |
| 1024px | Desktop |
| 2560px | Maximum supported |

---

## Occasion Options

`Date Night`, `Group Hangout`, `Family Dinner`, `Business Lunch`, `Solo Dining`, `Special Occasion`, `Treat Myself`, `Adventure`, `Chill Hangout`

## Neighborhood Options

`Anywhere`, `Pilsen`, `Wicker Park`, `Logan Square`, `Lincoln Park`, `West Loop`, `Bucktown`, `Hyde Park`, `Chinatown`, `Little Italy`, `Andersonville`, `River North`, `Old Town`, `Lakeview`, `Fulton Market`

## Budget Options

`Any` (default), `$` (Budget), `$$` (Mid), `$$$` (Upscale), `$$$$` (Splurge)
