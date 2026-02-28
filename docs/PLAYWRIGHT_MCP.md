# Nexus V6 — Playwright MCP Integration Guide

> This document covers browser automation with Playwright MCP in Nexus-managed projects.

---

## Overview

Nexus V6 integrates with Playwright via the Model Context Protocol (MCP). When a task requires
browser-level acceptance testing — for example, verifying that a UI component renders correctly or
that a user flow completes end-to-end — Nexus delegates execution to the Playwright MCP server.

The integration is managed by the `nexus-playwright` package, which handles:
- Loading flow specifications from `.nexus/08-playwright/flow-specs/`
- Communicating with the Playwright MCP server
- Capturing artifacts (screenshots, videos, logs)
- Tracking the 3-consecutive-pass promotion rule

---

## Setting Up the Playwright MCP Server

### Prerequisites

- Node.js >= 18
- A Nexus project with Claude Code as the runtime (Playwright MCP requires MCP support)
- `@playwright/mcp-server` package (installed automatically by `nexus install --claude`)

### Step 1: Install the MCP Server Package

```bash
# Global install (recommended)
npm install -g @playwright/mcp-server

# Or as a dev dependency in your project
pnpm add -D @playwright/mcp-server
```

### Step 2: Verify the Server Starts

```bash
npx @playwright/mcp-server --version

# Test that it starts without errors
npx @playwright/mcp-server --help
```

### Step 3: Install Browsers

```bash
npx playwright install chromium
# Or install all browsers
npx playwright install
```

---

## Configuring Nexus to Use Playwright MCP

### Project-Level Configuration

Add Playwright settings to `.nexus/settings.json`:

```json
{
  "playwright": {
    "enabled": true,
    "mcpPath": "@playwright/mcp-server",
    "mcpArgs": ["--browser", "chromium"],
    "passThreshold": 3,
    "artifactDir": ".nexus/07-artifacts",
    "timeout": 30000,
    "headless": true,
    "baseUrl": "http://localhost:3000"
  }
}
```

**Configuration fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable Playwright integration |
| `mcpPath` | string | `"@playwright/mcp-server"` | Path or package name of MCP server |
| `mcpArgs` | string[] | `[]` | Additional args passed to MCP server |
| `passThreshold` | number | `3` | Consecutive passes required for promotion |
| `artifactDir` | string | `".nexus/07-artifacts"` | Where to save screenshots and videos |
| `timeout` | number | `30000` | Per-step timeout in milliseconds |
| `headless` | boolean | `true` | Run browser in headless mode |
| `baseUrl` | string | `"http://localhost:3000"` | Base URL for relative navigation steps |

### Claude Code MCP Settings

The Playwright MCP server must also be registered in Claude Code's settings. The `nexus install --claude`
command handles this automatically, but you can verify or add it manually:

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp-server", "--browser", "chromium"],
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "0"
      }
    }
  }
}
```

---

## When Playwright Is Triggered

Playwright is triggered during the VERIFY step when a task has `playwright_required: true` in its
YAML frontmatter.

### Task Frontmatter Format

```yaml
---
id: task-0031
title: Verify login form renders and submits correctly
wave: 3
playwright_required: true
playwright_flows:
  - login-happy-path
  - login-invalid-credentials
files_to_touch:
  - src/components/LoginForm.tsx
  - src/pages/login.tsx
acceptance_criteria:
  - AC-12
  - AC-13
---
```

**Playwright-specific frontmatter fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `playwright_required` | boolean | Yes | Enables Playwright for this task's verification |
| `playwright_flows` | string[] | Yes | List of flow spec names to run (without .yaml extension) |

### Verification Flow When playwright_required Is True

```
VERIFY STEP (with playwright_required: true):

1. Physicality check           -> files exist
2. Goal-backward check         -> criteria semantically met
3. Contract check              -> no API regressions
4. Type check + Lint + Tests   -> standard code quality
5. Start dev server            -> nexus starts your dev command
6. Load flow specs             -> read .nexus/08-playwright/flow-specs/*.yaml
7. Run Playwright flows        -> execute via MCP server
8. Capture artifacts           -> screenshots, video, logs
9. Evaluate pass/fail          -> check 3-consecutive-pass tracker
10. Update pass-tracker.json   -> record result
11. If threshold not met       -> VERIFY incomplete, try again
12. If threshold met           -> VERIFY PASS for Playwright checks
```

---

## Flow Spec Format

Flow specifications are YAML files stored in `.nexus/08-playwright/flow-specs/`. Each file defines
a sequence of browser interactions to perform.

### Flow Spec Structure

```yaml
# .nexus/08-playwright/flow-specs/login-happy-path.yaml
id: login-happy-path
name: Login Happy Path
description: User logs in with valid credentials and lands on dashboard
baseUrl: http://localhost:3000
timeout: 30000

steps:
  - action: navigate
    url: /login

  - action: screenshot
    name: login-page-initial

  - action: fill
    selector: '[data-testid="email-input"]'
    value: test@example.com

  - action: fill
    selector: '[data-testid="password-input"]'
    value: password123

  - action: screenshot
    name: login-form-filled

  - action: click
    selector: '[data-testid="login-button"]'

  - action: waitForURL
    url: /dashboard
    timeout: 5000

  - action: screenshot
    name: post-login-dashboard

  - action: assertVisible
    selector: '[data-testid="user-menu"]'
    message: User menu should be visible after login

assertions:
  - type: url
    expected: /dashboard
    description: URL must be /dashboard after successful login
  - type: visible
    selector: '[data-testid="user-menu"]'
    description: User menu must be visible
```

### Available Step Actions

| Action | Parameters | Description |
|--------|-----------|-------------|
| `navigate` | `url` | Navigate to URL (absolute or relative to baseUrl) |
| `click` | `selector` | Click an element |
| `fill` | `selector`, `value` | Fill a text input |
| `select` | `selector`, `value` | Select a dropdown option |
| `check` | `selector` | Check a checkbox |
| `uncheck` | `selector` | Uncheck a checkbox |
| `screenshot` | `name` | Capture a screenshot (saved to 07-artifacts/screenshots/) |
| `waitForURL` | `url`, `timeout` | Wait for navigation to URL |
| `waitForSelector` | `selector`, `timeout` | Wait for element to appear |
| `assertVisible` | `selector`, `message` | Assert element is visible |
| `assertText` | `selector`, `expected` | Assert element text content |
| `assertURL` | `expected` | Assert current URL |
| `hover` | `selector` | Hover over element |
| `keyboard` | `key` | Press a keyboard key |
| `scroll` | `selector`, `direction` | Scroll element |

### Flow Spec Validation

Nexus validates flow specs against a JSON schema before running them. Run:

```bash
nexus validate-flows
```

This checks all specs in `.nexus/08-playwright/flow-specs/` for schema conformance.

---

## Artifact Capture

All Playwright runs capture artifacts to `.nexus/07-artifacts/`:

```
.nexus/07-artifacts/
+-- screenshots/
|   +-- login-happy-path/
|   |   +-- run-001/
|   |   |   +-- login-page-initial.png
|   |   |   +-- login-form-filled.png
|   |   |   +-- post-login-dashboard.png
|   |   +-- run-002/
|   |   |   +-- ...
+-- videos/
|   +-- login-happy-path/
|   |   +-- run-001.webm
+-- logs/
    +-- playwright-run-001.log
    +-- playwright-run-002.log
```

### Artifact Index

The `ArtifactWriter` maintains an index at `.nexus/07-artifacts/index.json`:

```json
{
  "runs": [
    {
      "runId": "run-001",
      "flowId": "login-happy-path",
      "timestamp": "2026-02-28T14:30:00Z",
      "result": "PASS",
      "screenshots": [
        "screenshots/login-happy-path/run-001/login-page-initial.png",
        "screenshots/login-happy-path/run-001/login-form-filled.png"
      ],
      "video": "videos/login-happy-path/run-001.webm",
      "log": "logs/playwright-run-001.log"
    }
  ]
}
```

---

## The 3-Consecutive-Pass Rule

A Playwright flow is not considered passing until it passes **3 times in a row** without any
failure. This rule guards against flaky tests that pass occasionally.

### How Pass Tracking Works

The pass tracker state is stored in `.nexus/08-playwright/pass-tracker.json`:

```json
{
  "flows": {
    "login-happy-path": {
      "consecutivePasses": 2,
      "lastResult": "PASS",
      "lastRun": "2026-02-28T14:35:00Z",
      "promoted": false
    },
    "login-invalid-credentials": {
      "consecutivePasses": 3,
      "lastResult": "PASS",
      "lastRun": "2026-02-28T14:36:00Z",
      "promoted": true
    }
  }
}
```

### Promotion

When a flow reaches 3 consecutive passes, it is marked as `promoted: true`. Promoted flows:
- Are no longer re-run on every verify cycle (only on relevant code changes)
- Contribute to the overall VERIFY PASS signal for the task
- Are listed in the changelog entry generated by `nexus unify`

### Resetting the Pass Tracker

If a flow was promoted but the underlying code changes break it, the tracker is reset:

```bash
nexus reset-flow-passes login-happy-path
```

This sets `consecutivePasses` back to 0 and `promoted` back to false.

---

## Troubleshooting Playwright

### MCP Server Not Starting

```
Error: Playwright MCP server did not respond within 10 seconds
```

Check:
1. Is `@playwright/mcp-server` installed? Run `npx @playwright/mcp-server --version`
2. Is the path in `.nexus/settings.json` correct?
3. Are browsers installed? Run `npx playwright install chromium`
4. Check the Claude Code MCP settings for the `playwright` server entry

### Flow Step Fails: Element Not Found

```
Step FAILED: selector '[data-testid="login-button"]' not found after 30000ms
```

Check:
1. Is the dev server running? Nexus auto-starts it, but check `.nexus/07-artifacts/logs/` for errors
2. Is the selector correct? Use `npx playwright codegen http://localhost:3000/login` to generate selectors
3. Is the timeout long enough? Increase `timeout` in the flow spec or in `.nexus/settings.json`

### Screenshots Not Being Saved

Check that `artifactDir` in `.nexus/settings.json` points to a writable directory and that the
`.nexus/07-artifacts/screenshots/` directory exists.

### Dev Server Not Starting

If Nexus fails to start your development server before running flows, ensure you have a `dev`
script in your `package.json` and that the `baseUrl` in the flow spec or settings is correct.

```json
// .nexus/settings.json
{
  "playwright": {
    "devServer": {
      "command": "pnpm dev",
      "port": 3000,
      "readyPattern": "ready on",
      "timeout": 30000
    }
  }
}
```
