# Scars Register

**Project:** {{project_name}}

> Every failure that taught us something. Scars are not shameful — they are guardrails.
> Prevention rules extracted from scars apply to all future tasks in this project.
> Workers receive active prevention rules in every context packet via stateDigest.

---

## Active Prevention Rules

> These rules are currently enforced. They are extracted from Scars below.
> Do NOT remove rules — they represent real failures that happened.

| Rule | Source Scar | Applied Since |
|------|-------------|---------------|
| [No active rules yet — rules will appear here as scars are recorded] | — | — |

---

## Scar Log

| ID | Date | Category | Description | Root Cause | Resolution | Prevention Rule |
|----|------|----------|-------------|------------|------------|-----------------|
| [No scars yet — scars are recorded when tasks fail and require recovery] | | | | | | |

---

## Scar Categories

| Category | Meaning |
|----------|---------|
| `implementation` | Code-level failure — logic error, missed edge case |
| `architecture` | Structural failure — wrong module boundary, incompatible design |
| `testing` | Test failure — tests didn't catch the bug, tests were wrong |
| `tooling` | Build/deploy failure — config wrong, version incompatibility |
| `external` | External dependency failure — API changed, service down |
| `process` | Process failure — checkpoint not created, context not preserved |

---

## How to Read a Scar

Each scar row answers:
- **What happened** (Description)
- **Why it happened** (Root Cause)
- **How we recovered** (Resolution)
- **How to prevent recurrence** (Prevention Rule)

The Prevention Rule is the most important field. It is the knowledge this project now carries permanently.

---

## Scar Recording Process

When a task requires rollback or fails permanently:

1. Identify root cause (specific, not vague)
2. Derive a prevention rule (actionable constraint)
3. Add row to Scar Log table
4. Add prevention rule to Active Prevention Rules table
5. Increment STATE.md scar_count
6. Update STATE.md session continuity with the new rule

---

*Scar register created: {{date}}*
*A project with zero scars may have not tried hard enough things.*
*A project with many scars is learning and improving.*
