'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
  // Transpile-only: type-safety is enforced separately by `tsc -p tsconfig.test.json`
  // (run via `type-check`), which avoids ts-jest diverging on the monorepo's
  // older TypeScript peer.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', isolatedModules: true }],
  },
  collectCoverage: true,
  // v8 coverage maps TypeScript back to source through source maps, which is why
  // tsconfig.test.json sets `sourceMap: true`. That setting is load-bearing, not
  // incidental: the base tsconfig turns source maps off for the production
  // build, and inheriting that here left v8-to-istanbul unable to attribute
  // ranges, so it reported every line of a loaded module as executed - including
  // function bodies no test calls. The aggregate barely moved (98.12 vs 98.01
  // statements, because this suite really does execute nearly everything), but
  // newly added dead code measured as fully covered, which silently disabled the
  // added-line gate in _test.yaml for this app. See issue #2238.
  //
  // The babel/istanbul provider is not the answer here: it under-counts ts-jest
  // `isolatedModules` output, reporting tested arrow-export bodies as uncovered.
  coverageProvider: 'v8',
  // Excluded: composition roots / bootstrap glue that only wire Electron
  // app/window/menu lifecycle and can only be exercised in a real Electron
  // process (same rationale as main.ts). Their behaviour is covered indirectly
  // by the unit tests of the modules they assemble.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/shell/create-main-window.ts',
    '!src/boot/setup.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
  // Thresholds are tuned to v8 measurements. Global bar enforces the project
  // coverage mandate; per-file overrides relax files that are dominated by
  // defensive branches only reachable in a real Electron runtime.
  // Statements/functions/lines meet the project's 95% mandate. Branches sit just
  // below: the remaining gaps are defensive guards (`?? 0`, optional-chaining
  // else-sides, type-guard fallbacks) that are low-risk and exercised only in a
  // real Electron runtime.
  coverageThreshold: {
    global: { statements: 95, branches: 88, functions: 95, lines: 95 },
  },
};
