# Nexus Handoff

**Date:** {{date}}
**Time:** {{time}} UTC
**Status:** {{status}}
**Reason for pause:** {{reason}}

---

## READ THIS FIRST

You have no prior context. This document tells you everything you need.

**Project:** {{project_name}}
**Core value:** {{core_value}}

---

## Current State

**Phase:** {{phase_number}} of {{total_phases}} — {{phase_name}}
**Plan:** {{plan_id}} — {{plan_status}}

**Loop Position:**
```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  {{plan_mark}}         {{execute_mark}}         {{verify_mark}}       {{unify_mark}}
```

---

## What Was Completed This Session

{{accomplished_list}}

---

## What Is In Progress

{{in_progress_list}}

---

## Open Decisions

{{open_decisions_or_none}}

---

## Active Blockers

{{blockers_or_none}}

---

## Active Prevention Rules

{{prevention_rules_or_none}}

> These are non-negotiable constraints for all future tasks in this project.

---

## Key Files

| File | Purpose |
|------|---------|
| `.nexus/01-governance/STATE.md` | Live project state |
| `.nexus/01-governance/ROADMAP.md` | Phase overview |
| {{current_plan_path}} | Current phase plan |
| `.nexus/02-architecture/SCARS.md` | Active prevention rules |

---

## Resume Instructions

Run `/nexus:progress` — it reads this file automatically and routes to exactly ONE next action.

**Single next action: {{next_action}}**

---

*Handoff created: {{timestamp}}*
*This file is the single entry point for fresh sessions.*
*Archived automatically by /nexus:progress when consumed.*
