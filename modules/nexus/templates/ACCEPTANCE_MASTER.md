# Acceptance Master Criteria

**Project:** {{project_name}}
**Last updated:** {{date}}

> Source of truth for "done". Each criterion links to tests and Playwright flows.
> Every row here should have a corresponding test file reference.
> Status: pending | passing | failing | deferred

---

## How to Use This File

1. Each row is a criterion from the PRD
2. `Test Ref` is the test file and test name that verifies this criterion automatically
3. `Playwright Flow` is the flow spec ID if a browser test also validates this
4. Update `Status` as verification runs during each phase

---

## Criteria

| ID | Description | Given / When / Then | Test Ref | Playwright Flow | Phase | Status |
|----|-------------|---------------------|----------|-----------------|-------|--------|
| AC-1 | [Description of what must be true] | Given [precondition] / When [action] / Then [outcome] | [test file:test name] | [FLOW-001 or —] | [phase] | pending |
| AC-2 | | | | | | pending |
| AC-3 | | | | | | pending |

---

## Adding New Criteria

When adding a criterion:

1. Assign the next available AC-N ID
2. Write Given/When/Then precisely enough to be unambiguous
3. Identify the test that proves it
4. Identify the Playwright flow if UI behavior is involved
5. Assign to the phase responsible for delivering it
6. Status starts as `pending`

---

## Criterion Templates

**Feature behavior:**
```
AC-N | User can [action] | Given user is [state] / When user [does action] / Then [outcome is visible] | tests/[file].test.ts:[test name] | FLOW-001 | Phase N | pending
```

**Error handling:**
```
AC-N | System rejects [invalid input] | Given [invalid state] / When user [attempts action] / Then [error is shown] | tests/[file].test.ts:[test name] | — | Phase N | pending
```

**Data persistence:**
```
AC-N | [Data] is persisted across sessions | Given [data exists] / When user logs out and back in / Then [data is still present] | tests/[file].test.ts:[test name] | FLOW-002 | Phase N | pending
```

---

*Review this file when: phases are planned (assign criteria to phases), verification runs (update status), new requirements are identified*
