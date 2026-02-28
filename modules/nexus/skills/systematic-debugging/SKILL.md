---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior. Find root cause before attempting any fix.
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting a fix. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

---

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1 (Root Cause Investigation), you cannot propose fixes.

---

## When to Use

Use for ANY technical issue:
- Test failures
- Unexpected behavior in the running application
- Performance problems
- Build failures
- Integration issues
- Type errors that don't make obvious sense

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried 1-2 fixes that didn't work
- You don't fully understand why it's failing

**Never skip because:**
- "It seems simple" — simple bugs have root causes too
- "We're in a hurry" — systematic is faster than thrashing
- "The fix is obvious" — obvious fixes are often wrong

---

## The Four Phases

Complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting any fix:**

#### 1. Read Error Messages Completely

Do not skip past errors. Read every line. Stack traces often contain the exact answer.
- Note file paths, line numbers, error codes
- Note what VALUE was received vs what was EXPECTED
- Don't skim — the answer is often in the middle of a long trace

#### 2. Reproduce Consistently

Can you trigger the failure reliably?
- What are the exact steps?
- Does it happen every time?
- If not reproducible consistently → gather more data, do NOT guess

A bug you can't reproduce consistently is a bug you can't verify fixed.

#### 3. Check Recent Changes

What changed that could cause this?
- `git diff HEAD~5` — recent commits
- New dependencies added
- Config changes
- Environment differences
- Note: the failure often appears in the code that USES the thing that changed, not the thing itself

#### 4. Gather Evidence in Multi-Component Systems

When the system has multiple layers (API → service → database, CI → build → deploy):

**BEFORE proposing fixes, add diagnostic instrumentation:**
```
For each component boundary:
  - Log what data enters the component
  - Log what data exits the component
  - Verify environment/config propagation
  - Check state at each layer

Run once to gather evidence showing WHERE it breaks.
Then analyze evidence to identify the failing component.
Then investigate that specific component.
```

This reveals which layer fails. Don't skip this to "save time" — it saves time.

#### 5. Trace Data Flow

When the error is deep in the call stack: trace backward.

Start at the error. Ask: "What called this with the bad value?"
Go up the call stack. Keep asking: "Where did this value come from?"
Find the source of the bad value. Fix it there, not at the symptom.

---

### Phase 2: Pattern Analysis

Find the pattern before fixing.

#### 1. Find Working Examples

Locate similar working code in the codebase.
What works that's similar to what's broken?
What's different?

#### 2. Compare Against References

If implementing a known pattern (auth, pagination, event handling): find the reference implementation and read it COMPLETELY.
Do not skim. Read every line. Understand the pattern fully.

Partial understanding guarantees bugs.

#### 3. Identify Differences

List every difference between working and broken code.
Do not assume any difference "can't matter." Every difference is a candidate.

#### 4. Understand Dependencies

What does the broken code depend on?
What settings, config, or environment does it assume?
What assumptions does it make that might not hold?

---

### Phase 3: Hypothesis and Testing

Scientific method for bugs.

#### 1. Form a Single Specific Hypothesis

State clearly: "I think X is the root cause because Y."

Examples:
- GOOD: "I think the session token is expired because the test doesn't mock clock time and the default expiry is 1 hour"
- GOOD: "I think the database query returns null when userId is a string instead of number, and TypeScript is coercing it at the call site"
- BAD: "I think there's an issue with the auth module"
- BAD: "The code might have a timing problem"

Write the hypothesis down before testing.

#### 2. Test Minimally

Make the SMALLEST possible change to test the hypothesis.
ONE change at a time.
Do NOT fix multiple things simultaneously.

#### 3. Verify Before Continuing

Did it work?
- Yes → Phase 4
- No → Form a NEW hypothesis. Do NOT add more changes on top of the failed change.

#### 4. When You Don't Know

If you genuinely don't know: say "I don't understand X." Ask for help. Research more.

Do not pretend to know. Fake confidence leads to random fixes.

---

### Phase 4: Implementation

Fix the root cause, not the symptom.

#### 1. Create a Failing Test Case First

Write the minimal test that reproduces the bug.

For hard `tdd_mode` tasks: this is already required.
For `standard` mode: write it now.
For `skip` mode: write a one-off reproduction script.

The test proves the bug exists and will prove it's fixed.

#### 2. Implement a Single Fix

Address the root cause you identified.
ONE change.
No "while I'm here" improvements.
No bundled refactoring.

#### 3. Verify the Fix

Run the test. Does it pass now?
Run all tests. No regressions?

#### 4. If Fix Doesn't Work — Count Your Attempts

If fix 1 didn't work: return to Phase 1 with the NEW information the failed fix revealed.
If fix 2 didn't work: return to Phase 1. Something in your understanding is wrong.

**IF YOU HAVE TRIED 3 OR MORE FIXES AND NONE WORKED:**
STOP. This is the 3-consecutive-failures rule.

Do NOT attempt fix #4.

Escalate per the 3-consecutive-failures escalation path:

---

## 3-Consecutive-Failures Rule

If you have applied 3 different fixes and none resolved the issue:

1. **STOP. The code is not the problem. The architecture is.**
2. Send `<<NEXUS_BLOCKED: 3 consecutive fix attempts failed. Possible architectural issue. Details: {what failed}>>`
3. The mission-controller will dispatch the architect agent to analyze the failing module.
4. Record this as a candidate Scar in STATE.md.
5. Surface the pattern to the user with these questions:
   - Is this pattern fundamentally sound?
   - Are we fixing symptoms of a design that doesn't work?
   - Should we refactor the architecture rather than continue patching?

Signs that the architecture is the problem:
- Each fix reveals a new problem in a different place
- Fixes require "massive refactoring" to implement properly
- Each fix creates new symptoms elsewhere

Do not attempt a 4th fix without architectural discussion. This is non-negotiable.

---

## Reference: /nexus:recover

If debugging reveals that a task has caused irreversible damage (corrupted data, broken migrations, broken auth), do NOT continue debugging. Use `/nexus:recover`:

1. Stop all debugging attempts
2. Check available checkpoints in `.nexus/06-checkpoints/`
3. Roll back to the last known-good state
4. Record a Scar with root cause and prevention rule
5. Re-plan the failed work

Recovery is not failure. Recovery is correct behavior when forward progress would cause more damage.

---

## Red Flags — Stop and Follow Process

Catch these thoughts before they lead to wasted time:

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)
- "Each fix reveals a new problem" (architectural issue signal)
- Proposing solutions before tracing data flow

**All of these mean: STOP. Return to Phase 1.**

---

## Quick Reference

| Phase | Key Activity | Success Criteria |
|-------|-------------|------------------|
| 1. Root Cause | Read errors, reproduce, trace data flow | Understand WHAT and WHERE |
| 2. Pattern | Find working examples, identify differences | Understand WHY |
| 3. Hypothesis | One specific theory, minimal test | Confirmed theory |
| 4. Implementation | One fix, verify with test | Bug resolved, tests green |

---

## Success Criteria

- [ ] Phase 1 complete before any fix attempted
- [ ] Bug reproducible consistently
- [ ] Root cause identified (specific, not "something in auth")
- [ ] Failing test written before fix applied
- [ ] Single fix implemented
- [ ] Fix verified: test passes, no regressions
- [ ] If 3+ fixes failed: `<<NEXUS_BLOCKED>>` sent, escalation triggered
- [ ] If recovery needed: `/nexus:recover` invoked
