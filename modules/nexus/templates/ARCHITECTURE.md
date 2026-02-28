# Architecture

**Project:** {{project_name}}
**Analysis Date:** {{date}}
**Tech Stack:** {{tech_stack}}

---

## Overview

**Pattern:** [e.g., Layered monolith, Hexagonal architecture, Feature-sliced design]

**Key characteristics:**
- [Characteristic 1]
- [Characteristic 2]
- [Characteristic 3]

---

## Module Map

| Module | Path | Responsibility | Owns | Depends On |
|--------|------|---------------|------|------------|
| [module-1] | src/[module-1]/ | [What it does] | [What it owns] | [What it imports] |
| [module-2] | src/[module-2]/ | [What it does] | [What it owns] | [module-1] |

---

## Data Flow

**Primary request flow:**
1. [Entry point: e.g., HTTP request arrives at src/server.ts]
2. [Routing: e.g., Express router dispatches to handler]
3. [Handler: e.g., handler validates input, calls service]
4. [Service: e.g., service applies business logic, calls repository]
5. [Repository: e.g., repository queries database, returns data]
6. [Response: e.g., handler serializes response]

**State management:**
[Describe how state is managed — Redux, Zustand, server-side sessions, etc.]

---

## API Boundaries

**External-facing endpoints:**

| Contract ID | Method | Path | Handler | Defined In |
|-------------|--------|------|---------|------------|
| CONTRACT-001 | POST | /api/auth/login | src/auth/login.ts | api_contracts.json |

**Inter-module boundaries:**
- [Module A] exposes to [Module B]: [what and how]
- [Module B] may NOT access [Module A] internals — use public API only

---

## Key Design Decisions

> See DECISION_LOG.md for full rationale

- [Decision 1 brief description] — see DEC-001
- [Decision 2 brief description] — see DEC-002

---

## Known Constraints

**Module boundary violations (technical debt):**
- [None | Description of violation, files involved, fix plan]

**Scaling limits:**
- [None known | Description of what will break and when]

**Fragile areas:**
- [None known | Description of fragile component and why]

---

## Module Boundary Rules

Based on analysis, these rules must be enforced:

1. Modules import from other modules' `index.ts` (public API) only — never from internal files
2. [Other rules based on project structure]
3. Any boundary violation must be flagged in adversarial review

---

## Testing

**Framework:** [Test framework and version]
**Coverage:** [Coverage requirements]
**Test locations:** [Co-located with source | separate tests/ directory]

---

*Architecture analysis: {{date}}*
*Rebuilt by: /nexus:map-codebase*
