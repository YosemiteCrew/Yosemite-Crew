/** @type {import('ts-jest').JestConfigWithTsJest} */
// Worker recycling is only needed for coverage runs (see workerIdleMemoryLimit below).
const collectingCoverage = process.argv.includes("--coverage");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/**/*.d.ts",
    "!<rootDir>/src/controllers/merck/merck-response.ts",
    "!<rootDir>/src/controllers/web/appointment.prisma.controller.ts",
    "!<rootDir>/src/controllers/web/case-encounter.controller.ts",
    "!<rootDir>/src/controllers/web/documenso.controller.ts",
    "!<rootDir>/src/controllers/web/lab-order.controller.ts",
    "!<rootDir>/src/controllers/web/lab-result.controller.ts",
    "!<rootDir>/src/controllers/web/organisation-invite.controller.ts",
    "!<rootDir>/src/controllers/web/organisation-room.controller.ts",
    "!<rootDir>/src/controllers/web/room-unit-group.controller.ts",
    "!<rootDir>/src/controllers/web/room-unit.controller.ts",
    "!<rootDir>/src/controllers/web/speciality.controller.ts",
    "!<rootDir>/src/middlewares/auth.ts",
    "!<rootDir>/src/routers/healthcare-service.router.ts",
    "!<rootDir>/src/services/appointment.prisma.service.ts",
    "!<rootDir>/src/services/formSigning.service.ts",
    "!<rootDir>/src/services/integration.service.ts",
    "!<rootDir>/src/services/lab-census.service.ts",
    "!<rootDir>/src/services/lab-order.service.ts",
    "!<rootDir>/src/utils/dual-write.ts",
    "!<rootDir>/src/utils/location.ts",
    "!<rootDir>/src/utils/org-usage-notifications.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageProvider: "v8",
  // Recycle workers ONLY during coverage runs. The v8 coverage provider accumulates
  // scope/context state across the 200+ suites on a long-lived worker, tripping an
  // internal V8 assertion ("# Check failed: needs_context ...") on memory-constrained
  // CI runners. Applying this to the much lighter non-coverage `turbo run test` runs
  // just restarts ts-jest workers needlessly and slows them down, so gate it on --coverage.
  ...(collectingCoverage ? { workerIdleMemoryLimit: "512MB" } : {}),
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],
  moduleNameMapper: {
    "^@yosemite-crew/database$": "<rootDir>/../../packages/database/src/client.ts",
    "^@yosemite-crew/lib$": "<rootDir>/../../packages/lib/src/index.ts",
    "^@yosemite-crew/(.*)$": "<rootDir>/../../packages/$1/src",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
        isolatedModules: true,
      },
    ],
  },
};
