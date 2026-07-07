import { DeveloperDataService } from "../../src/services/developer-data.service";
import {
  InvalidCursorError,
  encodeCursor,
} from "../../src/utils/cursor-pagination";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    appointment: { findMany: jest.fn(), findFirst: jest.fn() },
    patientOrganisation: { findMany: jest.fn(), findFirst: jest.fn() },
    encounter: { findMany: jest.fn(), findFirst: jest.fn() },
    invoice: { findMany: jest.fn(), findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  appointment: { findMany: jest.Mock; findFirst: jest.Mock };
  patientOrganisation: { findMany: jest.Mock; findFirst: jest.Mock };
  encounter: { findMany: jest.Mock; findFirst: jest.Mock };
  invoice: { findMany: jest.Mock; findFirst: jest.Mock };
  organization: { findUnique: jest.Mock };
};

const rows = (n: number, sortField = "createdAt") =>
  Array.from({ length: n }, (_, i) => ({
    id: `row-${i}`,
    [sortField]: new Date(Date.UTC(2026, 5, 30 - i)),
  }));

const when = new Date("2026-06-15T10:00:00.000Z");
const cursorFor = (id: string) =>
  encodeCursor({ sortKey: when.toISOString(), id });

describe("DeveloperDataService.listAppointments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pushes org, status, and date filters into the Prisma where clause", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 50,
      status: "UPCOMING",
      dateFrom: "2026-07-01T00:00:00+00:00",
      dateTo: "2026-07-31T00:00:00+00:00",
    });
    const arg = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      organisationId: "org-1",
      status: "UPCOMING",
      appointmentDate: {
        gte: new Date("2026-07-01T00:00:00+00:00"),
        lte: new Date("2026-07-31T00:00:00+00:00"),
      },
    });
    expect(arg.orderBy).toEqual([{ appointmentDate: "desc" }, { id: "desc" }]);
  });

  it("selects the contract list fields and nothing sensitive", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 50,
    });
    const select = mockPrisma.appointment.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      [
        "id",
        "organisationId",
        "patient",
        "lead",
        "appointmentType",
        "room",
        "appointmentDate",
        "startTime",
        "endTime",
        "timeSlot",
        "durationMinutes",
        "status",
        "isEmergency",
        "concern",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    expect(select.idempotencyKey).toBeUndefined();
    expect(select.expiresAt).toBeUndefined();
  });

  it("fetches limit + 1 rows to probe hasMore", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 100,
    });
    expect(mockPrisma.appointment.findMany.mock.calls[0][0].take).toBe(101);
  });

  it("continues via a keyset WHERE, never a Prisma cursor/skip", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 10,
      cursor: cursorFor("row-7"),
    });
    const arg = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(arg.cursor).toBeUndefined();
    expect(arg.skip).toBeUndefined();
    expect(arg.take).toBe(11);
    expect(arg.where).toEqual({
      organisationId: "org-1",
      AND: [
        {
          OR: [
            { appointmentDate: { lt: when } },
            { appointmentDate: when, id: { lt: "row-7" } },
          ],
        },
      ],
    });
  });

  it("keeps a forged cursor inside the caller's org filter (no cross-org oracle)", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    // Token forged with an id that lives in another org - or nowhere. Either
    // way the query stays pinned to org-1 and the id only appears inside the
    // value-comparison branch, so the response is indistinguishable.
    await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 10,
      cursor: cursorFor("some-other-orgs-appointment-id"),
    });
    const arg = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(arg.where.organisationId).toBe("org-1");
    expect(arg.where.AND).toEqual([
      {
        OR: [
          { appointmentDate: { lt: when } },
          {
            appointmentDate: when,
            id: { lt: "some-other-orgs-appointment-id" },
          },
        ],
      },
    ]);
  });

  it("propagates InvalidCursorError for a tampered cursor without querying", async () => {
    await expect(
      DeveloperDataService.listAppointments({
        organisationId: "org-1",
        limit: 10,
        cursor: "@@not-a-cursor",
      }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
    expect(mockPrisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it("builds the page envelope with hasMore and a continuation cursor", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue(
      rows(3, "appointmentDate"),
    );
    const page = await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 2,
    });
    expect(page.items).toHaveLength(2);
    expect(page.pagination.hasMore).toBe(true);
    expect(page.pagination.limit).toBe(2);
    expect(typeof page.pagination.nextCursor).toBe("string");
  });

  it("returns hasMore false and a null cursor on the last page", async () => {
    mockPrisma.appointment.findMany.mockResolvedValue(
      rows(1, "appointmentDate"),
    );
    const page = await DeveloperDataService.listAppointments({
      organisationId: "org-1",
      limit: 2,
    });
    expect(page.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      limit: 2,
    });
  });
});

describe("DeveloperDataService.getAppointment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes the lookup to the key's org and selects the detail fields", async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue({ id: "a-1" });
    const row = await DeveloperDataService.getAppointment("org-1", "a-1");
    const arg = mockPrisma.appointment.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "a-1", organisationId: "org-1" });
    expect(arg.select).toEqual(
      expect.objectContaining({
        supportStaff: true,
        attachments: true,
        formIds: true,
        caseId: true,
        encounterId: true,
        appointmentKind: true,
      }),
    );
    expect(arg.select.idempotencyKey).toBeUndefined();
    expect(row).toEqual({ id: "a-1" });
  });

  it("returns null for another org's appointment (no existence leak)", async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue(null);
    await expect(
      DeveloperDataService.getAppointment("org-1", "other-org-row"),
    ).resolves.toBeNull();
  });
});

describe("DeveloperDataService.listPatients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queries through the ACTIVE PatientOrganisation join and maps to patients", async () => {
    mockPrisma.patientOrganisation.findMany.mockResolvedValue([
      { id: "link-1", createdAt: new Date(), patient: { id: "p-1" } },
    ]);
    const page = await DeveloperDataService.listPatients({
      organisationId: "org-1",
      limit: 50,
    });
    const arg = mockPrisma.patientOrganisation.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ organisationId: "org-1", status: "ACTIVE" });
    expect(page.items).toEqual([{ id: "p-1" }]);
  });

  it("pushes the status filter into the Prisma where clause (not JS)", async () => {
    mockPrisma.patientOrganisation.findMany.mockResolvedValue([]);
    await DeveloperDataService.listPatients({
      organisationId: "org-1",
      limit: 50,
      status: "archived",
    });
    const arg = mockPrisma.patientOrganisation.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      organisationId: "org-1",
      status: "ACTIVE",
      patient: { status: "archived" },
    });
  });

  it("selects only the contract list fields on the joined patient", async () => {
    mockPrisma.patientOrganisation.findMany.mockResolvedValue([]);
    await DeveloperDataService.listPatients({
      organisationId: "org-1",
      limit: 50,
    });
    const select =
      mockPrisma.patientOrganisation.findMany.mock.calls[0][0].select;
    expect(Object.keys(select.patient.select).sort()).toEqual(
      [
        "id",
        "name",
        "type",
        "breed",
        "dateOfBirth",
        "gender",
        "photoUrl",
        "status",
        "isInsured",
        "microchipNumber",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });

  it("paginates on the link rows with a keyset continuation", async () => {
    const links = Array.from({ length: 3 }, (_, i) => ({
      id: `link-${i}`,
      createdAt: new Date(Date.UTC(2026, 5, 30 - i)),
      patient: { id: `p-${i}` },
    }));
    mockPrisma.patientOrganisation.findMany.mockResolvedValue(links);
    const page = await DeveloperDataService.listPatients({
      organisationId: "org-1",
      limit: 2,
      cursor: cursorFor("link-9"),
    });
    const arg = mockPrisma.patientOrganisation.findMany.mock.calls[0][0];
    expect(arg.cursor).toBeUndefined();
    expect(arg.where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: when } },
          { createdAt: when, id: { lt: "link-9" } },
        ],
      },
    ]);
    expect(page.items).toEqual([{ id: "p-0" }, { id: "p-1" }]);
    expect(page.pagination.hasMore).toBe(true);
  });
});

describe("DeveloperDataService.getPatient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when there is no ACTIVE link for this org", async () => {
    mockPrisma.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      DeveloperDataService.getPatient("org-1", "p-9"),
    ).resolves.toBeNull();
    const where =
      mockPrisma.patientOrganisation.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({
      patientId: "p-9",
      organisationId: "org-1",
      status: "ACTIVE",
    });
  });

  it("returns the detail fields for a linked patient", async () => {
    mockPrisma.patientOrganisation.findFirst.mockResolvedValue({
      patient: { id: "p-1", name: "Biscuit" },
    });
    const patient = await DeveloperDataService.getPatient("org-1", "p-1");
    const select =
      mockPrisma.patientOrganisation.findFirst.mock.calls[0][0].select;
    expect(select.patient.select).toEqual(
      expect.objectContaining({
        speciesCode: true,
        breedCode: true,
        currentWeight: true,
        colour: true,
        allergy: true,
        isNeutered: true,
        passportNumber: true,
      }),
    );
    // insurance JSON and medical records are not part of the contract surface
    expect(select.patient.select.insurance).toBeUndefined();
    expect(select.patient.select.medicalRecords).toBeUndefined();
    expect(patient).toEqual({ id: "p-1", name: "Biscuit" });
  });
});

describe("DeveloperDataService.listEncounters", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pushes status, patientId, caseId, and periodStart range into where", async () => {
    mockPrisma.encounter.findMany.mockResolvedValue([]);
    await DeveloperDataService.listEncounters({
      organisationId: "org-1",
      limit: 50,
      status: "in-progress",
      patientId: "p-1",
      caseId: "c-1",
      dateFrom: "2026-06-01T00:00:00+00:00",
    });
    const arg = mockPrisma.encounter.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      organisationId: "org-1",
      status: "in-progress",
      patientId: "p-1",
      caseId: "c-1",
      periodStart: { gte: new Date("2026-06-01T00:00:00+00:00") },
    });
    expect(arg.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("selects the contract encounter fields", async () => {
    mockPrisma.encounter.findMany.mockResolvedValue([]);
    await DeveloperDataService.listEncounters({
      organisationId: "org-1",
      limit: 50,
    });
    const select = mockPrisma.encounter.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      [
        "id",
        "caseId",
        "organisationId",
        "patientId",
        "parentId",
        "status",
        "encounterClass",
        "appointmentKind",
        "title",
        "reason",
        "periodStart",
        "periodEnd",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });

  it("merges the keyset continuation with the caller's filters", async () => {
    mockPrisma.encounter.findMany.mockResolvedValue([]);
    await DeveloperDataService.listEncounters({
      organisationId: "org-1",
      limit: 50,
      patientId: "p-1",
      cursor: cursorFor("e-5"),
    });
    const arg = mockPrisma.encounter.findMany.mock.calls[0][0];
    expect(arg.where.organisationId).toBe("org-1");
    expect(arg.where.patientId).toBe("p-1");
    expect(arg.where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: when } },
          { createdAt: when, id: { lt: "e-5" } },
        ],
      },
    ]);
  });

  it("returns the page envelope", async () => {
    mockPrisma.encounter.findMany.mockResolvedValue(rows(1));
    const page = await DeveloperDataService.listEncounters({
      organisationId: "org-1",
      limit: 50,
    });
    expect(page.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      limit: 50,
    });
  });
});

describe("DeveloperDataService.getEncounter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes the lookup to the org and returns null for cross-org rows", async () => {
    mockPrisma.encounter.findFirst.mockResolvedValue(null);
    await expect(
      DeveloperDataService.getEncounter("org-1", "e-1"),
    ).resolves.toBeNull();
    expect(mockPrisma.encounter.findFirst.mock.calls[0][0].where).toEqual({
      id: "e-1",
      organisationId: "org-1",
    });
  });

  it("returns the encounter when it belongs to the org", async () => {
    mockPrisma.encounter.findFirst.mockResolvedValue({ id: "e-1" });
    await expect(
      DeveloperDataService.getEncounter("org-1", "e-1"),
    ).resolves.toEqual({ id: "e-1" });
  });
});

describe("DeveloperDataService.listInvoices", () => {
  beforeEach(() => jest.clearAllMocks());

  it("filters by org (excluding null-org rows), status, ids, and createdAt range", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    await DeveloperDataService.listInvoices({
      organisationId: "org-1",
      limit: 50,
      status: "PAID",
      patientId: "p-1",
      appointmentId: "a-1",
      dateTo: "2026-07-01T00:00:00+00:00",
    });
    const arg = mockPrisma.invoice.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      organisationId: "org-1",
      status: "PAID",
      patientId: "p-1",
      appointmentId: "a-1",
      createdAt: { lte: new Date("2026-07-01T00:00:00+00:00") },
    });
  });

  it("never selects metadata on the list", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    await DeveloperDataService.listInvoices({
      organisationId: "org-1",
      limit: 50,
    });
    const select = mockPrisma.invoice.findMany.mock.calls[0][0].select;
    expect(select.metadata).toBeUndefined();
    expect(select.items).toBeUndefined();
    expect(select).toEqual(
      expect.objectContaining({
        subtotal: true,
        totalAmount: true,
        currency: true,
        visitBillingStage: true,
      }),
    );
  });

  it("continues with a keyset WHERE and returns the page envelope", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue(rows(3));
    const page = await DeveloperDataService.listInvoices({
      organisationId: "org-1",
      limit: 2,
      cursor: cursorFor("i-2"),
    });
    const arg = mockPrisma.invoice.findMany.mock.calls[0][0];
    expect(arg.cursor).toBeUndefined();
    expect(arg.skip).toBeUndefined();
    expect(arg.where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: when } },
          { createdAt: when, id: { lt: "i-2" } },
        ],
      },
    ]);
    expect(page.items).toHaveLength(2);
    expect(page.pagination.hasMore).toBe(true);
  });
});

describe("DeveloperDataService.getInvoice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns detail fields including line items but never metadata", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ id: "i-1" });
    const row = await DeveloperDataService.getInvoice("org-1", "i-1");
    const arg = mockPrisma.invoice.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "i-1", organisationId: "org-1" });
    expect(arg.select).toEqual(
      expect.objectContaining({
        items: true,
        invoiceDiscountType: true,
        invoiceDiscountValue: true,
        invoiceDiscountTotal: true,
        taxPercent: true,
        depositTargetAmount: true,
        depositCollectedAmount: true,
        paymentCollectionMethod: true,
        billingCollectionMode: true,
      }),
    );
    expect(arg.select.metadata).toBeUndefined();
    expect(arg.select.payments).toBeUndefined();
    expect(arg.select.paymentAttempts).toBeUndefined();
    expect(row).toEqual({ id: "i-1" });
  });

  it("returns null for a cross-org invoice", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    await expect(
      DeveloperDataService.getInvoice("org-1", "i-9"),
    ).resolves.toBeNull();
  });
});

describe("DeveloperDataService.getOrganization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the key's own org with the address sub-select", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      name: "Clinic",
      address: { city: "Berlin" },
    });
    const org = await DeveloperDataService.getOrganization("org-1");
    const arg = mockPrisma.organization.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "org-1" });
    expect(arg.select.address.select).toEqual({
      addressLine: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      latitude: true,
      longitude: true,
    });
    expect(org).toEqual({
      id: "org-1",
      name: "Clinic",
      address: { city: "Berlin" },
    });
  });

  it("never selects credentials or operational identifiers", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
    await DeveloperDataService.getOrganization("org-1");
    const select = mockPrisma.organization.findUnique.mock.calls[0][0].select;
    for (const forbidden of [
      "documensoApiKey",
      "documensoTeamId",
      "stripeAccountId",
      "googlePlacesId",
      "taxId",
      "dunsNumber",
      "healthAndSafetyCertNo",
      "animalWelfareComplianceCertNo",
      "fireAndEmergencyCertNo",
    ]) {
      expect(select[forbidden]).toBeUndefined();
    }
  });

  it("returns null when the org row is gone", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    await expect(
      DeveloperDataService.getOrganization("org-1"),
    ).resolves.toBeNull();
  });
});
