# DondeAI Frontend

Last updated: 2026-03-02

AI restaurant recommendations for Chicago. One craving in, one perfect spot out.

## Session Protocol (Token Minimization)

1. **Read MD files first** — `CLAUDE.md` → `docs/DESIGN-SYSTEM.md` → `docs/ARCHITECTURE.md`. These contain all context needed for most tasks.
2. **Read code on demand** — Only open source files when you need to modify or inspect specific sections. Use Grep/Glob to find exact locations rather than reading entire files.
3. **Never read entire large files** — `app.js` (~4000 lines), `components.css` (~6000 lines), and `index.html` (~1500 lines) are too large. Read specific line ranges using offset/limit.
4. **Use the doc index below** — Each doc covers a specific domain. Only read what's relevant to your task.

## Documentation Index

| Doc | When to read |
|-----|-------------|
| `docs/DESIGN-SYSTEM.md` | UI, animation, layout, theme, or visual tasks |
| `docs/ARCHITECTURE.md` | Code structure, module deps, state, event system |
| `docs/FEATURES.md` | Feature status, what's implemented vs planned |
| `docs/TEST-CRITICAL.md` | Quick 10-item smoke test before pushing |
| `docs/TEST-CASES.md` | Full manual test matrix |
| `AGENT-TEAMS.md` | Subagent skills and QA references |

## Design Philosophy — "Ink & Momentum" (V10)

**Core idea:** Every interaction feels like writing a wish on paper and watching it come to life.

### V10 Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Score display | Circle ring + RAG colors (green ≥80, amber ≥60, red <60) | Instant quality signal |
| Tier 1 stack | Photos → Score + Name → Blurb → Address + Actions | Minimal, content-first |
| Tier 1 removed | Match headline, signal chips, one-liner, quick tags | Redundant — blurb + factor bars suffice |
| Photo layout | Horizontal scroll strip (equal sizes, scroll-snap) | Clean, swipeable |
| Known For | Inline pills in Tier 2 (after story) | Reduce Tier 1 density |
| Loading | Instant slide + 300ms fade (score count-up only animation) | No scaffold, no carousel, no stagger |
| Blurb | Full text, no height cap, simple 300ms fade | Content-first |
| Footer | 2-row: Going + Try Another / Feedback + Start Over | Compact |
| Canvas history | Unified "Your Spots" (recent + saved + visited) | Single section vs three |
| Signal chips | Removed entirely | Factor bars sufficient |

### Animation Consistency Rules

All open/close and in/out animations must be **symmetric** (same duration + easing both directions):

| Pattern | Duration | Easing |
|---------|----------|--------|
| Step track slide | 450ms | var(--spring) |
| Filter drawer open/close | 300ms | var(--ease-out) |
| Tier 2 expand/collapse | 450ms | var(--ease-out) |
| Card swap out/in | 300ms | var(--ease-out) |
| Back button show/hide | 300ms | var(--spring) |
| Canvas morph/restore | 400ms | var(--ease-out) |
| Score count-up | 1200ms | cubic ease-out |

**Sequencing rule:** Canvas morph completes (400ms) before step slide begins. No overlapping animations.

## Skill

**`/frontenddesign`** — auto-activates on UI/animation/layout tasks. See `.claude/skills/frontenddesign/SKILL.md`.

## API Contract (Immutable)

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
Authorization: Bearer <supabase-anon-key>
apikey: <supabase-anon-key>
Timeout: 15s (AbortController)
```

Request: `{ special_request, occasion, neighborhood, price_level, exclude[], dietary_restrictions[], user_id, feedback, time_of_day }`

Key response fields: `{ success, restaurant{...}, recommendation, insider_tip, donde_match(0-99), scores{...}, scoring_v7{ food, vibe, service, reputation, convenience, factor_details, intent_alignment }, match_narrative{ strongest_factor, key_signals, summary }, ranked_queue[{ rank, restaurant, donde_match, scoring_v7 }], deep_context, tags[], intent_boost, timestamp }`

Errors: HTTP non-200 → toast + canvas | `success:false` → show `recommendation` | network → "Couldn't reach the engine." | timeout → "Request timed out."

## State Shape (`state.js`)

```js
{ step, craving, occasion, neighborhood, priceLevel, dietaryRestrictions,
  result, loading, error, excludeIds,
  rankedQueue: [], rankedQueueIndex: 0,
  theme: {culture, mode}, colorMode, soundEnabled, history, pendingFeedback }
```

## Run

Open `index.html` in browser. No build step, no dependencies, no env vars.

## Coding Standards

- **HTML:** Semantic, `data-action` event delegation, all interactives focusable
- **CSS:** Custom properties only, mobile-first `min-width`, `clamp()` fluid, BEM-like, no `!important`
- **JS:** ES modules, plain objects + functions, `requestAnimationFrame`, cached DOM queries, `AbortController`, no circular deps
- **Motion:** Duration tokens `--dur-instant`(0) → `--dur-score`(1200), all → 0ms under reduced-motion. Spring for user actions, ease-out for system reveals. Symmetric open/close timings.
- **Z-index:** `--z-base`(1) → `--z-particle`(500)
- **RAG colors:** `--rag-green`(≥80), `--rag-amber`(≥60), `--rag-red`(<60) — theme-independent, defined in tokens.css
