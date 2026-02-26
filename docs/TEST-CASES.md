# Test Cases

Last updated: 2026-02-26

## Current State

No automated frontend test framework exists. The app is vanilla HTML/CSS/JS with no build step. All testing is manual or via backend API tests.

## Backend Test References

| File | Location | Description |
|------|----------|-------------|
| `test_catalog.sh` | `dondeBackend/tests/` | 65-scenario bash API test suite |
| `TEST-FULL.md` | `dondeBackend/tests/` | 170-scenario agent-driven test spec (V4-era) |
| `TEST_RESULTS.md` | `dondeBackend/tests/` | Latest results: 273 pass, 3 fail, 30 warn (2026-02-24) |

## Frontend Manual Test Suite

### Visual (V1-V6)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| V1 | All 10 theme variants render | Cycle 5 themes in light + dark mode | Colors update, no layout shift, no console errors |
| V2 | Ink Rule compliance | Inspect accent usage on result card | `--ac` only on allowed elements (see DESIGN-SYSTEM.md) |
| V3 | Responsive 320-2560px | Chrome DevTools device toolbar | No overflow, readable at all sizes |
| V4 | Typography voices | Check headings, buttons, scores | Playfair=headings, Inter=buttons, JetBrains=scores |
| V5 | Progressive reveal timing | Submit and observe result card | Blocks stagger in, ring animates at 800ms |
| V6 | Glyph bar icons | Check result card glyph bar | Price as text, noise/ambiance context-mapped |

### Interaction (I1-I8)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| I1 | Submit → result flow | Enter craving, submit | Loading animation, result card appears |
| I2 | Try Another chain (3x) | Submit, Try Another x3 | 3 unique restaurants, scores may decrease |
| I3 | Start Over | From result, tap Start Over | Canvas view, input cleared, filters reset |
| I4 | Filter combinations | Set occasion + neighborhood + budget | CTA enabled, filters shown in summary |
| I5 | Voice input | Tap mic, speak craving | Transcript fills input, auto-submit on high confidence |
| I6 | Smart chips | Tap a chip on canvas | Input fills with chip text |
| I7 | Surprise Me | Tap Surprise Me | Random craving submitted |
| I8 | Share sheet | From result, tap Share | Native share or 8-channel fallback sheet |

### Accessibility (A1-A5)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| A1 | Keyboard navigation | Tab through all interactives | Focus visible, logical order, no traps |
| A2 | Keyboard shortcuts | Press /, T, F, R, Escape | Focus input, toggle mode, toggle filters, try again, close |
| A3 | Screen reader flow | VoiceOver/NVDA through full journey | All elements announced, landmarks found |
| A4 | Reduced motion | Enable `prefers-reduced-motion` | 0ms animations, no visual motion |
| A5 | Focus management | Submit → result, Start Over → canvas | Focus moves to primary element on view change |

### Theme & Persistence (T1-T4)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| T1 | Theme persistence | Set theme to Zen, reload | Theme still Zen |
| T2 | Auto-theme on typing | Type "sushi" in craving | Theme previews to Zen (indigo) |
| T3 | Theme wash animation | Click cycle button | Radial clip-path wash transition |
| T4 | Sound toggle persistence | Enable sound, reload, check | Sound state preserved |
