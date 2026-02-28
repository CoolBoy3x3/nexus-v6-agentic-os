# Revise Phase Workflow

Implements the plan revision flow for `/nexus:revise`. Performs blast-radius analysis before any changes.

---

## Identify Target Phase

1. From $ARGUMENTS or user selection: identify target phase
2. Read PLAN.md, TASK_GRAPH.json, SUMMARY.md (if exists) for the phase

---

## Gather Revision Description

Ask: "What needs to change?" Record the revision description.

---

## Impact Analysis

### Direct Dependents

Read ROADMAP.md. Find all phases where `depends_on` contains the target phase.

### Artifact Consumers

From target phase PLAN.md `provides` list: grep all other SUMMARY.md files for references.

### File Overlap

From target phase `files_modified` list: grep other PLAN.md files for the same files.

### Contract Impact

If revision touches any file in `api_contracts.json`: identify contracts and their consumers.

---

## Display Blast Radius

Show user:
- Direct dependent phases (with status)
- Artifact consumers
- File overlap
- Contract impact (breaking vs non-breaking)
- Impact assessment: low | medium | high

Ask: "Proceed? (yes/no)"

If no: stop.

---

## Create Checkpoint

Before any changes:
```bash
git add .nexus/04-phases/{NN}-{name}/
```
Write checkpoint JSON to `.nexus/06-checkpoints/`.

---

## Apply Revision

1. Dispatch architect agent if module boundaries will change
2. Dispatch planner agent with: original PLAN.md, revision description, blast radius analysis
3. Planner produces revised PLAN.md (incremented plan number)
4. Update TASK_GRAPH.json

---

## Propagate to Dependent Phases

For each incomplete dependent phase: add revision note to their PLAN.md.
For each complete dependent phase: add compatibility note to their SUMMARY.md.

---

## Update Governance Files

Add revision note to ROADMAP.md.
Add decision to DECISION_LOG.md.

---

## Output

```
REVISION COMPLETE

Phase {N} plan revised.
Change: {summary}

Affected phases noted: {list}
Checkpoint saved: {id}

Run /nexus:execute to re-execute the revised plan.
```
