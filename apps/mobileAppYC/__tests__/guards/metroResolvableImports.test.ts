// __tests__/guards/metroResolvableImports.test.ts
//
// Jest runs on Node, where `node:buffer` and friends resolve perfectly. Metro
// does not: metro-resolver has no `node:` protocol handling and no Node builtin
// shims, so those specifiers resolve to nothing on device. Worse, the React
// Native preset inlines requires, which frequently relocates a module-scope
// import into a `try {}` block; Metro then classifies it as an OPTIONAL
// dependency, emits a null slot in the dependency map, and the build SUCCEEDS.
// The failure only appears at runtime, as "Cannot find module", usually inside
// a catch that swallows it.
//
// That is exactly how `import {Buffer} from 'node:buffer'` shipped in
// sessionManager.ts and made every auth token look like it had no expiry. A
// unit test cannot catch it, because Node makes it work. This guard can.

import {readdirSync, readFileSync, statSync} from 'fs';
import {join, relative} from 'path';

const SRC_ROOT = join(__dirname, '..', '..', 'src');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Node core modules. Metro resolves none of these, with or without the prefix.
const NODE_BUILTINS = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
];

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (SOURCE_EXTENSIONS.some(extension => entry.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files;
};

/**
 * Every module specifier that appears in a static import, an export-from, or a
 * `require()` call. Deliberately regex-based rather than AST-based so the guard
 * has no dependency on the babel config it is guarding.
 */
const collectSpecifiers = (source: string): string[] => {
  const specifiers: string[] = [];
  const patterns = [
    /(?:^|[\s;}])(?:import|export)[\s\S]{0,400}?from\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;}])import\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match !== null) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return specifiers;
};

const isUnresolvableByMetro = (specifier: string): boolean => {
  if (specifier.startsWith('node:')) {
    return true;
  }
  return NODE_BUILTINS.includes(specifier);
};

describe('Metro-resolvable imports', () => {
  const sourceFiles = collectSourceFiles(SRC_ROOT);

  it('finds source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('never imports a Node builtin from src/', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of collectSpecifiers(source)) {
        if (isUnresolvableByMetro(specifier)) {
          offenders.push(`${relative(SRC_ROOT, file)} -> '${specifier}'`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('detects a node: specifier when one is present', () => {
    // Guards the guard: proves the matcher actually fires, so an empty
    // offenders list above means "nothing to find" and not "matcher is broken".
    const sample = [
      "import {Buffer} from 'node:buffer';",
      "import fs from 'fs';",
      "const path = require('path');",
      "export {x} from 'crypto';",
    ].join('\n');

    expect(
      collectSpecifiers(sample).filter(isUnresolvableByMetro).sort(),
    ).toEqual(['crypto', 'fs', 'node:buffer', 'path']);
  });

  it('does not flag ordinary app and package specifiers', () => {
    const sample = [
      "import React from 'react';",
      "import {View} from 'react-native';",
      "import {useTheme} from '@/hooks';",
      "import helper from './helper';",
      "import shared from '../shared/utils/pathHelpers';",
      "import {sha256} from 'js-sha256';",
    ].join('\n');

    expect(collectSpecifiers(sample).filter(isUnresolvableByMetro)).toEqual([]);
  });
});
