---
name: contract-first
description: Define API contracts before writing implementation. Register in api_contracts.json. Any contract change requires human approval.
---

# Contract-First Development

## Overview

Define the API contract before writing any implementation. The contract is the truth. Implementation follows. Never the other way around.

**Why this matters:** When implementation precedes contract definition, every consumer of the API is written against guesses about what the API will do. When the implementation changes — and it will — every consumer breaks in unpredictable ways. Contract-first prevents this by making the interface explicit before anyone writes a single line of implementation code.

---

## The Rule

**No implementation starts before the contract is defined.**

This is a blocking rule, not a guideline. If a task requires implementing an API endpoint, function with public interface, or external service integration, the contract must exist in `.nexus/02-architecture/api_contracts.json` before the worker begins.

Contract violations are blocking, not warnings.

---

## Contract Format

Register contracts in `.nexus/02-architecture/api_contracts.json` using this format:

```json
{
  "contracts": [
    {
      "id": "CONTRACT-001",
      "name": "User Login",
      "path": "/api/auth/login",
      "method": "POST",
      "version": "1.0",
      "status": "active",
      "definedInPhase": "02-auth",
      "requestSchema": {
        "type": "object",
        "required": ["email", "password"],
        "properties": {
          "email": { "type": "string", "format": "email" },
          "password": { "type": "string", "minLength": 8 }
        }
      },
      "responseSchema": {
        "success": {
          "status": 200,
          "type": "object",
          "properties": {
            "accessToken": { "type": "string" },
            "expiresAt": { "type": "string", "format": "date-time" }
          }
        },
        "error_401": {
          "status": 401,
          "type": "object",
          "properties": {
            "error": { "type": "string" }
          }
        }
      },
      "consumers": [],
      "notes": "Access token is a JWT. Expiry is 1 hour.",
      "created": "2024-01-15T10:00:00Z",
      "lastModified": "2024-01-15T10:00:00Z"
    }
  ],
  "lastUpdated": "2024-01-15T10:00:00Z"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier: CONTRACT-{N} |
| `name` | string | Human-readable name |
| `path` | string | URL path (REST) or function name (library) |
| `method` | string | HTTP method (GET, POST, PUT, DELETE, PATCH) or FUNCTION |
| `version` | string | Semantic version: "1.0", "1.1", "2.0" |
| `status` | enum | active \| deprecated \| draft |
| `definedInPhase` | string | Which phase defined this contract |
| `requestSchema` | object | JSON Schema for the request body |
| `responseSchema` | object | JSON Schema for each response type |
| `consumers` | array | List of files that consume this contract |

---

## When to Define a Contract

Define a contract in `api_contracts.json` before implementation when:

1. **Creating a new HTTP endpoint** (any method)
2. **Creating a function with a public interface** that other modules will call
3. **Integrating with an external service** (define the contract for what you will send/receive)
4. **Modifying an existing endpoint's request or response schema**

You do NOT need to define a contract for:
- Private/internal functions not consumed by other modules
- Pure utility functions with trivial interfaces
- Database ORM calls (these use the data model schema instead)

---

## The Contract Definition Process

### Step 1: Define Before Implementing

When planning a task that requires an API endpoint or public interface:

1. Add the contract to `api_contracts.json` BEFORE writing the task
2. Reference the contract ID in the task definition
3. Include the contract in the `contractsSlice` of the worker's context packet

If a task arrives without a contract for a required endpoint: send `<<NEXUS_BLOCKED: Contract not defined for {endpoint}. Define in api_contracts.json before implementation begins.>>`

### Step 2: Implementation Follows Contract

The contract is the specification. Implementation must match it.

When the worker implements the endpoint:
- Request validation must match `requestSchema`
- Success response must match `responseSchema.success`
- Error responses must match `responseSchema.error_{code}`

The verifier checks that the implementation matches the contract via key link verification.

### Step 3: Register Consumers

When a file consumes a contract (makes a fetch call to the endpoint, imports the function), add it to the contract's `consumers` array:

```json
"consumers": [
  "src/dashboard/auth-client.ts",
  "src/components/LoginForm.tsx"
]
```

This enables impact analysis when a contract changes.

---

## Handling Contract Changes

### Non-Breaking Changes (Safe to Proceed)

These changes do NOT require human approval:

- Adding an OPTIONAL new field to the response
- Adding a new OPTIONAL query parameter
- Adding a new endpoint (does not change existing endpoints)
- Updating documentation fields

**Process for non-breaking changes:**
1. Update the contract in `api_contracts.json`
2. Increment the version: `1.0` → `1.1`
3. Add a DECISION_LOG.md entry noting the change
4. Proceed with implementation

### Breaking Changes (Require Human Approval)

These changes REQUIRE explicit human approval:

- Removing a field from the response
- Renaming a required field
- Changing the type of a field
- Removing an endpoint
- Changing authentication requirements
- Changing required request fields

**Process for breaking changes:**

1. STOP implementation
2. Flag the breaking change:

```
CONTRACT CHANGE DETECTED — BREAKING CHANGE REQUIRES APPROVAL

Contract: {CONTRACT-ID} — {name}
Change: {what is changing}
Breaking because: {why existing consumers will break}

Affected consumers:
  - {file 1} (uses {field that's changing})
  - {file 2} (uses {field that's changing})

Options:
  A. Version the contract: create CONTRACT-002 v2.0, deprecate CONTRACT-001 v1.0
     Consumers can migrate on their own schedule.

  B. Update the contract and all consumers simultaneously
     All consumers updated in the same phase.

  C. Do not make this change — find a backwards-compatible alternative

This requires human approval before proceeding.
Run /nexus:brainstorming to discuss the approach.
```

3. Wait for human approval
4. Record the decision in DECISION_LOG.md with `[I]` (Irreversible) flag:
   ```
   | {ID} | {date} | {phase} | Breaking contract change: {what changed} | {rationale} | Consumers must be updated: {list} | [I] |
   ```

5. Only then proceed with implementation

---

## Contract Versioning

When breaking changes are approved, use versioning:

### Adding a Version

```json
{
  "id": "CONTRACT-001",
  "version": "1.0",
  "status": "deprecated",
  "deprecatedInPhase": "04-dashboard",
  "replacedBy": "CONTRACT-001-v2"
},
{
  "id": "CONTRACT-001-v2",
  "version": "2.0",
  "status": "active",
  "definedInPhase": "04-dashboard"
}
```

Both versions coexist until all consumers of v1.0 have migrated. Once all consumers list CONTRACT-001-v2, CONTRACT-001 can be removed.

---

## Contract-Diff Protocol

The architect agent runs contract-diff when instructed. It compares current `api_contracts.json` against git history to detect what changed.

When contract-diff detects a breaking change that was NOT approved in DECISION_LOG.md:

```
UNAUTHORIZED CONTRACT CHANGE DETECTED

Contract: {id} — {name}
Change introduced in: {commit SHA or phase}
Breaking change: {what changed}

No DECISION_LOG.md entry approving this change was found.

This may indicate:
  1. A worker modified the contract without following the approval process
  2. A merge was made without reviewing contract changes

Required action:
  1. Review whether this change was intentional
  2. If intentional: add a DECISION_LOG.md entry retroactively
  3. If accidental: roll back the contract change
  4. Update all consumers if the change is confirmed
```

---

## Integration with the Nexus Verification Ladder

During Rung 3 (Goal-Backward), the verifier checks key links that include contract connections:

```yaml
key_links:
  - from: "src/components/LoginForm.tsx"
    to: "CONTRACT-001"  # References contract, not just URL
    via: "fetch POST /api/auth/login"
```

The verifier checks:
1. The implementation at the contract endpoint matches the contract schema
2. The consumer correctly sends the request per the contract's `requestSchema`
3. The consumer correctly handles the response per the contract's `responseSchema`

A contract that exists on paper but whose implementation doesn't match the schema is a CONTRACT_MISMATCH gap.

---

## Success Criteria

- [ ] All API endpoints and public interfaces have contracts in api_contracts.json before implementation
- [ ] Contract format includes all required fields
- [ ] Consumers registered in contract.consumers array
- [ ] Breaking changes detected before implementation proceeds
- [ ] Breaking changes require and receive human approval
- [ ] Breaking changes recorded in DECISION_LOG.md with [I] flag
- [ ] Contract versioning used when breaking changes are approved
- [ ] Non-breaking changes increment version and add DECISION_LOG.md entry
- [ ] Contract-diff run after any contract-touching phase
