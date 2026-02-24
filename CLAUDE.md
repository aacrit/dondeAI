# DondeAI

AI restaurant recommendations for Chicago. "Ink & Momentum" design — Arc Browser x Apple Notes x Notion.
Vanilla HTML/CSS/JS. Zero frameworks, zero build steps.

## Skill

**`/frontenddesign`** — design system enforcement (`.claude/skills/frontenddesign/SKILL.md`). Auto-activates on UI/animation/layout tasks.

## Files

```
index.html                   # SPA entry point
css/reset.css                # box-sizing, margin, safe-area, focus-visible
css/tokens.css               # CSS custom properties (colors, spacing, type, motion, z-index, glass)
css/typography.css            # 3-voice type system
css/layout.css               # 2-view slide, ambient layer, loading overlay
css/components.css            # All components (chips, cards, buttons, tiers, glyph bar)
css/animations.css            # 40+ keyframes
css/responsive.css            # 320px–2560px breakpoints, hover queries, keyboard adapt
css/themes/{neutral,indian,middleeastern,nepalese,japanese,eastasian,african,southamerican}.css
js/app.js                    # Orchestrator — init, event delegation, 3-tier result rendering
js/state.js                  # Pub/sub state store
js/router.js                 # Canvas↔Result via translateX
js/api.js                    # Supabase Edge Function (15s timeout, auth headers)
js/theme.js                  # 8 cultures × 2 modes, auto-theme on typing, radial wash
js/audio.js                  # Web Audio chimes per culture, blob pulse sync
js/voice.js                  # Web Speech Recognition
js/animations.js             # Score ring, petal radar, score hero arc, bloom cycle, particles, logo
js/share.js                  # 8-channel share sheet + canvas card
js/persistence.js            # localStorage (theme, sound, colorMode, history, bookmarks, userId, feedback)
js/accessibility.js          # Focus, announcements, keyboard shortcuts
js/offline.js                # Connectivity detection
js/utils.js                  # 50+ SVG icons, cuisine/culture mapper, 320 greetings, helpers
Frontendarch.md              # Architecture reference
UI_UX_Requirements.md        # Business requirements (immutable)
nicehave_sso.md              # Future: SSO auth roadmap (not implemented)
```

## Design Principles (Non-Negotiable)

1. **Canvas + Result** — 2 views only. No multi-step wizard.
2. **Ink Rule** — `--ac` only on: score ring, restaurant name, active CTAs, selected pills, logo dot, caret, petal radar (8%/25%). Everything else grayscale. Google stars always amber `hsl(45 93% 47%)`.
3. **3 Type Voices** — Emotional (Playfair Display): headings/prompts. Structural (Inter): buttons/labels. Data (JetBrains Mono): scores/badges.
4. **Motion Grammar** — Spring `cubic-bezier(.34,1.56,.64,1)`: user-initiated. Ease `cubic-bezier(.4,0,.2,1)`: system reveals. `prefers-reduced-motion`: all 0ms.
5. **Cultural Personality** — Themes change palette + textures + terminology + audio + border/shadow depth.
6. **Screen Is Canvas** — Full viewport, no scrollbars during input.

## User Flow

```
[Canvas] Greeting → Craving input + voice + suggestions + smart chips + Surprise Me
         → Filter drawer (Occasion 9 pills, Neighborhood 15, Budget 5, Dietary 4 toggles, Randomize)
         → CTA (disabled until craving) → Taste Memory (last 3) → Saved Spots
    ↓ submit
[Loading] Act 1: blur canvas → Act 2: particles + logo draw-in + sonar → Act 3: reveal
    ↓
[Result]  3-tier progressive disclosure:
  Tier 1 (Glance):  Match pill + name (ink reveal) + one-liner + blurb (7-line clamp) + feedback + CTAs
  Tier 2 (Lean In): Score hero arc + bloom cycle + photos + hours + sentiment + Google stars + nav tile + quick links + glyph bar
  Tier 3 (Deep):    V2 score breakdown bars + detail badges grid
```

Navigation: swipe-right → canvas. Back button on result only. Logo tap = full reset.

## API Contract

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
Authorization: Bearer <supabase-anon-key>
apikey: <supabase-anon-key>
Timeout: 15s (AbortController)
```

**Request:**
```json
{
  "special_request": "string (required)",
  "occasion": "string (default: Any)",
  "neighborhood": "string (default: Anywhere)",
  "price_level": "string (default: Any)",
  "exclude": ["uuid"],
  "dietary_restrictions": ["string"],
  "user_id": "uuid",
  "feedback": {},
  "time_of_day": "breakfast|lunch|dinner|late_night"
}
```
`exclude` sent on "Try Another" (accumulated UUIDs). Fresh submit resets. `time_of_day` auto-sent from client clock.

**Response:**
```json
{
  "success": true,
  "restaurant": {
    "id": "uuid", "name": "str", "best_for_oneliner": "str", "address": "str",
    "phone": "str|null", "website": "str|null", "price_level": "str",
    "noise_level": "str|null", "cuisine_type": "str|null",
    "google_rating": "numeric str|null", "google_review_count": "str|null",
    "google_place_id": "str|null", "parking_availability": "str|null",
    "lighting_ambiance": "str|null", "dress_code": "str|null",
    "outdoor_seating": "bool|null", "live_music": "bool|null", "pet_friendly": "bool|null",
    "sentiment_breakdown": "str|null", "sentiment_score": "numeric 0-1|null",
    "photo_urls": ["str"]|null, "opening_hours": "str|null"
  },
  "recommendation": "str",
  "insider_tip": "str|null",
  "donde_match": "numeric 0-100",
  "scores": {
    "date_friendly_score": "str|null", "group_friendly_score": "str|null",
    "family_friendly_score": "str|null", "business_lunch_score": "str|null",
    "solo_dining_score": "str|null", "hole_in_wall_factor": "str|null",
    "romantic_rating": "str|null"
  },
  "scoring_v2": {
    "occasion_fit": "0-100|null", "craving_match": "0-100|null",
    "vibe_alignment": "0-100|null", "practical_fit": "0-100|null",
    "discovery_value": "0-100|null"
  }|null,
  "tags": ["str"]|null
}
```

**Errors:** HTTP non-200 → toast + return to canvas | `success:false` → show `recommendation` as error | network → "Couldn't reach the engine." | timeout → "Request timed out." | offline → block submit | empty craving → shake + toast

## Themes (8 × 2 = 16 variants)

| ID | Name | Hue | Character |
|---|---|---|---|
| `neutral` | Studio | achromatic | Clean minimal default |
| `indian` | Desi | 28° marigold | Saffron warmth, ornate |
| `middleeastern` | Bazaar | 48° gold | Hammered brass, arabesque |
| `nepalese` | Himalayan | 178° turquoise | Prayer flags, mountain earth |
| `japanese` | Zen | 220° indigo | Ink wash, wabi-sabi |
| `eastasian` | Silk | 285° plum | Imperial lacquer, orchid |
| `african` | Kente | 155° emerald | Bold geometry, Afrofuturist |
| `southamerican` | Sabor | 350° chili | Tropical vivid, fiesta |

**Theme tokens per file:** `--bg/bg2/bg3`, `--fg/fg2/fg3`, `--ac/ac2/ac-soft`, `--green/rose/amber` (+soft), `--glass*`, `--border`, `--shadow/shadow-lg`, `--radius*`, `--blob-1/2/3`, `--grain-opacity`, `--textile-pattern/opacity`

**Switching:** `data-theme` + `data-mode` on `<html>`. Radial wash transition (160ms). `data-color="auto|off"` controls auto-theme-on-typing. System `prefers-color-scheme` respected.

**Auto-theme:** When `colorMode="auto"`, typing cuisine keywords triggers visual-only theme preview via `matchCulture()` ("sushi"→Zen, "tacos"→Sabor). Manual selection disables auto.

**Label keys per culture:** `vibe`, `hood`, `blurb`, `prompt`, `placeholder`, `cta`, `again`, `share`, `profile`, `insiderTip`, `loadingPhrases`, `placeholders`, `smartChips`, `suggestions`, `chipPool`, `suggestionCorpus`

## Scores

**Match (0-100):** 90+ "Outstanding" (--ac/--green) | 85-89 "Excellent" (--ac) | 75-84 "Solid Pick" (--fg2) | 60-74 "Worth a Try" (--fg2) | 0-59 "Adventurous" (--fg3)

**Vibe Petal Radar (6 axes, render if ≥3):** `date_friendly_score`→heart, `group_friendly_score`→usersThree, `family_friendly_score`→home, `business_lunch_score`→briefcase, `solo_dining_score`→user, `hole_in_wall_factor`→diamond. Accent at 8% fill / 25% stroke.

**Bloom cycle (Score Hero tap):** compact → petal radar → V2 bars → compact. V2 dims: `occasion_fit`, `craving_match`, `vibe_alignment`, `practical_fit`, `discovery_value`.

**Sentiment bar:** 4px RAG bar (green/gray/rose 50% opacity). Defaults 33/33/34. Tooltip shows %.

**Glyph bar:** 32px icons, spring-pop stagger. Price=monospace "$"s, noise=speaker icons, ambiance=sun/moon, cuisine=dynamic, parking=car, dress=shirt, atmosphere=patio/music/pet.

## State (`state.js`)

```js
{ step: 0, craving: "", occasion: "Any", neighborhood: "Anywhere", priceLevel: "Any",
  dietaryRestrictions: [], result: null, loading: false, error: null, excludeIds: [],
  theme: { culture: "neutral", mode: "light" }, colorMode: "auto",
  soundEnabled: false, history: [], pendingFeedback: null }
```
API: `getState()`, `setState(patch)`, `subscribe(fn)` → `(state, prev)`, `resetState()`

## Persistence (localStorage)

| Key | Data |
|---|---|
| `dondeai-theme` | `{culture, mode}` |
| `dondeai-sound` | bool |
| `dondeai-colormode` | `"auto"/"off"` |
| `dondeai-history` | Last 3 searches `{label, payload, cuisineIcon, timestamp}` |
| `dondeai-bookmarks` | Max 20 `{id, name, cuisine_type, neighborhood_name, price_level, google_place_id, timestamp}` |
| `dondeai-user-id` | UUID via `crypto.randomUUID()` |
| `dondeai-feedback` | Max 100 entries keyed by restaurantId |

## Icons (`utils.js` → `ICON_SVG`, 256×256 viewBox, `svgIcon(name, size)`)

- **Cuisine:** sushi, taco, pasta, curry, noodles, dumpling, meat, croissant, seafood, burger, coffee, cocktail, salad, brunch, mediterranean, stew, ceviche, plate
- **Atmosphere:** patio, music, pet
- **Facts:** tag, car, speakerWave, speakerNone, speakerHigh, sun, moon, shirt
- **Vibe:** heart, usersThree, home, briefcase, user, diamond
- **Stars:** starFull, starHalf, starEmpty
- **Actions:** globe, phone, shareNetwork, pin, refresh, home, chevronRight
- **Utilities:** wine, calendar, clock, bolt, chat, train, camera, chair

## Audio (Web Audio API, opt-in)

| Culture | Freq (Hz) | Wave | Decay |
|---|---|---|---|
| neutral | 523,659,784 | sine | 0.4 |
| indian | 440,554,659 | triangle | 0.5 |
| middleeastern | 370,466,554 | triangle | 0.55 |
| nepalese | 392,494,587 | sine | 0.6 |
| japanese | 523,784,1047 | sine | 0.3 |
| eastasian | 523,659,880 | sine | 0.35 |
| african | 349,440,523 | square | 0.35 |
| southamerican | 392,523,659 | triangle | 0.45 |

Chime pulses `.ambient__blob` elements (600ms scale).

## Greetings

320 phrases: 8 cultures × 5 periods × 8 per slot. Friday/Saturday/Sunday overrides per culture. Periods: morning (5-10), lunch (11-13), afternoon (14-16), dinner (17-20), latenight (21-4).

## Keyboard Shortcuts

`/` focus craving | `T` toggle color mode | `F` toggle filters (canvas) | `R` try again (result) | `Escape` close modal | Arrows navigate pills | Enter/Space select pill

## Coding Standards

**HTML:** Semantic (`<main>`, `<section>`, `<button>`). All interactives focusable + named. `lang="en"`. Data attrs: `data-theme`, `data-mode`, `data-color`, `data-sound` on `<html>`.

**CSS:** All values via custom properties. Mobile-first `min-width`. `clamp()` fluid type/spacing. No `!important`. BEM-like: `.step__title`, `.step--active`.

**JS:** ES modules. Plain objects + functions. Event delegation on `document` via `data-action`. `requestAnimationFrame`. Cached DOM queries. Module scope only. `AbortController` for fetches.

**Motion tokens:** `--dur-instant`(0) `--dur-fast`(150) `--dur-normal`(300) `--dur-step`(450) `--dur-slow`(600) `--dur-advance`(600) `--dur-score`(1200). All → 0ms under reduced-motion.

**Z-index:** `--z-base`(1) `--z-above`(10) `--z-nav`(100) `--z-modal`(200) `--z-overlay`(300) `--z-toast`(400) `--z-particle`(500)

**Progressive reveal:** Blocks stagger 0/120/240/360/480ms. Match count-up 300ms→1200ms. Score ring 800ms. Sentiment 800ms. Google 900ms. Petals 400ms+80ms stagger. Glyphs 500ms+50ms stagger. Reveal removes at 1200ms.

## Responsive

| BP | Target |
|---|---|
| 320px | Min supported |
| 375px | Primary (mobile-first) |
| 500px max-h | Virtual keyboard (hide wordmark, chips, memory) |
| 768px | Tablet (3-col grid, 64px header) |
| 1024px | Desktop (`--content-max:960px`) |
| 2560px | Max (`--content-max:1100px`) |

`@media (hover:hover)` for mouse. `@media (hover:none)` hides cursor-glow.

## A11y (WCAG 2.1 AA)

Skip nav, `<main>` landmark, `aria-live="polite"` announcements via `#step-announce`, `radiogroup`+`radio` with `aria-checked`, `switch`+`aria-pressed` for toggles, `aria-live="assertive"` errors, focus management on view change, `:focus-visible` accent outline, reduced-motion 0ms, full keyboard, AA contrast across 16 variants.

## Ambient Layer

3 blobs (`blobDrift` 20-30s infinite, culture colors) + textile SVG overlay (culture-specific pattern) + grain SVG filter + cursor glow (radial gradient, disabled on touch/reduced-motion). Dark: `screen` blend; light: `multiply`.

## Share (8 channels)

clipboard (canvas image/PNG), whatsapp, sms, x, email, telegram, facebook, imessage (→sms fallback). Text: name + oneliner + recommendation + tip + address + website.

## Filter Options

**Occasion:** Date Night, Group Hangout, Family Dinner, Business Lunch, Solo Dining, Special Occasion, Treat Myself, Adventure, Chill Hangout
**Neighborhood:** Anywhere, Pilsen, Wicker Park, Logan Square, Lincoln Park, West Loop, Bucktown, Hyde Park, Chinatown, Little Italy, Andersonville, River North, Old Town, Lakeview, Fulton Market
**Budget:** Any, $ (Budget), $$ (Mid), $$$ (Upscale), $$$$ (Splurge)
**Dietary:** Vegan, Vegetarian, Gluten-Free, Halal (multi-select toggles)

## Future (not implemented)

SSO auth (Google/Apple/Instagram/TikTok) → user accounts, unlimited history, favorites. See `nicehave_sso.md`.
