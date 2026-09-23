import fs from "node:fs";
import path from "node:path";
import { getStreamServer } from "src/config/stream-client";

const STREAM_MODULES = [
  "src/services/chat.service",
  "src/services/networkChat.service",
  "src/services/sharedChatEntity.service",
] as const;

const REQUIRED_EXAMPLE_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "STREAM_API_KEY",
  "STREAM_API_SECRET",
] as const;

describe("optional Stream configuration", () => {
  const savedKey = process.env.STREAM_API_KEY;
  const savedSecret = process.env.STREAM_API_SECRET;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.STREAM_API_KEY;
    delete process.env.STREAM_API_SECRET;
  });

  afterAll(() => {
    if (savedKey === undefined) delete process.env.STREAM_API_KEY;
    else process.env.STREAM_API_KEY = savedKey;
    if (savedSecret === undefined) delete process.env.STREAM_API_SECRET;
    else process.env.STREAM_API_SECRET = savedSecret;
  });

  it.each(STREAM_MODULES)(
    "loads %s without Stream credentials",
    (modulePath) => {
      expect(() => {
        jest.isolateModules(() => require(modulePath));
      }).not.toThrow();
    },
  );

  it("fails only when Stream functionality is invoked without credentials", () => {
    expect(() => getStreamServer()).toThrow(
      "Stream Chat credentials missing in env",
    );
  });

  it("treats the blank values from the example file as unconfigured", () => {
    process.env.STREAM_API_KEY = "";
    process.env.STREAM_API_SECRET = "";
    expect(() => getStreamServer()).toThrow(
      "Stream Chat credentials missing in env",
    );
  });

  it.each([
    ["ordinary fixture key", undefined],
    [undefined, "ordinary fixture secret"],
  ])("rejects incomplete Stream credentials", (key, secret) => {
    if (key === undefined) delete process.env.STREAM_API_KEY;
    else process.env.STREAM_API_KEY = key;
    if (secret === undefined) delete process.env.STREAM_API_SECRET;
    else process.env.STREAM_API_SECRET = secret;

    expect(() => getStreamServer()).toThrow(
      "Stream Chat credentials missing in env",
    );
  });

  it("creates a client once Stream credentials are configured", () => {
    process.env.STREAM_API_KEY = "ordinary fixture key";
    process.env.STREAM_API_SECRET = "ordinary fixture secret";
    expect(getStreamServer()).toBeDefined();
  });
});

it("documents every service required for local backend startup", () => {
  const example = fs.readFileSync(
    path.resolve(__dirname, "../../.env.example"),
    "utf8",
  );

  for (const key of REQUIRED_EXAMPLE_KEYS) {
    expect(example).toMatch(new RegExp(`^(?:# )?${key}=`, "m"));
  }
});
