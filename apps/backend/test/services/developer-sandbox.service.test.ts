import {
  DeveloperSandboxService,
  DeveloperSandboxServiceError,
} from "../../src/services/developer-sandbox.service";
import { prisma } from "../../src/config/prisma";
import logger from "../../src/utils/logger";

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
      developerSandbox: { findUnique: jest.fn(), findFirst: jest.fn() },
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

jest.mock("src/utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const mockLogger = logger as unknown as { warn: jest.Mock };

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
    // Default: the caller org is not itself a sandbox org.
    mockPrisma.developerSandbox.findFirst.mockResolvedValue(null);
  });

  it("rejects creation when the caller org is itself a sandbox org (no nesting)", async () => {
    mockPrisma.developerSandbox.findFirst.mockResolvedValue({ id: "sbx-0" });

    await expect(
      DeveloperSandboxService.create({ organisationId: "sandbox-org" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "sandbox_org_not_eligible",
    });
    expect(mockPrisma.developerSandbox.findFirst).toHaveBeenCalledWith({
      where: { sandboxOrganisationId: "sandbox-org" },
      select: { id: true },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.organization.create).not.toHaveBeenCalled();
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
    // The linkage row is created last, inside the transaction, and records
    // the seeded patient ids so teardown deletes exactly those.
    expect(tx.developerSandbox.create).toHaveBeenCalledWith({
      data: {
        organisationId: "dev-org",
        sandboxOrganisationId: "sandbox-org",
        seededPatientIds: [
          "patient-0",
          "patient-1",
          "patient-2",
          "patient-3",
          "patient-4",
        ],
      },
    });
    expect(result.sandbox.testKeyHint).toContain("/v1/developers/api-keys");
  });

  it("answers idempotently when a concurrent POST wins the unique-org race", async () => {
    mockPrisma.developerSandbox.findUnique
      .mockResolvedValueOnce(null) // pre-transaction existence check
      .mockResolvedValueOnce({
        id: "sbx-raced",
        organisationId: "dev-org",
        sandboxOrganisationId: "sandbox-org-raced",
        createdAt: new Date("2026-07-07T00:00:00.000Z"),
      }); // re-read after the unique violation
    mockPrisma.organization.findUnique.mockResolvedValue({ name: "Acme Dev" });
    primeSeedCreates();
    mockPrisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    const result = await DeveloperSandboxService.create({
      organisationId: "dev-org",
    });

    expect(result.created).toBe(false);
    expect(result.sandbox.sandboxOrganisationId).toBe("sandbox-org-raced");
  });

  it("rethrows non-unique transaction failures", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ name: "Acme Dev" });
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("db down"));

    await expect(
      DeveloperSandboxService.create({ organisationId: "dev-org" }),
    ).rejects.toThrow("db down");
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
    // Remaining-links check after the sandbox org's links are deleted:
    // default is "no seeded patient is linked anywhere else".
    tx.patientOrganisation.findMany.mockResolvedValue([]);
  });

  const sandboxRecord = {
    id: "sbx-1",
    organisationId: "dev-org",
    sandboxOrganisationId: "sandbox-org",
    seededPatientIds: ["patient-0", "patient-1"],
    createdAt: new Date(),
  };

  it("404s when there is nothing to tear down", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(null);
    await expect(
      DeveloperSandboxService.teardown("dev-org"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes seeded rows children-first and the DeveloperSandbox row last", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(sandboxRecord);
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
    // Only the recorded seeded patients are candidates for deletion.
    expect(tx.patientOrganisation.findMany).toHaveBeenCalledWith({
      where: { patientId: { in: ["patient-0", "patient-1"] } },
      select: { patientId: true },
    });
    expect(tx.developerApiKey.updateMany).toHaveBeenCalledWith({
      where: { organisationId: "sandbox-org", status: "active" },
      data: { status: "revoked", revokedAt: expect.any(Date) },
    });
    expect(tx.developerSandbox.delete).toHaveBeenCalledWith({
      where: { id: "sbx-1" },
    });
  });

  it("skips the patient delete when no seeded patient ids were recorded", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue({
      ...sandboxRecord,
      seededPatientIds: [],
    });

    await DeveloperSandboxService.teardown("dev-org");

    expect(tx.patientOrganisation.findMany).not.toHaveBeenCalled();
    expect(tx.patient.deleteMany).not.toHaveBeenCalled();
    expect(tx.developerSandbox.delete).toHaveBeenCalled();
  });

  it("leaves a seeded patient still linked to another org and logs it instead of failing", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(sandboxRecord);
    // patient-1 gained a PatientOrganisation link outside the sandbox org.
    tx.patientOrganisation.findMany.mockResolvedValue([
      { patientId: "patient-1" },
    ]);

    await DeveloperSandboxService.teardown("dev-org");

    expect(tx.patient.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["patient-0"] } },
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Sandbox teardown skipped seeded patients still linked elsewhere",
      expect.objectContaining({ skippedPatientIds: ["patient-1"] }),
    );
    // The rest of the teardown still completes, sandbox row last.
    expect(tx.organization.delete).toHaveBeenCalledWith({
      where: { id: "sandbox-org" },
    });
    expect(tx.developerSandbox.delete).toHaveBeenCalledWith({
      where: { id: "sbx-1" },
    });
  });

  it("skips the patient delete entirely when every seeded patient is still linked elsewhere", async () => {
    mockPrisma.developerSandbox.findUnique.mockResolvedValue(sandboxRecord);
    tx.patientOrganisation.findMany.mockResolvedValue([
      { patientId: "patient-0" },
      { patientId: "patient-1" },
    ]);

    await DeveloperSandboxService.teardown("dev-org");

    expect(tx.patient.deleteMany).not.toHaveBeenCalled();
    expect(tx.developerSandbox.delete).toHaveBeenCalled();
  });
});
