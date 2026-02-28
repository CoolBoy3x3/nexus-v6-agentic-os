# Progress Phase Workflow

Implements the orient/route/pause logic for `/nexus:progress`. The universal session entry point.

---

## Behavior Split

Check `$ARGUMENTS` for `--pause` flag:
- **No `--pause`:** Orient mode — load state, display progress, output ONE next action
- **`--pause`:** Pause mode — capture state, write HANDOFF.md, update STATE.md

---

## ORIENT MODE

### Load State

Read in order:
1. `.nexus/01-governance/HANDOFF.md` — prior session context (if exists)
2. `.nexus/01-governance/STATE.md` — authoritative loop position, blockers, scar count
3. `.nexus/01-governance/ROADMAP.md` — phase overview and roadmap progress

If `.nexus/` does not exist: "No workspace found. Run `/nexus:init` first."

**Conflict resolution:** If HANDOFF.md and STATE.md disagree on loop position, STATE.md wins. Note the discrepancy.

---

### Surface Prior Session (if HANDOFF.md exists)

Display brief summary from HANDOFF.md:
```
📋 Last session: {date} — {status}
   Completed: {bullet list of what was done}
```

Then archive the consumed handoff:
```bash
mv .nexus/01-governance/HANDOFF.md .nexus/01-governance/HANDOFF-{date}-consumed.md
```

---

### Calculate Progress

Overall roadmap: count phases with status `complete` vs total.

Current phase progress (from loop position):
- ○○○○ = 0% | ✓○○○ = 25% | ✓✓○○ = 50% | ✓✓✓○ = 75% | ✓✓✓✓ = 100%

---

### Consider User Context

If `$ARGUMENTS` includes context (non-`--pause`):
- "30 minutes" → suggest smallest meaningful step
- "stuck on X" → route to systematic-debugging skill
- "continue" / "go" / "yes" → proceed with default routing
- "I need to fix a bug" → surface bug path over normal loop

---

### Routing Table

Output EXACTLY ONE next action:

| Situation | Single Next Action |
|-----------|-------------------|
| No phases in ROADMAP.md | "Add phases to ROADMAP.md, then run /nexus:plan" |
| Loop ○○○○ | `/nexus:plan` |
| Loop ✓○○○ | `/nexus:execute [plan-path]` |
| Loop ✓✓○○ | `/nexus:verify` |
| Loop ✓✓✓○ | `/nexus:unify` |
| Loop ✓✓✓✓, more phases | `/nexus:plan` (next phase) |
| Loop ✓✓✓✓, last phase | "All phases complete — ship it or add phases." |
| VERIFY ● (gaps) | `/nexus:plan --gaps` (gap-closure) |
| Blockers in STATE.md | "Address blocker: {specific blocker}" |
| Architecture rebuild flagged | `/nexus:map-codebase` before next plan |

**Never output multiple actions. Never output a menu.**

---

### Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► {project-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Roadmap: {X}% complete ({done}/{total} phases)
├── Phase 1: {name} ████████████ complete
├── Phase 2: {name} ██████░░░░░░ 50%  ← current
└── Phase 3: {name} ░░░░░░░░░░░░ pending

Current Loop: Phase {N} — {Phase Name}
  PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
    {✓/●/○}      {✓/●/○}      {✓/●/○}    {✓/●/○}

Scars: {count} | Prevention rules: {count} active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{if active prevention rules:}
Active rules:
  - {rule 1}

────────────────────────────────────────
▶ NEXT: {exact command}
  {one-line reason}
────────────────────────────────────────

Type "go" to proceed, or describe context for a different suggestion.
```

If the user types "go", "yes", "y", or "proceed": execute the suggested action immediately.

---

## PAUSE MODE (`--pause`)

### Capture Current State

Read STATE.md. Extract:
- Phase number and name
- Loop position marks
- In-progress tasks from TASK_GRAPH.json
- Active blockers
- Scar count and active prevention rules

Parse reason from $ARGUMENTS (text after `--pause`), or use "Manual pause" if none.

---

### Write HANDOFF.md

Write `.nexus/01-governance/HANDOFF.md`:

```markdown
# HANDOFF — {project_name}

**Created:** {ISO timestamp}
**Status:** {loop position summary}
**Reason:** {reason}

---

## READ THIS FIRST

**Project:** {project_name}
**Phase:** {N} of {total} — {phase name}

**Loop Position:**
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  {mark}       {mark}       {mark}      {mark}
```

## Completed This Session

{From TASK_GRAPH completed tasks + decisions made — real content, no placeholders}

## In Progress

{In-progress tasks or "Stopped at a clean boundary."}

## Blockers

{Active blockers or "None."}

## Active Prevention Rules

{From SCARS.md or "None recorded yet."}

## Key Files

| File | Purpose |
|------|---------|
| `.nexus/01-governance/STATE.md` | Live project state |
| {current plan path} | Current phase plan |

## Resume Instructions

Run `/nexus:progress` — reads this file automatically and routes to ONE next action.

**Single next action: {exact command}**

---
*Created: {ISO timestamp}*
```

---

### Update STATE.md Session Continuity

```
Last session: {ISO timestamp}
Paused at: {loop position}
Next action: {command}
Resume file: .nexus/01-governance/HANDOFF.md
```

---

### Optional WIP Commit

Ask:
```
Commit current .nexus/ state? Creates a recovery point.
[yes / no]
```

If yes:
```bash
git add .nexus/ && git commit -m "nexus: WIP pause {YYYY-MM-DD}"
```

---

### Confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► SESSION PAUSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase {N} | {loop position}

Handoff: .nexus/01-governance/HANDOFF.md

Resume with: /nexus:progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
