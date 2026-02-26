# Agent Teams

Last updated: 2026-02-26

## Active Skills

### `/frontenddesign`

| Property | Value |
|----------|-------|
| File | `.claude/skills/frontenddesign/SKILL.md` |
| Trigger | Auto-activates on UI, animation, layout, or theme tasks |
| Also invocable | Yes — type `/frontenddesign` to activate manually |
| Tools | Read, Grep, Glob, Edit, Write, Bash |

**Enforces:** Ink Rule (accent discipline), 3-voice typography, motion grammar (spring/ease), 2-view cockpit architecture, all 10 theme variants, WCAG 2.1 AA accessibility, value-based glyph rendering, spatial logic (left=past, right=future).

**Code review checklist (7 points):** accent usage, type voice, motion curve, theme coverage, keyboard nav, reduced-motion, badge neutrality.

## QA Agent Teams (System-Wide)

The full 15-agent QA testing framework is documented in `dondeBackend/_archive/DondeAPP_Agent_Teams.md`. Frontend-relevant agents:

| # | Agent | Domain |
|---|-------|--------|
| 1 | UX Design Reviewer | Visual design, themes, motion, Ink Rule |
| 2 | Frontend Architecture Reviewer | Code quality, state management, modules |
| 3 | Accessibility & Responsive Reviewer | WCAG, keyboard nav, breakpoints |
| 8 | Integration & Contract Reviewer | API contract alignment, response rendering |
| 14 | Frontend Rendering Reviewer | Score tiers, labels, icons, weight chips |

170 test scenarios across 15 categories. See `dondeBackend/tests/TEST-FULL.md` for the full catalog.
