import {
  chooseMongooseSourceModelName,
  deriveOrganisationRoomCode,
  getMissingCoParentInvitePatientIdReason,
  getMissingExternalExpensePatientIdReason,
  getMissingCompanionForeignKeyReason,
  getMissingMongooseModelReason,
  normalizePatientGender,
  normalizePatientSource,
  normalizePatientStatus,
  normalizePatientType,
  resolveLegacyPatientId,
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

  it("normalizes patient enums from legacy Mongo values", () => {
    expect(normalizePatientType("DOG")).toBe("dog");
    expect(normalizePatientType(" cat ")).toBe("cat");
    expect(normalizePatientType("unknown")).toBe("other");

    expect(normalizePatientGender("MALE")).toBe("male");
    expect(normalizePatientGender("OTHER")).toBe("unknown");
    expect(normalizePatientGender("not-a-gender")).toBeNull();

    expect(normalizePatientSource("FOSTER SHELTER")).toBe("foster_shelter");
    expect(normalizePatientSource("friends-family")).toBe("friends_family");
    expect(normalizePatientSource("mystery")).toBeNull();

    expect(normalizePatientStatus("ACTIVE")).toBe("active");
    expect(normalizePatientStatus("archived")).toBe("archived");
    expect(normalizePatientStatus("deleted")).toBeNull();
  });

  it("flags co-parent invites missing patient ids", () => {
    expect(getMissingCoParentInvitePatientIdReason({})).toBe(
      "missing patientId",
    );
    expect(getMissingCoParentInvitePatientIdReason({ patientId: "   " })).toBe(
      "missing patientId",
    );
    expect(
      getMissingCoParentInvitePatientIdReason({ patientId: "patient-1" }),
    ).toBeNull();
  });

  it("flags external expenses missing patient ids", () => {
    expect(getMissingExternalExpensePatientIdReason({})).toBe(
      "missing patientId",
    );
    expect(getMissingExternalExpensePatientIdReason({ patientId: "   " })).toBe(
      "missing patientId",
    );
    expect(
      getMissingExternalExpensePatientIdReason({ patientId: "patient-1" }),
    ).toBeNull();
  });

  it("flags missing mongoose models", () => {
    expect(getMissingMongooseModelReason("InventoryBatch", [])).toBe(
      "Mongoose model InventoryBatch is not registered",
    );
    expect(
      getMissingMongooseModelReason("InventoryBatch", ["InventoryBatch"]),
    ).toBeNull();
  });

  it("prefers the legacy source model when it has rows", () => {
    expect(
      chooseMongooseSourceModelName({
        preferredNames: ["ParentCompanion", "ParentPatient"],
        registeredModelNames: ["ParentCompanion", "ParentPatient"],
        documentCounts: new Map([
          ["ParentCompanion", 12],
          ["ParentPatient", 0],
        ]),
      }),
    ).toBe("ParentCompanion");

    expect(
      chooseMongooseSourceModelName({
        preferredNames: ["ParentCompanion", "ParentPatient"],
        registeredModelNames: ["ParentCompanion", "ParentPatient"],
        documentCounts: new Map([
          ["ParentCompanion", 0],
          ["ParentPatient", 4],
        ]),
      }),
    ).toBe("ParentPatient");
  });

  it("resolves patient ids from legacy field names", () => {
    expect(
      resolveLegacyPatientId({
        patientId: "",
        companionId: "  legacy-companion-id  ",
      }),
    ).toBe("legacy-companion-id");

    expect(
      resolveLegacyPatientId({
        patient: { toString: () => "patient-ref-1" },
      }),
    ).toBe("patient-ref-1");

    expect(resolveLegacyPatientId({})).toBeNull();
  });
});
