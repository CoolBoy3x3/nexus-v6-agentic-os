#!/usr/bin/env node
/**
 * nexus-playwright-runner.mjs
 *
 * Thin Playwright CLI for runtimes that don't support MCP (e.g. Codex).
 * Workers invoke this via the Bash tool — no MCP server needed.
 *
 * Usage:
 *   node nexus-playwright-runner.mjs navigate <url>
 *   node nexus-playwright-runner.mjs screenshot <url> <outputPath>
 *   node nexus-playwright-runner.mjs click <url> <cssSelector>
 *   node nexus-playwright-runner.mjs fill <url> <cssSelector> <value>
 *   node nexus-playwright-runner.mjs evaluate <url> <jsExpression>
 *   node nexus-playwright-runner.mjs html <url>
 *
 * Exits 0 on success, 1 on failure.
 * Prints a JSON result object on stdout.
 *
 * Prerequisites: `playwright` must be installed in the project or globally.
 *   npm i -D playwright && npx playwright install chromium
 */

import { createRequire } from 'module';
import path from 'path';
import { mkdir } from 'fs/promises';

const require = createRequire(import.meta.url);

async function loadPlaywright() {
  // Try local project first, then global
  for (const candidate of [
    path.join(process.cwd(), 'node_modules', 'playwright'),
    path.join(process.cwd(), '..', 'node_modules', 'playwright'),
    'playwright',
  ]) {
    try {
      return require(candidate);
    } catch {}
  }
  throw new Error(
    'playwright package not found.\n' +
    'Install it with: npm i -D playwright && npx playwright install chromium'
  );
}

function result(ok, data = {}) {
  const out = { success: ok, timestamp: new Date().toISOString(), ...data };
  console.log(JSON.stringify(out));
  process.exit(ok ? 0 : 1);
}

const [,, cmd, arg1, arg2, arg3] = process.argv;

if (!cmd) {
  console.error('Usage: nexus-playwright-runner.mjs <cmd> [args...]');
  process.exit(1);
}

let pw, browser, page;
try {
  pw = await loadPlaywright();
  browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext();
  page = await context.newPage();
} catch (err) {
  result(false, { error: err.message, hint: 'Run: npm i -D playwright && npx playwright install chromium' });
}

try {
  switch (cmd) {
    case 'navigate': {
      if (!arg1) result(false, { error: 'Missing url' });
      await page.goto(arg1, { waitUntil: 'networkidle', timeout: 30000 });
      const title = await page.title();
      result(true, { url: arg1, title });
      break;
    }

    case 'screenshot': {
      if (!arg1) result(false, { error: 'Missing url' });
      const outPath = arg2 ?? `screenshot-${Date.now()}.png`;
      await mkdir(path.dirname(outPath), { recursive: true });
      await page.goto(arg1, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: outPath, fullPage: true });
      result(true, { url: arg1, screenshotPath: outPath });
      break;
    }

    case 'click': {
      if (!arg1 || !arg2) result(false, { error: 'Missing url or selector' });
      await page.goto(arg1, { waitUntil: 'networkidle', timeout: 30000 });
      await page.click(arg2, { timeout: 10000 });
      result(true, { url: arg1, selector: arg2, action: 'clicked' });
      break;
    }

    case 'fill': {
      if (!arg1 || !arg2 || !arg3) result(false, { error: 'Missing url, selector, or value' });
      await page.goto(arg1, { waitUntil: 'networkidle', timeout: 30000 });
      await page.fill(arg2, arg3, { timeout: 10000 });
      result(true, { url: arg1, selector: arg2, value: arg3, action: 'filled' });
      break;
    }

    case 'evaluate': {
      if (!arg1 || !arg2) result(false, { error: 'Missing url or expression' });
      await page.goto(arg1, { waitUntil: 'networkidle', timeout: 30000 });
      const evalResult = await page.evaluate(arg2);
      result(true, { url: arg1, expression: arg2, result: evalResult });
      break;
    }

    case 'html': {
      if (!arg1) result(false, { error: 'Missing url' });
      await page.goto(arg1, { waitUntil: 'networkidle', timeout: 30000 });
      const html = await page.content();
      result(true, { url: arg1, html: html.slice(0, 50000) }); // cap at 50k chars
      break;
    }

    default:
      result(false, { error: `Unknown command: ${cmd}` });
  }
} catch (err) {
  result(false, { error: err.message, cmd, arg1, arg2 });
} finally {
  await browser?.close();
}
