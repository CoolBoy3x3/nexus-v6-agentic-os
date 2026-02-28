---
name: brainstorming
description: "Use before any feature design, new capability, or architectural decision. Explores intent, requirements, and design before committing to a plan."
---

# Brainstorming

## Overview

Turn ideas into fully-formed designs through Socratic questioning before any implementation work begins. This skill prevents the most common form of waste: building the right code for the wrong design.

The output of brainstorming feeds directly into the Nexus planning loop. A brainstorming session ends with a decision written to DECISION_LOG.md and a clear path to `/nexus:plan`.

---

## Hard Gate

<HARD-GATE>
Do NOT invoke any implementation, write any code, or take any planning action until the user has approved a design. This applies to every feature regardless of apparent simplicity. The design can be brief — a few sentences for a simple feature — but approval must be obtained before proceeding.
</HARD-GATE>

---

## When to Use

Use this skill before:
- Designing a new feature or capability
- Choosing between multiple implementation approaches
- Making an architectural decision that will affect future phases
- Designing a new API contract (required by the contract-first skill)
- Any time the right approach is unclear

Do NOT use this skill for:
- Bug fixes with clear root cause (use systematic-debugging instead)
- Mechanical tasks with no design choices (use /nexus:plan directly)
- Implementing something already fully specified in PLAN.md

---

## The Checklist

Work through these steps in order. Do not skip.

1. **Explore project context** — read ARCHITECTURE.md, DECISION_LOG.md, ROADMAP.md
2. **Ask clarifying questions** — one at a time until you understand purpose, constraints, success criteria
3. **Propose 2-3 approaches** — with tradeoffs and your recommendation
4. **Present design** — section by section, get approval after each section
5. **Write decision to DECISION_LOG.md** — record the design and rationale
6. **Transition** — output "Design approved. Run /nexus:plan with this design."

---

## Step 1: Explore Context

Before asking any questions, understand what exists:

- Read `.nexus/01-governance/STATE.md` — current position in the project
- Read `.nexus/02-architecture/ARCHITECTURE.md` — existing module structure
- Read `.nexus/02-architecture/DECISION_LOG.md` — prior architectural decisions
- Read `.nexus/01-governance/ROADMAP.md` — where this fits in the overall plan
- Check `.nexus/02-architecture/SCARS.md` — what's gone wrong before (active prevention rules)

Look for:
- Prior decisions that constrain this design (locked decisions must be honored)
- Module boundaries this feature will touch
- Existing patterns the feature should follow
- Active prevention rules that apply to this area

---

## Step 2: Ask Clarifying Questions

**One question at a time.** Never ask multiple questions in a single message. This is not negotiable — multiple simultaneous questions overwhelm and produce poor answers.

**Prefer multiple-choice questions** when possible. They're easier to answer and produce clearer responses.

Focus your questions on:
- **Purpose:** Why is this needed? What problem does it solve?
- **Scope:** What is explicitly in scope? What is explicitly out of scope?
- **Success criteria:** How will we know this worked? What does "done" look like?
- **Constraints:** Technical limitations, time pressure, team preferences?
- **Users:** Who uses this? What are their expectations?

**YAGNI ruthlessly.** Every time a feature expansion comes up, ask: "Is this needed for the first version?" Remove it if not clearly needed now.

---

## Step 3: Propose 2-3 Approaches

Once you understand the problem, propose 2-3 different approaches:

Format:
```
Approach A: {Name}
  How it works: {brief description}
  Pros: {list}
  Cons: {list}
  Best when: {conditions}

Approach B: {Name}
  How it works: {brief description}
  Pros: {list}
  Cons: {list}
  Best when: {conditions}

My recommendation: Approach A
  Reason: {why this fits the project's context, constraints, and goals}
```

Lead with your recommendation. Be direct. The user can choose differently, but give them a clear starting point.

---

## Step 4: Present the Design

Once an approach is selected, present the design section by section. **Ask after each section whether it looks right.** Do not present the entire design at once.

**Typical design sections:**
1. Architecture — how the new code fits into existing modules
2. Data model — any new data structures or schema changes
3. API contract — if applicable (required before implementation)
4. Component/function interface — public API of the new code
5. Error handling — how failures are handled
6. Testing strategy — what types of tests, what they cover

**Scale each section to its complexity:**
- Simple change: a few sentences per section
- Complex feature: up to a paragraph per section, with a small code example if helpful

---

## Step 5: Write Decision to DECISION_LOG.md

After design approval, append to `.nexus/02-architecture/DECISION_LOG.md`:

```markdown
| {auto-ID} | {date} | {phase or "pre-planning"} | {decision summary} | {rationale} | {impact on future phases} | [R]/[I] |
```

Reversibility:
- `[R]` = Reversible — can be undone without coordination
- `[I]` = Irreversible — requires migration, external coordination, or significant rework to undo

If the design specifies a new API contract: also register it in `.nexus/02-architecture/api_contracts.json` (see contract-first skill).

---

## Step 6: Terminal State — Transition to Planning

**The terminal state of brainstorming is:**

1. Write the design to a file: `.nexus/05-artifacts/design-{YYYY-MM-DD}-{topic}.md`
2. Update DECISION_LOG.md
3. Output:

```
════════════════════════════════════════
  DESIGN APPROVED
════════════════════════════════════════

Design: .nexus/05-artifacts/design-{date}-{topic}.md
Decision recorded in DECISION_LOG.md

Run /nexus:plan with this design to create the implementation plan.

The plan should include:
  - Phase goal: {one sentence from design}
  - Key constraints: {from design decisions}
  - Files that will be modified: {estimated list from design}
════════════════════════════════════════
```

Do NOT invoke any implementation skill. Do NOT write code. Do NOT create PLAN.md.

The only next step is `/nexus:plan`. The user runs it.

---

## Key Principles

**One question at a time.** Decision fatigue destroys design sessions. Ask one thing and wait.

**YAGNI.** Every feature not clearly needed now should be deferred. "We might need it later" is not a reason to build it now.

**Explore alternatives.** Always propose 2-3 approaches. Never lock in on the first idea.

**Respect locked decisions.** If DECISION_LOG.md shows a prior decision that constrains this design, honor it. If the user wants to revisit a locked decision, route them to `/nexus:revise` — not brainstorming.

**Check prevention rules.** SCARS.md active prevention rules apply to the design. If the proposed design would violate a prevention rule, surface this immediately and design around it.

**Incremental validation.** Present and approve each section before moving to the next. Don't ask for approval of a complete design all at once.

---

## Anti-Patterns

**Presenting designs that ignore prior decisions:** Always read DECISION_LOG.md first.

**Asking multiple questions at once:** Split them. One question, wait, then next.

**Designing past the YAGNI line:** "Just in case" features are scope creep. Remove them.

**Starting to implement during brainstorming:** You found an interesting technical approach and started writing code to "explore" it. Stop. Design first.

**Skipping approval:** The user gave an enthusiastic description of what they want. You understood it. You skipped the design presentation and went straight to planning. Don't. Always present the design and get explicit approval.

---

## Success Criteria

- [ ] Project context read (ARCHITECTURE.md, DECISION_LOG.md, SCARS.md)
- [ ] Questions asked one at a time
- [ ] 2-3 approaches proposed with tradeoffs
- [ ] Design presented section by section with approval
- [ ] YAGNI applied (unnecessary features removed)
- [ ] Decision recorded in DECISION_LOG.md
- [ ] Design file written to .nexus/05-artifacts/
- [ ] Terminal output: "Design approved. Run /nexus:plan with this design."
- [ ] No code written during brainstorming
