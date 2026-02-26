# DondeAI Frontend

Last updated: 2026-02-26

> **Read all `docs/*.md` files for context before making changes. Only open source files when modifying code.**

AI restaurant recommendations for Chicago. One craving in, one perfect spot out.

## Documentation Index

| Doc | Contents |
|-----|----------|
| `docs/ARCHITECTURE.md` | Repo structure, tech stack, module graph, CSS load order, state shape |
| `docs/DESIGN-SYSTEM.md` | Themes, tokens, typography, motion, Ink Rule, breakpoints, accessibility |
| `docs/FEATURES.md` | User-facing feature checklist with implementation status |
| `docs/AGENT-TEAMS.md` | Claude Code subagent skills and QA agent references |
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

**Response:**
```json
{
  "success": true,
  "restaurant": {
    "id", "name", "address", "best_for_oneliner", "google_place_id",
    "google_rating", "google_review_count", "price_level", "phone", "website",
    "noise_level", "cuisine_type", "lighting_ambiance", "dress_code",
    "outdoor_seating", "live_music", "pet_friendly", "parking_availability",
    "dietary_options", "sentiment_breakdown", "sentiment_score", "sentiment_summary",
    "sentiment_positive", "sentiment_negative", "sentiment_neutral",
    "neighborhood_name", "photo_urls", "opening_hours", "review_snippets"
  },
  "recommendation": "string (100-120 words)",
  "insider_tip": "string|null",
  "donde_match": "numeric 60-99",
  "scores": { "date_friendly_score", "group_friendly_score", "family_friendly_score",
    "business_lunch_score", "solo_dining_score", "hole_in_wall_factor", "romantic_rating" },
  "scoring_v5": { "food", "vibe", "service", "reputation", "convenience",
    "weights_used", "weight_shift_reasons", "confidence", "data_completeness" },
  "deep_context": { "signature_dishes", "service_style", "reservation_difficulty", "..." },
  "tags": ["string"],
  "intent_boost": { "active", "reason", "boost_points", "base_score" },
  "timestamp": "ISO"
}
```

**Errors:** HTTP non-200 → toast + return to canvas | `success:false` → show `recommendation` as error | network → "Couldn't reach the engine." | timeout → "Request timed out."

**Health:** `GET /recommend` → `{status, version, timestamp}`

## Run

Open `index.html` in browser. No build step, no dependencies, no env vars.

## Coding Standards

- **HTML:** Semantic, all interactives focusable + named, `lang="en"`, `data-action` attrs
- **CSS:** All values via custom properties, mobile-first `min-width`, `clamp()` fluid, no `!important`, BEM-like naming
- **JS:** ES modules, plain objects + functions, event delegation via `data-action`, `requestAnimationFrame`, cached DOM queries, `AbortController`, no circular deps
- **Motion tokens:** `--dur-instant`(0) through `--dur-score`(1200), all → 0ms under reduced-motion
- **Z-index:** `--z-base`(1) → `--z-particle`(500)
