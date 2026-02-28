---
name: progress
description: Universal session entry point — orient, resume, and route to exactly ONE next action. Replaces pause/resume commands.
argument-hint: "[context] [--pause]"
allowed-tools: [Read, Write, Bash, Glob]
---

# nexus:progress

## Purpose

**This is the universal entry point for any session.** Run `/nexus:progress` at the start of every session. It reads HANDOFF.md and STATE.md, shows where you are in the loop, and outputs exactly ONE next action.

With `--pause`: saves session state and creates a handoff for clean resume later.

This command eliminates decision fatigue. One command → one action. Always.

---

## RULE 0

Read `~/.claude/nexus/workflows/progress-phase.md` before executing.

---

## Behavior Split

- **No flag (default):** Orient + route → show progress → output ONE next action
- **`--pause` flag:** Save state → create HANDOFF.md → output resume instructions

---

## ORIENT MODE (default)

### Step 1 — Load State

Read:
- `.nexus/01-governance/HANDOFF.md` — last session's stopping point (if exists)
- `.nexus/01-governance/STATE.md` — authoritative loop position and blockers
- `.nexus/01-governance/ROADMAP.md` — phase overview and overall progress

If `.nexus/` does not exist: "No workspace found. Run `/nexus:init` first."

**STATE.md is the ground truth.** If HANDOFF.md and STATE.md disagree, use STATE.md and note the discrepancy.

---

### Step 2 — Display Progress

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► {project-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Roadmap: {X}% complete ({complete}/{total} phases)
├── Phase 1: {name} ████████████ complete
├── Phase 2: {name} ██████░░░░░░ 50%  ← current
├── Phase 3: {name} ░░░░░░░░░░░░ pending
└── Phase 4: {name} ░░░░░░░░░░░░ pending

Current Loop: Phase {N} — {Phase Name}
  PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
    {✓/●/○}      {✓/●/○}      {✓/●/○}    {✓/●/○}

Scars: {count} recorded | Prevention rules: {count} active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If HANDOFF.md exists from a prior session, show a brief summary:
```
📋 Last session: {date} — {status from HANDOFF.md}
   {What was completed last session}
```

Then archive the consumed handoff:
```bash
mv .nexus/01-governance/HANDOFF.md .nexus/01-governance/HANDOFF-{date}-consumed.md
```

---

### Step 3 — Consider User Context

If `$ARGUMENTS` was provided (no `--pause`), factor it into routing:
- "I only have 30 minutes" → suggest smallest meaningful step
- "I'm stuck on X" → suggest `/nexus:systematic-debugging` skill
- "I need to fix a bug first" → surface the bug path
- "Continue" / "go" / "yes" → proceed with default routing

If no argument: use default routing from state.

---

### Step 4 — Determine ONE Next Action

**Default routing table:**

| Situation | Single Next Action |
|-----------|-------------------|
| No phases in ROADMAP.md | "Add phases to ROADMAP.md, then run /nexus:plan" |
| Loop position ○○○○ | `/nexus:plan` |
| Loop position ✓○○○ | `/nexus:execute [plan-path]` |
| Loop position ✓✓○○ | `/nexus:verify` |
| Loop position ✓✓✓○ | `/nexus:unify` |
| Loop position ✓✓✓✓, more phases | `/nexus:plan` (next phase) |
| Loop position ✓✓✓✓, last phase | "All phases complete — ship it or add phases." |
| VERIFY ● (gaps) | `/nexus:plan --gaps` (gap-closure) |
| Blockers in STATE.md | "Address blocker: {specific blocker}" |
| Architecture rebuild flagged | `/nexus:map-codebase` before next plan |

**IMPORTANT:** Exactly ONE action. Not a menu. Not "you could do A or B."

---

### Step 5 — Output

```
────────────────────────────────────────
▶ NEXT: {exact command with path}
  {one-line reason why this is the next action}
────────────────────────────────────────

Type "go" to proceed, or describe your context for a different suggestion.
```

Active prevention rules from SCARS.md (if any):
```
Active prevention rules:
  - {rule 1}
  - {rule 2}
```

If the user types "go", "yes", "y", or "proceed": execute the suggested action immediately.

---

## PAUSE MODE (`--pause`)

### Step P1 — Capture State

Read STATE.md. Extract:
- Current phase and loop position
- Any in-progress tasks from TASK_GRAPH.json
- Active blockers
- Scar count and prevention rules

If `$ARGUMENTS` contains context (other than `--pause`): treat it as the pause reason.

---

### Step P2 — Write HANDOFF.md

Write `.nexus/01-governance/HANDOFF.md`:

```markdown
# HANDOFF — {project_name}

**Created:** {ISO timestamp}
**Status:** {loop position summary — e.g., "Mid-execute, Wave 2 of 3 complete"}
**Reason:** {reason from arguments or "Manual pause"}

---

## READ THIS FIRST

**Project:** {project_name}
**Phase:** {N} of {total} — {phase name}

**Loop Position:**
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  {mark}       {mark}       {mark}      {mark}
```

## What Was Completed This Session

{Bullet list from TASK_GRAPH.json completed tasks and decisions made}

## What Is In Progress

{In-progress tasks or "Nothing in progress — stopped at a clean boundary."}

## Blockers

{Active blockers or "None."}

## Active Prevention Rules

{From SCARS.md Active Prevention Rules or "None recorded yet."}

## Key Files

| File | Purpose |
|------|---------|
| `.nexus/01-governance/STATE.md` | Live project state |
| {current plan path} | Current phase plan |

## Resume Instructions

Run `/nexus:progress` — it reads this file automatically.

**Single next action: {exact command}**

---
*Handoff created: {ISO timestamp}*
```

Update STATE.md Session Continuity:
```
Last session: {ISO timestamp}
Paused at: {loop position}
Next action: {command}
Resume file: .nexus/01-governance/HANDOFF.md
```

---

### Step P3 — Optional WIP Commit

```
Commit the current .nexus/ state? Creates a recovery point.
[yes / no]
```

If yes:
```bash
git add .nexus/
git commit -m "nexus: WIP pause {YYYY-MM-DD}"
```

---

### Step P4 — Confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► SESSION PAUSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase {N} | {loop position}

Handoff: .nexus/01-governance/HANDOFF.md

Resume with: /nexus:progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Anti-Patterns

**Outputting multiple next actions:** One action. Always. Decision fatigue kills momentum.

**Ignoring HANDOFF.md:** If a handoff exists, always surface its context before routing.

**Asking "what were you working on?" when STATE.md shows it:** STATE.md is the source of truth. Read it.

**Using /nexus:pause or /nexus:resume:** These are now stubs. Use `/nexus:progress --pause` and `/nexus:progress`.

---

## Success Criteria

**Orient mode:**
- [ ] HANDOFF.md and STATE.md read
- [ ] Prior session context surfaced (if HANDOFF.md exists)
- [ ] Consumed HANDOFF.md archived
- [ ] Progress display output with marks
- [ ] Exactly ONE next action output
- [ ] Active prevention rules shown if any
- [ ] User can type "go" to proceed

**Pause mode:**
- [ ] HANDOFF.md written with complete, real content
- [ ] STATE.md session continuity updated
- [ ] Optional WIP commit offered
- [ ] Resume instructions: exactly ONE command
