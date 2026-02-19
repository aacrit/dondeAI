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
│   │   ├── neutral.css         # Studio — default theme (light + dark variables)
│   │   ├── indian.css          # Desi — South Asian cultural theme
│   │   ├── middleeastern.css   # Bazaar — Middle Eastern/Mediterranean cultural theme
│   │   ├── nepalese.css        # Himalayan — Nepalese/Tibetan cultural theme
│   │   ├── japanese.css        # Zen — Japanese cultural theme
│   │   ├── eastasian.css       # Silk — East/Southeast Asian cultural theme
│   │   ├── african.css         # Kente — African/Black American cultural theme
│   │   └── southamerican.css   # Sabor — South American/Latin cultural theme
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
  ├── Block 3: Scores
  │   ├── Score Row (DondeAI Match ring + Petal Radar — side by side)
  │   ├── Sentiment Bar ("Review Sentiment" label + RAG color bar + tooltip)
  │   └── Google Rating (inline stars + count)
  ├── Block 4: Profile
  │   ├── Glyph Bar (icon-only collapsed view — value-based symbols)
  │   └── Detail Badges Grid (expandable — facts + atmosphere merged)
  └── Block 5: Actions (quick links + Try Another / Start Over CTAs)
```

**Navigation:** Swipe-right on result returns to canvas. Back button visible only on result. Logo tap = full reset.

---

## Backend Integration Contract (IMMUTABLE)

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
Content-Type: application/json
```

### Request — 4 required fields + 1 optional:

```json
{
  "special_request": "string",     // from craving input (required, non-empty)
  "occasion": "string",            // from vibe filter (default: "Any")
  "neighborhood": "string",        // from hood filter (default: "Anywhere")
  "price_level": "string",         // from budget filter (default: "Any")
  "exclude": ["uuid", ...]         // optional — previously seen restaurant IDs to skip
}
```

The `exclude` field is sent on "Try Another" — the frontend accumulates `restaurant.id` UUIDs from prior results and passes them so the backend filters out repeats. Fresh "Submit" resets the exclude list.

### Response shape:

```json
{
  "success": true,
  "restaurant": {
    "id": "uuid string",
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
- Petal radar petals (very subtle: 8% fill, 25% stroke opacity — tints with cultural theme color)

**Always neutral (grayscale):**
- All detail badges (cuisine, price, parking, noise, ambiance, dress)
- Score tile backgrounds
- Google stars (amber, `hsl(45 93% 47%)`, NOT accent)
- Atmosphere tags (patio, music, pets)
- Navigation tile
- Quick links (website, call, share)
- Insider tip callout

---

## Theme System (8 Cultures x 2 Modes = 16 Variants)

### Cultures (display names used in UI):

| ID | Display Name | Accent Hue | Personality |
|---|---|---|---|
| `neutral` | Studio | achromatic | Clean, minimal, universally accessible default |
| `indian` | Desi | 28° marigold | Deep saffron warmth, ornate patterns — "from the homeland" |
| `middleeastern` | Bazaar | 48° spice gold | Hammered brass, arabesque — "where every meal is a gathering" |
| `nepalese` | Himalayan | 178° turquoise | Sacred stone, prayer flags, mountain earth — spiritual heights |
| `japanese` | Zen | 220° indigo | Ink wash, aizome, wabi-sabi restraint — minimalist philosophy |
| `eastasian` | Silk | 285° plum | Imperial lacquer, orchid — "ten thousand flavors, one table" |
| `african` | Kente | 155° emerald | Bold geometry, Pan-African green, Afrofuturist energy |
| `southamerican` | Sabor | 350° chili red | Tropical vivid palette, fiesta energy — "flavor runs through everything" |

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
| **Scores** | Evaluative metrics | Score row (DondeAI Match™ ring + DondeAI Vibe™ petal radar side-by-side), Sentiment bar, Google Rating |
| **Profile** | "About This Spot" | Glyph bar (icon-only collapsed, tooltips on tap) + expandable detail badges grid |
| **Actions** | "Now what?" | Quick links (website, call, share), Try Another + Start Over CTAs |

### Progressive reveal timing:
- Blocks stagger in: 0ms, 120ms, 240ms, 360ms, 480ms
- Score ring animates at 800ms, Sentiment bar grows at 800ms, Google rating at 900ms
- Petal radar petals spring-scale at 400ms + 80ms stagger
- Glyph bar icons spring-pop at 500ms + 50ms stagger
- Reveal class auto-removes at 1200ms

---

## Score Visualization

### DondeAI Match™ (0-10):

| Range | Tier | Verdict Label |
|---|---|---|
| 9-10 | High | "Outstanding" |
| 8 | High | "Excellent" |
| 6-7 | Mid | "Solid Pick" |
| 4-5 | Mid | "Worth a Try" |
| 0-3 | Low | "Adventurous" |

Score ring uses `--ac` for fill stroke. Ring is 112px on mobile, 120px on tablet+, 160px in expanded modal. Verdict label uses tier-appropriate colors: accent for high (85%+), `--fg2` for mid (75-84%), `--fg3` for low (<75%).

### DondeAI Vibe™ Petal Radar ("Ink Blossom"):

6 teardrop-shaped petals radiating from center. Each petal length maps to the dimension score. Render only if >=3 dimensions present. Uses subtle accent color (`--ac` at 8% fill / 25% stroke). Shows "Top: Label X.X" below chart for the dominant vibe.

| Backend Key | Short Label | Icon |
|---|---|---|
| `date_friendly_score` | Date | heart |
| `group_friendly_score` | Group | usersThree |
| `family_friendly_score` | Family | home |
| `business_lunch_score` | Business | briefcase |
| `solo_dining_score` | Solo | user |
| `hole_in_wall_factor` | Gem | diamond |

### Sentiment Bar:

Horizontal 4px bar between score row and Google rating. Always visible (defaults to 33/33/34 when no sentiment data). Uses dimmed RAG colors (green/gray/rose at 50% opacity). Labeled "Review Sentiment" above the track. Tooltip on hover/tap shows percentages.

### Glyph Bar (Collapsed Profile View):

32px icon squares with spring-pop stagger entrance. Tap toggles tooltip (label + value). Value-based symbols:
- **Price:** Shows "$"/"$$"/"$$$"/"$$$$" as bold monospace text (not tag icon)
- **Noise:** Maps to `speakerNone` (quiet), `speakerWave` (moderate), `speakerHigh` (loud)
- **Ambiance:** Maps to `moon` (dim/cozy/warm) or `sun` (bright/modern)
- **Others:** Cuisine (dynamic), parking (`car`), dress (`shirt`), atmosphere (`patio`/`music`/`pet`)

---

## SVG Icon System

Icons are inline SVG paths stored in `ICON_SVG` registry in `utils.js`. Phosphor-compatible 256x256 viewBox. Rendered via `svgIcon(name, size)` helper. Categories:

- **Cuisine:** sushi, taco, pasta, curry, noodles, dumpling, meat, croissant, seafood, burger, coffee, cocktail, salad, brunch, plate
- **Atmosphere:** patio, music, pet
- **Facts:** tag, car, speakerWave, speakerNone, speakerHigh, sun, moon, shirt
- **DondeAI Vibe™:** heart, usersThree, home, briefcase, user, diamond
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
  excludeIds: [],             // restaurant UUIDs to exclude on "Try Another"
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
