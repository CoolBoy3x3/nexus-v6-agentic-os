---
name: smart-tdd
description: Test-driven development with mode selector. hard | standard | skip based on task frontmatter tdd_mode.
---

# Smart TDD

## Overview

Write tests before or alongside production code, calibrated to the risk of the task. The mode is set in the task frontmatter (`tdd_mode`) and must be respected. Changing the mode during execution requires updating PLAN.md — not just ignoring it.

---

## Mode Selector

At the start of every task, check `task.tdd_mode`:

| Mode | What It Means | When to Use |
|------|---------------|-------------|
| `hard` | Iron Law TDD — test first, watch it fail, then implement | Auth, payments, migrations, security-critical code |
| `standard` | Write tests alongside implementation, must pass before complete | Normal feature work (default) |
| `skip` | Tests not required — must have documented `skip_reason` | Config files, generated code, pure markup |

**If `tdd_mode` is absent:** Default to `standard`.

**If `tdd_mode: skip` with no `skip_reason`:** Proceed with `standard` mode and flag this in your completion report.

---

## Mode: `hard` — The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

This is not a suggestion. Violating the letter of this rule violates the spirit.

### The Cycle: Red → Green → Refactor

#### RED — Write the Failing Test First

Write ONE minimal test that demonstrates what should happen.

```typescript
test('login rejects empty password', async () => {
  const result = await login({ email: 'user@test.com', password: '' });
  expect(result.error).toBe('Password required');
});
```

Requirements for a good test:
- Tests ONE behavior (no "and" in the test name)
- Clear name that describes the behavior
- Uses real code, not mocks unless unavoidable

#### VERIFY RED — Watch It Fail

**MANDATORY. Never skip this step.**

```bash
npm test path/to/test.ts
```

Confirm:
- Test fails (not errors out)
- Failure message makes sense ("expected 'Password required', received undefined")
- Fails because the FEATURE IS MISSING (not a typo or syntax error)

**Test passes immediately?** You're testing existing behavior. Fix the test.
**Test errors?** Fix the error until it fails correctly.

#### GREEN — Write Minimal Code

Write the simplest code that makes the test pass. Nothing more.

```typescript
async function login({ email, password }: LoginInput) {
  if (!password?.trim()) {
    return { error: 'Password required' };
  }
  // ... rest of implementation
}
```

Do not add:
- Features not tested yet
- "Obvious improvements"
- Options or configuration for hypothetical future needs

#### VERIFY GREEN — All Tests Pass

```bash
npm test path/to/test.ts
```

Confirm:
- Test passes
- All OTHER tests still pass (no regressions)
- No errors or warnings in output

#### REFACTOR — Clean Up

Only after GREEN:
- Remove duplication
- Improve names
- Extract helpers

Stay green throughout. Do not add new behavior during refactor.

#### Repeat

Write the next failing test. Repeat.

---

### Hard Mode Red Flags — Stop and Start Over

Any of these mean the TDD cycle was violated. Delete the code. Start over.

- Code written before the test
- Test written after the implementation
- Test passes immediately (no failure seen)
- Can't explain why the test failed
- Tests added "later" after code is working
- Kept code as "reference" while writing tests
- "Just this once" exception applied
- "The spirit of TDD" invoked to justify skipping the letter

**There are no exceptions to hard mode without explicit human approval.**

---

## Mode: `standard` — Write Alongside

Tests must exist and must pass. The strict red-green-refactor cycle is not required, but:

1. For every function or behavior you implement, a test must exist
2. Tests must be written during implementation, not after
3. Tests must pass before you report the task as complete
4. No test file = incomplete task

### Standard Mode Checklist

Before reporting complete:
- [ ] Every new function has at least one test
- [ ] Edge cases and error paths are tested
- [ ] All tests pass
- [ ] No tests are pending/skipped without justification
- [ ] Test file is in `task.files_modified`

---

## Mode: `skip` — No Tests Required

Use only when the task frontmatter contains:

```yaml
tdd_mode: skip
skip_reason: "Configuration file — no logic to test"
```

Valid `skip_reason` values:
- Configuration files (no logic)
- Generated code (auto-generated, not hand-maintained)
- Pure markup with no logic (static HTML, CSS only)
- Type definition files (no runtime behavior)

**Invalid `skip_reason` values:**
- "Not sure how to test this"
- "Too simple to test"
- "I'll add tests later"
- "The component is easy to verify visually"

If the skip_reason is invalid, proceed with `standard` mode.

---

## Writing Good Tests

### What Makes a Test Good

| Quality | Good Example | Bad Example |
|---------|-------------|-------------|
| **One behavior** | `test('rejects empty password')` | `test('validates email and password and trims whitespace')` |
| **Clear name** | `test('returns 401 when token expired')` | `test('test1')` |
| **Tests behavior** | Verifies the observable outcome | Verifies mock was called |
| **Minimal** | No setup beyond what's needed | Giant fixture setup for simple case |

### Common Test Patterns

**Testing async functions:**
```typescript
test('fetches user data', async () => {
  const user = await getUser('user-123');
  expect(user.email).toBe('test@example.com');
});
```

**Testing error conditions:**
```typescript
test('throws on invalid input', async () => {
  await expect(processPayment(null)).rejects.toThrow('Payment data required');
});
```

**Testing with minimal mocking:**
```typescript
// Only mock what you CANNOT control (external APIs, file system, time)
// Never mock the thing you're testing
// Never mock to avoid writing a test
```

---

## When Tests Are Hard to Write

| Problem | Meaning | Solution |
|---------|---------|----------|
| Test is too complicated | Design is too complicated | Simplify the interface |
| Must mock everything | Code too coupled | Use dependency injection |
| Test setup is huge | Design has too many preconditions | Simplify design |
| Don't know how to test | API design is unclear | Write the wished-for API first |

Hard-to-test code is a design signal. Listen to it.

---

## Integration with the Nexus Loop

The verifier agent will check:
1. Test files exist in `task.files_modified`
2. Tests are substantive (not just `it('works', () => {})`)
3. Tests cover the key behaviors listed in `task.acceptance_criteria`
4. Tests for error paths exist alongside happy-path tests

A task reported as `<<NEXUS_COMPLETE>>` with failing tests or missing test files will fail the deterministic check (Rung 2 of the verification ladder).

Do not send `<<NEXUS_COMPLETE>>` until all tests pass.

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to need tests" | Simple code still breaks |
| "I'll add tests after" | Tests-after prove nothing — they pass immediately |
| "Tests after achieve the same goals" | Tests-after answer "what does this do?" Tests-first answer "what should this do?" |
| "Already manually tested it" | Manual testing has no record, can't re-run, misses regressions |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Untested code is debt. |
| "TDD will slow me down" | TDD finds bugs before commit — much faster than debugging after |

---

## Success Criteria

- [ ] `tdd_mode` read from task frontmatter before writing any code
- [ ] Hard mode: test written first, failure observed before implementation
- [ ] Standard mode: test written during implementation, passes before completion
- [ ] Skip mode: skip_reason documented and valid
- [ ] All tests pass before `<<NEXUS_COMPLETE>>`
- [ ] Test file in `task.files_modified`
- [ ] Edge cases and error paths have tests
