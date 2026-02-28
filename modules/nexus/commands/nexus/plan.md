---
name: plan
description: Full pipeline entry point — discuss intent, research, plan, then auto-execute→verify→unify
argument-hint: "[phase-name-or-number] [--research] [--gaps] [--manual]"
allowed-tools: [Read, Write, Glob, Bash, AskUserQuestion]
---

# nexus:plan

## Purpose

**This is the primary entry point for Nexus V6.** Run `/nexus:plan` to kick off the autonomous pipeline for a phase. The system discusses your intent, researches the domain, creates an executable plan, and automatically executes, verifies, and closes the loop — without you typing further commands.

Pipeline: **DISCUSS → RESEARCH → PLAN → [auto] EXECUTE → VERIFY → UNIFY**

Flags:
- `--research` — force fresh oracle research even if RESEARCH.md exists
- `--gaps` — gap-closure mode: reads verification-report.json, plans only what failed
- `--manual` — disable auto-advance (stop after plan approval, wait for manual commands)

**Default is autonomous. Intervene only when blocked.**

---

## RULE 0

Read `~/.claude/nexus/workflows/plan-phase.md` before executing any step.

---

## Step 1 — Validate Preconditions

Read `.nexus/01-governance/STATE.md`:

1. Confirm `.nexus/` exists. If not: stop — "Run `/nexus:init` first."
2. Check loop position. If EXECUTE/VERIFY/UNIFY is in-progress (not complete):
   - Ask: `[1] Resume from current position  [2] Force new plan`
   - Default to `[1]` if no input in 10s.
3. Check blockers in STATE.md. Surface them before proceeding.

---

## Step 2 — Identify Phase

Read `.nexus/01-governance/ROADMAP.md`.

1. If `$ARGUMENTS`: use as target phase (match by name or number)
2. Otherwise: first phase with status `pending` or `not-started`
3. For `--gaps`: find the phase whose `verification-report.json` has `"status": "gaps_found"` or `"rejected"`. Match by reading each `.nexus/04-phases/*/verification-report.json`. If multiple phases have failures, use the most recently verified one (latest `"verified"` timestamp). If no failed report found, report error: "No failed verification report found. Run /nexus:verify first."
4. Auto-confirm if only one option; ask if multiple
5. Create phase directory: `.nexus/04-phases/{NN}-{phase-name}/`

---

## Step 3 — Discuss Phase Intent

Check for existing CONTEXT.md:

```bash
ls .nexus/04-phases/{NN}-{phase-name}/CONTEXT.md 2>/dev/null
```

If CONTEXT.md exists: skip to Step 4.

If not, ask:

```
════════════════════════════════════════
PHASE DISCUSSION — Phase {N}: {Name}
════════════════════════════════════════

Roadmap goal: {phase description from ROADMAP.md}

What do you want to accomplish? Describe success, specific goals,
design preferences, or constraints. Everything you say becomes a
locked decision for the planner.

[Enter to skip / type your intent]
════════════════════════════════════════
```

If skipped or no response in 15s: proceed with ROADMAP goals only.

If user responds: synthesize and confirm: "Goals are: {summary}. Sound right? [yes/refine]"

Write `.nexus/04-phases/{NN}-{phase-name}/CONTEXT.md`:

```markdown
# Phase {N}: {Name} — Context

**Gathered:** {date}

## Goals
{user's stated goals — or "Derived from ROADMAP.md (no discussion)" if skipped}

## Locked Decisions
{Everything stated explicitly — planner treats as non-negotiable}

## Claude's Discretion
{Areas not covered — implementation details, tech choices}

## Open Questions
{Anything unclear to resolve during planning}
```

---

## Step 4 — Oracle Research Pass

Skip if: `--gaps` mode. Skip if RESEARCH.md exists and `--research` not given.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► RESEARCHING Phase {N}: {Name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Spawning oracle...
```

Dispatch oracle (pass paths only — oracle reads its own context):

```
Task(
  subagent_type="nexus-oracle",
  description="Research Phase {N}: {name}",
  prompt="
    Read ~/.claude/agents/nexus/oracle.md for your role.

    Research: What do I need to know to plan Phase {N}: {name} well?

    Read these files yourself at start:
    - .nexus/04-phases/{NN}-{name}/CONTEXT.md
    - .nexus/01-governance/settings.json
    - .nexus/01-governance/ROADMAP.md
    {if prior SUMMARY.md}: - {path}

    Write: .nexus/04-phases/{NN}-{name}/RESEARCH.md
    Return ## RESEARCH COMPLETE or ## RESEARCH BLOCKED
  "
)
```

Handles:
- `## RESEARCH COMPLETE` → continue
- `## RESEARCH BLOCKED` → show blocker, options: `[1] Low-confidence  [2] Guidance  [3] Skip`

---

## Step 5 — Invoke Planner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► PLANNING Phase {N}: {Name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
◆ Spawning planner...
```

Dispatch planner (pass paths only):

```
Task(
  subagent_type="nexus-planner",
  description="Plan Phase {N}: {name}",
  prompt="
    Read ~/.claude/agents/nexus/planner.md for your role.

    Create PLAN.md for Phase {N}: {name}. Mode: {standard|gap_closure}.

    Read these files yourself at start:
    - .nexus/04-phases/{NN}-{name}/CONTEXT.md  [LOCKED DECISIONS — honor all]
    - .nexus/04-phases/{NN}-{name}/RESEARCH.md
    - .nexus/01-governance/ROADMAP.md
    - .nexus/01-governance/STATE.md
    - .nexus/01-governance/SCARS.md  [active prevention rules — MANDATORY]
    - .nexus/02-architecture/ARCHITECTURE.md
    {gap_closure}: - .nexus/04-phases/{NN}-{name}/verification-report.json

    Write: .nexus/04-phases/{NN}-{name}/PLAN.md
    Write: .nexus/04-phases/{NN}-{name}/TASK_GRAPH.json
    Return ## PLANNING COMPLETE or ## PLANNING INCONCLUSIVE
  "
)
```

- `## PLANNING COMPLETE` → Step 6
- `## PLANNING INCONCLUSIVE` → ask for context, retry once, then present to user

---

## Step 6 — Plan Quality Check

Skip if: `--gaps` mode with <3 tasks.

Read PLAN.md and verify inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► CHECKING PLAN QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- [ ] All tasks have: id, wave, files_modified, risk_tier, tdd_mode, acceptance_criteria
- [ ] Task descriptions are specific (endpoint, inputs, outputs — not "implement auth")
- [ ] Test files in files_modified for all non-skip TDD tasks
- [ ] No two tasks in same wave modify the same file
- [ ] must_haves.truths are observable testable behaviors
- [ ] must_haves.artifacts all have tasks that produce them (no phantoms)
- [ ] must_haves.key_links verify wiring not just existence
- [ ] No task has >6 files in files_modified
- [ ] checkpoint_before: true if any high/critical task
- [ ] TASK_GRAPH.json written, all tasks pending

Issues found → send back to planner with specific list (max 2 iterations).
After 2 iterations: `[1] Force proceed  [2] Add guidance  [3] Pause`

---

## Step 7 — Required Skills Check

Read `.nexus/01-governance/settings.json` for `required_skills` map.

For each work type in the plan's tasks, check if required skills are loaded.
If any required skill is missing:

```
════════════════════════════════════════
BLOCKED: Required skills not loaded
════════════════════════════════════════

This plan requires:
- /nexus:smart-tdd (auth work type)

Load these skills now, then type "ready".
Or type "override" to proceed without (logged).
════════════════════════════════════════
```

---

## Step 8 — Update State + Auto-Advance

Update STATE.md: loop position PLAN ✓.
Update ROADMAP.md: phase status → "planning".

Present plan summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► Phase {N}: {Name} — PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{N} tasks in {wave_count} waves

| Wave | Tasks | What it builds |
|------|-------|----------------|
| 1    | T01, T02 | {objectives} |
| 2    | T03      | {objective}  |

Risk: {tier} | TDD: {mode} | Playwright: {yes/no}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If `--manual` OR `settings.auto_advance: false`:
```
▶ NEXT: /nexus:execute .nexus/04-phases/{NN}-{name}/PLAN.md
  Type "go" to proceed.
```

If `auto_advance: true` (default):
```
Auto-advancing to EXECUTE in 5s... (type "stop" to pause)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXUS ► AUTO-ADVANCING → EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Invoke `/nexus:execute {plan-path}`.
Execute auto-chains to verify, verify auto-chains to unify.

---

## Anti-Patterns

**Loading file contents to pass to subagents:** Pass paths. Workers read their own context. Keep orchestrator lean.

**Skipping discussion:** CONTEXT.md captures intent that research+roadmap cannot provide alone.

**Skipping plan quality check:** Phantom artifacts and vague tasks waste execution time.

**Auto-advancing with active blockers in STATE.md:** Always surface blockers first.

---

## Success Criteria

- [ ] plan-phase.md loaded (RULE 0)
- [ ] Preconditions validated
- [ ] Phase identified
- [ ] CONTEXT.md created or existing
- [ ] RESEARCH.md created or existing
- [ ] PLAN.md created with full frontmatter and must_haves
- [ ] Plan quality check passed
- [ ] TASK_GRAPH.json written, all tasks pending
- [ ] Required skills loaded or override logged
- [ ] STATE.md: PLAN ✓
- [ ] ROADMAP.md: phase = planning
- [ ] Auto-advanced to execute (or waiting for "go")
