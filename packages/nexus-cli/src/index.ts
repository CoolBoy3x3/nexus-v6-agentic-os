#!/usr/bin/env node
import { main } from './cli.js';

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
