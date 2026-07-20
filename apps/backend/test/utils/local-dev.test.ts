import { isLocalDevEnvironment } from "../../src/utils/local-dev";

describe("isLocalDevEnvironment", () => {
  const originalFlag = process.env.LOCAL_DEVELOPMENT;
  const originalNodeEnv = process.env.NODE_ENV;

  const setEnv = (flag: string | undefined, nodeEnv: string | undefined) => {
    if (flag === undefined) delete process.env.LOCAL_DEVELOPMENT;
    else process.env.LOCAL_DEVELOPMENT = flag;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  };

  afterEach(() => {
    setEnv(originalFlag, originalNodeEnv);
  });

  it.each(["development", "test", undefined])(
    "is true with the explicit flag and NODE_ENV %p",
    (nodeEnv) => {
      setEnv("true", nodeEnv);
      expect(isLocalDevEnvironment()).toBe(true);
    },
  );

  // The flag is the signal. NODE_ENV alone must never enable local-only
  // behaviour: a deployed dev or staging tier commonly sets NODE_ENV=development
  // while being a real remote environment.
  it.each(["development", "test", "staging", "production", undefined])(
    "is false without the flag, NODE_ENV %p",
    (nodeEnv) => {
      setEnv(undefined, nodeEnv);
      expect(isLocalDevEnvironment()).toBe(false);
    },
  );

  it.each(["false", "0", "", "TRUE", "yes"])(
    "is false for a non-exact flag value %p",
    (flag) => {
      setEnv(flag, "development");
      expect(isLocalDevEnvironment()).toBe(false);
    },
  );

  it("is false in production even when the flag is set", () => {
    setEnv("true", "production");
    expect(isLocalDevEnvironment()).toBe(false);
  });
});
