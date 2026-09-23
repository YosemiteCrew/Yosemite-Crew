import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
  STALE_CLINICAL_ARTIFACT_MESSAGE,
} from "../../src/services/clinical-artifact.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    clinicalArtifact: {
      update: jest.fn(),
    },
    soapNote: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dischargeSummary: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    renderedDocument: {
      findUnique: jest.fn(),
    },
    appointment: {
      updateMany: jest.fn(),
    },
  },
}));

/**
 * #3144: every mutable clinical write claims the artifact at the generation the
 * caller read. These tests assert the WHERE the service builds, because prisma
 * is mocked here - nothing else in this suite can tell a conditional write from
 * an unconditional one, and an unconditional one is the whole defect.
 */
describe("ClinicalArtifact optimistic concurrency", () => {
  const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    clinicalArtifact: { update: jest.Mock };
    soapNote: { findUnique: jest.Mock; update: jest.Mock };
    dischargeSummary: { findUnique: jest.Mock; update: jest.Mock };
    renderedDocument: { findUnique: jest.Mock };
    appointment: { updateMany: jest.Mock };
  };

  const organisationId = "org-1";
  const artifactId = "artifact-1";
  const soapNoteId = "soap-1";
  const dischargeSummaryId = "discharge-1";
  const D1 = new Date("2026-01-01T00:00:00.000Z");

  // The stored generation and the generation a caller claims are deliberately
  // different numbers throughout. Equal ones cannot tell the two readings apart.
  const STORED_VERSION = 5;
  const CALLER_VERSION = 2;

  const artifactRow = (overrides: Record<string, unknown> = {}) => ({
    id: artifactId,
    organisationId,
    appointmentId: null,
    caseId: null,
    encounterId: null,
    kind: "SOAP_NOTE",
    status: "DRAFT",
    templateId: null,
    templateVersion: null,
    templateVersionId: null,
    authorId: null,
    signedBy: null,
    signedAt: null,
    summary: null,
    version: STORED_VERSION,
    createdAt: D1,
    updatedAt: D1,
    ...overrides,
  });

  const soapRow = (artifact: Record<string, unknown> = artifactRow()) => ({
    id: soapNoteId,
    artifactId,
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    diagnoses: null,
    metadata: null,
    createdAt: D1,
    updatedAt: D1,
    artifact,
  });

  const dischargeRow = () => ({
    id: dischargeSummaryId,
    artifactId,
    summaryContent: null,
    diagnoses: null,
    medications: null,
    followUp: null,
    instructions: null,
    metadata: null,
    createdAt: D1,
    updatedAt: D1,
    artifact: artifactRow({ kind: "DISCHARGE_SUMMARY" }),
  });

  const recordNotFound = () =>
    new Prisma.PrismaClientKnownRequestError("No record was found", {
      code: "P2025",
      clientVersion: "6.19.3",
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) =>
      typeof callback === "function" ? callback(prisma) : undefined,
    );
    // No rendered document for this artifact: the post-commit PDF refresh exits
    // before touching the renderer, which this suite is not about.
    mockedPrisma.renderedDocument.findUnique.mockResolvedValue(null);
    mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.clinicalArtifact.update.mockResolvedValue(
      artifactRow({ version: STORED_VERSION + 1 }),
    );
    mockedPrisma.soapNote.update.mockResolvedValue(soapRow());
    mockedPrisma.dischargeSummary.update.mockResolvedValue(dischargeRow());
  });

  const whereOfArtifactUpdate = () =>
    mockedPrisma.clinicalArtifact.update.mock.calls[0][0].where;

  const dataOfArtifactUpdate = () =>
    mockedPrisma.clinicalArtifact.update.mock.calls[0][0].data;

  it("claims the artifact at the version it read and advances it once", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());

    await ClinicalArtifactService.updateSoapNote(
      soapNoteId,
      { summary: "Updated" },
      organisationId,
    );

    expect(whereOfArtifactUpdate()).toEqual({
      id: artifactId,
      organisationId,
      version: STORED_VERSION,
    });
    expect(dataOfArtifactUpdate().version).toEqual({ increment: 1 });
  });

  it("claims the caller's expected version rather than the one it just read", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());

    await ClinicalArtifactService.updateSoapNote(
      soapNoteId,
      { summary: "Updated", expectedVersion: CALLER_VERSION },
      organisationId,
    );

    expect(whereOfArtifactUpdate().version).toBe(CALLER_VERSION);
  });

  it("reports a lost claim as a conflict and writes no clinical content", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());
    mockedPrisma.clinicalArtifact.update.mockRejectedValueOnce(
      recordNotFound(),
    );

    await expect(
      ClinicalArtifactService.updateSoapNote(
        soapNoteId,
        { summary: "Mine", subjective: { chiefComplaint: "Mine" } },
        organisationId,
      ),
    ).rejects.toMatchObject({
      message: STALE_CLINICAL_ARTIFACT_MESSAGE,
      statusCode: 409,
    });

    // The QA oracle for #3144: the loser mutates no subtype row at all.
    expect(mockedPrisma.soapNote.update).not.toHaveBeenCalled();
  });

  it("does not disguise an unrelated database failure as a conflict", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());
    mockedPrisma.clinicalArtifact.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Deadlock", {
        code: "P2034",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      ClinicalArtifactService.updateSoapNote(soapNoteId, {}, organisationId),
    ).rejects.toMatchObject({ code: "P2034" });
  });

  it("refuses to write an artifact that was loaded without its version", async () => {
    const { version: _omitted, ...withoutVersion } = artifactRow();
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(
      soapRow(withoutVersion),
    );

    await expect(
      ClinicalArtifactService.updateSoapNote(soapNoteId, {}, organisationId),
    ).rejects.toBeInstanceOf(ClinicalArtifactServiceError);
    // An `undefined` filter is dropped by prisma, so the write must not happen
    // at all rather than happen unconditionally.
    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("claims the artifact on a lifecycle transition too", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(soapRow());

    await ClinicalArtifactService.finalizeSoapNote(
      soapNoteId,
      organisationId,
      CALLER_VERSION,
    );

    expect(whereOfArtifactUpdate()).toEqual({
      id: artifactId,
      organisationId,
      version: CALLER_VERSION,
    });
    expect(dataOfArtifactUpdate().status).toBe("COMPLETED");
  });

  it("claims a discharge summary the same way, not only SOAP notes", async () => {
    mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(
      dischargeRow(),
    );

    await ClinicalArtifactService.updateDischargeSummary(
      dischargeSummaryId,
      { summary: "Updated" },
      organisationId,
    );

    expect(whereOfArtifactUpdate()).toEqual({
      id: artifactId,
      organisationId,
      version: STORED_VERSION,
    });
    expect(dataOfArtifactUpdate().version).toEqual({ increment: 1 });
  });
});
