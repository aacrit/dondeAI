# DondeAI Frontend

Last updated: 2026-03-15

> **Read this file first. Only read `docs/*.md` when task-relevant. Only open source files when modifying code.**

AI restaurant recommendations for Chicago. One craving in, one perfect spot out. Vanilla HTML/CSS/JS (no frameworks, no build). Backend: Supabase Edge Function V11 + PostgreSQL. AI: Claude Haiku 4.5. Data: 2,719 restaurants (all active) across 33 Chicago neighborhoods.

## Session Protocol (Token Minimization)

1. **Read MD files first** — `CLAUDE.md` → `docs/DESIGN-SYSTEM.md` → `docs/ARCHITECTURE.md`. These contain all context.
2. **Read code on demand** — Use Grep/Glob to find exact locations rather than reading entire files.
3. **Never read entire large files** — `app.js` (~5000 lines), `components.css` (~6600 lines). Use offset/limit.
4. **Use the doc index below** — Each doc covers a specific domain.

## Documentation Index

| Doc | When to read |
|-----|-------------|
| `docs/DESIGN-SYSTEM.md` | UI, animation, layout, theme, or visual tasks |
| `docs/ARCHITECTURE.md` | Code structure, module deps, state, event system |
| `docs/FEATURES.md` | Feature status, what's implemented vs planned |
| `docs/TEST-CRITICAL.md` | Quick 10-item smoke test before pushing |
| `docs/TEST-CASES.md` | Full manual test matrix |
| `docs/OPTIMIZATION-RECOMMENDATIONS.md` | Prioritized optimization roadmap (monolith breakup, learning flywheel, lazy loading, caching, match narrative) |
| `docs/CEO-COMMAND-CENTER.md` | Admin dashboard architecture (agents, pipelines, data health) |
| `_archive/VERSION-HISTORY.md` | Pre-V9/V10 specs, removed features, scoring evolution |

## Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `donde-coo` | **COO super-agent** — orchestrates all agents across both repos, runs quality cycles, reports to CEO | Auto on significant changes, manual |
| `/frontenddesign` | UI/animation/layout enforcement (Ink Rule, 3-voice type, motion grammar, 10 themes, WCAG AA) | Auto on UI tasks |
| `/ceo-advisor` | Strategic product advisor — Top 10 prioritized recommendations | Manual |
| `/donde-premium-advisor` | Premium app audit (UI polish, backend, marketing psychology, Claude Code mastery) | Manual |
| `/donde-ciso` | Security audit across 10 domains — severity-ranked findings with remediation | Manual or auto on security changes |
| `/update-docs` | Scans codebase and updates all MD files to reflect current state | Auto when Claude judges changes are significant |

All skills in `.claude/skills/`. COO agent in `.claude/agents/donde-coo.md`. Frontend design review checklist (7 points): accent usage, type voice, motion curve + symmetry, theme coverage, keyboard nav, reduced-motion, badge neutrality.

## Agent Hierarchy

The COO (`donde-coo`) orchestrates all agents across **5 divisions** in both repos. Every agent reports to the COO, and the COO reports directly to the CEO.

```
CEO (Aacrit)
  └── COO (donde-coo)
        ├── Quality ———— analytics-expert, bug-fixer, gen-test-queries, continuous-tester
        ├── Infrastructure — perf-optimizer, db-reviewer, update-docs, prod-sentinel
        ├── Frontend ———— frontend-builder, frontend-fixer, css-theme-specialist, uat-tester, frontenddesign
        ├── Product ————— ceo-advisor, donde-premium-advisor
        └── Security ———— donde-ciso
```

**15 agents total** across 5 divisions. All operate at $0 cost via `skip_claude`.

| Agent | Division | Purpose | Repo |
|-------|----------|---------|------|
| `donde-coo` | Lead | Orchestrates all agents, runs quality cycles, reports to CEO | Backend (canonical) |
| `analytics-expert` | Quality | Benchmarks engine, implements quick-wins | Backend |
| `bug-fixer` | Quality | Post-test bug fixer — root-causes, groups, fixes code | Backend |
| `gen-test-queries` | Quality | Generates diverse, persona-driven test queries | Backend |
| `continuous-tester` | Quality | Automated test runner after deploys | Backend |
| `perf-optimizer` | Infra | Response time optimizer, timeout prevention | Backend |
| `db-reviewer` | Infra | Database quality audit — accuracy, freshness, consistency | Backend |
| `update-docs` | Infra | Scans codebase, updates all MD files | Both |
| `prod-sentinel` | Infra | Production monitoring — error rates, cache health | Backend |
| `frontend-builder` | Frontend | Component engineering | **Frontend** |
| `frontend-fixer` | Frontend | UI bug remediation | **Frontend** |
| `css-theme-specialist` | Frontend | 10 theme variants | **Frontend** |
| `uat-tester` | Frontend | UAT browser testing via Playwright | Backend |
| `ceo-advisor` | Product | Strategic product advisor — Top 10 recommendations | Backend |
| `donde-premium-advisor` | Product | Premium app audit ($50B caliber) | Backend |
| `donde-ciso` | Security | Security audit across 10 domains | Backend |

**Escalation:** CRITICAL findings auto-escalate to COO → CEO with "The Bottom Line" summary.

**CEO task trigger:** All CEO tasks should trigger an agentic team response — spawn the COO (`donde-coo`) to orchestrate the appropriate division agents for the task. The COO triages, assigns agents, and reports back.

**Canonical COO definition:** `../dondeBackend/.claude/agents/donde-coo.md`. Mirror in this repo: `.claude/agents/donde-coo.md`. Full team operations: `../dondeBackend/docs/TEAM-OPERATIONS.md`.

## Design Philosophy — "Ink & Momentum" (V10, Locked)

Every interaction feels like writing a wish on paper and watching it come to life.

### V10 Design Decisions (Locked)

| Decision | Choice |
|----------|--------|
| Layout | 2-view sliding cockpit: Canvas (input) ↔ Result (output) |
| Score display | Circle ring + RAG colors (green ≥80, amber ≥60, red <60) |
| Tier 1 stack | Photos → Score + Name → Blurb → Address + Actions |
| Tier 1 removed | Match headline, signal chips, one-liner, quick tags (redundant) |
| Photo layout | Horizontal scroll strip (equal sizes, scroll-snap) |
| Known For | Inline pills in Tier 2 (after story) |
| Loading | Instant slide (400ms) + API fetch → Card fade-in (300ms) → Score count-up (1200ms). No scaffold. |
| Blurb | Full text, no height cap, 300ms fade |
| Footer | 2-row: Going + Try Another / Feedback + Start Over |
| Canvas history | Unified "Your Spots" (recent + saved + visited) |
| Typography | Playfair (emotional), Inter (structural), JetBrains Mono (data) |
| Themes | 5 cultures × 2 modes = 10 variants (Neutral, Indian, Middle Eastern, Japanese, South American) |
| The Ink Rule | Accent color earned, not given — only score ring, name, active CTAs, selected pills, logo |

### Animation Rules (Symmetric open/close)

| Pattern | Duration | Easing |
|---------|----------|--------|
| Step track slide | 450ms | var(--spring) |
| Filter drawer open/close | 300ms | var(--ease-out) |
| Tier 2 expand/collapse | 450ms | var(--ease-out) |
| Card swap out/in | 300ms | var(--ease-out) |
| Back button show/hide | 300ms | var(--spring) |
| Canvas morph/restore | 400ms | var(--ease-out) |
| Score count-up | 1200ms | cubic ease-out |

Sequencing: Canvas morph (400ms) completes before step slide. No overlapping animations. Spring for user actions, ease-out for system reveals. All → 0ms under reduced-motion.

## API Contract (Immutable)

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
Authorization: Bearer <supabase-anon-key>
apikey: <supabase-anon-key>
Timeout: 15s (AbortController)
```

Request: `{ special_request, occasion, neighborhood, price_level, exclude[], dietary_restrictions[], user_id, feedback, time_of_day, skip_claude }`

**`skip_claude` (internal):** When `true`, skips Claude API calls — engine returns deterministic scores + fallback blurbs at $0 cost. Default: `false`. The Command Center "Live API" toggle (default OFF) sets this automatically.

**Command Center Live API Toggle:** Green "Scoring Only" (default, $0) / Red "LIVE API" ($$$). Two standalone live tests (red cards): "Blurb Quality Check" (1 query, ~$0.30) and "Intent Classification" (1 query, ~$0.05) always call Claude regardless of toggle.

Key response fields: `{ success, restaurant{...}, recommendation, insider_tip, donde_match(0-99), scores{...}, scoring_v9{ relevance_score, relevance_type, quality_score, occasion_bonus, food, vibe, service, reputation, convenience, weights_used }, match_narrative{ strongest_factor, key_signals, summary, weak_spots }, ranked_queue[{ rank, restaurant, donde_match, scoring_v9, match_headline }], deep_context, tags[], intent_boost, timestamp }`

Errors: HTTP non-200 → toast + canvas | `success:false` → show `recommendation` | network → "Couldn't reach the engine." | timeout → "Request timed out."

## State Shape (`state.js`)

```js
{ step, craving, occasion, neighborhood, priceLevel, dietaryRestrictions,
  openNow, result, loading, error, excludeIds,
  rankedQueue: [], rankedQueueIndex: 0,
  theme: {culture, mode}, colorMode, soundEnabled, history, pendingFeedback,
  user, isAuthenticated }
```

## Run

Open `index.html` in browser. No build step, no dependencies, no env vars.

## Git Workflow

For every task that modifies code:
1. Create a new branch from main with `claude/` prefix (e.g., `claude/add-cache`, `claude/fix-scoring`)
2. Make all changes on that branch
3. Commit with a clear, descriptive message
4. Push the branch to origin — CI auto-merges `claude/**` branches to `main` via `.github/workflows/auto-merge-claude.yml`
5. No PR needed for `claude/` branches — auto-merge handles it

**Never commit directly to main. Always use `claude/` branch prefix so CI auto-merges.**

## Coding Standards

- **HTML:** Semantic, `data-action` event delegation, all interactives focusable
- **CSS:** Custom properties only, mobile-first `min-width`, `clamp()` fluid, BEM-like, no `!important`
- **JS:** ES modules, plain objects + functions, `requestAnimationFrame`, cached DOM queries, `AbortController`, no circular deps
- **Motion:** Duration tokens `--dur-instant`(0) → `--dur-score`(1200), all → 0ms under reduced-motion. Spring for user actions, ease-out for system reveals. Symmetric open/close.
- **Z-index:** `--z-base`(1) → `--z-particle`(500)
- **RAG colors:** `--rag-green`(≥80), `--rag-amber`(≥60), `--rag-red`(<60) — theme-independent, defined in tokens.css
