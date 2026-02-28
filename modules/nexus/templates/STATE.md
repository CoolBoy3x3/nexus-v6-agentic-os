# Project State

> Machine-readable session continuity. Keep under 100 lines. Update on every loop transition.

---

## Project Reference

**Name:** {{project_name}}
**Core value:** {{core_value}}
**Tech stack:** {{tech_stack}}
**Workspace:** `.nexus/`

---

## Current Position

**Phase:** {{current_phase}} of {{total_phases}} — {{phase_name}}
**Status:** {{phase_status}}
**Last activity:** {{timestamp}} — {{last_action}}

**Progress:**
- Roadmap: {{roadmap_progress_bar}} {{roadmap_percent}}%
- Phase: {{phase_progress_bar}} {{phase_percent}}%

---

## Loop Position

```
PLAN ──▶ EXECUTE ──▶ VERIFY ──▶ UNIFY
  {{plan_mark}}         {{execute_mark}}         {{verify_mark}}       {{unify_mark}}
```

**Current:** {{loop_status_description}}

> Marks: ✓ complete | ● active | ○ not started

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | {{phases_complete}} / {{total_phases}} |
| Total tasks completed | {{total_tasks}} |
| Scar Count | {{scar_count}} |
| Prevention rules active | {{prevention_rule_count}} |
| Session count | {{session_count}} |

---

## Accumulated Context

**Decisions made:** {{decision_count}} (see DECISION_LOG.md)
**Active prevention rules:** {{prevention_rule_count}} (see SCARS.md)

**Key constraints:**
- {{constraint_1}}
- {{constraint_2}}

**Architecture notes:**
- Architecture rebuild needed: {{rebuild_needed}}
- Last mapped: {{last_mapped}}

---

## Blockers

{{blockers_or_none}}

---

## Session Continuity

**Last session:** {{last_session_timestamp}}
**Stopped at:** {{stopped_at}}
**Next action:** {{next_action}}
**Resume file:** {{resume_file}}
