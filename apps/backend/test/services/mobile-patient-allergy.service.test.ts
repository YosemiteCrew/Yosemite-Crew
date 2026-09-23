import { MobilePatientAllergyService } from "../../src/services/mobile-patient-allergy.service";

jest.mock("src/config/prisma", () => ({
  prisma: { patientAllergy: { findMany: jest.fn() } },
}));

import { prisma } from "src/config/prisma";

const mockAllergies = prisma.patientAllergy.findMany as jest.Mock;
const { listAllergiesForCompanion } = MobilePatientAllergyService;

const allergyRow = (overrides: Record<string, unknown> = {}) => ({
  id: "alg-1",
  patientId: "pet-1",
  organisationId: "org-1",
  allergen: "Penicillin",
  allergyType: "DRUG",
  severity: "LIFE_THREATENING",
  reaction: "Anaphylaxis",
  status: "ACTIVE",
  onsetDate: new Date("2026-03-04T00:00:00.000Z"),
  createdAt: new Date("2026-03-05T09:00:00.000Z"),
  updatedAt: new Date("2026-03-06T09:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAllergies.mockResolvedValue([]);
});

describe("scoping", () => {
  it("never queries for a falsy patient id", async () => {
    await expect(listAllergiesForCompanion("")).resolves.toEqual([]);
    expect(mockAllergies).not.toHaveBeenCalled();
  });

  it("scopes the read to the named companion", async () => {
    await listAllergiesForCompanion("pet-1");

    expect(mockAllergies).toHaveBeenCalledTimes(1);
    expect(mockAllergies.mock.calls[0][0].where).toMatchObject({
      patientId: "pet-1",
    });
  });

  /*
   * The organisation is deliberately absent from the `where`. An animal seen
   * by a second practice has that practice's allergy rows under a different
   * organisationId, and an org filter would hide exactly the record the owner
   * cannot reach any other way.
   */
  it("does not filter by organisation, so a second practice's record is returned", async () => {
    mockAllergies.mockResolvedValue([
      allergyRow(),
      allergyRow({ id: "alg-2", organisationId: "org-2", allergen: "Beef" }),
    ]);

    const allergies = await listAllergiesForCompanion("pet-1");

    expect(mockAllergies.mock.calls[0][0].where).not.toHaveProperty(
      "organisationId",
    );
    expect(allergies.map((a) => a.organisationId)).toEqual(["org-1", "org-2"]);
  });
});

describe("what the owner is shown", () => {
  it("asks for the live statuses and not for resolved ones", async () => {
    await listAllergiesForCompanion("pet-1");

    const { status } = mockAllergies.mock.calls[0][0].where;
    expect(status.in).toEqual(["ACTIVE", "UNCONFIRMED"]);
    expect(status.in).not.toContain("RESOLVED");
  });

  it("never selects the practice's own notes or the recording staff id", async () => {
    await listAllergiesForCompanion("pet-1");

    const { select } = mockAllergies.mock.calls[0][0];
    expect(select).not.toHaveProperty("notes");
    expect(select).not.toHaveProperty("recordedBy");
  });

  it("orders the most severe first, so a short screen shows what can kill", async () => {
    await listAllergiesForCompanion("pet-1");

    expect(mockAllergies.mock.calls[0][0].orderBy[0]).toEqual({
      severity: "desc",
    });
  });

  it("reads the page unpaged, so no allergy is silently withheld", async () => {
    await listAllergiesForCompanion("pet-1");

    const args = mockAllergies.mock.calls[0][0];
    expect(args).not.toHaveProperty("take");
    expect(args).not.toHaveProperty("cursor");
    expect(args).not.toHaveProperty("skip");
  });
});

describe("the wire shape", () => {
  it("maps a row to the owner-facing fields", async () => {
    mockAllergies.mockResolvedValue([allergyRow()]);

    const [allergy] = await listAllergiesForCompanion("pet-1");

    expect(allergy).toEqual({
      id: "alg-1",
      patientId: "pet-1",
      organisationId: "org-1",
      allergen: "Penicillin",
      allergyType: "DRUG",
      severity: "LIFE_THREATENING",
      reaction: "Anaphylaxis",
      status: "ACTIVE",
      onsetDate: "2026-03-04T00:00:00.000Z",
      recordedAt: "2026-03-05T09:00:00.000Z",
      updatedAt: "2026-03-06T09:00:00.000Z",
    });
  });

  /*
   * `recordedAt` is the row's createdAt, which is when the practice wrote it
   * down - not when the animal became allergic. Conflating the two is the
   * mistake the rename exists to prevent, so the test pins both separately.
   */
  it("keeps the recorded date distinct from the onset date", async () => {
    mockAllergies.mockResolvedValue([
      allergyRow({
        onsetDate: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-06T06:00:00.000Z"),
      }),
    ]);

    const [allergy] = await listAllergiesForCompanion("pet-1");

    expect(allergy.onsetDate).toBe("2024-01-01T00:00:00.000Z");
    expect(allergy.recordedAt).toBe("2026-06-06T06:00:00.000Z");
  });

  /*
   * Absent, not null. JSON.stringify drops an undefined and emits a null, so a
   * client checking presence would otherwise see a reaction that is there and
   * empty.
   */
  it("omits an unknown reaction and onset rather than sending null", async () => {
    mockAllergies.mockResolvedValue([
      allergyRow({ reaction: null, onsetDate: null }),
    ]);

    const [allergy] = await listAllergiesForCompanion("pet-1");

    expect(allergy.reaction).toBeUndefined();
    expect(allergy.onsetDate).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(allergy, "reaction")).toBe(
      true,
    );
  });

  it("carries an unconfirmed allergy through with its status intact", async () => {
    mockAllergies.mockResolvedValue([
      allergyRow({ id: "alg-9", status: "UNCONFIRMED", severity: "MILD" }),
    ]);

    const [allergy] = await listAllergiesForCompanion("pet-1");

    expect(allergy.status).toBe("UNCONFIRMED");
  });

  it("returns an empty list when nothing has been recorded", async () => {
    await expect(listAllergiesForCompanion("pet-1")).resolves.toEqual([]);
  });
});
