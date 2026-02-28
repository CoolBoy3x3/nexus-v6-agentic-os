---
name: resume
description: Deprecated — use /nexus:progress
argument-hint: "[handoff-path]"
allowed-tools: [Read]
---

# nexus:resume — Deprecated

This command is deprecated. Use `/nexus:progress` instead.

`/nexus:progress` automatically reads HANDOFF.md and STATE.md at session start — no separate resume command needed.

**Do this instead:**

```
/nexus:progress
```

It will detect the handoff, surface prior session context, and output exactly ONE next action.

Redirecting to `/nexus:progress`...
