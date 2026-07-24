import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import { resolveSafeInputFilePath } from "../../scripts/preprovision-supertokens.helpers";

describe("preprovision-supertokens", () => {
  it("resolves safe relative file paths from the current working directory", () => {
    expect(resolveSafeInputFilePath("exports/staff.json")).toBe(
      path.resolve(process.cwd(), "exports/staff.json"),
    );
    expect(resolveSafeInputFilePath("./exports/../staff.json")).toBe(
      path.resolve(process.cwd(), "staff.json"),
    );
  });

  it("rejects absolute and traversal file paths", () => {
    expect(() => resolveSafeInputFilePath("/etc/passwd")).toThrow(
      "Invalid file path",
    );
    expect(() => resolveSafeInputFilePath("../secrets.json")).toThrow(
      "Invalid file path",
    );
    expect(() => resolveSafeInputFilePath("nested/../../secrets.json")).toThrow(
      "Invalid file path",
    );
  });
});
