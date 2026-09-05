import {
  DEFAULT_PRESCRIPTION_PAGE_SIZE,
  MAX_PRESCRIPTION_PAGE_SIZE,
  MobilePrescriptionService,
} from "../../src/services/mobile-prescription.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: { findMany: jest.fn() },
    encounter: { findMany: jest.fn() },
    prescription: { findMany: jest.fn() },
  },
}));

import { prisma } from "src/config/prisma";

const mockLinks = prisma.parentPatient.findMany as jest.Mock;
const mockEncounters = prisma.encounter.findMany as jest.Mock;
const mockPrescriptions = prisma.prescription.findMany as jest.Mock;

/**
 * A CO_PARENT by default, because that is the role the `medicalRecords` flag
 * actually constrains. A PRIMARY link passes on its role alone, so building
 * these as PRIMARY would make every permission assertion below vacuous.
 */
const activeLink = (patientId: string, medicalRecords = true) => ({
  patientId,
  role: "CO_PARENT",
  permissions: { medicalRecords },
});

const primaryLink = (patientId: string, medicalRecords = true) => ({
  patientId,
  role: "PRIMARY",
  permissions: { medicalRecords },
});

const prescriptionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "rx-1",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  items: [
    {
      id: "item-1",
      medication: "Meloxicam",
      strength: "1.5 mg/ml",
      dosage: "0.5 ml",
      route: "Oral",
      frequency: "Once daily",
      duration: "5 days",
      quantity: "1 bottle",
      instructions: "Give with food",
      refill: null,
    },
  ],
  artifact: {
    encounterId: "enc-1",
    organisationId: "org-1",
    status: "SIGNED",
    summary: "Post-op pain relief",
    signedAt: new Date("2026-09-01T11:00:00.000Z"),
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("listPermittedPatientIds", () => {
  it("returns nothing for a caller with no parent id", async () => {
    const result = await MobilePrescriptionService.listPermittedPatientIds("");

    expect(result).toEqual([]);
    expect(mockLinks).not.toHaveBeenCalled();
  });

  it("asks only for ACTIVE links, so PENDING and REVOKED never reach the filter", async () => {
    mockLinks.mockResolvedValue([]);

    await MobilePrescriptionService.listPermittedPatientIds("parent-1");

    expect(mockLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: "parent-1", status: "ACTIVE" },
      }),
    );
  });

  it("excludes a co-parent whose link does not grant medicalRecords", async () => {
    mockLinks.mockResolvedValue([
      activeLink("pat-1"),
      activeLink("pat-2", false),
    ]);

    const result =
      await MobilePrescriptionService.listPermittedPatientIds("parent-1");

    expect(result).toEqual(["pat-1"]);
  });

  it("excludes a co-parent link whose permissions are missing entirely", async () => {
    mockLinks.mockResolvedValue([
      { patientId: "pat-3", role: "CO_PARENT", permissions: null },
    ]);

    const result =
      await MobilePrescriptionService.listPermittedPatientIds("parent-1");

    expect(result).toEqual([]);
  });

  // The rule is `requireCompanionPermission`'s, not this module's: a primary
  // parent's permission set describes what they have delegated and never
  // constrains them. `promoteLinkToPrimary` and `updatePermissions` both merge
  // caller-supplied overrides over PRIMARY_PARENT_PERMISSIONS and pin only
  // `assignAsPrimaryParent`, so `medicalRecords: false` on a PRIMARY link is
  // reachable - and that parent reads the same animal's passport today, which
  // is gated on the same feature through the middleware.
  it("includes a PRIMARY parent whose own link has medicalRecords off", async () => {
    mockLinks.mockResolvedValue([primaryLink("pat-1", false)]);

    const result =
      await MobilePrescriptionService.listPermittedPatientIds("parent-1");

    expect(result).toEqual(["pat-1"]);
  });

  it("includes a PRIMARY parent whose link carries no permissions at all", async () => {
    mockLinks.mockResolvedValue([
      { patientId: "pat-1", role: "PRIMARY", permissions: null },
    ]);

    const result =
      await MobilePrescriptionService.listPermittedPatientIds("parent-1");

    expect(result).toEqual(["pat-1"]);
  });
});

describe("listPrescriptionsForParent", () => {
  it("returns nothing, and queries nothing further, when no patient is permitted", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1", false)]);

    const result =
      await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(result.prescriptions).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(mockEncounters).not.toHaveBeenCalled();
    expect(mockPrescriptions).not.toHaveBeenCalled();
  });

  it("scopes encounters to the permitted patients", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1")]);
    mockEncounters.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(mockEncounters).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: { in: ["pat-1"] } } }),
    );
    expect(mockPrescriptions).not.toHaveBeenCalled();
  });

  it("restricts prescriptions to those encounters and to finalised artifacts only", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1")]);
    mockEncounters.mockResolvedValue([{ id: "enc-1", patientId: "pat-1" }]);
    mockPrescriptions.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    const where = mockPrescriptions.mock.calls[0][0].where;
    expect(where.artifact.encounterId).toEqual({ in: ["enc-1"] });
    expect(where.artifact.status).toEqual({ in: ["COMPLETED", "SIGNED"] });
  });

  it("maps a prescription onto the patient its encounter belongs to", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1")]);
    mockEncounters.mockResolvedValue([{ id: "enc-1", patientId: "pat-1" }]);
    mockPrescriptions.mockResolvedValue([prescriptionRow()]);

    const {
      prescriptions: [result],
    } = await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(result).toMatchObject({
      id: "rx-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      organisationId: "org-1",
      status: "SIGNED",
      summary: "Post-op pain relief",
      signedAt: "2026-09-01T11:00:00.000Z",
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      medication: "Meloxicam",
      dosage: "0.5 ml",
      instructions: "Give with food",
    });
    expect(result.items[0].refill).toBeUndefined();
  });

  it("drops a row whose artifact carries no encounter rather than returning it unscoped", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1")]);
    mockEncounters.mockResolvedValue([{ id: "enc-1", patientId: "pat-1" }]);
    mockPrescriptions.mockResolvedValue([
      prescriptionRow({
        artifact: {
          encounterId: null,
          organisationId: "org-1",
          status: "SIGNED",
          summary: null,
          signedAt: null,
        },
      }),
    ]);

    const result =
      await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(result.prescriptions).toEqual([]);
  });

  it("drops a row whose encounter is not one of the permitted patients'", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1")]);
    mockEncounters.mockResolvedValue([{ id: "enc-1", patientId: "pat-1" }]);
    mockPrescriptions.mockResolvedValue([
      prescriptionRow({
        artifact: {
          encounterId: "enc-someone-else",
          organisationId: "org-1",
          status: "SIGNED",
          summary: null,
          signedAt: null,
        },
      }),
    ]);

    const result =
      await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(result.prescriptions).toEqual([]);
  });
});

/*
 * The endpoint is a page, and the point of these is that it says so. A bare
 * `take` would pass every test above while silently dropping whatever did not
 * fit, which is the defect this describe exists to make impossible.
 */
describe("listPrescriptionsForParent pagination", () => {
  const onePatientWithOneEncounter = () => {
    mockLinks.mockResolvedValue([activeLink("pat-1")]);
    mockEncounters.mockResolvedValue([{ id: "enc-1", patientId: "pat-1" }]);
  };

  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      prescriptionRow({ id: `rx-${index + 1}` }),
    );

  it("reads one row past the page so hasMore is measured, not guessed", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(mockPrescriptions.mock.calls[0][0].take).toBe(
      DEFAULT_PRESCRIPTION_PAGE_SIZE + 1,
    );
  });

  it("orders by createdAt and then id, so a tied timestamp cannot make the page boundary ambiguous", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    expect(mockPrescriptions.mock.calls[0][0].orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("truncates to the page and reports the truncation", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue(rows(4));

    const result = await MobilePrescriptionService.listPrescriptionsForParent(
      "parent-1",
      { limit: "3" },
    );

    expect(result.prescriptions).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("rx-3");
    expect(result.limit).toBe(3);
  });

  it("reports the end of the data when the extra row does not come back", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue(rows(3));

    const result = await MobilePrescriptionService.listPrescriptionsForParent(
      "parent-1",
      { limit: "3" },
    );

    expect(result.prescriptions).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  /*
   * The cursor is taken from the last row the query returned for this page, not
   * from the last row that survived mapping. Here the third row is unmappable,
   * so the caller sees two prescriptions - and the cursor must still be `rx-3`,
   * or the next page starts on the dropped row and drops it again forever.
   */
  it("takes the cursor from the queried row, not from the last mapped one", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([
      prescriptionRow({ id: "rx-1" }),
      prescriptionRow({ id: "rx-2" }),
      prescriptionRow({
        id: "rx-3",
        artifact: {
          encounterId: null,
          organisationId: "org-1",
          status: "SIGNED",
          summary: null,
          signedAt: null,
        },
      }),
      prescriptionRow({ id: "rx-4" }),
    ]);

    const result = await MobilePrescriptionService.listPrescriptionsForParent(
      "parent-1",
      { limit: "3" },
    );

    expect(result.prescriptions.map((p) => p.id)).toEqual(["rx-1", "rx-2"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("rx-3");
  });

  it("steps past the cursor row rather than returning it twice", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1", {
      cursor: "rx-7",
    });

    const args = mockPrescriptions.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "rx-7" });
    expect(args.skip).toBe(1);
  });

  it("sends no cursor and no skip on the first page", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

    const args = mockPrescriptions.mock.calls[0][0];
    expect(args).not.toHaveProperty("cursor");
    expect(args).not.toHaveProperty("skip");
  });

  /*
   * A cursor is a position, never an access grant. Handing this endpoint an id
   * lifted from someone else's response moves the window and must not widen the
   * scope: the `where` is rebuilt from the permitted encounters every page.
   */
  it("does not let a foreign cursor widen the scope", async () => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([]);

    await MobilePrescriptionService.listPrescriptionsForParent("parent-1", {
      cursor: "rx-belonging-to-someone-else",
    });

    const where = mockPrescriptions.mock.calls[0][0].where;
    expect(where.artifact.encounterId).toEqual({ in: ["enc-1"] });
    expect(where.artifact.status).toEqual({ in: ["COMPLETED", "SIGNED"] });
  });

  it.each([
    ["above the ceiling", "1000", MAX_PRESCRIPTION_PAGE_SIZE],
    ["not a number", "all", DEFAULT_PRESCRIPTION_PAGE_SIZE],
    ["zero", "0", DEFAULT_PRESCRIPTION_PAGE_SIZE],
    ["negative", "-5", DEFAULT_PRESCRIPTION_PAGE_SIZE],
    ["absent", undefined, DEFAULT_PRESCRIPTION_PAGE_SIZE],
  ])("bounds a limit that is %s", async (_label, requested, expected) => {
    onePatientWithOneEncounter();
    mockPrescriptions.mockResolvedValue([]);

    const result = await MobilePrescriptionService.listPrescriptionsForParent(
      "parent-1",
      { limit: requested },
    );

    expect(result.limit).toBe(expected);
    expect(mockPrescriptions.mock.calls[0][0].take).toBe(expected + 1);
  });

  it("reports the applied limit even on a page it never queried for", async () => {
    mockLinks.mockResolvedValue([activeLink("pat-1", false)]);

    const result = await MobilePrescriptionService.listPrescriptionsForParent(
      "parent-1",
      { limit: "5" },
    );

    expect(result).toEqual({
      prescriptions: [],
      nextCursor: null,
      hasMore: false,
      limit: 5,
    });
  });
});
