// --- MOCKS ---
jest.mock("winston", () => {
  let capturedCb: any;

  return {
    // Return a mocked logger object so the default export is valid
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
    addColors: jest.fn(),
    // Fully mock the format object properties destructured in logger.ts
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      colorize: jest.fn(),
      json: jest.fn(),
      errors: jest.fn(),
      printf: jest.fn((cb) => {
        capturedCb = cb;
        return "MOCKED_PRINTF";
      }),
    },
    transports: {
      Console: jest.fn(),
    },
    // Helper to retrieve the captured format callback in our tests
    __getCapturedCb: () => capturedCb,
  };
});

jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

describe("Logger Utility", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  describe("Environment Configurations", () => {
    it("should call dotenv.config immediately upon initialization", () => {
      jest.isolateModules(() => {
        const localDotenv = require("dotenv");
        require("../../src/utils/logger");
        expect(localDotenv.config).toHaveBeenCalled();
      });
    });

    it("should configure for production (JSON format, info level)", () => {
      process.env.NODE_ENV = "production";
      jest.isolateModules(() => {
        const localWinston = require("winston");
        require("../../src/utils/logger");

        expect(localWinston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({ level: "info" }),
        );
      });
    });

    it("should configure for development (Custom format, debug level)", () => {
      process.env.NODE_ENV = "development";
      jest.isolateModules(() => {
        const localWinston = require("winston");
        require("../../src/utils/logger");

        expect(localWinston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({ level: "debug" }),
        );

        expect(localWinston.addColors).toHaveBeenCalledWith({
          error: "red",
          warn: "yellow",
          info: "green",
          debug: "white",
        });

        expect(localWinston.__getCapturedCb()).toBeDefined();
      });
    });

    it("should configure for test/default (JSON format, debug level)", () => {
      process.env.NODE_ENV = "test";
      jest.isolateModules(() => {
        const localWinston = require("winston");
        require("../../src/utils/logger");

        expect(localWinston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({ level: "debug" }),
        );
      });
    });

    it("should export the logger with correct signature methods", () => {
      jest.isolateModules(() => {
        const logger = require("../../src/utils/logger").default;
        expect(logger.info).toBeDefined();
        expect(logger.error).toBeDefined();
        expect(logger.warn).toBeDefined();
        expect(logger.debug).toBeDefined();
      });
    });
  });

  describe("printf formatting logic (logFormat & serializeLogMessage)", () => {
    let formatCb: any;

    beforeEach(() => {
      process.env.NODE_ENV = "development";
      jest.isolateModules(() => {
        const localWinston = require("winston");
        require("../../src/utils/logger");
        formatCb = localWinston.__getCapturedCb();
      });
    });

    it("should format string message with valid timestamp and no meta", () => {
      const res = formatCb({ level: "info", message: "Hello", timestamp: "T" });
      expect(res).toBe("T [info]: Hello");
    });

    it("should fallback to ISO string if timestamp is empty", () => {
      const res = formatCb({ level: "warn", message: "Hello", timestamp: "" });
      expect(res).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[warn\]: Hello$/,
      );
    });

    it("should fallback to ISO string if timestamp is completely undefined", () => {
      const res = formatCb({ level: "error", message: "Hello" });
      expect(res).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[error\]: Hello$/,
      );
    });

    it("should append serialized meta if extra keys are provided", () => {
      const res = formatCb({
        level: "debug",
        message: "Hello",
        timestamp: "T",
        key1: "value1",
        key2: 2,
      });
      expect(res).toBe(
        'T [debug]: Hello {\n  "key1": "value1",\n  "key2": 2\n}',
      );
    });

    it("should prefer stack property over serialized message if stack is provided", () => {
      const res = formatCb({
        level: "error",
        message: "Hello",
        timestamp: "T",
        stack: "Stack Trace...",
      });
      expect(res).toBe("T [error]: Stack Trace...");
    });

    it("should use Error.stack if message is an Error with a stack", () => {
      const err = new Error("msg");
      err.stack = "Error Stack...";
      const res = formatCb({ level: "error", message: err, timestamp: "T" });
      expect(res).toBe("T [error]: Error Stack...");
    });

    it("should use Error.message if message is an Error without a stack", () => {
      const err = new Error("Just message");
      delete err.stack; // Force undefined stack
      const res = formatCb({ level: "error", message: err, timestamp: "T" });
      expect(res).toBe("T [error]: Just message");
    });

    it("should JSON stringify message objects", () => {
      const res = formatCb({
        level: "info",
        message: { a: 1, b: "two" },
        timestamp: "T",
      });
      expect(res).toBe('T [info]: {"a":1,"b":"two"}');
    });

    it("should fallback to String() if JSON stringify fails (catch block)", () => {
      // BigInt throws a TypeError when attempting to JSON.stringify it, forcing the catch branch
      const res = formatCb({ level: "info", message: 10n, timestamp: "T" });
      expect(res).toBe("T [info]: 10");
    });

    it("should use string message even if stack is an empty string", () => {
      const res = formatCb({
        level: "error",
        message: "Fallback Message",
        timestamp: "T",
        stack: "",
      });
      expect(res).toBe("T [error]: Fallback Message");
    });
  });
});
