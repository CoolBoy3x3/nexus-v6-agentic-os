# Plan Phase Workflow

Implements the planning logic for `/nexus:plan`. Discuss intent → oracle research → planner creates PLAN.md → plan quality check → auto-advance to execute.

**Key principle: Orchestrator stays lean. Pass PATHS to subagents. Subagents read their own context.**

---

## Precondition Check

1. Verify `.nexus/01-governance/STATE.md` exists
2. Check loop position — if EXECUTE/VERIFY/UNIFY is in-progress (not complete):
   - Ask: `[1] Resume from current position  [2] Force new plan`
   - Default to `[1]` after 10s
3. Surface any active blockers from STATE.md before proceeding
4. Check architecture index freshness:
   ```bash
   cat .nexus/02-architecture/modules.json 2>/dev/null
   ```
   If `modules.json` does not exist, is empty `{}`, or has no entries in its `modules` array:
   ```
   ⚠ Architecture index is empty.
   Workers will have no module context for this plan.

   [1] Run /nexus:map-codebase first (recommended for existing codebases)
   [2] Proceed anyway (fine for new projects — no existing code to index)
   ```
   Default to `[2]` after 10s (new projects start with empty index — this is normal).

---

## Phase Identification

1. Read ROADMAP.md
2. If `$ARGUMENTS`: match by name or number
3. Otherwise: first phase with status `pending` or `not-started`
4. For `--gaps`: use the phase with a failed `verification-report.json`
5. Auto-confirm if only one option; ask if multiple
6. Create phase directory: `.nexus/04-phases/{NN}-{name}/`

---

## Discuss Phase Intent

Check for existing CONTEXT.md:
```bash
ls .nexus/04-phases/{NN}-{name}/CONTEXT.md 2>/dev/null
```

If exists: skip to Oracle Research.

If not, ask the user:
```
════════════════════════════════════════
PHASE DISCUSSION — Phase {N}: {Name}
════════════════════════════════════════

Roadmap goal: {phase description}

What do you want to accomplish? Describe success, specific goals,
design preferences, or constraints. Everything you say becomes a
locked decision for the planner.

[Enter to skip / type your intent]
════════════════════════════════════════
```

If skipped (or no response in 15s): proceed with ROADMAP goals only.
If user responds: synthesize and confirm. "Goals are: {summary}. Sound right? [yes/refine]"

Write `.nexus/04-phases/{NN}-{name}/CONTEXT.md`:
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

## Oracle Research

Skip if: `--gaps` mode. Skip if RESEARCH.md exists and `--research` not given.

Dispatch oracle (pass PATHS ONLY — oracle reads its own context):
```
Task(
  subagent_type="nexus-oracle",
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

- `## RESEARCH COMPLETE` → continue
- `## RESEARCH BLOCKED` → show blocker: `[1] Low-confidence  [2] Guidance  [3] Skip`

---

## Planner Dispatch

Dispatch planner (pass PATHS ONLY — planner reads its own context):
```
Task(
  subagent_type="nexus-planner",
  prompt="
    Read ~/.claude/agents/nexus/planner.md for your role.

    Create PLAN.md for Phase {N}: {name}. Mode: {standard|gap_closure}.

    Read these files yourself at start:
    - .nexus/04-phases/{NN}-{name}/CONTEXT.md  [LOCKED DECISIONS — honor all]
    - .nexus/04-phases/{NN}-{name}/RESEARCH.md
    - .nexus/01-governance/ROADMAP.md
    - .nexus/01-governance/STATE.md
    - .nexus/01-governance/SCARS.md  [MANDATORY — active prevention rules]
    - .nexus/02-architecture/ARCHITECTURE.md
    {gap_closure}: - .nexus/04-phases/{NN}-{name}/verification-report.json

    Write: .nexus/04-phases/{NN}-{name}/PLAN.md
    Write: .nexus/04-phases/{NN}-{name}/TASK_GRAPH.json
    Return ## PLANNING COMPLETE or ## PLANNING INCONCLUSIVE
  "
)
```

- `## PLANNING COMPLETE` → quality check
- `## PLANNING INCONCLUSIVE` → ask for context, retry once, then present to user

---

## Plan Quality Check

Skip if: `--gaps` mode with <3 tasks.

Verify inline (read PLAN.md structure — do NOT load file contents into orchestrator):

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

## Required Skills Check

Read `.nexus/01-governance/settings.json` for `required_skills` map.

`required_skills` format:
```json
{
  "required_skills": {
    "auth": ["smart-tdd"],
    "payments": ["smart-tdd", "adversarial-review"],
    "data-migration": ["rollback-discipline"]
  }
}
```

A skill is "loaded" when the user has run `/skill:nexus/<skill-name>` in this Claude Code session, which loads `~/.claude/skills/nexus/<skill-name>/SKILL.md` into context. This is honor-system for solo use — the gate is a reminder, not a hard block.

For each work type tag in the plan's task descriptions (e.g. "auth", "payments"), check `required_skills`.
If a required skill is listed:
```
════════════════════════════════════════
SKILLS REMINDER
════════════════════════════════════════
This plan includes work tagged: {work-type}
Recommended skill: /skill:nexus/{skill-name}

Load it now for best results, then type "ready".
Or type "skip" to proceed without (logged in STATE.md).
════════════════════════════════════════
```

If `required_skills` is empty `{}`: skip this check entirely.

---

## Risk Tier Assignment

| Risk Tier | Criteria |
|-----------|----------|
| `low` | New files only, no dependencies changed |
| `medium` | Modifies existing files, adds libraries, changes data structures |
| `high` | Modifies auth/payments/migrations/integrations, changes public API |
| `critical` | Destructive operations, data migrations, security-critical, irreversible |

Plan-level `risk_tier` = highest task-level `risk_tier`.
Set `checkpoint_before: true` if any task is `high` or `critical`.

---

## Update STATE.md

Set loop position PLAN ✓:
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  ✓          ○           ○         ○
```

Update ROADMAP.md phase status to "planning".
Update session continuity: next action = `/nexus:execute {plan-path}`.

---

## Auto-Advance

If `--manual` OR `auto_advance: false`:
```
▶ NEXT: /nexus:execute .nexus/04-phases/{NN}-{name}/PLAN.md
  Type "go" to proceed.
```

If `auto_advance: true` (default):
```
Auto-advancing to EXECUTE in 5s... (type "stop" to pause)
```
Invoke `/nexus:execute {plan-path}`.
Execute auto-chains to verify, verify auto-chains to unify.
