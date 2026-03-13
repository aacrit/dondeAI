# DondeAI Optimization Recommendations

Last updated: 2026-03-13

Strategic optimization assessment by CEO Advisor. Ranked by impact × feasibility.

---

## 1. Break the `app.js` Monolith (In Progress)

**Insight:** `app.js` is ~5,000 lines — orchestrator, renderer, event handler, and loading flow manager in one file. This is the biggest technical debt in the frontend and slows every future change.

**What to Build:**
- Extract rendering functions into `js/render.js` (renderResult, renderPhotos, renderKnownFor, renderYourSpots)
- Extract loading/transition flow into `js/transitions.js` (beginCanvasFold, manifestResult, reverseCanvasFold, unfoldResultToCanvas)
- Extract event handling into `js/events.js` (the data-action switch)
- Keep `app.js` as a thin orchestrator that imports and wires these modules

**Progress:** Scaffold modules created (`render.js`, `transitions.js`, `events.js`) with target function groups documented. Shared globals extracted to `globals.js` (DOM refs, haptics, AbortController, animation timers). Functions not yet migrated — still live in `app.js`. New utility modules added: `motion.js` (timeline API), `spring.js` (Motion One spring physics).

**Effort:** M (1-2 weeks)
**Impact:** Developer velocity, bug surface reduction, future feature speed

---

## 2. Build the Learning Flywheel

**Insight:** User history (searches, favorites, feedback) is collected but the scoring engine doesn't consume it. Every query that doesn't improve the next query is a wasted signal.

**What to Build:**
- Feed accepted/rejected restaurant history into the scoring pipeline as a preference signal
- Weight neighborhoods, cuisines, and price levels the user gravitates toward (frequency counts)
- Add a `user_preference_profile` materialized view: top 3 cuisines, avg price level, preferred neighborhoods, favorite occasion types
- Use as tiebreaker in ranked queue when quality scores are within 5 points

**Effort:** L (month+, shippable incrementally — frequency counts first, then tiebreaking)
**Impact:** Retention, recommendation quality, "it knows me" moments — long-term moat

---

## 3. Frontend Performance: Lazy-Load Below the Fold

**Insight:** Tier 2 content (score hero, factor bars, known-for pills, story, profile facts) is rendered eagerly even though it's behind "Show More." Photo strip loads all images upfront. Free performance left on the table.

**What to Build:**
- Defer Tier 2 DOM construction until user taps "Show More" (render on demand, not on hide)
- Add `loading="lazy"` to all photo `<img>` elements except the first visible one
- Use `IntersectionObserver` for photo scroll strip to load images as they approach viewport
- Track Time to Interactive on result view before/after

**Effort:** S (days)
**Impact:** Faster perceived performance, lower memory usage on mobile, smoother scroll

---

## 4. Cache Smarter — Prefetch the Ranked Queue

**Insight:** The ranked queue (2-5 pre-computed results) makes "Try Another" instant. But the first recommendation still requires a full API round-trip. That's the bottleneck.

**What to Build:**
- For returning users: prefetch a "top pick" based on last occasion + neighborhood combo on app load (background fetch, cached)
- Increase ranked queue depth from 2-5 to 5-8 for common query patterns
- Add `stale-while-revalidate` semantics to 5-min cache: serve cached result immediately while refreshing in background
- Track cache hit rate as a KPI (target: 30%+ for returning users)

**Effort:** M (1-2 weeks)
**Impact:** Time-to-first-recommendation drops for returning users, "Try Another" runs out less often

---

## 5. Make the Match Narrative Unmissable (THE ONE THING)

**Insight:** `match_narrative` (strongest factor, key signals, summary, weak spots) is genuinely good content but buried in Tier 2. Users see a score and blurb but don't understand *why this score, why this place.* The narrative is the trust layer.

**What to Build:**
- Surface `strongest_factor` as single-line callout below score ring in Tier 1 (e.g., "Matched on: exceptional ramen noodle quality")
- Style as `type-data` (JetBrains Mono), muted, small — confidence signal, not headline
- Keep full narrative in Tier 2; strongest signal at glance level
- Follows Ink Rule: structural data, not accent-colored, stays neutral

**Effort:** S (days)
**Impact:** Trust, transparency, word-of-mouth — "it doesn't just pick a place, it tells you *why*"

---

## Priority Sequence

1. **This week:** #5 (Match Narrative) + #3 (Lazy Loading) — both S effort, immediate user impact
2. **Next sprint:** #4 (Smart Caching) + #1 (Monolith Breakup) — in parallel
3. **Q2 initiative:** #2 (Learning Flywheel) — incremental rollout
