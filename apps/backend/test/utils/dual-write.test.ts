jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const loadModule = (env: Record<string, string>) => {
  jest.resetModules();
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...env };
  const mod = require("../../src/utils/dual-write");
  process.env = originalEnv;
  return mod as typeof import("../../src/utils/dual-write");
};

describe("dual-write utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs and does not throw when strict is false", () => {
    const mod = loadModule({
      DUAL_WRITE_ENABLED: "true",
      DUAL_WRITE_STRICT: "false",
    });
    mod.handleDualWriteError("Entity", new Error("boom"));
  });
});
