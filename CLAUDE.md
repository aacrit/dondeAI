# DondeAI Frontend

Last updated: 2026-02-27

> **Read `AGENT-TEAMS.md` and all `docs/*.md` files for context before making changes. Only open source files when modifying code.**

AI restaurant recommendations for Chicago. One craving in, one perfect spot out.

## Documentation Index

| Doc | Contents |
|-----|----------|
| `AGENT-TEAMS.md` | Claude Code subagent skills and QA agent references |
| `docs/ARCHITECTURE.md` | Repo structure, tech stack, module graph, CSS load order, state shape |
| `docs/DESIGN-SYSTEM.md` | Themes, tokens, typography, motion, Ink Rule, breakpoints, accessibility |
| `docs/FEATURES.md` | User-facing feature checklist with implementation status |
| `docs/TEST-CASES.md` | Manual test suite (no automated frontend tests exist) |
| `docs/TEST-CRITICAL.md` | 10-item smoke test for quick validation |

## Skill

**`/frontenddesign`** — design enforcement (`.claude/skills/frontenddesign/SKILL.md`). Auto-activates on UI/animation/layout tasks.

## API Contract (Immutable)

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
Authorization: Bearer <supabase-anon-key>
apikey: <supabase-anon-key>
Timeout: 15s (AbortController on frontend)
```

**Request:**
```json
{
  "special_request": "string (required, max 500)",
  "occasion": "string (default: Any)",
  "neighborhood": "string (default: Anywhere)",
  "price_level": "string (default: Any)",
  "exclude": ["uuid (max 15)"],
  "dietary_restrictions": ["string (max 5, 30 chars each)"],
  "user_id": "uuid",
  "feedback": {"restaurant_id": "uuid", "feedback": "like|dislike"},
  "time_of_day": "breakfast|lunch|dinner|late_night"
}
```

**Response (V7 — current):**
```json
{
  "success": true,
  "restaurant": { "id", "name", "address", "cuisine_type", "google_rating",
    "google_review_count", "price_level", "noise_level", "lighting_ambiance",
    "outdoor_seating", "live_music", "pet_friendly", "parking_availability",
    "dietary_options", "sentiment_score", "neighborhood_name",
    "photo_urls", "opening_hours", "review_snippets", "..." },
  "recommendation": "string (100-120 words)",
  "insider_tip": "string|null",
  "donde_match": "integer 0-99",
  "scores": { "date_friendly_score", "group_friendly_score", "family_friendly_score",
    "business_lunch_score", "solo_dining_score", "hole_in_wall_factor", "romantic_rating" },
  "scoring_v7": {
    "food", "vibe", "service", "reputation", "convenience",
    "weights_used", "weight_shift_reasons", "confidence", "data_completeness",
    "factor_details", "intent_alignment": {"score", "cuisine", "dish", "vibe", "constraints"}
  },
  "scoring_v5": "<alias of scoring_v7 — kept for backward compat>",
  "match_narrative": {
    "strongest_factor", "key_signals", "summary", "weak_spots", "comparison_context"
  },
  "ranked_queue": [
    { "rank", "restaurant", "donde_match", "scoring_v7", "match_headline" }
  ],
  "deep_context": { "signature_dishes", "service_style", "reservation_difficulty", "..." },
  "tags": ["string"],
  "intent_boost": { "active", "reason", "boost_points", "base_score" },
  "timestamp": "ISO"
}
```

**Errors:** HTTP non-200 → toast + return to canvas | `success:false` → show `recommendation` as error | network → "Couldn't reach the engine." | timeout → "Request timed out."

**Health:** `GET /recommend` → `{status, version, timestamp}`

## Key State Shape (`state.js`)

```js
{ step, craving, occasion, neighborhood, priceLevel, dietaryRestrictions,
  result, loading, error, excludeIds,
  rankedQueue: [],       // V7: pre-computed top 5 for instant Try Again
  rankedQueueIndex: 0,   // V7: current position in ranked queue
  theme: {culture, mode}, colorMode, soundEnabled, history, pendingFeedback }
```

## Run

Open `index.html` in browser. No build step, no dependencies, no env vars.

## Coding Standards

- **HTML:** Semantic, all interactives focusable + named, `lang="en"`, `data-action` attrs
- **CSS:** All values via custom properties, mobile-first `min-width`, `clamp()` fluid, no `!important`, BEM-like naming
- **JS:** ES modules, plain objects + functions, event delegation via `data-action`, `requestAnimationFrame`, cached DOM queries, `AbortController`, no circular deps
- **Motion tokens:** `--dur-instant`(0) through `--dur-score`(1200), all → 0ms under reduced-motion
- **Z-index:** `--z-base`(1) → `--z-particle`(500)

## V7 Key Files

| File | V7 Changes |
|------|-----------|
| `js/animations.js` | `renderScoreHero(dm, scores, v2, sentiment, timers, matchNarrative)` — factor constellation rings, narrative reveal, weight badges, signal chips |
| `js/app.js` | Try Again instant queue (rankedQueue state), card swap animation, `match_narrative` passed through |
| `js/api.js` | Extracts `ranked_queue` + normalizes `scoring_v7`/`scoring_v5` keys |
| `js/state.js` | `rankedQueue` + `rankedQueueIndex` added to state shape |
| `index.html` | Score hero SVG: 5 factor ring `<circle>` elements + narrative `<span>` |
| `css/components.css` | `.score-hero__factor-ring`, `.score-hero__narrative`, `.factor-row__weight-badge`, `.factor-row__signal-chip`, `.result-card--swapping-*` |
| `css/animations.css` | `@keyframes factorRingFill`, `ringPulse`, `cardSwapOut`, `cardSwapIn` |
