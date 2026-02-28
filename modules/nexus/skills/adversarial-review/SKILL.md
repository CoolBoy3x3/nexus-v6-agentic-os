---
name: adversarial-review
description: Red-team your own code before the verifier does. Find what tests and type-checking cannot catch.
---

# Adversarial Review

## Overview

Automated tools catch what they're designed to catch. Lint catches style. Type checkers catch type errors. Tests catch regressions. Adversarial review catches everything else: the security holes, the silent failures, the code that works in the happy path and silently eats errors everywhere else.

This review is run by the verifier agent and should also be self-applied by workers before reporting `<<NEXUS_COMPLETE>>`.

**The question to hold throughout:** "How could this break in production?"

---

## The Red-Team Checklist

Work through each category. For each finding, assign a severity:

| Severity | Symbol | Meaning |
|----------|--------|---------|
| FAIL | ✗ | Blocks merge. Must be fixed before /nexus:verify can pass. |
| WARNING | ⚠ | Surface for human judgment. Does not block merge, but should be addressed. |
| INFO | ℹ | Notable observation. No action required. |

---

### Category 1: Unhanded Edge Cases

**What to check:**
- Functions that accept user input or collection data: do they handle null/undefined?
- Functions that operate on arrays: do they handle empty arrays?
- Functions that operate on strings: do they handle empty strings?
- Functions that access nested properties: do they use optional chaining?

**How to check:**
```bash
grep -n "\.length\|\.map(\|\.filter(\|Object\.keys\|Object\.values" {file}
grep -n "req\.body\.\|req\.params\.\|req\.query\." {file}
```

Then manually read the function body. Is there a null/empty check before each access?

**Severity: FAIL** if null/undefined could cause an uncaught TypeError in a production code path.
**Severity: WARNING** if it's in a test or clearly guarded path.

**Examples:**
```typescript
// FAIL — no null check
function getUser(id: string) {
  return db.users.find(u => u.id === id).email; // .email throws if find returns undefined
}

// OK
function getUser(id: string) {
  const user = db.users.find(u => u.id === id);
  if (!user) throw new Error(`User ${id} not found`);
  return user.email;
}
```

---

### Category 2: Missing Error Paths

**What to check:**
- Every `await` expression: is there a try/catch?
- Every `fetch()` call: is the error response handled?
- Every database operation: is failure handled?
- Every external API call: is the unhappy path handled?

**How to check:**
```bash
grep -n "await\|\.then(" {file}
grep -n "try {" {file}
```

Count the `await` expressions. Count the `try/catch` blocks. Mismatch = unhandled error path.

**Severity: FAIL** if an uncaught exception would silently fail or corrupt state.
**Severity: WARNING** if failure would produce a visible error (HTTP 500) but with a poor error message.

**Examples:**
```typescript
// FAIL — bare await, no error handling
async function saveUser(user: User) {
  await db.users.create(user); // Throws on constraint violation — nothing handles it
}

// OK
async function saveUser(user: User) {
  try {
    await db.users.create(user);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ConflictError('User already exists');
    }
    throw error;
  }
}
```

---

### Category 3: Development Artifacts in Production Code

**What to check:**
```bash
grep -n "TODO\|FIXME\|HACK\|XXX\|console\.log\|debugger\|localhost:\|127\.0\.0\.1" {file}
```

**Severity rules:**
- `TODO`/`FIXME`/`HACK`/`XXX`: WARNING (unfinished work noted)
- `console.log` in a production code path: WARNING (logs to stdout in production)
- `debugger`: FAIL (freezes execution in debugger-attached environments)
- Hardcoded `localhost:` or `127.0.0.1`: FAIL (breaks in any non-local environment)

**Note:** `console.log` in test files is acceptable.

---

### Category 4: Suspicious Shortcuts

**What to check:**
```bash
grep -n "as any\|// @ts-ignore\|// @ts-expect-error" {file}
grep -n "catch (.*) {}" {file}        # Empty catch
grep -n "catch.*{[\s]*}" {file}       # Empty catch variant
grep -n "setTimeout.*0)\|setTimeout.*1)" {file}  # setTimeout for synchronization
```

**Severity rules:**
- `as any` that silences a legitimate type error: WARNING (explain why in a comment or it's a code smell)
- Empty catch block `catch (e) {}`: FAIL (errors are silently swallowed — the absolute worst pattern)
- `catch (e) { /* ignore */ }`: FAIL (same issue, different spelling)
- `setTimeout(fn, 0)` used as a synchronization mechanism: WARNING (race condition)
- `!` non-null assertion: evaluate the context. If clearly safe: INFO. If uncertain: WARNING.

**Examples:**
```typescript
// FAIL
try {
  await saveData();
} catch (e) {}  // What went wrong? We'll never know.

// OK (errors re-thrown with context)
try {
  await saveData();
} catch (e) {
  logger.error('saveData failed', { error: e, context });
  throw e;
}
```

---

### Category 5: Missing Input Validation at System Boundaries

Every HTTP handler, WebSocket message handler, or CLI argument parser is a system boundary. User-controlled data enters here. Validate it before using it.

**What to check:**
```bash
grep -n "req\.body\|req\.params\|req\.query\|request\.body\|event\.data" {file}
```

For each access: is there validation (zod schema, joi schema, manual type guard, or at minimum a typeof check) before the value is used?

**Severity: FAIL** if unvalidated user input is passed to a database query, shell command, or rendered into a response without escaping.
**Severity: WARNING** if unvalidated user input is used in a non-dangerous way (e.g., as a display label with no SQL/shell/eval exposure).

**Examples:**
```typescript
// FAIL — no validation
app.post('/api/users', async (req, res) => {
  const user = await db.users.create(req.body); // req.body is untrusted
  res.json(user);
});

// OK
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

app.post('/api/users', async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error });
  const user = await db.users.create(result.data);
  res.json(user);
});
```

---

### Category 6: N+1 Query Patterns

A loop that contains a database call is an N+1 pattern. For N items, it makes N database calls instead of 1.

**What to check:**
```bash
grep -n "for\|\.map(\|\.forEach\|\.filter(" {file}
```

For each loop: does the loop body contain a database query (prisma., db., findOne, query)?

**Severity: WARNING** for N+1 patterns in query paths (performance issue, but not a correctness bug).
**Severity: FAIL** if N could be large and unbounded (e.g., for all users in the database).

**Example:**
```typescript
// WARNING/FAIL
const orders = await db.orders.findMany();
for (const order of orders) {
  order.user = await db.users.findUnique({ where: { id: order.userId } }); // N queries
}

// OK
const orders = await db.orders.findMany({
  include: { user: true } // 1 query with JOIN
});
```

---

### Category 7: Security Footguns

These are FAIL severity by default.

**What to check:**
```bash
# Code injection
grep -n "eval(\|new Function(\|execSync(\|exec(\|spawn(" {file}
grep -n "innerHTML\s*=\|outerHTML\s*=" {file}

# SQL injection
grep -n "query.*+\|+.*query\|\`.*\$.*\`.*WHERE\|WHERE.*\`.*\$" {file}

# Hardcoded secrets
grep -n "password\s*=\s*['\"][^'\"]\|secret\s*=\s*['\"][^'\"]\|apiKey\s*=\s*['\"]" {file}

# User input in system calls
grep -n "exec.*req\.\|spawn.*req\.\|exec.*params\|spawn.*params" {file}
```

**FAIL patterns:**
- `eval()` with any non-literal input
- `new Function(userInput)`
- `innerHTML = userControlledString`
- SQL string concatenation or interpolation with user input
- Hardcoded passwords, API keys, or secrets in production code
- User input passed directly to shell commands

---

## Running the Review

### As a Worker (Self-Review)

Before sending `<<NEXUS_COMPLETE>>`, run through the red-team checklist for all files in `task.files_modified`.

In your completion report, include:
```
Self-review: adversarial
  Category 1 (edge cases): {PASS | {finding}}
  Category 2 (error paths): {PASS | {finding}}
  Category 3 (dev artifacts): {PASS | {finding}}
  Category 4 (shortcuts): {PASS | {finding}}
  Category 5 (input validation): {PASS | {finding}}
  Category 6 (N+1): {PASS | {finding}}
  Category 7 (security): {PASS | {finding}}
```

### As the Verifier Agent

The verifier runs this as Rung 4. Any FAIL-severity finding blocks the merge-judge. WARNING findings are passed through to the merge-judge's notes.

---

## Output Format

```
ADVERSARIAL REVIEW RESULT: {PASS | FINDINGS}

{If findings exist:}

FAIL-severity findings (block merge):
  [F1] src/auth/login.ts:47 — Empty catch block silences authentication errors
       Code: catch (e) {}
       Risk: Auth failures are silently ignored, all logins succeed
       Fix: Handle error or re-throw with context

WARNING-severity findings (advisory):
  [W1] src/api/users.ts:23 — TODO comment in production code
       Code: // TODO: add rate limiting
       Fix: Create a task in ROADMAP.md or remove the comment

INFO:
  [I1] src/utils/hash.ts:8 — Using bcrypt with 10 rounds (standard for this use case)
```

---

## Success Criteria

- [ ] All 7 categories checked for each modified file
- [ ] Each finding has a severity assigned (FAIL/WARNING/INFO)
- [ ] Empty catch blocks are always FAIL
- [ ] Hardcoded credentials/secrets are always FAIL
- [ ] Unvalidated user input in SQL/shell/eval is always FAIL
- [ ] FAIL findings block merge-judge approval
- [ ] WARNING findings included in merge-judge notes
- [ ] Self-review completed by worker before NEXUS_COMPLETE
