# CEO Command Center

> DondeAI's operational cockpit — real-time quality monitoring, agent-driven testing, and data-pipeline orchestration in a single dark-mode dashboard.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│  command-center.html  (CEO Frontend — admin-gated)      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Pulse    │  │ Agent    │  │ Analytics│  │ Data   │  │
│  │ Cards    │  │ Runner   │  │ & Gaps   │  │ Health │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │             │             │       │
│  cc-ui.js    cc-agents.js  cc-analytics.js  cc-config.js│
└───────┼──────────────┼─────────────┼─────────────┼──────┘
        │    Supabase   │   REST/RPC  │   Insert    │
        ▼              ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Edge Functions + Auth)          │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────────┐ │
│  │ recommend    │ │ gauntlet_runs │ │ maintenance_   │ │
│  │ (Edge Fn)    │ │ & _results    │ │ requests       │ │
│  └──────┬───────┘ └───────────────┘ └───────┬────────┘ │
└─────────┼───────────────────────────────────┼──────────┘
          │                                   │ poll (5 min)
          ▼                                   ▼
┌─────────────────────┐    ┌──────────────────────────────┐
│  Scoring Engine V11 │    │ maintenance-worker (GH Action)│
│  Intent → Filter →  │    │ discovery | enrichment |      │
│  Score → Rank       │    │ scores_tags | audit           │
└─────────────────────┘    └──────────────────────────────┘
```

---

## Frontend

### Entry Point

**`command-center.html`** — Standalone dark-mode dashboard, admin-gated to `aacrit@gmail.com` via Supabase Google SSO.

### Module Map

| Module | Role |
|--------|------|
| **cc-config.js** | Constants, agent definitions, edge probes, golden queries, pipeline defs, global state, helpers (`ragClass`, `ragColor`, `determineGapType`) |
| **cc-agents.js** | Agent orchestration — calls `/recommend`, manages budgets, XP/level system, category/difficulty filtering |
| **cc-analytics.js** | Auth check, loads gauntlet data from Supabase or local JSON, renders quality metrics & gap analysis |
| **cc-ui.js** | Pulse cards, action center, live feed (2-line layout), query detail panel (with grades), sparklines, grade heatmap, run history, freshness indicator, KPI click handlers, test vs prod comparison |
| **cc-queries.js** | 1,042 Chicago test queries across 5 categories (Food, Vibe, Service, Rep, Conv) with difficulty tiers |

### UI Zones

1. **Pulse Cards** — System Health %, Avg DondeMatch, Needs Attention count. RAG-colored (green ≥ 80, amber ≥ 60, red < 60). Click to expand trend detail.
2. **Action Center** — Top 3 actionable issues across test + production. One-click navigation to filtered views. Shows "All Clear" when no issues.
3. **Test vs Production Strip** — Side-by-side comparison: DM, Score Fit, Blurb Quality for latest test run vs 7-day production average. Amber border if prod >10% worse than test.
4. **Grade KPI Strip** — Score Fit grade, Blurb Quality grade, Grade Pass Rate (from latest test run).
5. **Live Tab** — Filter bar + 12 KPIs (with sparkline trends on 4 key metrics) + inline grade issues section (top 5 below-B queries) + score distribution + API health + two-line live feed entries with grade badges.
6. **Test Tab** — 6 test types + run history (color-coded rows with delta arrows) + grade heatmap in run details.
7. **Issues Tab** — Root-cause grouped issues with severity, fix prompts, retest capability, executive summary.
8. **Data Tab** — DB overview + pipeline status + data coverage.
9. **Query Detail Panel** — Slide-out panel with DondeMatch, Score Fit grade card, Blurb Quality grade card, fix prompts for below-B grades, restaurant details, blurb.
10. **Data Freshness Indicator** — Header shows time since last data refresh. Amber >5m, red >15m.
11. **Cross-Tab Navigation** — Grade Issues, Fallback Rate, Avg Fit, Avg Blurb KPIs are clickable — navigate to filtered Issues/Live views.

### Agents

| Agent | Color | Purpose |
|-------|-------|---------|
| **Atlas** | Blue `#3b82f6` | Broad-coverage golden-query runner |
| **QAudit** | Purple `#8b5cf6` | Quality auditor — deep score analysis |
| **Sentinel** | Amber `#f59e0b` | Edge-case & security probe runner (20 probes: SQLi, XSS, empty, unicode…) |
| **Hunter** | Red `#ef4444` | Gap hunter — targets known weaknesses |
| **Guardian** | Green `#22c55e` | Regression guard — re-tests previous failures |

Each agent has an XP/level system, per-session budget drawn from a daily $50 cap, and AbortController-based 15 s API timeout.

### Keyboard Shortcuts

`t` Run Tests · `r` Rerun & Compare · `d` Check Data · `1-3` Toggle sections · `?` Show help · `Esc` Close overlays

### Design Tokens

- **Palette:** `--cc-bg: #0c0d0f`, `--cc-surface: #16181c`, `--cc-accent: #8b8ff5`
- **Typography:** Inter (body), JetBrains Mono (data)
- **Motion:** Spring physics for user actions, ease-out for system reveals

---

## Backend

### Supabase Edge Functions

| Function | Method | Purpose |
|----------|--------|---------|
| **`recommend`** | POST | V11 recommendation engine — intent classification → candidate filtering → scoring → ranking. Returns `restaurant`, `donde_match`, `scoring_v9`, `match_narrative`, `ranked_queue[]`. |
| **`recommend`** | GET | Health check: `{status, version, engine, timestamp}` |
| **`review-intelligence`** | POST | Extracts dish catalogs and cuisine signals from reviews. |

**Scoring V11 formula:** `Relevance(0–1) × Quality(0–100) + OccasionBonus(±5)`
- 40+ semantic concepts, dynamic weight profiles per query type, self-healing for NULL fields.
- Rate-limited: 30 req/min/IP (429 on breach).
- Response cache: 5-min TTL, 100 entries, stale-while-revalidate at 15 min.

### Database Tables (CEO-Relevant)

| Table | Purpose |
|-------|---------|
| **`maintenance_requests`** | Queue for pipeline operations. Columns: `operation`, `status` (pending → running → complete/failed), `requested_by` (default `ceo`), `config` JSONB, `result` JSONB, `stages` JSONB. |
| **`gauntlet_runs`** | Test run summaries — `passed_60/80/90`, `avg_dm`, gap counts, category stats, delta vs prior run. |
| **`gauntlet_results`** | Per-query scores, factor breakdowns, gap analysis per run. |
| **`restaurant_popularity`** | 7d/30d recommendation counts, trending score (0–10), query demand score (0–10). |
| **`user_queries`** | Fire-and-forget query log with feedback. |

All tables have RLS enabled. Gauntlet and maintenance data is publicly readable; mutations are frontend-auth-gated.

### Pipeline System

The CEO Command Center writes to `maintenance_requests`; a **GitHub Actions cron** (`maintenance-worker.yml`, every 5 min) polls and executes:

| Operation | Script | Schedule |
|-----------|--------|----------|
| **discovery** | `discovery.ts` | Monthly 1st, 03:00 UTC |
| **enrichment** | `enrichment-v2.ts` + `enrichment-review-intelligence.ts` | Monthly 1st, 05–06:00 UTC |
| **scores_tags** | `generate-occasion-scores.ts` + `generate-tags.ts` | Monthly 1st, 07:00 UTC |
| **audit** | `audit-full-dataset.ts` + `audit-enrichment-gaps.ts` | On-demand |

Additional pipelines: `analytics.ts` (daily trending aggregation), `validate-status.ts` (active status checks), `gauntlet-dashboard.ts` (markdown + JSON report generation with regression detection).

All pipeline scripts support `DRY_RUN` mode and use the `SUPAB_SERVICE_ROLE_KEY` to bypass RLS.

### Auth & Authorization

- **Google SSO** via Supabase Auth; `user_profiles` auto-created on signup.
- **CEO gate:** Frontend checks email === `aacrit@gmail.com` before rendering.
- **RLS policies:** Users access own data; service-role key for pipelines.
- **Edge Functions:** JWT extracted from Authorization header; `recommend` has `verify_jwt = false` (validates in code).

### Environment Variables

| Variable | Usage |
|----------|-------|
| `SUPAB_URL` | Supabase project URL |
| `SUPAB_ANON_KEY` | Client-safe RLS key |
| `SUPAB_SERVICE_ROLE_KEY` | Pipeline access (bypasses RLS) |
| `DATABASE_URL` | Direct PostgreSQL (pipelines) |
| `ANTHROPIC_API_KEY` | Claude API (enrichment, scoring) |
| `GOOGLE_PLACES_API_KEY` | Discovery pipeline |

---

## Data Flow: Test Run Lifecycle

```
CEO clicks "Run Tests"
  → cc-agents.js builds query pool (golden + edge probes)
  → Per query: POST /recommend → score + gap analysis
  → Results streamed to Activity Log + Agent XP updates
  → On complete: summary written to gauntlet_runs / gauntlet_results
  → cc-analytics.js reloads Pulse Cards with new avg_dm, gap count
  → Session overlay shows pass rate, top agent, budget used
```

## Data Flow: Pipeline Trigger

```
CEO clicks "Check Data" → selects operation (e.g. enrichment)
  → Frontend INSERTs into maintenance_requests (status: pending)
  → maintenance-worker.yml (5-min cron) picks up request
  → Sets status: running, executes pipeline script
  → Updates stages[] JSONB with per-step progress
  → Sets status: complete/failed with result summary
  → Frontend polls and surfaces status in Data Health section
```

---

## Score Validation Grading

Two independent quality grades computed per test result:

### Score Fit Grade
Evaluates whether the DondeScore accurately reflects restaurant-query fit.
- Relevance type alignment (30pts)
- Cuisine match accuracy (25pts)
- Dominant factor alignment (25pts)
- Score compression penalty (10pts)
- Weak spots coherence (10pts)

### Blurb Quality Grade
Evaluates recommendation text quality and applicability.
- Slop-free (25pts) — 67 banned cliche patterns
- Query relevance (25pts) — key terms present in blurb
- Restaurant specificity (20pts) — specific details, not generic
- Voice compliance (15pts) — "we"/"our" mandate
- Word count (15pts) — 100-120 word target

### Pass Criteria
All three must be true:
1. DondeMatch >= 70
2. Score Fit >= B- (80/100)
3. Blurb Quality >= B- (80/100)

### KPIs
- Avg Score Fit Grade (letter + numeric)
- Avg Blurb Quality Grade (letter + numeric)
- Grade Pass Rate (%)
- Grade distribution per run

---

## File Reference

### Frontend (`dondeAI/`)

| Path | Lines | Purpose |
|------|-------|---------|
| `command-center.html` | 374 | Dashboard shell + auth gate |
| `css/command-center.css` | ~1800 | Dark theme, agent colors, animations |
| `js/cc-config.js` | 255 | Config, agents, state, helpers |
| `js/cc-agents.js` | 300+ | Test orchestration, API calls, XP |
| `js/cc-analytics.js` | 74+ | Gauntlet data loading, quality render |
| `js/cc-ui.js` | 150+ | Pulse, status, clock, count-up |
| `js/cc-queries.js` | 1042 | Chicago query dataset |
| `data/dashboard-data.json` | — | Sample gauntlet run |

### Backend (`dondeBackend/`)

| Path | Purpose |
|------|---------|
| `supabase/functions/recommend/index.ts` | V11 recommendation engine |
| `supabase/functions/recommend/_shared/scoring-v9.ts` | Scoring logic |
| `supabase/functions/recommend/_shared/intent-classifier-v5.ts` | Query intent detection |
| `supabase/functions/review-intelligence/index.ts` | Review analytics |
| `supabase/migrations/20260309000001_maintenance_requests.sql` | Pipeline queue table |
| `supabase/migrations/20260308000001_gauntlet_tracking.sql` | Test tracking tables |
| `scripts/pipelines/maintenance-worker.ts` | Cron worker |
| `scripts/pipelines/analytics.ts` | Trending aggregation |
| `scripts/pipelines/gauntlet-dashboard.ts` | Report generator |
| `.github/workflows/maintenance-worker.yml` | 5-min cron |
