'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const targets = process.argv.slice(2);
const allowedTargets = new Set(['build', 'dist', 'coverage']);

for (const target of targets.length > 0 ? targets : ['build']) {
  if (!allowedTargets.has(target)) {
    throw new Error(`Refusing to clean unsupported target: ${target}`);
  }
  fs.rmSync(path.join(root, target), { recursive: true, force: true });
}
