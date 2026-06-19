import {
  deriveOrganisationRoomCode,
  getMissingCompanionForeignKeyReason,
} from "../../src/scripts/migrate-all.helpers";

describe("getMissingCompanionForeignKeyReason", () => {
  const knownIds = new Set(["companion-1", "companion-2"]);

  it("returns null for unrelated models", () => {
    expect(
      getMissingCompanionForeignKeyReason(
        "Organization",
        { patientId: "companion-1" },
        knownIds,
      ),
    ).toBeNull();
  });

  it("returns null when the companion exists", () => {
    expect(
      getMissingCompanionForeignKeyReason(
        "Document",
        { patientId: "companion-1" },
        knownIds,
      ),
    ).toBeNull();
  });

  it("flags missing companionId values", () => {
    expect(getMissingCompanionForeignKeyReason("Document", {}, knownIds)).toBe(
      "missing patientId",
    );
    expect(
      getMissingCompanionForeignKeyReason(
        "Document",
        { patientId: "" },
        knownIds,
      ),
    ).toBe("missing patientId");
  });

  it("flags unknown companion references", () => {
    expect(
      getMissingCompanionForeignKeyReason(
        "PatientOrganisation",
        { patientId: "missing-id" },
        knownIds,
      ),
    ).toBe("unknown patientId missing-id");
  });

  it("derives a room code from explicit and legacy fields", () => {
    expect(
      deriveOrganisationRoomCode({
        data: { code: "  IP-01  ", name: "Exam Room 1", id: "abc123" },
      }),
    ).toBe("IP-01");

    expect(
      deriveOrganisationRoomCode({
        data: { fhirId: "LEGACY-ROOM-1", name: "Exam Room 1", id: "abc123" },
      }),
    ).toBe("LEGACY-ROOM-1");

    expect(
      deriveOrganisationRoomCode({
        data: { name: "Exam Room 1", id: "abc123def456" },
      }),
    ).toBe("exam-room-1-abc123");
  });

  it("returns null when a room code cannot be derived", () => {
    expect(deriveOrganisationRoomCode({ data: {} })).toBeNull();
  });
});
