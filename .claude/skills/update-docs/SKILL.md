---
name: update-docs
description: "Scans the DondeAI frontend codebase for changes and updates all markdown documentation files (CLAUDE.md, docs/*.md) to reflect the current state. AUTO-TRIGGER: Claude should proactively run this skill whenever it judges that changes made during the session are significant enough to cause documentation drift — e.g., new files added, state shape changed, API contract modified, new features implemented, design decisions locked, animation timings changed, or skills added/removed. Do not run after every small edit — use judgment. A good heuristic: if a future session would waste >30 seconds re-discovering what changed, update the docs now. Also triggers on: 'update docs', 'refresh docs', 'sync documentation', 'update markdown', '/update-docs'."
---

# DondeAI Documentation Updater — Frontend

You are a documentation maintenance agent for the DondeAI frontend repo. Your job is to scan the codebase for the current state and update all markdown files so future Claude Code sessions can load full context without reading source code.

## Why This Skill Exists

Every token spent re-discovering architecture in a new session is wasted. Accurate MD files = instant context = faster sessions = lower cost. This skill keeps documentation as the single source of truth.

## Activation Protocol

### Phase 1: Scan Current State

Gather the ground truth from source code. Do NOT guess — read the actual files.

```
1. Read CLAUDE.md — note the "Last updated" date and all documented facts
2. Read docs/ARCHITECTURE.md — check file tree accuracy, module list, tech stack
3. Read docs/DESIGN-SYSTEM.md — verify design decisions match current CSS/HTML
4. Read docs/FEATURES.md — check feature checklist against actual implementation
5. Scan key source files for changes:
   - js/app.js (line count, key function names)
   - js/state.js (state shape)
   - js/api.js (API endpoint, request/response format)
   - js/router.js (view structure)
   - css/tokens.css (design tokens, RAG colors, z-index scale)
   - index.html (script imports, structure)
6. Check for new files not documented:
   - Glob js/*.js — compare against ARCHITECTURE.md file tree
   - Glob css/*.css — compare against CSS load order
   - Glob .claude/skills/*/SKILL.md — compare against CLAUDE.md skills section
7. Check git log for recent changes:
   - git log --oneline -20 — identify what changed recently
   - git diff HEAD~10 --stat — understand scope of recent changes
```

### Phase 2: Identify Drift

Compare scanned state against documented state. Flag every discrepancy:

| Category | What to Check |
|----------|---------------|
| **File tree** | New/deleted/renamed JS/CSS files not in ARCHITECTURE.md |
| **State shape** | New/removed state fields not in CLAUDE.md |
| **API contract** | Changed request/response fields, new endpoints |
| **Design decisions** | New locked decisions, changed animation timings |
| **Features** | New features implemented but not in FEATURES.md |
| **Skills** | New/removed skills not in CLAUDE.md skills section |
| **Dependencies** | New CDN imports, removed libraries |
| **Scoring engine** | Version changes in backend reference (V9 → V10 → V11) |
| **Dates** | All "Last updated" dates should reflect today |

### Phase 3: Update Documentation

For each discrepancy found, update the relevant MD file:

1. **CLAUDE.md** — Always update:
   - `Last updated` date → today
   - Documentation Index table (add/remove docs)
   - Skills table (add/remove skills)
   - API Contract (if response format changed)
   - State Shape (if state.js changed)
   - Design decisions table (if new locked decisions)

2. **docs/ARCHITECTURE.md** — Update if file structure changed:
   - File tree listing
   - Module graph
   - Tech stack version references
   - Key functions table

3. **docs/DESIGN-SYSTEM.md** — Update if visual/interaction changes:
   - Animation timings
   - Design tokens
   - Theme variants
   - Component patterns

4. **docs/FEATURES.md** — Update if features added/removed:
   - Checklist items
   - Implementation status

5. **docs/TEST-CRITICAL.md** — Update if smoke test items changed

6. **docs/OPTIMIZATION-RECOMMENDATIONS.md** — Update if priorities shifted

7. **docs/CEO-COMMAND-CENTER.md** — Update if dashboard architecture changed

### Phase 4: Report

After updating, provide a summary:

```
## Documentation Update Report

**Date:** [today]
**Files Updated:** [list]
**Key Changes:**
- [bullet list of what changed and why]

**Files Unchanged (verified current):**
- [list]

**Action Items (if any):**
- [things that need human decision before documenting]
```

## Rules

1. **Evidence-based only** — Never update docs based on assumptions. Read the actual source file before changing any documented fact.
2. **Preserve locked decisions** — V10 design decisions marked "Locked" should never be removed, only amended if new locked decisions are added.
3. **Compact format** — Use tables over prose. Use inline code for file paths. No filler text.
4. **Cross-repo awareness** — The backend repo is at `../dondeBackend/`. If backend API contract changed, update the frontend's API Contract section too.
5. **Date stamp everything** — Every MD file updated gets today's date in its "Last updated" line.
6. **Don't bloat** — Remove outdated information rather than accumulating history. Archive-worthy content goes to `_archive/`.

## Companion Skill

The backend repo (`dondeBackend`) has a matching `/update-docs` skill. When major changes span both repos, run both skills.
