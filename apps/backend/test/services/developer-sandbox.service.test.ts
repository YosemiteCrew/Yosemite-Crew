import {
  DeveloperSandboxService,
  DeveloperSandboxServiceError,
} from "../../src/services/developer-sandbox.service";
import { prisma } from "../../src/config/prisma";

type DelegateMocks = Record<string, jest.Mock>;

const delegate = (methods: string[]): DelegateMocks =>
  Object.fromEntries(methods.map((method) => [method, jest.fn()]));

jest.mock("../../src/config/prisma", () => {
  const tx = {
    organization: { create: jest.fn(), delete: jest.fn() },
    organizationAddress: { create: jest.fn() },
    organizationBilling: { create: jest.fn(), deleteMany: jest.fn() },
    organizationUsageCounter: { create: jest.fn(), deleteMany: jest.fn() },
    userOrganization: { create: jest.fn(), deleteMany: jest.fn() },
    userProfile: { create: jest.fn(), deleteMany: jest.fn() },
    patient: { create: jest.fn(), deleteMany: jest.fn() },
    patientOrganisation: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: { create: jest.fn(), deleteMany: jest.fn() },
    case: { create: jest.fn(), deleteMany: jest.fn() },
    encounter: { create: jest.fn(), deleteMany: jest.fn() },
    invoice: { create: jest.fn(), deleteMany: jest.fn() },
    developerApiKey: { updateMany: jest.fn() },
    developerSandbox: { create: jest.fn(), delete: jest.fn() },
  };
  return {
    prisma: {
      developerSandbox: { findUnique: jest.fn() },
      organization: { findUnique: jest.fn() },
      patientOrganisation: { count: jest.fn() },
      appointment: { count: jest.fn() },
      case: { count: jest.fn() },
      encounter: { count: jest.fn() },
      invoice: { count: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
      __tx: tx,
    },
  };
});

const mockPrisma = prisma as unknown as {
  developerSandbox: DelegateMocks;
  organization: DelegateMocks;
  patientOrganisation: DelegateMocks;
  appointment: DelegateMocks;
  case: DelegateMocks;
  encounter: DelegateMocks;
  invoice: DelegateMocks;
  $transaction: jest.Mock;
  __tx: Record<string, DelegateMocks>;
};

const tx = mockPrisma.__tx;

const primeCounts = () => {
  mockPrisma.patientOrganisation.count.mockResolvedValue(5);
  mockPrisma.appointment.count.mockResolvedValue(8);
  mockPrisma.case.count.mockResolvedValue(3);
  mockPrisma.encounter.count.mockResolvedValue(3);
  mockPrisma.invoice.count.mockResolvedValue(4);
};

const primeSeedCreates = () => {
  tx.organization.create.mockResolvedValue({
    id: "sandbox-org",
    name: "Demo Clinic - Acme Dev",
  });
  let patientIndex = 0;
  tx.patient.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `patient-${patientIndex++}`,
      ...data,
    }),
  );
  let caseIndex = 0;
  tx.case.create.mockImplementation(async () => ({
    id: `case-${caseIndex++}`,
  }));
  tx.developerSandbox.create.mockResolvedValue({
    id: "sbx-1",
    organisationId: "dev-org",
    sandboxOrganisationId: "sandbox-org",
    createdAt: new Date("2026-07-07T00:00:00.000Z"),
  });
};

describe("DeveloperSandboxService.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeCounts();
  });

  it("is idempotent: an existing sandbox is returned untouched", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue({
      id: "sbx-1",
      organisationId: "dev-org",
      sandboxOrganisationId: "sandbox-org",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });

    const result = await DeveloperSandboxService.create({
      organisationId: "dev-org",
    });

    expect(result.created).toBe(false);
    expect(result.sandbox.sandboxOrganisationId).toBe("sandbox-org");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it("404s when the developer organisation does not exist", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      DeveloperSandboxService.create({ organisationId: "ghost-org" }),
    ).rejects.toBeInstanceOf(DeveloperSandboxServiceError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("seeds the demo clinic with 5 patients, 8 appointments, 3 cases + encounters, 4 invoices", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ name: "Acme Dev" });
    primeSeedCreates();

    const result = await DeveloperSandboxService.create({
      organisationId: "dev-org",
      userId: "user-1",
    });

    expect(result.created).toBe(true);
    expect(tx.patient.create).toHaveBeenCalledTimes(5);
    expect(tx.patientOrganisation.create).toHaveBeenCalledTimes(5);
    expect(tx.appointment.create).toHaveBeenCalledTimes(8);
    expect(tx.case.create).toHaveBeenCalledTimes(3);
    expect(tx.encounter.create).toHaveBeenCalledTimes(3);
    expect(tx.invoice.create).toHaveBeenCalledTimes(4);
    expect(tx.organizationBilling.create).toHaveBeenCalledWith({
      data: { orgId: "sandbox-org" },
    });
    expect(tx.organizationUsageCounter.create).toHaveBeenCalledWith({
      data: { orgId: "sandbox-org" },
    });
    // The linkage row is created last, inside the transaction.
    expect(tx.developerSandbox.create).toHaveBeenCalledWith({
      data: {
        organisationId: "dev-org",
        sandboxOrganisationId: "sandbox-org",
      },
    });
    expect(result.sandbox.testKeyHint).toContain("/v1/developers/api-keys");
  });

  it("creates the demo clinic org with the deterministic identity fields", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ name: "Acme Dev" });
    primeSeedCreates();

    await DeveloperSandboxService.create({ organisationId: "dev-org" });

    expect(tx.organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Demo Clinic - Acme Dev",
        taxId: "DEMO-000",
        type: "HOSPITAL",
      }),
    });
    // No session user: no OWNER mapping and no DRAFT profile.
    expect(tx.userOrganization.create).not.toHaveBeenCalled();
    expect(tx.userProfile.create).not.toHaveBeenCalled();
  });

  it("truncates a long developer org name safely", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: "X".repeat(200),
    });
    primeSeedCreates();

    await DeveloperSandboxService.create({ organisationId: "dev-org" });

    const name = tx.organization.create.mock.calls[0][0].data.name as string;
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.startsWith("Demo Clinic - X")).toBe(true);
  });

  it("shapes each appointment patient snapshot like the booking flow writes it", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ name: "Acme Dev" });
    primeSeedCreates();

    await DeveloperSandboxService.create({ organisationId: "dev-org" });

    for (const [{ data }] of tx.appointment.create.mock.calls) {
      expect(data.patient).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        species: expect.any(String),
        breed: expect.any(String),
        parent: { id: expect.any(String), name: expect.any(String) },
      });
      expect(data.organisationId).toBe("sandbox-org");
      expect(data.timeSlot).toMatch(/^\d{2}:\d{2}$/);
      expect(data.durationMinutes).toBeGreaterThan(0);
    }
    const statuses = tx.appointment.create.mock.calls.map(
      ([{ data }]: [{ data: { status: string } }]) => data.status,
    );
    expect(new Set(statuses).size).toBeGreaterThanOrEqual(5);
  });

  it("links every seeded patient to the sandbox org as ACTIVE", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ name: "Acme Dev" });
    primeSeedCreates();

    await DeveloperSandboxService.create({ organisationId: "dev-org" });

    for (const [{ data }] of tx.patientOrganisation.create.mock.calls) {
      expect(data).toEqual(
        expect.objectContaining({
          organisationId: "sandbox-org",
          organisationType: "HOSPITAL",
          status: "ACTIVE",
        }),
      );
    }
  });
});

describe("DeveloperSandboxService.get", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primeCounts();
  });

  it("returns null when no sandbox exists", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    await expect(DeveloperSandboxService.get("dev-org")).resolves.toBeNull();
  });

  it("reports the sandbox with live row counts", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue({
      id: "sbx-1",
      organisationId: "dev-org",
      sandboxOrganisationId: "sandbox-org",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });

    const status = await DeveloperSandboxService.get("dev-org");

    expect(status).toMatchObject({
      sandboxOrganisationId: "sandbox-org",
      counts: {
        patients: 5,
        appointments: 8,
        cases: 3,
        encounters: 3,
        invoices: 4,
      },
    });
  });
});

describe("DeveloperSandboxService.teardown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tx.patientOrganisation.findMany.mockResolvedValue([
      { patientId: "patient-0" },
      { patientId: "patient-1" },
    ]);
  });

  it("404s when there is nothing to tear down", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    await expect(
      DeveloperSandboxService.teardown("dev-org"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes seeded rows children-first and the DeveloperSandbox row last", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue({
      id: "sbx-1",
      organisationId: "dev-org",
      sandboxOrganisationId: "sandbox-org",
      createdAt: new Date(),
    });
    const order: string[] = [];
    const track = (name: string, mock: jest.Mock) =>
      mock.mockImplementation(async () => {
        order.push(name);
        return { count: 0 };
      });
    track("invoices", tx.invoice.deleteMany);
    track("appointments", tx.appointment.deleteMany);
    track("encounters", tx.encounter.deleteMany);
    track("cases", tx.case.deleteMany);
    track("links", tx.patientOrganisation.deleteMany);
    track("patients", tx.patient.deleteMany);
    track("profiles", tx.userProfile.deleteMany);
    track("memberships", tx.userOrganization.deleteMany);
    track("billing", tx.organizationBilling.deleteMany);
    track("usage", tx.organizationUsageCounter.deleteMany);
    track("keys", tx.developerApiKey.updateMany);
    track("organization", tx.organization.delete);
    track("sandbox", tx.developerSandbox.delete);

    await DeveloperSandboxService.teardown("dev-org");

    expect(order).toEqual([
      "invoices",
      "appointments",
      "encounters",
      "cases",
      "links",
      "patients",
      "profiles",
      "memberships",
      "billing",
      "usage",
      "keys",
      "organization",
      "sandbox",
    ]);
    expect(tx.patient.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["patient-0", "patient-1"] } },
    });
    expect(tx.developerApiKey.updateMany).toHaveBeenCalledWith({
      where: { organisationId: "sandbox-org", status: "active" },
      data: { status: "revoked", revokedAt: expect.any(Date) },
    });
    expect(tx.developerSandbox.delete).toHaveBeenCalledWith({
      where: { id: "sbx-1" },
    });
  });

  it("skips the patient delete when the sandbox has no linked patients", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue({
      id: "sbx-1",
      organisationId: "dev-org",
      sandboxOrganisationId: "sandbox-org",
      createdAt: new Date(),
    });
    tx.patientOrganisation.findMany.mockResolvedValue([]);

    await DeveloperSandboxService.teardown("dev-org");

    expect(tx.patient.deleteMany).not.toHaveBeenCalled();
  });
});
