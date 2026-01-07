
// --- Mocks ---
// We mock the individual component files to ensure the barrel file
// is correctly re-exporting what it receives.

jest.mock("@/app/components/CompanionInfo/Sections/Companion", () => ({
  __esModule: true,
  default: "MockCompanion",
}));

jest.mock("@/app/components/CompanionInfo/Sections/Parent", () => ({
  __esModule: true,
  default: "MockParent",
}));

jest.mock("@/app/components/CompanionInfo/Sections/Core", () => ({
  __esModule: true,
  default: "MockCore",
}));

jest.mock("@/app/components/CompanionInfo/Sections/History", () => ({
  __esModule: true,
  default: "MockHistory",
}));

jest.mock("@/app/components/CompanionInfo/Sections/Documents", () => ({
  __esModule: true,
  default: "MockDocuments",
}));

jest.mock("@/app/components/CompanionInfo/Sections/AddAppointment", () => ({
  __esModule: true,
  default: "MockAddAppointment",
}));

jest.mock("@/app/components/CompanionInfo/Sections/AddTask", () => ({
  __esModule: true,
  default: "MockAddTask",
}));

// Import the barrel file AFTER mocking
import * as Sections from "@/app/components/CompanionInfo/Sections";

describe("Sections Barrel File (Index)", () => {
  // --- 1. Export Verification ---

  it("exports all section components correctly", () => {
    // We check that the named export in the index file matches the default export of our mock
    expect(Sections.Companion).toBe("MockCompanion");
    expect(Sections.Parent).toBe("MockParent");
    expect(Sections.Core).toBe("MockCore");
    expect(Sections.History).toBe("MockHistory");
    expect(Sections.Documents).toBe("MockDocuments");
    expect(Sections.AddAppointment).toBe("MockAddAppointment");
    expect(Sections.AddTask).toBe("MockAddTask");
  });

  // --- 2. Coverage Check ---
  // Since there is no logic, branches, or functions in a barrel file,
  // simply importing it triggers the lines and statements coverage.

  it("has defined exports for all keys", () => {
    const keys = Object.keys(Sections);
    expect(keys).toHaveLength(7);
    expect(keys).toContain("Companion");
    expect(keys).toContain("Parent");
    expect(keys).toContain("Core");
    expect(keys).toContain("History");
    expect(keys).toContain("Documents");
    expect(keys).toContain("AddAppointment");
    expect(keys).toContain("AddTask");
  });
});
