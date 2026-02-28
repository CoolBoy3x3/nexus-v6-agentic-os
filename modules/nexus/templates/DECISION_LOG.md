# Decision Log

**Project:** {{project_name}}

> Architectural and significant technical decisions.
> Record decisions here so future phases don't re-open settled questions.
> Also prevents "why did we do it this way?" confusion months later.

---

## Reversibility Legend

- **[R]** Reversible — can be undone with rollback, config change, or refactor without external coordination
- **[I]** Irreversible — requires database migration, external coordination, breaking API consumers, or significant rework

When in doubt: mark [I]. It's better to be cautious about what's reversible.

---

## How to Add an Entry

When a significant decision is made:
1. Assign the next DEC-N ID
2. Record date, phase, decision, rationale, and impact
3. Mark reversibility
4. Reference this ID in PLAN.md and SUMMARY.md

---

## Log

| ID | Date | Phase | Decision | Rationale | Impact | Reversible |
|----|------|-------|----------|-----------|--------|------------|
| [No decisions yet — decisions are recorded during planning and execution] | | | | | | |

---

## Decision Templates

**Library / Technology Choice:**
```
| DEC-N | YYYY-MM-DD | Phase N | Use [library] for [purpose] instead of [alternative] | [Why: performance, ecosystem, team familiarity, etc.] | All [purpose] code uses [library] API | [R]/[I] |
```

**Architecture Decision:**
```
| DEC-N | YYYY-MM-DD | Phase N | Organize [concern] as [pattern] | [Why this pattern fits the project constraints] | Module structure and import paths follow this pattern | [R]/[I] |
```

**API Contract Decision:**
```
| DEC-N | YYYY-MM-DD | Phase N | [endpoint] returns [shape] | [Why this shape is correct for consumers] | All consumers must handle [shape]; breaking change if modified | [I] |
```

**Breaking Change:**
```
| DEC-N | YYYY-MM-DD | Phase N | Changed [contract/interface] from [old] to [new] | [Why the change was necessary] | Consumers [list] must be updated | [I] |
```

---

*Decision log created: {{date}}*
*Reference: SCARS.md for failure-derived rules | ARCHITECTURE.md for current architecture state*
