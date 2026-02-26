# Features

Last updated: 2026-02-26

## Core Journey

- [x] Free-text craving input with 500-char limit (BR-C1)
- [x] Voice input via Web Speech Recognition (BR-H8)
- [x] Smart chips — culture-aware suggestions (BR-L7)
- [x] Surprise Me — one-tap random craving (BR-H1)
- [x] Occasion filter — 9 options (BR-C2)
- [x] Neighborhood filter — Anywhere + 14 Chicago areas (BR-C3)
- [x] Budget filter — Any, $, $$, $$$, $$$$ (BR-C4)
- [x] Dietary filter — Vegan, Vegetarian, Gluten-Free, Halal (multi-select)
- [x] Randomize filters button
- [x] CTA disabled until craving entered
- [x] 3-act loading transition (blur → particles + logo → reveal) (BR-C5)
- [x] Result card with 5 semantic blocks (identity, story, scores, profile, actions) (BR-C6)
- [x] Try Another with exclude chain, max 15 (BR-C7)
- [x] Start Over / reset to canvas (BR-C8)

## Scoring & Display

- [x] Donde Match ring (0-100, animated, 5 verdict tiers)
- [x] Donde Vibe petal radar (6-axis teardrop, expandable)
- [x] Bloom cycle (ring → radar → V2 bars → compact)
- [x] Sentiment bar (RAG horizontal, labeled, tooltip)
- [x] Google rating inline (stars + count, links to Maps)
- [x] Glyph bar (value-based icons: price, noise, ambiance, cuisine, parking, dress)
- [x] Profile facts (expandable badge grid)
- [x] Progressive reveal with staggered timing

## Enhanced UX

- [x] 5 cultural themes x 2 modes (BR-H5)
- [x] Auto-theme on typing (cuisine → culture preview)
- [x] Theme wash transition (radial clip-path)
- [x] Sound/haptic chimes per culture (BR-H6)
- [x] Celebration chime for 88%+ matches
- [x] Taste Memory — last 3 searches with re-fill (BR-H3)
- [x] Share sheet — 8 channels + canvas card (BR-H4)
- [x] Time-of-day intelligence (BR-H7)

## Polish

- [x] Particle loading animation (BR-L2)
- [x] Keyboard navigation — full a11y (BR-L3)
- [x] Offline detection with banner (BR-L4)
- [x] Virtual keyboard adaptation (BR-L5)
- [x] Ambient background blobs (culture-specific speeds)
- [x] Logo SVG draw-in animation

## Auth (Partial — Phase 1a)

- [x] Google SSO via Supabase Auth
- [x] Server-side search history for authenticated users
- [x] Server-side favorites/bookmarks
- [x] Anonymous-to-auth data migration on first sign-in
- [ ] Apple SSO (awaiting developer enrollment)
- [ ] Facebook/Instagram (Phase 2, demand-driven)

## Persistence (localStorage)

`dondeai-theme`, `dondeai-sound`, `dondeai-colormode`, `dondeai-history` (last 3), `dondeai-bookmarks` (max 20), `dondeai-user-id` (UUID), `dondeai-feedback` (max 100)
