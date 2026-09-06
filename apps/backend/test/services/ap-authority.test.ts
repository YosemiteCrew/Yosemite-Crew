import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const warn = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: (...args: unknown[]) => warn(...args),
    error: jest.fn(),
  },
}));

import {
  DEFAULT_AP_AUTHORITY_URL,
  apAuthorityBase,
} from "src/services/ap-authority";

const VAR = "AP_LICENSE_AUTHORITY_URL";

function withValue<T>(value: string | undefined, run: () => T): T {
  const previous = process.env[VAR];
  if (value === undefined) delete process.env[VAR];
  else process.env[VAR] = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env[VAR];
    else process.env[VAR] = previous;
  }
}

beforeEach(() => {
  warn.mockClear();
});

describe("apAuthorityBase", () => {
  it.each([
    ["unset", undefined],
    // What .env.example ships. `??` would pass this straight through, and the
    // result is not a wrong host - it is fetch("/api/ap/signing-key.json"),
    // which throws `TypeError: Failed to parse URL` inside the fetch.
    ["the empty string", ""],
    ["whitespace only", "   "],
    ["a tab", "\t"],
  ])("falls back to the authority when the variable is %s", (_label, value) => {
    expect(withValue(value, apAuthorityBase)).toBe(DEFAULT_AP_AUTHORITY_URL);
    // Silently. Blank is "not configured", not "misconfigured" - a deployment
    // that copied .env.example must not log a warning on every call. Asserting
    // only the return value cannot tell the two apart, because an empty string
    // also reaches the default by failing `new URL("")` and warning on the way.
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["https://authority.example", "https://authority.example"],
    ["https://authority.example/", "https://authority.example"],
    ["  https://authority.example/  ", "https://authority.example"],
    ["http://localhost:3001", "http://localhost:3001"],
  ])("uses %s as the base", (value, expected) => {
    expect(withValue(value, apAuthorityBase)).toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["not-a-url", "not-a-url"],
    ["admin.yosemitecrew.com", "admin.yosemitecrew.com"],
    ["://missing-scheme", "://missing-scheme"],
  ])("falls back and warns once for %s", (_label, value) => {
    expect(withValue(value, apAuthorityBase)).toBe(DEFAULT_AP_AUTHORITY_URL);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("never puts the configured value in the log line", () => {
    // An authority URL is not a secret, but a mistyped one can carry
    // `user:password@host`, and a warning is the wrong place to find that out.
    // Deliberately an input that FAILS to parse: `http://user:pass@host` is a
    // perfectly valid URL and never reaches the warning at all.
    withValue("://user:hunter2@authority.example", apAuthorityBase);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain("hunter2");
  });
});

describe("the variable has exactly one reader", () => {
  // The defect this module exists to fix was two readers with two different
  // defaults, only one of which was corrected when the default changed. A second
  // reader is the recurrence, and it is invisible to every other test here.
  const SRC = join(__dirname, "..", "..", "src");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it("is read only by ap-authority.ts", () => {
    const files = sourceFiles(SRC);
    // A walk that found nothing would make the assertion below vacuous.
    expect(files.length).toBeGreaterThan(100);

    const readers = files.filter((file) =>
      readFileSync(file, "utf8").includes(`process.env.${VAR}`),
    );
    expect(readers.map((file) => file.slice(SRC.length + 1))).toEqual([
      join("services", "ap-authority.ts"),
    ]);
  });
});
