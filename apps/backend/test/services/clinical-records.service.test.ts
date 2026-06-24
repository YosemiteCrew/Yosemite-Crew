import { prisma } from "src/config/prisma";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "../../src/services/clinical-artifact.service";

jest.mock("../../src/services/rendered-document.service", () => ({
  createRenderedDocumentRecord: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    clinicalArtifact: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    renderedDocument: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prescription: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    dischargeSummary: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    vitalRecord: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    appointment: {
      updateMany: jest.fn(),
    },
  },
}));

describe("ClinicalArtifactService clinical records", () => {
  const organisationId = "org-1";
  const appointmentId = "appt-1";
  const encounterId = "enc-1";
  const artifactId = "artifact-1";
  const now = new Date("2026-01-01T00:00:00.000Z");

  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    clinicalArtifact: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    renderedDocument: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    prescription: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    dischargeSummary: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    vitalRecord: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
    };
    appointment: {
      updateMany: jest.Mock;
    };
  };

  const buildArtifact = (
    kind: "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "VITAL_RECORD",
    overrides: Record<string, unknown> = {},
  ) => ({
    id: artifactId,
    organisationId,
    appointmentId,
    caseId: null,
    encounterId,
    kind,
    status: "DRAFT",
    templateId: null,
    templateVersion: null,
    templateVersionId: null,
    authorId: null,
    signedBy: null,
    signedAt: null,
    summary: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      userId: "nurse-1",
      firstName: "Nina",
      lastName: "Nurse",
      displayName: "Nina Nurse",
    });
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return undefined;
    });
  });

  it("creates, gets, updates and lists prescriptions", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
      buildArtifact("PRESCRIPTION"),
    );
    mockedPrisma.prescription.create.mockResolvedValueOnce({
      id: "rx-1",
      artifactId,
      medications: [{ name: "Amoxicillin", dose: "250mg" }],
      instructions: { timing: "BID" },
      notes: { note: "after food" },
      metadata: { source: "template" },
      createdAt: now,
      updatedAt: now,
    });

    const created = await ClinicalArtifactService.createPrescription({
      organisationId,
      appointmentId,
      encounterId,
      status: "DRAFT",
      medications: [{ name: "Amoxicillin", dose: "250mg" }],
      instructions: { timing: "BID" },
      notes: { note: "after food" },
      metadata: { source: "template" },
    });

    expect(created.prescription.id).toBe("rx-1");

    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      artifactId,
      medications: [{ name: "Amoxicillin", dose: "250mg" }],
      instructions: { timing: "BID" },
      notes: { note: "after food" },
      metadata: { source: "template" },
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("PRESCRIPTION"),
    });

    const fetched = await ClinicalArtifactService.getPrescription("rx-1");
    expect(fetched.artifact.kind).toBe("PRESCRIPTION");

    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      artifactId,
      medications: [{ name: "Amoxicillin", dose: "250mg" }],
      instructions: { timing: "BID" },
      notes: { note: "after food" },
      metadata: { source: "template" },
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("PRESCRIPTION"),
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
      buildArtifact("PRESCRIPTION", { status: "IN_PROGRESS" }),
    );
    mockedPrisma.prescription.update.mockResolvedValueOnce({
      id: "rx-1",
      artifactId,
      medications: [{ name: "Amoxicillin", dose: "500mg" }],
      instructions: { timing: "BID" },
      notes: { note: "after food" },
      metadata: { source: "template" },
      createdAt: now,
      updatedAt: now,
    });

    const updated = await ClinicalArtifactService.updatePrescription(
      "rx-1",
      { medications: [{ name: "Amoxicillin", dose: "500mg" }] },
      organisationId,
    );

    expect(updated.artifact.status).toBe("IN_PROGRESS");

    mockedPrisma.prescription.findMany.mockResolvedValueOnce([
      {
        id: "rx-1",
        artifactId,
        medications: [{ name: "Amoxicillin", dose: "500mg" }],
        instructions: { timing: "BID" },
        notes: { note: "after food" },
        metadata: { source: "template" },
        createdAt: now,
        updatedAt: now,
        artifact: buildArtifact("PRESCRIPTION"),
      },
    ]);

    const list = await ClinicalArtifactService.listPrescriptionsForEncounter(
      organisationId,
      encounterId,
    );

    expect(list).toHaveLength(1);
  });

  it("rejects prescription updates for the wrong organisation", async () => {
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      artifactId,
      medications: [],
      instructions: null,
      notes: null,
      metadata: null,
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("PRESCRIPTION", { organisationId: "other-org" }),
    });

    await expect(
      ClinicalArtifactService.updatePrescription(
        "rx-1",
        { summary: "Nope" },
        organisationId,
      ),
    ).rejects.toBeInstanceOf(ClinicalArtifactServiceError);
  });

  it("creates, gets, updates and lists discharge summaries", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
      buildArtifact("DISCHARGE_SUMMARY"),
    );
    mockedPrisma.dischargeSummary.create.mockResolvedValueOnce({
      id: "ds-1",
      artifactId,
      summary: { text: "Recovered well" },
      diagnoses: [{ code: "A1" }],
      medications: [{ name: "Supportive care" }],
      followUp: { afterDays: 7 },
      instructions: { text: "Rest" },
      metadata: { template: "discharge" },
      createdAt: now,
      updatedAt: now,
    });

    const created = await ClinicalArtifactService.createDischargeSummary({
      organisationId,
      appointmentId,
      encounterId,
      summaryContent: { text: "Recovered well" },
      diagnoses: [{ code: "A1" }],
      medications: [{ name: "Supportive care" }],
      followUp: { afterDays: 7 },
      instructions: { text: "Rest" },
      metadata: { template: "discharge" },
    });

    expect(created.dischargeSummary.id).toBe("ds-1");

    mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
      id: "ds-1",
      artifactId,
      summary: { text: "Recovered well" },
      diagnoses: [{ code: "A1" }],
      medications: [{ name: "Supportive care" }],
      followUp: { afterDays: 7 },
      instructions: { text: "Rest" },
      metadata: { template: "discharge" },
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("DISCHARGE_SUMMARY"),
    });

    const fetched = await ClinicalArtifactService.getDischargeSummary("ds-1");
    expect(fetched.artifact.kind).toBe("DISCHARGE_SUMMARY");

    mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
      id: "ds-1",
      artifactId,
      summary: { text: "Recovered well" },
      diagnoses: [{ code: "A1" }],
      medications: [{ name: "Supportive care" }],
      followUp: { afterDays: 7 },
      instructions: { text: "Rest" },
      metadata: { template: "discharge" },
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("DISCHARGE_SUMMARY"),
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
      buildArtifact("DISCHARGE_SUMMARY", { status: "SIGNED" }),
    );
    mockedPrisma.dischargeSummary.update.mockResolvedValueOnce({
      id: "ds-1",
      artifactId,
      summary: { text: "Recovered well" },
      diagnoses: [{ code: "A1" }],
      medications: [{ name: "Updated care" }],
      followUp: { afterDays: 14 },
      instructions: { text: "Rest" },
      metadata: { template: "discharge" },
      createdAt: now,
      updatedAt: now,
    });

    const updated = await ClinicalArtifactService.updateDischargeSummary(
      "ds-1",
      { medications: [{ name: "Updated care" }], followUp: { afterDays: 14 } },
      organisationId,
    );

    expect(updated.artifact.status).toBe("SIGNED");

    mockedPrisma.dischargeSummary.findMany.mockResolvedValueOnce([
      {
        id: "ds-1",
        artifactId,
        summary: { text: "Recovered well" },
        diagnoses: [{ code: "A1" }],
        medications: [{ name: "Updated care" }],
        followUp: { afterDays: 14 },
        instructions: { text: "Rest" },
        metadata: { template: "discharge" },
        createdAt: now,
        updatedAt: now,
        artifact: buildArtifact("DISCHARGE_SUMMARY"),
      },
    ]);

    const list =
      await ClinicalArtifactService.listDischargeSummariesForAppointment(
        organisationId,
        appointmentId,
      );
    expect(list).toHaveLength(1);
  });

  it("creates, gets, updates and lists vital records", async () => {
    mockedPrisma.clinicalArtifact.create.mockResolvedValueOnce(
      buildArtifact("VITAL_RECORD"),
    );
    mockedPrisma.vitalRecord.create.mockResolvedValueOnce({
      id: "vr-1",
      artifactId,
      measuredAt: now,
      recordedBy: "nurse-1",
      vitals: {
        temperature: 39.1,
        heartRate: 128,
      },
      notes: { text: "Stable" },
      metadata: { unit: "clinic-1" },
      createdAt: now,
      updatedAt: now,
    });

    const created = await ClinicalArtifactService.createVitalRecord({
      organisationId,
      appointmentId,
      encounterId,
      measuredAt: now,
      recordedBy: "nurse-1",
      vitals: {
        temperature: 39.1,
        heartRate: 128,
      },
      notes: { text: "Stable" },
      metadata: { unit: "clinic-1" },
    });

    expect(created.vitalRecord.id).toBe("vr-1");

    mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
      id: "vr-1",
      artifactId,
      measuredAt: now,
      recordedBy: "nurse-1",
      vitals: {
        temperature: 39.1,
        heartRate: 128,
      },
      notes: { text: "Stable" },
      metadata: { unit: "clinic-1" },
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("VITAL_RECORD"),
    });

    const fetched = await ClinicalArtifactService.getVitalRecord("vr-1");
    expect(fetched.artifact.kind).toBe("VITAL_RECORD");

    mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
      id: "vr-1",
      artifactId,
      measuredAt: now,
      recordedBy: "nurse-1",
      vitals: {
        temperature: 39.1,
        heartRate: 128,
      },
      notes: { text: "Stable" },
      metadata: { unit: "clinic-1" },
      createdAt: now,
      updatedAt: now,
      artifact: buildArtifact("VITAL_RECORD"),
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce(
      buildArtifact("VITAL_RECORD", { status: "IN_PROGRESS" }),
    );
    mockedPrisma.vitalRecord.update.mockResolvedValueOnce({
      id: "vr-1",
      artifactId,
      measuredAt: new Date("2026-01-02T00:00:00.000Z"),
      recordedBy: "nurse-2",
      vitals: {
        temperature: 38.5,
        heartRate: 110,
      },
      notes: { text: "Improving" },
      metadata: { unit: "clinic-1" },
      createdAt: now,
      updatedAt: now,
    });

    const updated = await ClinicalArtifactService.updateVitalRecord(
      "vr-1",
      {
        measuredAt: new Date("2026-01-02T00:00:00.000Z"),
        recordedBy: "nurse-2",
        vitals: {
          temperature: 38.5,
          heartRate: 110,
        },
        notes: { text: "Improving" },
      },
      organisationId,
    );

    expect(updated.artifact.status).toBe("IN_PROGRESS");

    mockedPrisma.vitalRecord.findMany.mockResolvedValueOnce([
      {
        id: "vr-1",
        artifactId,
        measuredAt: new Date("2026-01-02T00:00:00.000Z"),
        recordedBy: "nurse-2",
        vitals: {
          temperature: 38.5,
          heartRate: 110,
        },
        notes: { text: "Improving" },
        metadata: { unit: "clinic-1" },
        createdAt: now,
        updatedAt: now,
        artifact: buildArtifact("VITAL_RECORD"),
      },
    ]);

    const list = await ClinicalArtifactService.listVitalRecordsForEncounter(
      organisationId,
      encounterId,
    );
    expect(list).toHaveLength(1);
  });
});
