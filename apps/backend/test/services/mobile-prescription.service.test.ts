import { MobilePrescriptionService } from "../../src/services/mobile-prescription.service";

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

    expect(result).toEqual([]);
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

    const [result] =
      await MobilePrescriptionService.listPrescriptionsForParent("parent-1");

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

    expect(result).toEqual([]);
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

    expect(result).toEqual([]);
  });
});
