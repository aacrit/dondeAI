# Features

Last updated: 2026-03-02

## Core Journey

- [x] Free-text craving input (500-char limit) + voice input (Web Speech)
- [x] Smart chips — culture-aware suggestions
- [x] Surprise Me — one-tap random craving
- [x] Filters: occasion (9), neighborhood (14 + Anywhere), budget (4 + Any), dietary (multi-select)
- [x] CTA disabled until craving entered
- [x] V10 loading: instant slide + 300ms fade (score count-up only animation)
- [x] Result card: photos → score + name → blurb → address → actions → footer
- [x] Try Another — instant from ranked queue (V7), API fallback when exhausted
- [x] Start Over — reset to canvas

## Scoring & Display

- [x] Donde Match ring (0-100) with RAG colors (green ≥80, amber ≥60, red <60)
- [x] Score Hero in Tier 2: full ring + RAG colors
- [x] Factor bars with weight badges
- [x] Match narrative reveal (strongest factor + key signal)
- [x] Donde Vibe petal radar (6-axis, expandable)
- [x] Sentiment bar (RAG, labeled)
- [x] Google rating (stars + count, links to Maps)
- [x] Glyph bar (price, noise, ambiance, cuisine, parking, dress)
- [x] Card swap animation on Try Again (300ms symmetric slide)

### V10 Removed from Tier 1
- Signal chips (factor bars sufficient)
- Match headline (blurb communicates the why)
- One-liner (redundant with blurb)
- Quick tags (low value)
- Staggered progressive reveal (card fades in as unit)
- Blurb height cap (full text flows naturally)

## Enhanced UX

- [x] 5 cultural themes × 2 modes (auto-theme on typing)
- [x] Theme wash transition (radial clip-path)
- [x] Sound/haptic chimes per culture + celebration for 88%+
- [x] V10 "Your Spots" — unified recent + saved + visited history
- [x] Known For — inline pills in Tier 2 (moved from Tier 1)
- [x] Share sheet — 8 channels + canvas card
- [x] Time-of-day intelligence
- [x] 2-row compact footer: Going + Try Another / Feedback + Start Over

## V10 Loading Changes

| Before | After |
|--------|-------|
| 5-phase scaffold choreography | Instant slide + simple fade |
| Skeleton blocks + ink wash | No skeleton |
| Ghost headline carousel | No carousel |
| Word-group stagger reveal | Blurb fades in with card |
| 500ms minimum wait | No artificial delay |
| Staggered element reveals | Card fades in as unit (300ms) |

## Polish

- [x] Keyboard nav (full a11y), shortcuts: `/` `T` `F` `R` `Esc`
- [x] Offline detection banner
- [x] Virtual keyboard adaptation
- [x] Ambient background blobs (culture-specific)
- [x] Logo SVG draw-in animation
- [x] Reduced-motion: all animations disabled

## Auth (Partial)

- [x] Google SSO, server-side history + favorites, anon-to-auth migration
- [ ] Apple SSO (awaiting enrollment)

## Persistence (localStorage)

`dondeai-theme`, `dondeai-sound`, `dondeai-colormode`, `dondeai-history` (3), `dondeai-bookmarks` (20), `dondeai-user-id`, `dondeai-feedback` (100)
