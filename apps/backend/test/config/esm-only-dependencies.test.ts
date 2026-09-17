/**
 * THE ESM-ONLY DEPENDENCIES LOAD UNDER THE COMMONJS TEST RUNTIME.
 *
 * This package is `"type": "module"`, but jest runs it through ts-jest as
 * CommonJS. A dependency that publishes ESM only therefore cannot be `require`d
 * unless `transformIgnorePatterns` in jest.config.cjs carves it out of the
 * node_modules exclusion so the `^.+\.m?js$` transform can reach it.
 *
 * Nothing said so before. When uuid 14.0.2 dropped its CommonJS build, the
 * failure was not one test - it was 74 suites reporting "Test suite failed to
 * run" and 1418 cases that never reached an assertion, because `uuid` sits
 * behind src/middlewares/upload.ts and most of the service layer reaches it.
 * A suite that dies at import is not a suite that failed a check; it is a suite
 * whose checks did not happen, and the only visible number moves the wrong way.
 *
 * So the carve-out gets a test of its own. Each name below is a dependency this
 * package imports that ships ESM only, listed rather than derived from the
 * config: a list read out of the regex it is meant to guard would agree with
 * that regex whatever the regex said.
 */

/** Every ESM-only dependency the jest transform is expected to reach. */
const ESM_ONLY_DEPENDENCIES = ["jose", "raw-body", "uuid"] as const;

/**
 * The application module whose own import of one of the above took the suite
 * down. Included because the dependency loading in isolation and the module
 * loading through the real import graph are different questions, and it was the
 * second one that was red.
 */
const IMPORTER = "src/middlewares/upload";

describe("ESM-only dependencies under the CommonJS test runtime", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it.each(ESM_ONLY_DEPENDENCIES)("loads %s", (dependency) => {
    expect(() => {
      jest.isolateModules(() => require(dependency));
    }).not.toThrow();
  });

  it(`loads ${IMPORTER}, which imports one of them`, () => {
    expect(() => {
      jest.isolateModules(() => require(IMPORTER));
    }).not.toThrow();
  });
});
