---
name: update-docs
description: "Scans the DondeAI frontend codebase for changes and updates all markdown documentation files (CLAUDE.md, docs/*.md) to reflect the current state. Auto-trigger when changes are significant enough to cause documentation drift."
---

# DondeAI Documentation Updater — Frontend

> **Canonical source:** `../dondeBackend/.claude/agents/update-docs.md` — read that file for the full scan protocol and update methodology.

## Frontend-Specific Protocol

When updating frontend docs:
1. Read `CLAUDE.md` — check "Last updated" date and all documented facts
2. Read `docs/ARCHITECTURE.md` — verify file tree, module list, tech stack
3. Read `docs/DESIGN-SYSTEM.md` — verify design decisions match current CSS/HTML
4. Read `docs/FEATURES.md` — check feature checklist against implementation
5. Scan key source files for state changes:
   - `js/app.js` (key functions), `js/state.js` (state shape)
   - `js/api.js` (API endpoint), `css/tokens.css` (design tokens)
6. Update any drifted documentation to match current source code
7. Update "Last updated" dates on modified files
