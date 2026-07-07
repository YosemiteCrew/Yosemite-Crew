#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

import { run } from './run.js';

// dist/cli.js lives next to dist/, templates/ ships at the package root.
const templatesRoot = fileURLToPath(new URL('../templates', import.meta.url));

process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  templatesRoot,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
