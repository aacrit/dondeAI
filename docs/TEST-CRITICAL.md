# Smoke Tests (Critical Path)

Last updated: 2026-02-26

Run before every deployment or major change. All must pass.

| # | Test | Expected |
|---|------|----------|
| 1 | `index.html` loads in browser | No console errors, greeting visible |
| 2 | Type craving, submit | Loading animation plays, result card appears within 15s |
| 3 | Result card shows name + score ring + recommendation | All three visible and correctly rendered |
| 4 | Try Another returns different restaurant | Different name and ID |
| 5 | Start Over returns to canvas | Input cleared, canvas view active |
| 6 | Toggle through all 5 themes | No layout shift, colors update, no console errors |
| 7 | Toggle light/dark mode | Instant switch, no flash of wrong colors |
| 8 | Keyboard: `/` focuses input, `T` toggles mode | Shortcuts work from canvas view |
| 9 | Offline banner appears when disconnected | Banner visible (disconnect via DevTools Network tab) |
| 10 | Reduced motion: no animations | Enable in OS settings, reload — no visible motion |
