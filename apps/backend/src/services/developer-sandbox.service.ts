import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { emitDeveloperEvent } from "src/utils/developer-events";
import logger from "src/utils/logger";

// Developer sandbox: one seeded demo clinic per developer organisation
// (POST/GET/DELETE /v1/developers/sandbox, management plane). The sandbox is a
// real Organization row so the data plane serves it unchanged; the
// DeveloperSandbox row records ownership and makes creation idempotent.
// Developer API keys are scoped to the DEVELOPER org, so reading the seeded
// data requires a key issued FOR the sandbox org - see the sandbox-target
// validation in DeveloperApiKeyService.issue.

export class DeveloperSandboxServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DeveloperSandboxServiceError";
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2002";

// The interactive-transaction client: everything seeding/teardown touches.
type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const MAX_ORG_NAME_LENGTH = 80;
const DEMO_TAX_ID = "DEMO-000";

// Deterministic seed fixtures - no faker, stable content on every run.
const PATIENT_SEED = [
  {
    name: "Bella",
    type: "dog",
    breed: "Labrador Retriever",
    gender: "female",
    dateOfBirth: new Date("2021-03-14T00:00:00.000Z"),
  },
  {
    name: "Max",
    type: "dog",
    breed: "German Shepherd",
    gender: "male",
    dateOfBirth: new Date("2019-07-02T00:00:00.000Z"),
  },
  {
    name: "Whiskers",
    type: "cat",
    breed: "Maine Coon",
    gender: "male",
    dateOfBirth: new Date("2020-11-23T00:00:00.000Z"),
  },
  {
    name: "Luna",
    type: "cat",
    breed: "Siamese",
    gender: "female",
    dateOfBirth: new Date("2022-01-08T00:00:00.000Z"),
  },
  {
    name: "Storm",
    type: "horse",
    breed: "Arabian",
    gender: "unknown",
    dateOfBirth: new Date("2018-05-30T00:00:00.000Z"),
  },
] as const;

// 8 appointments spread across past and future, statuses matching where they
// sit relative to now (past ones are terminal, future ones are open).
const APPOINTMENT_SEED = [
  { dayOffset: -21, status: "COMPLETED", concern: "Annual wellness exam" },
  { dayOffset: -14, status: "COMPLETED", concern: "Vaccination booster" },
  { dayOffset: -7, status: "CANCELLED", concern: "Dental cleaning" },
  { dayOffset: -3, status: "NO_SHOW", concern: "Skin irritation follow-up" },
  { dayOffset: 0, status: "IN_PROGRESS", concern: "Limping on front left leg" },
  { dayOffset: 1, status: "UPCOMING", concern: "Post-surgery checkup" },
  { dayOffset: 3, status: "REQUESTED", concern: "Loss of appetite" },
  { dayOffset: 7, status: "UPCOMING", concern: "Microchip implantation" },
] as const;

const CASE_SEED = [
  {
    status: "active",
    title: "Lameness workup",
    encounterStatus: "in-progress",
    encounterClass: "AMB",
    reason: "Limping on front left leg",
  },
  {
    status: "finished",
    title: "Routine dental care",
    encounterStatus: "finished",
    encounterClass: "AMB",
    reason: "Dental cleaning and polish",
  },
  {
    status: "planned",
    title: "Colic observation",
    encounterStatus: "planned",
    encounterClass: "OBSENC",
    reason: "Intermittent colic signs",
  },
] as const;

type SeedInvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

const INVOICE_SEED: ReadonlyArray<{
  status: "PAID" | "PENDING" | "AWAITING_PAYMENT" | "REFUNDED";
  items: SeedInvoiceItem[];
}> = [
  {
    status: "PAID",
    items: [
      { name: "Consultation", quantity: 1, unitPrice: 65, total: 65 },
      { name: "Rabies vaccine", quantity: 1, unitPrice: 32.5, total: 32.5 },
    ],
  },
  {
    status: "PENDING",
    items: [
      { name: "Dental cleaning", quantity: 1, unitPrice: 180, total: 180 },
      { name: "Anaesthesia", quantity: 1, unitPrice: 95, total: 95 },
    ],
  },
  {
    status: "AWAITING_PAYMENT",
    items: [
      { name: "X-ray (2 views)", quantity: 2, unitPrice: 55, total: 110 },
      { name: "Pain medication", quantity: 1, unitPrice: 24, total: 24 },
    ],
  },
  {
    status: "REFUNDED",
    items: [
      { name: "Grooming package", quantity: 1, unitPrice: 48, total: 48 },
    ],
  },
];

const sandboxOrgName = (developerOrgName: string): string => {
  const name = `Demo Clinic - ${developerOrgName}`;
  return name.length > MAX_ORG_NAME_LENGTH
    ? name.slice(0, MAX_ORG_NAME_LENGTH)
    : name;
};

const atHour = (base: Date, dayOffset: number, hour: number, minute = 0) => {
  const when = new Date(base);
  when.setUTCDate(when.getUTCDate() + dayOffset);
  when.setUTCHours(hour, minute, 0, 0);
  return when;
};

const timeSlotLabel = (start: Date) =>
  `${String(start.getUTCHours()).padStart(2, "0")}:${String(
    start.getUTCMinutes(),
  ).padStart(2, "0")}`;

export type SandboxStatus = {
  sandboxOrganisationId: string;
  createdAt: Date;
  counts: {
    patients: number;
    appointments: number;
    cases: number;
    encounters: number;
    invoices: number;
  };
  // How to get an API key that can read the seeded data.
  testKeyHint: string;
};

const TEST_KEY_HINT =
  "Developer API keys are scoped to your developer organisation, not the sandbox. " +
  "To query the seeded data, issue a sandbox-scoped test key: " +
  'POST /v1/developers/api-keys with body { "name": "sandbox", "environment": "test", ' +
  '"organisationId": "<sandboxOrganisationId>" }.';

const seedCounts = async (tx: Tx, sandboxOrganisationId: string) => {
  const [patients, appointments, cases, encounters, invoices] =
    await Promise.all([
      tx.patientOrganisation.count({
        where: { organisationId: sandboxOrganisationId },
      }),
      tx.appointment.count({
        where: { organisationId: sandboxOrganisationId },
      }),
      tx.case.count({ where: { organisationId: sandboxOrganisationId } }),
      tx.encounter.count({ where: { organisationId: sandboxOrganisationId } }),
      tx.invoice.count({ where: { organisationId: sandboxOrganisationId } }),
    ]);
  return { patients, appointments, cases, encounters, invoices };
};

type SeedResult = {
  sandboxOrganisationId: string;
  // Recorded on the DeveloperSandbox row so teardown deletes exactly the
  // patients this seed created - never "whatever is linked to the org".
  seededPatientIds: string[];
};

const seedSandboxData = async (
  tx: Tx,
  input: { developerOrgName: string; userId?: string },
): Promise<SeedResult> => {
  // The minimal org set the real signup flow creates (OrganizationService
  // .upsert): Organization + address + billing + usage counter, plus the
  // caller's OWNER mapping and DRAFT profile so the clinic is visible in the
  // portal too.
  const organisation = await tx.organization.create({
    data: {
      name: sandboxOrgName(input.developerOrgName),
      taxId: DEMO_TAX_ID,
      type: "HOSPITAL",
      phoneNo: "+1-555-0100",
      email: "demo-clinic@example.com",
      isVerified: false,
      isActive: true,
    },
  });
  await tx.organizationAddress.create({
    data: {
      organizationId: organisation.id,
      addressLine: "1 Demo Street",
      city: "Yosemite",
      state: "CA",
      postalCode: "95389",
      country: "US",
    },
  });
  await tx.organizationBilling.create({ data: { orgId: organisation.id } });
  await tx.organizationUsageCounter.create({
    data: { orgId: organisation.id },
  });
  if (input.userId) {
    await tx.userOrganization.create({
      data: {
        practitionerReference: input.userId,
        organizationReference: organisation.id,
        roleCode: "OWNER",
        active: true,
      },
    });
    await tx.userProfile.create({
      data: {
        userId: input.userId,
        organizationId: organisation.id,
        personalDetails: {} as Prisma.InputJsonValue,
        professionalDetails: {} as Prisma.InputJsonValue,
        status: "DRAFT",
      },
    });
  }

  const patients = [];
  for (const seed of PATIENT_SEED) {
    const patient = await tx.patient.create({
      data: {
        name: seed.name,
        type: seed.type,
        breed: seed.breed,
        gender: seed.gender,
        dateOfBirth: seed.dateOfBirth,
        status: "active",
        isInsured: false,
      },
    });
    await tx.patientOrganisation.create({
      data: {
        patientId: patient.id,
        organisationId: organisation.id,
        organisationType: "HOSPITAL",
        role: "ORGANISATION",
        status: "ACTIVE",
        organisationName: organisation.name,
      },
    });
    patients.push(patient);
  }

  // Denormalised participants embedded in the appointment JSON snapshots,
  // shaped exactly like the booking flow writes them (types Appointment
  // .patient / .lead / .appointmentType).
  const demoParent = { id: randomUUID(), name: "Jamie Demo" };
  const demoLead = { id: randomUUID(), name: "Dr. Ada Demo" };
  const demoAppointmentType = {
    id: randomUUID(),
    name: "Consultation",
    speciality: { id: randomUUID(), name: "General Practice" },
  };

  const now = new Date();
  for (const [index, seed] of APPOINTMENT_SEED.entries()) {
    const patient = patients[index % patients.length];
    const startTime = atHour(now, seed.dayOffset, 9 + (index % 4), 30);
    const durationMinutes = index % 2 === 0 ? 30 : 45;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    await tx.appointment.create({
      data: {
        organisationId: organisation.id,
        patient: {
          id: patient.id,
          name: patient.name,
          species: patient.type,
          breed: patient.breed,
          parent: demoParent,
        } as Prisma.InputJsonValue,
        lead: demoLead as Prisma.InputJsonValue,
        appointmentType: demoAppointmentType as Prisma.InputJsonValue,
        appointmentDate: atHour(now, seed.dayOffset, 0),
        startTime,
        endTime,
        timeSlot: timeSlotLabel(startTime),
        durationMinutes,
        status: seed.status,
        isEmergency: false,
        concern: seed.concern,
      },
    });
  }

  for (const [index, seed] of CASE_SEED.entries()) {
    const patient = patients[index % patients.length];
    const caseRecord = await tx.case.create({
      data: {
        organisationId: organisation.id,
        patientId: patient.id,
        status: seed.status,
        title: seed.title,
      },
    });
    await tx.encounter.create({
      data: {
        caseId: caseRecord.id,
        organisationId: organisation.id,
        patientId: patient.id,
        status: seed.encounterStatus,
        encounterClass: seed.encounterClass,
        title: seed.title,
        reason: seed.reason,
        periodStart: atHour(now, -7 + index, 10),
        periodEnd:
          seed.encounterStatus === "finished"
            ? atHour(now, -7 + index, 11)
            : null,
      },
    });
  }

  for (const [index, seed] of INVOICE_SEED.entries()) {
    const patient = patients[index % patients.length];
    const subtotal = seed.items.reduce((sum, item) => sum + item.total, 0);
    await tx.invoice.create({
      data: {
        organisationId: organisation.id,
        patientId: patient.id,
        items: seed.items as unknown as Prisma.InputJsonValue,
        subtotal,
        totalAmount: subtotal,
        currency: "USD",
        status: seed.status,
        paidAt: seed.status === "PAID" ? atHour(now, -20, 12) : null,
      },
    });
  }

  return {
    sandboxOrganisationId: organisation.id,
    seededPatientIds: patients.map((patient) => patient.id),
  };
};

export const DeveloperSandboxService = {
  // Idempotent: a second POST returns the existing sandbox untouched.
  async create(input: {
    organisationId: string;
    userId?: string;
  }): Promise<{ sandbox: SandboxStatus; created: boolean }> {
    // A sandbox org can never be the parent of another sandbox. The seed
    // grants the caller OWNER on the sandbox org, so without this check the
    // caller could re-enter with organisationId=<sandboxOrgId> and nest
    // sandboxes unboundedly (and teardown would orphan the nested orgs).
    const parentSandbox = await prisma.developerSandbox.findFirst({
      where: { sandboxOrganisationId: input.organisationId },
      select: { id: true },
    });
    if (parentSandbox) {
      throw new DeveloperSandboxServiceError(
        "A sandbox organisation cannot create its own sandbox",
        409,
        "sandbox_org_not_eligible",
      );
    }

    const existing = await prisma.developerSandbox.findUnique({
      where: { organisationId: input.organisationId },
    });
    if (existing) {
      return {
        created: false,
        sandbox: {
          sandboxOrganisationId: existing.sandboxOrganisationId,
          createdAt: existing.createdAt,
          counts: await seedCounts(prisma, existing.sandboxOrganisationId),
          testKeyHint: TEST_KEY_HINT,
        },
      };
    }

    const developerOrg = await prisma.organization.findUnique({
      where: { id: input.organisationId },
      select: { name: true },
    });
    if (!developerOrg) {
      throw new DeveloperSandboxServiceError(
        "Developer organisation not found",
        404,
      );
    }

    let record;
    try {
      record = await prisma.$transaction(async (tx) => {
        const seeded = await seedSandboxData(tx, {
          developerOrgName: developerOrg.name,
          userId: input.userId,
        });
        // Created last inside the transaction: the linkage row only exists
        // once the whole seed committed. The unique organisationId makes a
        // concurrent second POST fail its insert instead of double-seeding.
        return tx.developerSandbox.create({
          data: {
            organisationId: input.organisationId,
            sandboxOrganisationId: seeded.sandboxOrganisationId,
            seededPatientIds: seeded.seededPatientIds,
          },
        });
      });
    } catch (error) {
      // A concurrent POST won the unique-organisationId race: its seed is the
      // sandbox now, so answer idempotently instead of surfacing a 500.
      if (isUniqueViolation(error)) {
        const raced = await prisma.developerSandbox.findUnique({
          where: { organisationId: input.organisationId },
        });
        if (raced) {
          return {
            created: false,
            sandbox: {
              sandboxOrganisationId: raced.sandboxOrganisationId,
              createdAt: raced.createdAt,
              counts: await seedCounts(prisma, raced.sandboxOrganisationId),
              testKeyHint: TEST_KEY_HINT,
            },
          };
        }
      }
      throw error;
    }

    emitDeveloperEvent("sandbox.created", input.organisationId, {
      sandboxOrganisationId: record.sandboxOrganisationId,
    });

    return {
      created: true,
      sandbox: {
        sandboxOrganisationId: record.sandboxOrganisationId,
        createdAt: record.createdAt,
        counts: await seedCounts(prisma, record.sandboxOrganisationId),
        testKeyHint: TEST_KEY_HINT,
      },
    };
  },

  async get(organisationId: string): Promise<SandboxStatus | null> {
    const record = await prisma.developerSandbox.findUnique({
      where: { organisationId },
    });
    if (!record) {
      return null;
    }
    return {
      sandboxOrganisationId: record.sandboxOrganisationId,
      createdAt: record.createdAt,
      counts: await seedCounts(prisma, record.sandboxOrganisationId),
      testKeyHint: TEST_KEY_HINT,
    };
  },

  // Tears the sandbox down in FK-safe order: children first (invoices,
  // appointments, encounters, cases, patient links, patients), then the org
  // satellites, the org itself, and the DeveloperSandbox row last. Only the
  // patients recorded at seed time are deleted, and a seeded patient that
  // still has PatientOrganisation links elsewhere is skipped (logged, not
  // deleted) so an extra link can never wedge the teardown on an FK error.
  async teardown(organisationId: string): Promise<void> {
    const record = await prisma.developerSandbox.findUnique({
      where: { organisationId },
    });
    if (!record) {
      throw new DeveloperSandboxServiceError("Sandbox not found", 404);
    }
    const sandboxOrgId = record.sandboxOrganisationId;
    const seededPatientIds = record.seededPatientIds;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.deleteMany({
        where: { organisationId: sandboxOrgId },
      });
      await tx.appointment.deleteMany({
        where: { organisationId: sandboxOrgId },
      });
      await tx.encounter.deleteMany({
        where: { organisationId: sandboxOrgId },
      });
      await tx.case.deleteMany({ where: { organisationId: sandboxOrgId } });
      // Every link to the sandbox org goes (seeded or not - the org itself
      // is about to be deleted), but only seeded patients are candidates for
      // deletion below.
      await tx.patientOrganisation.deleteMany({
        where: { organisationId: sandboxOrgId },
      });
      if (seededPatientIds.length > 0) {
        const remainingLinks = await tx.patientOrganisation.findMany({
          where: { patientId: { in: seededPatientIds } },
          select: { patientId: true },
        });
        const stillLinked = new Set(
          remainingLinks.map((link) => link.patientId),
        );
        const deletable = seededPatientIds.filter((id) => !stillLinked.has(id));
        const skipped = seededPatientIds.filter((id) => stillLinked.has(id));
        if (skipped.length > 0) {
          // Partial cleanup, by design: deleting a patient another org still
          // links to would violate the FK and wedge every future teardown.
          logger.warn(
            "Sandbox teardown skipped seeded patients still linked elsewhere",
            { organisationId, sandboxOrgId, skippedPatientIds: skipped },
          );
        }
        if (deletable.length > 0) {
          await tx.patient.deleteMany({ where: { id: { in: deletable } } });
        }
      }
      await tx.userProfile.deleteMany({
        where: { organizationId: sandboxOrgId },
      });
      await tx.userOrganization.deleteMany({
        where: { organizationReference: sandboxOrgId },
      });
      await tx.organizationBilling.deleteMany({
        where: { orgId: sandboxOrgId },
      });
      await tx.organizationUsageCounter.deleteMany({
        where: { orgId: sandboxOrgId },
      });
      // Any keys issued FOR the sandbox org must not outlive it.
      await tx.developerApiKey.updateMany({
        where: { organisationId: sandboxOrgId, status: "active" },
        data: { status: "revoked", revokedAt: new Date() },
      });
      // OrganizationAddress cascades from the org delete.
      await tx.organization.delete({ where: { id: sandboxOrgId } });
      await tx.developerSandbox.delete({ where: { id: record.id } });
    });
    emitDeveloperEvent("sandbox.deleted", organisationId, {
      sandboxOrganisationId: sandboxOrgId,
    });
  },
};
