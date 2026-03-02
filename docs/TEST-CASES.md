# Test Cases

Last updated: 2026-03-02

No automated frontend tests. All testing is manual or via backend API tests (`dondeBackend/tests/`).

## Visual (V1-V7)

| ID | Test | Expected |
|----|------|----------|
| V1 | All 10 theme variants | Colors update, no layout shift, no console errors |
| V2 | Ink Rule compliance | `--ac` only on allowed elements (see DESIGN-SYSTEM.md) |
| V3 | Responsive 320-2560px | No overflow, readable at all sizes |
| V4 | Typography voices | Playfair=headings, Inter=buttons, JetBrains=scores |
| V5 | RAG colors on score | Green ≥80, amber ≥60, red <60 on ring + number |
| V6 | Photo scroll strip | Equal-sized photos, scroll-snap, lightbox on tap |
| V7 | Blurb full text | No height cap, no scrollbar, full text flows naturally |

## Interaction (I1-I9)

| ID | Test | Expected |
|----|------|----------|
| I1 | Submit → result | Canvas dissolves (400ms), step slides, card fades in (300ms) |
| I2 | Try Another × 3 | 3 unique restaurants, card swaps symmetrically (300ms each) |
| I3 | Start Over | Canvas view, "Your Spots" shows recent search |
| I4 | Filter combos | CTA enabled, summary line updates |
| I5 | Voice input | Transcript fills input |
| I6 | Smart chips | Input fills with chip text |
| I7 | Surprise Me | Random craving submitted |
| I8 | Share sheet | Native share or 8-channel fallback |
| I9 | Show More / Less | Tier 2 toggles symmetrically (450ms), button text swaps |

## Animation Symmetry (S1-S5)

| ID | Test | Expected |
|----|------|----------|
| S1 | Filter drawer open/close | 300ms both directions, no jank |
| S2 | Tier 2 expand/collapse | 450ms both, opacity aligned with max-height |
| S3 | Card swap out/in | 300ms both, smooth slide |
| S4 | Back button appear/disappear | 300ms spring, opacity + transform aligned |
| S5 | Canvas morph/restore | inkDissolve ↔ inkRestore mirrored (20px offset) |

## Accessibility (A1-A5)

| ID | Test | Expected |
|----|------|----------|
| A1 | Keyboard tab | Focus visible, logical order, no traps |
| A2 | Shortcuts `/` `T` `F` `R` `Esc` | Focus, toggle, retry, close |
| A3 | Screen reader | All elements announced, landmarks found |
| A4 | Reduced motion | 0ms animations, no visual motion |
| A5 | Focus management | Focus moves to primary element on view change |

## Theme & Persistence (T1-T4)

| ID | Test | Expected |
|----|------|----------|
| T1 | Theme persistence | Reload preserves theme |
| T2 | Auto-theme on typing | "sushi" → Zen preview |
| T3 | Theme wash | Radial clip-path transition |
| T4 | Sound toggle | State preserved across reload |
