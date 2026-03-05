# DondeAI Frontend — Version History Archive

Archived: 2026-03-05. This file consolidates all pre-V9/V10 specifications for reference only. **See `CLAUDE.md` for current docs.**

---

## Frontend Version Evolution

| Version | Key Changes | Status |
|---------|-------------|--------|
| V1-V3 | Multi-step wizard, basic scoring display | Archived |
| V4-V6 | Signal chips, match headline, one-liner, staggered reveals | Archived |
| V7 | Ranked queue (instant Try Again), 5-phase loading scaffold | Archived |
| V8 | Skeleton blocks, phrase carousel, word-group stagger | Archived |
| **V10** | **2-view cockpit, instant slide + fade, content-first Tier 1/Tier 2** | **Active** |

## V10 Removals (from previous versions)

| Removed | Reason |
|---------|--------|
| Signal chips | Factor bars sufficient |
| Match headline | Blurb communicates the "why" |
| One-liner | Redundant with blurb |
| Quick tags | Low value |
| 5-phase scaffold choreography | Replaced by instant slide + simple fade |
| Skeleton blocks + ink wash | No skeleton needed |
| Ghost headline carousel | Removed |
| Word-group stagger reveal | Blurb fades in with card as unit |
| 500ms minimum wait | No artificial delay |
| Staggered element reveals | Card fades in as unit (300ms) |
| Separate history sections | Unified "Your Spots" |

## Scoring Engine Versions (Backend, for frontend context)

| Version | Frontend Field | Architecture |
|---------|---------------|-------------|
| V3-V5 | `scoring_v5` | Weighted sum → geometric mean with weight shifts |
| V7 | `scoring_v7` | Geometric mean + intent alignment |
| **V9** | **`scoring_v9`** | **Relevance × Quality + OccasionBonus** |

## Archived Files Reference

| File | Contents |
|------|----------|
| `_archive/donde-match-design.md` (61K) | V3.0 scoring engine — 5-factor model deep-dive |
| `_archive/donde-match-system-v3.6.md` (45K) | V3.6 production system — full process flow |
| `_archive/UI_UX_Requirements.md` (27K) | Original business requirements — design philosophy, 8 principles |
| `_archive/Frontendarch.md` (9K) | Earlier frontend architecture (pre-V10 module graph) |
| `_archive/README.md` (3K) | Original project overview |
| `_archive/nicehave_sso.md` (3K) | SSO implementation status (Phase 1a Google complete) |
