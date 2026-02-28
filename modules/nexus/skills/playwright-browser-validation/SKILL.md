---
name: playwright-browser-validation
description: When and how to run Playwright browser validation. Mandatory for UI changes, user flows, and when playwright_required: true.
---

# Playwright Browser Validation

## Overview

Playwright validates what automated unit and integration tests cannot: that a user can actually complete a flow in a real browser. It closes the gap between "the code passes tests" and "the feature works for users."

Playwright validation is part of Rung 7 of the Nexus verification ladder. It runs after all other automated checks and before the merge-judge.

---

## Decision Tree: When to Invoke Playwright

Work through this before deciding whether to run Playwright:

```
Does PLAN.md have playwright_required: true?
├── YES → Run Playwright. No further decision needed.
└── NO → Continue to next question.

Does this phase modify UI that users interact with?
├── YES → Run Playwright if flow specs exist.
└── NO → Continue to next question.

Does this phase add or modify a multi-step user flow?
├── YES → Run Playwright if flow specs exist.
└── NO → Continue to next question.

Does this phase modify authentication flows?
├── YES → Playwright highly recommended.
└── NO → Continue to next question.

Does this phase modify payment flows?
├── YES → Playwright required regardless of flag.
└── NO → Playwright optional. Unit/integration tests sufficient.
```

**Default rule:** If in doubt, run Playwright if flow specs exist. The cost of a false positive (running when not needed) is much lower than a false negative (missing a broken user flow).

---

## Flow Spec Format

Flow specs live in `.nexus/08-playwright/flow-specs/`.

Each flow spec is a markdown file describing the steps of a user flow:

```markdown
---
id: FLOW-001
name: User Login Flow
phase: 02-auth
type: critical-path          # critical-path | happy-path | edge-case | exploratory
status: stable               # stable | exploratory | draft
required_for: [02-auth, 04-dashboard]
---

# User Login Flow

## Preconditions
- Application is running at http://localhost:3000
- User account exists: test@example.com / TestPass123!

## Steps

1. Navigate to /login
2. Enter email: test@example.com
3. Enter password: TestPass123!
4. Click "Sign In" button
5. Verify: redirect to /dashboard
6. Verify: user name appears in header
7. Verify: no error messages visible

## Expected Outcome
User is logged in and sees the dashboard with their name.

## Failure Indicators
- "Invalid credentials" error shown after correct login
- No redirect after form submission
- Dashboard loads but shows no user information
```

---

## How to Run a Flow Spec

Playwright runs via the MCP tool if configured, or via CLI.

### Via MCP (if playwright.mcpPath is configured)

Check `.nexus/01-governance/settings.json`:
```json
{
  "playwright": {
    "enabled": true,
    "mcpPath": ".claude/playwright-mcp"
  }
}
```

Use the MCP tool to launch the browser and execute the flow steps.

### Via CLI (fallback)

```bash
npx playwright test .nexus/08-playwright/flow-specs/{flow-id}.spec.ts
```

If a `.spec.ts` file doesn't exist for the flow spec, generate it from the markdown:

```typescript
// .nexus/08-playwright/flow-specs/FLOW-001.spec.ts
import { test, expect } from '@playwright/test';

test('user login flow', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
});
```

---

## Mandatory Artifacts

**For every Playwright run, these artifacts are mandatory:**

1. **Screenshot** at the final state of each flow
   ```bash
   await page.screenshot({ path: '.nexus/08-playwright/artifacts/{flow-id}-{timestamp}-final.png' });
   ```

2. **Trace** for the complete flow
   ```javascript
   // playwright.config.ts
   use: {
     trace: 'on', // Always capture trace
   }
   ```
   Traces go to: `.nexus/08-playwright/artifacts/{flow-id}-{timestamp}-trace.zip`

3. **Video** for flows longer than 30 seconds
   ```javascript
   use: {
     video: 'on', // For long flows
   }
   ```
   Videos go to: `.nexus/08-playwright/artifacts/{flow-id}-{timestamp}-video.webm`

These artifacts are referenced in SUMMARY.md and serve as evidence in Scar records if a flow fails.

---

## Interpreting Failures

When a Playwright flow fails, artifacts become evidence.

### Step 1: Read the Error

Playwright failures include:
- The step that failed
- The expected vs actual state
- A screenshot of the failure state (if screenshots enabled)

### Step 2: View the Screenshot

Open the failure screenshot from `.nexus/08-playwright/artifacts/`. It shows exactly what the browser saw at the moment of failure.

Common failure patterns:
- **Element not found:** The selector is wrong, or the element was not rendered
- **Wrong URL after action:** A redirect didn't happen, or went somewhere unexpected
- **Text mismatch:** Content was rendered but with wrong data
- **Loading state stuck:** An async operation didn't complete before the assertion ran

### Step 3: Open the Trace

Playwright traces are inspectable via:
```bash
npx playwright show-trace .nexus/08-playwright/artifacts/{flow-id}-trace.zip
```

The trace shows:
- Every network request and response
- DOM state before and after each action
- Console logs
- Exact timing of each step

### Step 4: Determine If This Is a Scar Candidate

If the failure was caused by:
- A production code bug → fix it, re-run, no Scar needed
- An intermittent timing issue → add a wait condition, note as WARNING
- A fundamental UI/API disconnect → record as Scar with prevention rule

---

## Promoting Exploratory Sessions to Stable Tests

The 3-consecutive-pass rule:

1. Run a flow as `type: exploratory`
2. If it passes 3 consecutive runs (across different sessions, not the same run): promote it
3. Update the flow spec frontmatter: `status: stable`
4. Add it to the required flow list for this phase

Exploratory flows are informational. They do not block the merge-judge.
Stable flows block the merge-judge if they fail.

---

## Integration with the Verification Ladder

Playwright validation is Rung 7. It runs after system tests (Rung 6) and before the merge-judge (Rung 8).

**Rung 7 pass conditions:**
- All `stable` flow specs tagged for this phase pass
- All mandatory artifacts created (screenshot + trace)
- No `critical-path` flow fails

**Rung 7 fail conditions:**
- Any `stable` flow spec fails
- Mandatory artifacts not created
- `playwright_required: true` in PLAN.md and Playwright was not run

**Special case:** If `playwright_required: true` but no flow specs exist for this phase, create a draft flow spec before running. Rung 7 cannot be "satisfied" by simply not having any specs.

---

## Reporting Results

After running Playwright, produce a report section for `verification-report.json`:

```json
{
  "playwright": {
    "ok": true,
    "notRequired": false,
    "flowsRun": 3,
    "flowsPassed": 3,
    "flowsFailed": 0,
    "artifacts": [
      {
        "flowId": "FLOW-001",
        "screenshot": ".nexus/08-playwright/artifacts/FLOW-001-2024-01-15-final.png",
        "trace": ".nexus/08-playwright/artifacts/FLOW-001-2024-01-15-trace.zip"
      }
    ]
  }
}
```

Include in SUMMARY.md when unifying:

```markdown
### Playwright Artifacts

| Flow | Status | Screenshot | Trace |
|------|--------|-----------|-------|
| FLOW-001: User Login | ✓ PASS | FLOW-001-2024-01-15-final.png | trace.zip |
```

---

## Success Criteria

- [ ] Decision tree evaluated to determine if Playwright should run
- [ ] playwright_required: true always triggers Playwright
- [ ] Flow specs found in .nexus/08-playwright/flow-specs/
- [ ] All stable flow specs for this phase run
- [ ] Screenshot artifact created for each flow
- [ ] Trace artifact created for each flow
- [ ] Video created for flows > 30 seconds
- [ ] Failures interpreted via screenshot + trace (not guessed)
- [ ] 3-consecutive-pass rule used for exploratory → stable promotion
- [ ] Results included in verification-report.json
- [ ] Artifacts listed in SUMMARY.md
