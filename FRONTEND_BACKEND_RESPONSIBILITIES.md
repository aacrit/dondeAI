# DondeAI: Frontend vs Backend Responsibilities

Reference document for discussing responsibility boundaries between the edge function and the frontend.

---

## Current Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND  (Vanilla JS, runs in browser)                              │
│                                                                      │
│  js/api.js       → POST request to edge function, timeout, errors    │
│  js/app.js       → Renders result card, all UI logic                 │
│  js/utils.js     → Cuisine detection, score tiers, star rendering    │
│  js/animations.js→ Score ring, radar chart, text reveal animations   │
│  js/state.js     → Client state (step, filters, result, theme)       │
│  js/share.js     → Share sheet (clipboard, native share, socials)    │
│  js/theme.js     → 6 cultures x light/dark, label overrides          │
│  js/audio.js     → Web Audio chimes per culture                      │
│  js/voice.js     → Web Speech Recognition input                      │
│                                                                      │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                   POST /recommend
                   { special_request, occasion,
                     neighborhood, price_level }
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND  (Supabase Edge Function, Deno runtime)                      │
│                                                                      │
│  supabase/functions/recommend/index.ts                                │
│                                                                      │
│  1. Validate request (non-empty craving)                             │
│  2. Call Claude Sonnet → get restaurant name + creative content       │
│  3. Validate name via Google Places Text Search (fuzzy match)        │
│  4. Enrich with real Google data (address, phone, website, rating)   │
│  5. Retry up to 2x if restaurant not found on Google                 │
│  6. Return JSON with { verified: true/false }                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## What the Backend (`index.ts`) Currently Does

### 1. Request Validation
- Checks `ANTHROPIC_API_KEY` exists and starts with `sk-ant-`
- Checks `GOOGLE_PLACES_API_KEY` (optional, degrades gracefully if missing)
- Validates `special_request` is non-empty

### 2. AI Recommendation (Claude API)
- Sends user input to Claude Sonnet (`claude-sonnet-4-5-20250929`)
- System prompt instructs Claude to return JSON with:
  - Restaurant name, address (best guess), one-liner, cuisine_type
  - Recommendation paragraph (2-3 sentences)
  - Insider tip
  - DondeAI score (0-10)
  - 7 vibe scores (date, group, family, business, solo, gem, romantic)
  - 3-6 tags
  - Atmospheric details: noise_level, lighting_ambiance, dress_code, outdoor_seating, live_music, pet_friendly, parking
- Claude is told to set phone, website, google_rating, google_review_count, google_place_id, sentiment_breakdown, and sentiment_score to `null` (enriched later)

### 3. Google Places Validation + Enrichment
- Searches Google Places Text Search API for `"{name} restaurant Chicago IL"`
- Location bias: Chicago center (41.8781, -87.6298), 40km radius
- Fuzzy name matching via trigram Jaccard similarity (threshold: 0.6)
- If verified, overwrites Claude's data with real:
  - `name` (Google's canonical display name)
  - `address` (Google's formatted address)
  - `phone` (Google's phone number)
  - `website` (Google's URL)
  - `google_rating` (real rating)
  - `google_review_count` (real count)
  - `google_place_id` (real ID)
  - `price_level` (mapped from Google's enum to $/$$/$$$/$$$$)

### 4. Retry Logic
- Up to 3 total attempts (1 initial + 2 retries)
- On each failure, the restaurant name is added to an exclusion list
- Retry prompt includes: "Do NOT recommend [excluded names]"
- If all attempts fail, returns first Claude result with `verified: false`

### 5. Response Formatting
- Strips markdown code fences from Claude's output if present
- Parses JSON, adds `success: true` and `verified: boolean`
- Returns to frontend

### 6. Error Handling
| Condition | HTTP Status | Message |
|---|---|---|
| Missing Anthropic key | 503 | "Server configuration error" |
| Empty craving | 400 | "Please tell us what you're craving" |
| Claude API error | 502 | "Our engine hit a snag" |
| Empty Claude response | 500 | "No recommendation generated" |
| JSON parse failure | 502 | "Got a response but couldn't read it" |
| Google Places error | — | Silently degrades (returns unverified) |
| Unexpected error | 500 | "Something went wrong" |

---

## What the Frontend Currently Handles

All of the following logic runs in the browser after receiving the backend JSON response:

### A. Data Interpretation & Computation

| Task | File | Description |
|---|---|---|
| **Cuisine detection** | `utils.js:98` | Scans `name`, `one-liner`, `cuisine_type`, `recommendation`, and `tags` for keyword matches (sushi, taco, pasta, etc.) to determine emoji icon and HSL hue for accent color |
| **Score tier classification** | `utils.js:175` | Converts `donde_score` string to integer, clamps 0-10, maps to tier (high/mid/low), verdict word ("Outstanding", "Excellent", etc.), and CSS class |
| **Score color mapping** | `utils.js:186` | Maps score to CSS variable (`--green`, `--ac`, `--rose`) |
| **Google star rendering** | `utils.js:193` | Converts `google_rating` string to full/half/empty star SVGs |
| **Price badge classification** | `app.js` | Maps price_level to badge modifier CSS class |
| **Noise badge classification** | `app.js` | Maps noise_level text to badge modifier CSS class |
| **Parking parsing** | `app.js` | Splits parking_availability string into individual parking type badges |
| **Maps URL construction** | `utils.js:205` | Builds `google.com/maps/search` URL from address |
| **Google Reviews URL** | `app.js:739` | Builds `google.com/maps/place` URL from `google_place_id` |
| **Share text formatting** | `share.js` | Compiles restaurant name, one-liner, recommendation, tip, address, website into shareable text |

### B. Visualization & Animation

| Task | File | Description |
|---|---|---|
| **Score ring animation** | `animations.js:12` | SVG circle stroke-dashoffset animation with spring easing, number count-up from 0 to score |
| **Google rating animation** | `app.js` | Animated reveal of rating number |
| **Radar chart** | `animations.js:76` | 6-axis spider chart (SVG) from vibe scores. Only renders if >= 3 dimensions present. Includes animated polygon fill |
| **Text reveal** | `animations.js:374` | "Chaos to order" letter-by-letter animation for recommendation paragraph |
| **Cuisine accent** | `app.js:643` | Sets `--cuisine-hue` CSS property on result card for border color |
| **Card entrance** | `app.js` | Staggered tile entrance animation with delays |

### C. Conditional Display Logic

| Task | Description |
|---|---|
| **Google tile visibility** | Hidden entirely if `google_rating` is null |
| **Radar tile visibility** | Hidden if fewer than 3 vibe scores present |
| **Insider tip visibility** | Hidden if `insider_tip` is null |
| **Website/Call links** | Only rendered if `website` / `phone` are non-null |
| **Atmosphere section** | Hidden if no ambiance, dress code, or boolean features present |
| **Parking badges** | Hidden if `parking_availability` is null |
| **Tags cloud** | Hidden if `tags` array is null or empty |
| **Sentiment bar** | Hidden if `sentiment_breakdown` is null |
| **Read more toggle** | Only shown if recommendation text overflows 7-line clamp |
| **Verified badge** | Shows "Verified on Google" (green) or "Not yet verified" (muted) based on `data.verified` |

### D. User Interaction Handling

| Task | Description |
|---|---|
| **Tile expand/collapse** | Score tile and radar tile are expandable on click/tap |
| **Read more/less toggle** | Expands/collapses recommendation text |
| **Share action** | Opens native share or custom share sheet |
| **Try Again** | Re-submits same query |
| **Start Over** | Resets all state back to step 0 |
| **Google tile click** | Opens Google Maps page for the restaurant |
| **Navigation tile click** | Opens Google Maps directions to address |

---

## Summary: Who Owns What

```
                      BACKEND                    FRONTEND
                   (edge function)              (browser)

  Restaurant       Claude picks it,              —
  selection        Google validates it

  Name / Address   Google enriches               Renders text
  Phone / Website  Google enriches               Renders links / click handlers

  Google Rating    Google provides as number      Renders stars SVG + animation
  Review Count     Google provides as number      Renders count text

  DondeAI Score    Claude generates (string)      Parses to int, tier, verdict,
                                                  color, ring animation

  Vibe Scores      Claude generates (strings)     Parses, renders radar SVG

  Recommendation   Claude writes                  Renders with text animation
  Insider Tip      Claude writes                  Conditional display
  Tags             Claude generates               Renders pill cloud

  Cuisine Type     Claude generates (string)      Keyword-scans all text for
                                                  emoji + HSL hue mapping

  Atmosphere       Claude generates               Conditional badge rendering
  (noise, dress,                                  with modifier CSS classes
   parking, etc.)

  Sentiment        Claude generates (currently    Stacked bar chart rendering
                   always null)                   (currently never shown)

  Verified Status  Backend sets boolean           Renders badge

  Score Tier       —                              Computes from donde_score
  ("Outstanding")

  Maps URLs        —                              Builds from address/place_id

  Star SVGs        —                              Builds from google_rating

  Share Text       —                              Compiles from multiple fields

  All Animations   —                              Score ring, radar, text reveal,
                                                  card entrance, tile stagger
```

---

## Key Observations

1. **The backend is stateless** — no database, no cache. Every request is a fresh Claude call + Google Places lookup.

2. **Score interpretation is entirely frontend** — Claude returns a raw string ("8.5"), and the frontend decides tier, verdict word, color, and animation.

3. **Cuisine detection is entirely frontend** — Claude provides `cuisine_type` as a string, but the frontend independently scans all text fields for keywords to derive emoji and accent hue.

4. **Sentiment is dead** — The backend tells Claude to always return `null` for sentiment fields. The frontend has rendering code for it but it never activates.

5. **The frontend timeout is 25 seconds** — to accommodate up to 3 Claude calls + 3 Google Places calls in the worst-case retry scenario.

6. **Google data can be null** — If `GOOGLE_PLACES_API_KEY` is not set, or Google Places fails, or all retries fail, the response comes back with `verified: false` and all Google fields as `null`. The frontend hides the Google rating tile entirely in this case.
