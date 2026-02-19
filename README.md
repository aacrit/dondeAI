# DondeAI

AI-powered restaurant recommendation engine for Chicago. Tell it what you're craving, and it finds your spot.

## What It Does

DondeAI takes a free-text craving ("cozy ramen with killer sake"), optional filters (occasion, neighborhood, budget), and returns a single AI-curated restaurant recommendation with rich scoring, vibe analysis, and actionable details.

## Design Language: "Ink & Momentum"

Every interaction feels like writing a wish on paper and watching it come to life. Confident pen strokes, spring-physics choreography, handwritten texture over precision engineering.

- **Three Voices of Type:** Playfair Display (emotional), Inter (structural), JetBrains Mono (data)
- **The Ink Rule:** Accent color is earned, not given — only score rings, restaurant names, active CTAs, and selected pills use accent
- **Motion Grammar:** Spring physics for user actions, gentle ease for system reveals, instant fallback for reduced-motion
- **Cultural Personality:** 6 themes x 2 modes = 12 variants that change palette, terminology, audio, and texture

## Architecture

Two-view sliding cockpit: **Canvas** (all input) and **Result** (all output), connected by a 3-act loading transition.

```
View 0: Canvas           →    View 1: Result
├── Greeting                   ├── Identity (name + navigation)
├── Craving input + voice      ├── Story (recommendation + tip)
├── Collapsible filters        ├── Scores
│   ├── Occasion (9 pills)     │   ├── DondeAI Match™ ring
│   ├── Neighborhood (15)      │   ├── DondeAI Vibe™ petal radar
│   └── Budget (5)             │   ├── Sentiment bar
├── Submit CTA                 │   └── Google rating
└── Taste Memory               ├── Profile (glyph bar + badges)
                               └── Actions (links + Try Another)
```

## Stack

- **Vanilla HTML + CSS + JavaScript** — zero frameworks, zero build steps
- **ES modules** (`type="module"`) — no bundler required
- **CSS custom properties** — all design tokens, all theme variants
- **Mobile-first** — 320px to 2560px responsive

## Backend

```
POST https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend
```

Accepts `special_request`, `occasion`, `neighborhood`, `price_level`, and optional `exclude` (array of restaurant UUIDs for "Try Another" deduplication).

## File Structure

```
index.html          Single entry point (entire SPA)
css/                Tokens, themes (6 cultures), layout, components, animations, responsive
js/                 ES modules: app, state, router, api, theme, audio, voice, animations,
                    share, persistence, accessibility, offline, utils
```

See `CLAUDE.md` for detailed architecture, API contract, and implementation guide.
