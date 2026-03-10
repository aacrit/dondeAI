# DondeAI — CEO Strategic Review

**Board-Level Memo | March 10, 2026**

---

## Current State Assessment

**What's world-class:** The scoring engine (V11) is genuinely sophisticated — relevance gating, semantic concept matching, 6 weight profiles, review intelligence with 912 deep profiles. This is not a wrapper around an LLM. This is a real recommendation engine. The design system ("Ink & Momentum") is locked, coherent, and has the kind of philosophical rigor I've only seen at Arc and Apple. Five cultural themes with auto-detection is a feature most companies 100x your size haven't attempted.

**What's strong:** Documentation is exceptional — I've seen Series C startups with worse architectural docs. The backend has 18 data pipelines, 8 CI/CD workflows, a 50-case golden dataset with 88% pass rate, and a proper fallback chain. The CEO Command Center shows operational maturity. Claude Code as your development workflow is a genuine force multiplier.

**What's missing:** Monetization strategy. Growth engine. Mobile distribution. Learning flywheel. The product is a Michelin-starred restaurant with no sign on the door.

---

## Top 10 Recommendations

### 1. Ship the Learning Flywheel — Yesterday

**The Insight:** Google became Google because every search made the next search better. DondeAI logs queries and feedback to `user_queries`, but the scoring engine doesn't learn from them. You have the data infrastructure (`restaurant_popularity`, `user_searches`, `user_favorites`) — but none of it feeds back into relevance or quality scoring. At Arc, we watched user behavior reshape the product daily. You're leaving your most valuable data on the floor.

**What to Build:**
- Weight `recommendation_count_7d` and `trending_score` into the reputation factor (they exist in the schema but aren't used in scoring)
- Track accept/reject/Try Another patterns per query type → adjust weight profiles over time
- Use `user_favorites` as implicit "this was a great recommendation" signal → boost those restaurants for similar future queries
- Weekly pipeline: aggregate feedback → compute "user-validated quality" per restaurant → blend into quality score at 10-20% weight

**Effort:** M (2 weeks — data is already there, scoring hooks exist)
**Impact:** Scoring accuracy compounds over time. Every user interaction makes the next recommendation better. This is how you build a moat that competitors can't replicate.

---

### 2. Build the "Told You So" Moment

**The Insight:** At Apple, we learned that the most powerful marketing is the moment when the product proves it was right. DondeAI recommends a restaurant — but then the relationship ends. You have no idea if the user went, if they loved it, if they'd go back. The "Going" button exists in the footer, but it's a dead end. This is a tragedy. The moment someone goes to your pick and has an amazing time is the single most powerful conversion event possible.

**What to Build:**
- Post-visit nudge: 2 hours after "Going" tap → push notification / email: "How was [restaurant]?"
- 3-tap rating: thumbs up / meh / thumbs down + optional 1-sentence note
- If thumbs up → "Share this spot with a friend?" → pre-filled share sheet with their mini-review
- Display "X people went on Donde's recommendation" on restaurant cards (social proof)
- Feed this data back into recommendation #1 (the flywheel)

**Effort:** M (notification infra needed — but Supabase has push via edge functions)
**Impact:** Retention (brings users back), virality (organic sharing after positive experience), data quality (real-world validation of scores)

---

### 3. Kill the Browser, Ship a PWA

**The Insight:** You're building a premium mobile experience served as a webpage. That's like serving a $200 tasting menu on a paper plate. The architecture is actually PWA-ready — no build step, vanilla JS, service worker would be trivial. You're one `manifest.json` and a service worker away from "Add to Home Screen" with an app icon, splash screen, and offline capability. Arc proved that the container changes how people perceive quality.

**What to Build:**
- `manifest.json` with proper icons, theme colors, `display: standalone`
- Service worker for offline caching of static assets + last recommendation
- "Add to Home Screen" prompt after second use (not first — earn it)
- iOS meta tags for splash screen, status bar styling
- App-like navigation (no browser chrome)

**Effort:** S (3-5 days — you already have `offline.js` for connectivity detection)
**Impact:** Retention (home screen = 3x return rate vs bookmark), perceived quality (feels like an app, not a website), distribution (shareable install link)

---

### 4. Own "Friday Night in Chicago"

**The Insight:** At Google, we learned that owning the moment of intent is worth more than owning the category. DondeAI shouldn't try to be "the restaurant app" — it should own the specific moment: "It's 7pm, I'm hungry, I don't know where to go." You have `time_of_day` intelligence. You have occasion filters. But you're not marketing to the moment. You're marketing to the category.

**What to Build:**
- SEO landing pages: "Best date night restaurants in Wicker Park tonight" — dynamically generated from your 913 restaurants + occasion scores
- Instagram/TikTok content: "Donde picked my Friday night dinner" — 15-second format showing craving → recommendation → actual meal
- Weekly "Chicago Tonight" email/push: 3 curated picks based on trending data, weather, day of week
- Partnership with 2-3 Chicago food influencers: "Let Donde pick for me" challenge

**Effort:** M (SEO pages are L, but social + email are S)
**Impact:** Acquisition (SEO is your free growth channel), brand positioning (moment owner, not category player)

---

### 5. Make the Score the Star

**The Insight:** At Anthropic, we agonized over how to make AI output trustworthy. Claude's "thinking" feature was the breakthrough — showing reasoning builds trust. DondeAI has `match_narrative` with `strongest_factor`, `key_signals`, and `summary`. But it's buried in Tier 2, behind "Show More." The score is a number — and numbers without context are meaningless. A "78" means nothing. "78 because their handmade pasta matches exactly what you craved, and they're in your budget" means everything.

**What to Build:**
- Surface `match_narrative.summary` as a single line directly below the score ring in Tier 1. One sentence. "Strong match for your craving — their handmade pasta is the real deal."
- Make the score ring tappable → expands inline to show the 5 factor bars (food, vibe, service, reputation, convenience) without navigating to Tier 2
- Add "Why this score?" micro-copy below the ring to signal it's interactive

**Effort:** S (data already exists in the API response — this is pure frontend)
**Impact:** Trust (users understand and believe the score), engagement (tappable score is a discovery moment), differentiation (no competitor explains their rankings this way)

---

### 6. The "Concierge Unlock" — Your Monetization Path

**The Insight:** You're not going to monetize with ads (kills the premium feel) or with restaurant commissions (kills trust). The monetization model is **personal concierge**. Free tier: unlimited recommendations. Premium ($4.99/mo or $39.99/yr): saved taste profile, priority queue (your recommendations learn faster), reservation assist (direct link / integration), group dining coordinator, "Surprise Date Night" (full evening planned — restaurant + cocktail bar + dessert spot).

**What to Build (V1 — validate demand):**
- "Unlock your taste profile" gate after 5th search → show them their emerging taste pattern (you have this data in `user_searches`)
- "Want us to remember your preferences?" → premium signup
- Stripe integration via Supabase (they have billing primitives)
- Premium badge on profile, priority in response cache

**Effort:** L (payment infra + taste profile engine)
**Impact:** Revenue (even 1000 paying users at $4.99/mo = $60K ARR — enough to fund operations and prove the model)

---

### 7. Expand the Data Moat Before Someone Copies You

**The Insight:** 913 restaurants is strong for Chicago. But your real moat isn't the count — it's the 38-field deep profiles, the 7-dimension occasion scores, the review intelligence with dish catalogs and semantic tags. Nobody else has this. But data moats erode if you don't actively expand them. Your discovery pipeline runs monthly. That's not fast enough.

**What to Build:**
- Increase discovery pipeline frequency to weekly for net-new restaurants (Chicago restaurant scene changes fast)
- Add "Suggest a restaurant" in the app footer → user-submitted additions (with validation pipeline)
- Track "no good match found" queries → identify gaps in your coverage (you have `unmatched_keywords` in `user_queries` — mine it)
- Target coverage gaps: your 14 neighborhoods likely have uneven depth. Which neighborhoods have <50 restaurants? Fill them first.
- Add a "freshness" dimension: when was the restaurant last validated as open and accurate? Surface this.

**Effort:** M (pipeline infrastructure exists — this is tuning frequency and adding a user submission flow)
**Impact:** Quality (fewer stale/closed recommendations), coverage (fewer "no match" results), defensibility (deeper data = harder to replicate)

---

### 8. Accessibility Is Your Secret Weapon

**The Insight:** You already have WCAG 2.1 AA with keyboard nav, focus management, reduced motion, and semantic HTML. This is genuinely rare for a startup. Don't just comply — market it. The accessibility community is loyal, vocal, and under-served by food apps. Yelp's accessibility is terrible. Google Maps is marginally better. You're already ahead.

**What to Build:**
- Screen reader optimization pass: ensure every state change has `aria-live` announcements (score reveal, restaurant name, Try Again swap)
- Voice-first flow: your Web Speech Recognition exists — make it the primary input, not secondary. "Hey Donde, I'm craving Thai near Logan Square."
- High-contrast mode as a toggle (beyond just light/dark)
- Publish an accessibility statement page
- Reach out to 2-3 disability-focused food bloggers/influencers

**Effort:** S-M (most infrastructure exists)
**Impact:** Brand differentiation, loyal community, potential press coverage ("the accessible restaurant app"), and it's the right thing to do

---

### 9. Harden for Launch

**The Insight:** You're running a production service with `supabase-anon-key` visible in the frontend JavaScript. Your rate limiting is soft (logs a warning). Your cache is in-memory (dies on cold start). These are fine for beta. They are not fine for press coverage, a Product Hunt launch, or any scenario where you get 10K users in a day.

**What to Build:**
- Move sensitive operations behind a proper API gateway (Supabase already supports this via RLS + service role separation — but audit it)
- Upgrade rate limiting from soft to hard (429 with retry-after header)
- Add Redis or Supabase-native caching (in-memory LRU dies on Edge Function cold starts)
- Implement basic abuse detection: repeated identical queries, exclude list manipulation, feedback spam
- Security audit the CEO Command Center — it's an admin dashboard that likely has broader access than it needs
- Run `/donde-ciso` before any public launch

**Effort:** M
**Impact:** Prevents embarrassing failures at the worst possible moment (launch day). Security incidents kill trust permanently.

---

### 10. Build the Chicago Story

**The Insight:** The single biggest mistake AI startups make is launching as "AI-powered [category]." Nobody cares about AI. People care about outcomes. DondeAI should launch as "Chicago's restaurant concierge" — not "an AI restaurant recommendation engine." The AI is the how, not the what. Arc didn't launch as "a Chromium fork." Apple didn't launch the iPhone as "a mobile Unix computer."

**What to Build:**
- Landing page: "One craving. One perfect spot. Chicago." — no mention of AI above the fold
- Chicago-specific content: neighborhood guides powered by your data (you have 14 neighborhoods with descriptions + restaurant density)
- Partner with 1 Chicago food publication for launch coverage (Time Out Chicago, Chicago Magazine, Eater Chicago)
- Launch event: "Let Donde pick dinner for 100 Chicagoans" — real people, real recommendations, real reactions
- Testimonial collection: "I asked for [craving] and Donde sent me to [restaurant] and it was [amazing/perfect/exactly right]"

**Effort:** M (content + partnerships, not engineering)
**Impact:** This is how you acquire your first 10,000 users. Not through features. Through story.

---

## The One Thing

If you can only do ONE of these ten: **#1 — Ship the Learning Flywheel.**

Here's why: everything else — the PWA, the monetization, the growth, the data moat — gets better when your recommendations get better. And your recommendations only get better if you close the loop between "what we recommended" and "what the user actually loved." You have the data infrastructure. You have the feedback signals. You have the scoring engine hooks. You're one pipeline away from a product that gets smarter every day.

The difference between a good recommendation engine and a great one isn't the algorithm — it's the data loop. Google didn't win search with PageRank. They won it because every click taught them what people actually wanted. Build your version of that, and everything else follows.

---

*Review prepared based on comprehensive analysis of both frontend and backend repositories, all documentation, architecture, scoring engine, data schema, and feature status as of March 10, 2026.*
