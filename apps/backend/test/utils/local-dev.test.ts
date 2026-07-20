import { isLocalDevEnvironment } from "../../src/utils/local-dev";

describe("isLocalDevEnvironment", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it.each(["development", "test"])("is true for %s", (env) => {
    process.env.NODE_ENV = env;
    expect(isLocalDevEnvironment()).toBe(true);
  });

  // The allowlist exists so that anything unrecognised is treated as
  // production. A `!== "production"` denylist would return true for every value
  // below, enabling debug-only behaviour on a misconfigured production deploy.
  it.each(["production", "", "Production", "PRODUCTION", "prod", "staging"])(
    "is false for %p",
    (env) => {
      process.env.NODE_ENV = env;
      expect(isLocalDevEnvironment()).toBe(false);
    },
  );

  it("is false when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    expect(isLocalDevEnvironment()).toBe(false);
  });
});
