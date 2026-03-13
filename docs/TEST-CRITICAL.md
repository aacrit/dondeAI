# Smoke Tests (Critical Path)

Last updated: 2026-03-13

Run before every deployment or major change. All must pass.

| # | Test | Expected |
|---|------|----------|
| 1 | `index.html` loads | No console errors, greeting visible |
| 2 | Type craving, submit | Card fades in within 15s, score counts up with RAG color |
| 3 | Result card shows photos + name + score + blurb | All visible, score ring colored by RAG threshold |
| 4 | Try Another | Different restaurant, card swaps symmetrically (300ms) |
| 5 | Start Over | Canvas view, input cleared, "Your Spots" visible |
| 6 | Show More / Show Less | Tier 2 expands/collapses symmetrically (450ms) |
| 7 | Toggle all 5 themes | No layout shift, RAG colors correct in all themes |
| 8 | Toggle light/dark mode | Instant switch, no flash |
| 9 | Keyboard: `/` focuses input, `T` toggles mode | Shortcuts work |
| 10 | Reduced motion: no animations | All motion disabled, score shows final value instantly |
