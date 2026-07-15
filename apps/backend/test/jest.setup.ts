process.env.DUAL_WRITE_ENABLED = "false";
process.env.DUAL_WRITE_STRICT = "false";
process.env.READ_FROM_POSTGRES = "false";
process.env.STREAM_API_KEY = process.env.STREAM_API_KEY || "test-stream-key";
process.env.STREAM_API_SECRET =
  process.env.STREAM_API_SECRET || "test-stream-secret";

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));
