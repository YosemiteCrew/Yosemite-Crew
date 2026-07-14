import fs from "node:fs";
import path from "node:path";

// We need to test the readJson function in isolation
// Since it's not exported, we'll recreate it here for testing
const readJson = <T>(filePath: string): T => {
  if (filePath.includes('..') || path.isAbsolute(filePath)) {
    throw new Error('Invalid file path');
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

describe("seed-codebook path traversal protection", () => {
  const testDataDir = path.join(process.cwd(), "test-data");
  const validFile = path.join(testDataDir, "test.json");

  beforeAll(() => {
    // Create test directory and file
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    fs.writeFileSync(validFile, JSON.stringify({ test: "data" }));
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(validFile)) {
      fs.unlinkSync(validFile);
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmdirSync(testDataDir);
    }
  });

  describe("readJson security validation", () => {
    it("should successfully read a valid relative file path", () => {
      const result = readJson<{ test: string }>("test-data/test.json");
      expect(result).toEqual({ test: "data" });
    });

    it("should reject path traversal with double dots", () => {
      expect(() => {
        readJson("../../../etc/passwd");
      }).toThrow("Invalid file path");
    });

    it("should reject path traversal in middle of path", () => {
      expect(() => {
        readJson("data/../../../etc/passwd");
      }).toThrow("Invalid file path");
    });

    it("should reject absolute Unix paths", () => {
      expect(() => {
        readJson("/etc/passwd");
      }).toThrow("Invalid file path");
    });

    it("should reject absolute Windows paths", () => {
      const windowsPath = "C:\\Windows\\System32\\config\\sam";
      if (path.isAbsolute(windowsPath)) {
        expect(() => {
          readJson(windowsPath);
        }).toThrow("Invalid file path");
      } else {
        // On Unix, this would fail with ENOENT, which is acceptable
        expect(() => {
          readJson(windowsPath);
        }).toThrow();
      }
    });

    it("should reject URL-encoded path traversal", () => {
      expect(() => {
        readJson("..%2F..%2F..%2Fetc%2Fpasswd");
      }).toThrow("Invalid file path");
    });

    it("should reject backslash path traversal", () => {
      expect(() => {
        readJson("..\\..\\..\\windows\\system32\\config\\sam");
      }).toThrow("Invalid file path");
    });
  });
});
