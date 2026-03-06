import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import esbuild from "esbuild";
import { createRequire } from "node:module";

jest.mock("esbuild");
jest.mock("node:module", () => {
  const actual = jest.requireActual("node:module");
  return {
    ...actual,
    createRequire: jest.fn(),
  };
});

describe("Build Script", () => {
  let mockConsoleLog;
  let mockConsoleError;
  let mockExit;
  let mockRequire;
  const buildScriptPath = "../../src/scripts/build.js";

  beforeEach(() => {
    jest.resetModules();
    mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});

    mockRequire = jest.fn();
    createRequire.mockReturnValue(mockRequire);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should build successfully with dependencies (Happy Path)", async () => {
    esbuild.build.mockResolvedValue({});
    mockRequire.mockReturnValue({
      dependencies: {
        "some-dep": "1.0.0",
        react: "18.0.0",
      },
    });
    await import(buildScriptPath);
    expect(esbuild.build).toHaveBeenCalledWith(
      expect.objectContaining({
        bundle: true,
        platform: "node",
        format: "esm",
        external: expect.arrayContaining([
          "some-dep",
          "react",
          "stream-chat",
          "axios",
        ]),
      }),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith("Build succeeded");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should build successfully with no dependencies (Branch Coverage)", async () => {
    esbuild.build.mockResolvedValue({});
    mockRequire.mockReturnValue({});

    await import(buildScriptPath);
    expect(esbuild.build).toHaveBeenCalledWith(
      expect.objectContaining({
        external: expect.arrayContaining(["stream-chat", "axios"]),
      }),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith("Build succeeded");
  });

  it("should handle build failure and exit process", async () => {
    const testError = new Error("Esbuild crashed");
    esbuild.build.mockRejectedValue(testError);
    mockRequire.mockReturnValue({ dependencies: {} });

    await import(buildScriptPath);
    expect(mockConsoleError).toHaveBeenCalledWith("Build failed:", testError);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
