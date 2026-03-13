process.env.DUAL_WRITE_ENABLED = "false";
process.env.DUAL_WRITE_STRICT = "false";

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));
