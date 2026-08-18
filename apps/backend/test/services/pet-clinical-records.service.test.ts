import {
  PetClinicalRecordService,
  PetClinicalRecordError,
  notifyOwnerOfPassportUpdate,
} from "src/services/pet-clinical-records.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { DocumensoService } from "src/services/documenso.service";
import { buildPassportRecordPdf } from "src/services/passport-record-pdf";
import { NotificationService } from "src/services/notification.service";
import { sendEmail } from "src/utils/email";

jest.mock("src/config/prisma", () => ({
  prisma: {
    encounter: { findFirst: jest.fn(), findUnique: jest.fn() },
    clinicalArtifact: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    patient: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));
jest.mock("src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn() },
}));
jest.mock("src/utils/email", () => ({ sendEmail: jest.fn() }));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
  },
}));
jest.mock("src/services/passport-record-pdf", () => ({
  buildPassportRecordPdf: jest.fn(),
}));

const documensoMock = DocumensoService as unknown as {
  resolveOrganisationApiKey: jest.Mock;
  createDocument: jest.Mock;
  distributeDocument: jest.Mock;
};
const buildPdfMock = buildPassportRecordPdf as jest.Mock;

const prismaMock = prisma as unknown as {
  encounter: { findFirst: jest.Mock; findUnique: jest.Mock };
  clinicalArtifact: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  user: { findFirst: jest.Mock };
  patient: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
};
const auditMock = AuditTrailService.recordSafely as jest.Mock;
const sendToUserMock = NotificationService.sendToUser as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

const CTX = {
  patientId: "pat-1",
  organisationId: "org-1",
  encounterId: "enc-1",
  actor: { type: "PMS_USER" as const, id: "vet-1" },
};

const CTX_NULL = { ...CTX, actor: { type: "PMS_USER" as const, id: null } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const echoArtifact = (args: any) => {
  const data = args.data;
  const stamp = {
    id: "child-1",
    createdAt: new Date("2024-04-02T00:00:00.000Z"),
  };
  const attestation = data.attestation?.create
    ? {
        signatoryName: data.attestation.create.signatoryName,
        signatoryLicence: data.attestation.create.signatoryLicence,
      }
    : null;
  return Promise.resolve({
    id: "art-1",
    attestation,
    immunization: data.immunization?.create
      ? { ...stamp, ...data.immunization.create }
      : null,
    parasiteTreatment: data.parasiteTreatment?.create
      ? { ...stamp, ...data.parasiteTreatment.create }
      : null,
    rabiesTitration: data.rabiesTitration?.create
      ? { ...stamp, ...data.rabiesTitration.create }
      : null,
    clinicalExamination: data.clinicalExamination?.create
      ? { ...stamp, ...data.clinicalExamination.create }
      : null,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.encounter.findFirst.mockResolvedValue({ id: "enc-1" });
  // Attest/sign now prove the artifact's encounter belongs to the route's pet.
  prismaMock.encounter.findUnique.mockResolvedValue({ patientId: "pat-1" });
  prismaMock.clinicalArtifact.create.mockImplementation(echoArtifact);
  prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
    id: "art-1",
    status: "DRAFT",
    encounterId: "enc-1",
    kind: "IMMUNIZATION",
    immunization: {
      vaccineName: "Nobivac Rabies",
      vaccineType: "RABIES",
      manufacturer: null,
      batchNumber: "A234B",
      dateAdministered: new Date("2024-04-01T00:00:00.000Z"),
      validUntil: new Date("2027-03-14T00:00:00.000Z"),
    },
    rabiesTitration: null,
    parasiteTreatment: null,
    clinicalExamination: null,
  });
  prismaMock.clinicalArtifact.update.mockResolvedValue({ id: "art-1" });
  prismaMock.user.findFirst.mockResolvedValue({ email: "vet@example.com" });
  prismaMock.patient.findUnique.mockResolvedValue({
    name: "Doggy",
    microchipNumber: "985141000123456",
  });
  // Default: no linked owner, so attest/sign flows skip the update notice
  // unless a test opts in.
  prismaMock.parentPatient.findFirst.mockResolvedValue(null);
  prismaMock.parent.findUnique.mockResolvedValue(null);
  sendToUserMock.mockResolvedValue([]);
  sendEmailMock.mockResolvedValue(undefined);
  documensoMock.resolveOrganisationApiKey.mockResolvedValue("api-key");
  documensoMock.createDocument.mockResolvedValue({ id: 42 });
  documensoMock.distributeDocument.mockResolvedValue({});
  buildPdfMock.mockResolvedValue(Buffer.from("%PDF-1.4"));
});

describe("PetClinicalRecordService.recordImmunization", () => {
  const input = {
    vaccineType: "RABIES" as const,
    vaccineName: "Nobivac Rabies",
    dateAdministered: "2024-04-01T00:00:00.000Z",
    validFrom: "2024-04-22T00:00:00.000Z",
    administeringVetName: "Dr Vet",
    vetLicenseNumber: "RCVS-1",
  };

  it("creates an artifact + immunization + attestation and audits", async () => {
    const dto = await PetClinicalRecordService.recordImmunization(CTX, input);
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "IMMUNIZATION",
          status: "DRAFT",
          encounterId: "enc-1",
        }),
      }),
    );
    expect(dto).toMatchObject({
      patientId: "pat-1",
      vaccineName: "Nobivac Rabies",
      validFrom: "2024-04-22T00:00:00.000Z",
      administeringVetName: "Dr Vet",
      vetLicenseNumber: "RCVS-1",
    });
    expect(dto.nextDueDate).toBeUndefined();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "VACCINATION_RECORDED" }),
    );
  });

  it("handles a null actor id and a full validity window", async () => {
    const dto = await PetClinicalRecordService.recordImmunization(CTX_NULL, {
      ...input,
      validUntil: "2027-03-14T00:00:00.000Z",
      nextDueDate: "2025-04-01T00:00:00.000Z",
    });
    expect(dto.validUntil).toBe("2027-03-14T00:00:00.000Z");
    expect(dto.nextDueDate).toBe("2025-04-01T00:00:00.000Z");
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: null }),
      }),
    );
  });

  it("404s when the encounter is not for the companion", async () => {
    prismaMock.encounter.findFirst.mockResolvedValue(null);
    await expect(
      PetClinicalRecordService.recordImmunization(CTX, input),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.clinicalArtifact.create).not.toHaveBeenCalled();
  });

  it("400s an invalid administration date", async () => {
    await expect(
      PetClinicalRecordService.recordImmunization(CTX, {
        ...input,
        dateAdministered: "nope",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("500s when the child row fails to persist", async () => {
    prismaMock.clinicalArtifact.create.mockResolvedValue({
      id: "art-1",
      immunization: null,
      attestation: null,
    });
    await expect(
      PetClinicalRecordService.recordImmunization(CTX, input),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("PetClinicalRecordService.recordParasiteTreatment", () => {
  const input = {
    treatmentType: "ECHINOCOCCUS" as const,
    productName: "Milbemax",
    treatedAt: "2024-06-20T14:00:00.000Z",
  };

  it("creates an artifact + parasite treatment and audits", async () => {
    const dto = await PetClinicalRecordService.recordParasiteTreatment(
      CTX,
      input,
    );
    expect(dto).toMatchObject({
      treatmentType: "ECHINOCOCCUS",
      productName: "Milbemax",
    });
    expect(dto.administeringVetName).toBeUndefined();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TREATMENT_RECORDED" }),
    );
  });

  it("handles a null actor id", async () => {
    await PetClinicalRecordService.recordParasiteTreatment(CTX_NULL, input);
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: null }),
      }),
    );
  });

  it("500s when the treatment row fails to persist", async () => {
    prismaMock.clinicalArtifact.create.mockResolvedValue({
      id: "art-1",
      parasiteTreatment: null,
      attestation: null,
    });
    await expect(
      PetClinicalRecordService.recordParasiteTreatment(CTX, input),
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("PetClinicalRecordService.recordRabiesTitration", () => {
  const input = {
    approvedLab: "EU Lab",
    sampleDate: "2024-05-01T00:00:00.000Z",
    resultIuMl: 0.8,
  };

  it("creates an artifact + titration and audits", async () => {
    const dto = await PetClinicalRecordService.recordRabiesTitration(
      CTX,
      input,
    );
    expect(dto).toMatchObject({ approvedLab: "EU Lab", resultIuMl: 0.8 });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TITRATION_RECORDED" }),
    );
  });

  it("handles a null actor id", async () => {
    await PetClinicalRecordService.recordRabiesTitration(CTX_NULL, input);
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: null }),
      }),
    );
  });

  it("rejects a negative titration result", async () => {
    await expect(
      PetClinicalRecordService.recordRabiesTitration(CTX, {
        ...input,
        resultIuMl: -1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("500s when the titration row fails to persist", async () => {
    prismaMock.clinicalArtifact.create.mockResolvedValue({
      id: "art-1",
      rabiesTitration: null,
    });
    await expect(
      PetClinicalRecordService.recordRabiesTitration(CTX, input),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("surfaces the error type for callers", () => {
    expect(new PetClinicalRecordError("x", 400)).toBeInstanceOf(Error);
  });
});

describe("PetClinicalRecordService.recordClinicalExam", () => {
  const input = {
    examinedAt: "2024-06-23T00:00:00.000Z",
    fitForTravel: true,
    weightKg: 32.4,
    temperatureC: 38.5,
    findings: "healthy",
  };

  // Vitals are attested into the passport and printed onto the signed PDF, so
  // the service guards them for non-HTTP callers too, mirroring the titration
  // path rather than relying on the request schema alone.
  it.each([
    ["a negative weight", { weightKg: -5 }],
    ["a zero weight", { weightKg: 0 }],
    ["an absurd weight", { weightKg: 900 }],
    ["a frozen temperature", { temperatureC: -3 }],
    ["a boiling temperature", { temperatureC: 80 }],
  ])("400s %s", async (_label, override) => {
    await expect(
      PetClinicalRecordService.recordClinicalExam(CTX, {
        ...input,
        ...override,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.clinicalArtifact.create).not.toHaveBeenCalled();
  });

  it("accepts the range bounds and an omitted vital", async () => {
    await PetClinicalRecordService.recordClinicalExam(CTX, {
      ...input,
      weightKg: 200,
      temperatureC: 15,
    });
    await PetClinicalRecordService.recordClinicalExam(CTX, {
      examinedAt: input.examinedAt,
      fitForTravel: true,
    });
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledTimes(2);
  });

  it("creates an artifact + clinical exam", async () => {
    const dto = await PetClinicalRecordService.recordClinicalExam(CTX, input);
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "CLINICAL_EXAM" }),
      }),
    );
    expect(dto).toMatchObject({
      patientId: "pat-1",
      fitForTravel: true,
      weightKg: 32.4,
      temperatureC: 38.5,
      findings: "healthy",
    });
    expect(dto.examiningVetName).toBeUndefined();
  });

  it("creates a minimal exam and 400s an invalid date", async () => {
    const dto = await PetClinicalRecordService.recordClinicalExam(CTX, {
      examinedAt: "2024-06-23T00:00:00.000Z",
      fitForTravel: false,
    });
    expect(dto.fitForTravel).toBe(false);
    expect(dto.weightKg).toBeUndefined();
    await expect(
      PetClinicalRecordService.recordClinicalExam(CTX, {
        examinedAt: "nope",
        fitForTravel: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("handles a null actor id", async () => {
    await PetClinicalRecordService.recordClinicalExam(CTX_NULL, input);
    expect(prismaMock.clinicalArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: null }),
      }),
    );
  });

  it("500s when the exam row fails to persist", async () => {
    prismaMock.clinicalArtifact.create.mockResolvedValue({
      id: "art-1",
      clinicalExamination: null,
      attestation: null,
    });
    await expect(
      PetClinicalRecordService.recordClinicalExam(CTX, input),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("emits EXAM_RECORDED audit event", async () => {
    await PetClinicalRecordService.recordClinicalExam(CTX, input);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "EXAM_RECORDED",
        patientId: CTX.patientId,
        organisationId: CTX.organisationId,
        entityType: "COMPANION",
        metadata: expect.objectContaining({ fitForTravel: true }),
      }),
    );
  });
});

describe("PetClinicalRecordService.attestRecord", () => {
  const args = {
    artifactId: "art-1",
    patientId: "pat-1",
    organisationId: "org-1",
    actor: CTX.actor,
    signatoryName: "Dr Vet",
    signatoryLicence: "RCVS-1",
  };

  it("marks a draft record SIGNED, upserts the attestation and audits", async () => {
    const result = await PetClinicalRecordService.attestRecord(args);
    expect(result.status).toBe("SIGNED");
    expect(prismaMock.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SIGNED" }),
      }),
    );
    expect(auditMock).toHaveBeenCalled();
  });

  it("404s an unknown or out-of-org record", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue(null);
    await expect(
      PetClinicalRecordService.attestRecord(args),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s when the record belongs to a different pet", async () => {
    // Pairing pet A's record id with pet B's URL previously signed A's artifact
    // while auditing and notifying B.
    prismaMock.encounter.findUnique.mockResolvedValue({ patientId: "pat-9" });
    await expect(
      PetClinicalRecordService.attestRecord(args),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("404s when the record has no encounter to prove ownership", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
      id: "art-1",
      status: "DRAFT",
      encounterId: null,
      kind: "IMMUNIZATION",
    });
    await expect(
      PetClinicalRecordService.attestRecord(args),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("audits the event matching the record kind, not always vaccination", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
      id: "art-1",
      status: "DRAFT",
      encounterId: "enc-1",
      kind: "RABIES_TITRATION",
    });
    await PetClinicalRecordService.attestRecord(args);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TITRATION_RECORDED" }),
    );
  });

  it("409s a record that is already attested", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
      id: "art-1",
      status: "SIGNED",
      encounterId: "enc-1",
      kind: "IMMUNIZATION",
    });
    await expect(
      PetClinicalRecordService.attestRecord(args),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("attests with a null actor and no explicit signatory", async () => {
    await PetClinicalRecordService.attestRecord({
      artifactId: "art-1",
      patientId: "pat-1",
      organisationId: "org-1",
      actor: { type: "PMS_USER", id: null },
    });
    expect(prismaMock.clinicalArtifact.update).toHaveBeenCalled();
  });

  it("409s re-attesting a revoked record and leaves the row untouched", async () => {
    // VOID is terminal: re-attesting would flip it back to SIGNED and wipe the
    // revocation columns, republishing a record pulled for error or fraud.
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
      id: "art-1",
      status: "VOID",
      encounterId: "enc-1",
      kind: "IMMUNIZATION",
    });
    await expect(
      PetClinicalRecordService.attestRecord({
        artifactId: "art-1",
        patientId: "pat-1",
        organisationId: "org-1",
        actor: CTX.actor,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("does not clear the revocation columns when attesting", async () => {
    await PetClinicalRecordService.attestRecord({
      artifactId: "art-1",
      patientId: "pat-1",
      organisationId: "org-1",
      actor: CTX.actor,
    });
    const attestationData =
      prismaMock.clinicalArtifact.update.mock.calls[0][0].data.attestation
        .upsert.update;
    expect(attestationData).not.toHaveProperty("revokedAt");
    expect(attestationData).not.toHaveProperty("revokedReason");
  });
});

describe("PetClinicalRecordService.revokeRecord", () => {
  const base = {
    artifactId: "art-1",
    patientId: "pat-1",
    organisationId: "org-1",
    actor: CTX.actor,
  };

  it("voids a record with and without a reason", async () => {
    const withReason = await PetClinicalRecordService.revokeRecord({
      ...base,
      reason: "error",
    });
    expect(withReason.status).toBe("VOID");
    expect(prismaMock.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "VOID" }),
      }),
    );
    const withoutReason = await PetClinicalRecordService.revokeRecord(base);
    expect(withoutReason.status).toBe("VOID");
  });

  it("404s an unknown record", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue(null);
    await expect(
      PetClinicalRecordService.revokeRecord(base),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s a record whose encounter belongs to another pet", async () => {
    // Pet B's URL paired with pet A's record id must not void A's record.
    prismaMock.encounter.findUnique.mockResolvedValue({ patientId: "pat-2" });
    await expect(
      PetClinicalRecordService.revokeRecord(base),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("writes a patient-scoped audit row for the revocation", async () => {
    await PetClinicalRecordService.revokeRecord({ ...base, reason: "fraud" });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "pat-1",
        organisationId: "org-1",
        entityId: "art-1",
        metadata: expect.objectContaining({ revoked: true, reason: "fraud" }),
      }),
    );
  });
});

describe("PetClinicalRecordService.requestRecordSignature", () => {
  const args = {
    artifactId: "art-1",
    patientId: "pat-1",
    organisationId: "org-1",
    actor: CTX.actor,
    signatoryName: "Dr Vet",
  };

  const artifactWith = (over: Record<string, unknown>) => ({
    id: "art-1",
    status: "DRAFT",
    encounterId: "enc-1",
    kind: "IMMUNIZATION",
    immunization: null,
    rabiesTitration: null,
    parasiteTreatment: null,
    clinicalExamination: null,
    ...over,
  });

  it("renders a PDF, sends it to Documenso and marks IN_PROGRESS", async () => {
    const result = await PetClinicalRecordService.requestRecordSignature(args);
    expect(buildPdfMock).toHaveBeenCalled();
    expect(documensoMock.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        signerEmail: "vet@example.com",
        apiKey: "api-key",
      }),
    );
    expect(documensoMock.distributeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 42 }),
    );
    expect(result).toMatchObject({
      status: "IN_PROGRESS",
      documensoDocumentId: "42",
    });
    expect(prismaMock.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      }),
    );
  });

  it("renders titration, parasite and exam records too", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({
        rabiesTitration: {
          approvedLab: "EU Lab",
          sampleDate: new Date("2024-05-01T00:00:00.000Z"),
          resultIuMl: 0.8,
        },
      }),
    );
    await PetClinicalRecordService.requestRecordSignature(args);
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({
        parasiteTreatment: {
          treatmentType: "ECHINOCOCCUS",
          productName: "Milbemax",
          treatedAt: new Date("2024-06-20T14:00:00.000Z"),
        },
      }),
    );
    await PetClinicalRecordService.requestRecordSignature(args);
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({
        clinicalExamination: {
          examinedAt: new Date("2024-06-23T00:00:00.000Z"),
          fitForTravel: true,
          weightKg: 32.4,
          temperatureC: 38.5,
        },
      }),
    );
    await PetClinicalRecordService.requestRecordSignature(args);
    expect(documensoMock.createDocument).toHaveBeenCalledTimes(3);
  });

  it("409s sending a revoked record for signature", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({ status: "VOID" }),
    );
    await expect(
      PetClinicalRecordService.requestRecordSignature(args),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(documensoMock.createDocument).not.toHaveBeenCalled();
  });

  it("is idempotent when a signing request is already in flight", async () => {
    // A retry must not mint and distribute a second Documenso document, which
    // would mail the vet twice and orphan the first document id.
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({
        status: "IN_PROGRESS",
        attestation: {
          signingStatus: "IN_PROGRESS",
          documensoDocumentId: "42",
        },
      }),
    );
    const result = await PetClinicalRecordService.requestRecordSignature(args);
    expect(result).toEqual({
      artifactId: "art-1",
      status: "IN_PROGRESS",
      documensoDocumentId: "42",
    });
    expect(documensoMock.createDocument).not.toHaveBeenCalled();
    expect(documensoMock.distributeDocument).not.toHaveBeenCalled();
  });

  it("persists the document id before distributing it", async () => {
    // Distributing first and failing to write would mail a live signing request
    // whose DOCUMENT_COMPLETED webhook can never be matched back to a record.
    const order: string[] = [];
    prismaMock.clinicalArtifact.update.mockImplementation(() => {
      order.push("persist");
      return Promise.resolve({ id: "art-1" });
    });
    documensoMock.distributeDocument.mockImplementation(() => {
      order.push("distribute");
      return Promise.resolve({});
    });
    await PetClinicalRecordService.requestRecordSignature(args);
    expect(order).toEqual(["persist", "distribute"]);
  });

  it("404s unknown, 409s already-signed", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(null);
    await expect(
      PetClinicalRecordService.requestRecordSignature(args),
    ).rejects.toMatchObject({ statusCode: 404 });
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce({
      id: "art-1",
      status: "SIGNED",
      encounterId: "enc-1",
      kind: "IMMUNIZATION",
    });
    await expect(
      PetClinicalRecordService.requestRecordSignature(args),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("400s when Documenso, the signer email or the actor is missing", async () => {
    documensoMock.resolveOrganisationApiKey.mockResolvedValueOnce(null);
    await expect(
      PetClinicalRecordService.requestRecordSignature(args),
    ).rejects.toMatchObject({ statusCode: 400 });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    await expect(
      PetClinicalRecordService.requestRecordSignature(args),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      PetClinicalRecordService.requestRecordSignature({
        ...args,
        actor: { type: "PMS_USER", id: null },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("502s when the signing document cannot be created", async () => {
    documensoMock.createDocument.mockResolvedValueOnce(undefined);
    await expect(
      PetClinicalRecordService.requestRecordSignature(args),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("falls back to a default pet name when the patient is missing", async () => {
    prismaMock.patient.findUnique.mockResolvedValueOnce(null);
    const result = await PetClinicalRecordService.requestRecordSignature(args);
    expect(result.status).toBe("IN_PROGRESS");
  });

  it("covers absent optional fields and a missing signatory name", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({
        immunization: {
          vaccineName: "Lepto",
          vaccineType: "CORE",
          manufacturer: null,
          batchNumber: null,
          dateAdministered: new Date("2024-04-01T00:00:00.000Z"),
          validUntil: null,
        },
      }),
    );
    await PetClinicalRecordService.requestRecordSignature({
      ...args,
      signatoryName: undefined,
    });
    prismaMock.clinicalArtifact.findFirst.mockResolvedValueOnce(
      artifactWith({
        clinicalExamination: {
          examinedAt: new Date("2024-06-23T00:00:00.000Z"),
          fitForTravel: false,
          weightKg: null,
          temperatureC: null,
        },
      }),
    );
    await PetClinicalRecordService.requestRecordSignature(args);
    expect(documensoMock.createDocument).toHaveBeenCalled();
  });
});

describe("notifyOwnerOfPassportUpdate", () => {
  const wireOwner = (
    parent: { linkedUserId: string | null; email: string | null } | null,
  ) => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue(parent);
    prismaMock.patient.findUnique.mockResolvedValue({ name: "Biscuit" });
  };

  it("pushes + emails the owner with a passport link", async () => {
    process.env.PUBLIC_PASSPORT_BASE_URL = "https://app.test/";
    wireOwner({ linkedUserId: "user-1", email: "owner@test.com" });

    await notifyOwnerOfPassportUpdate("pat-1");

    expect(sendToUserMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Passport updated 🪪" }),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@test.com",
        htmlBody: expect.stringContaining("https://app.test/passport/pat-1"),
      }),
    );
    delete process.env.PUBLIC_PASSPORT_BASE_URL;
  });

  it("pushes only when the owner has no email", async () => {
    wireOwner({ linkedUserId: "user-1", email: null });
    await notifyOwnerOfPassportUpdate("pat-1");
    expect(sendToUserMock).toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("emails only when the owner has no linked app account", async () => {
    wireOwner({ linkedUserId: null, email: "owner@test.com" });
    await notifyOwnerOfPassportUpdate("pat-1");
    expect(sendToUserMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it("no-ops when there is no owner link or parent record", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValueOnce(null);
    await notifyOwnerOfPassportUpdate("pat-1");

    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue(null);
    prismaMock.patient.findUnique.mockResolvedValue({ name: "Biscuit" });
    await notifyOwnerOfPassportUpdate("pat-1");

    expect(sendToUserMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("swallows push + email failures", async () => {
    wireOwner({ linkedUserId: "user-1", email: "owner@test.com" });
    sendToUserMock.mockRejectedValueOnce(new Error("push down"));
    sendEmailMock.mockRejectedValueOnce(new Error("ses down"));
    await expect(notifyOwnerOfPassportUpdate("pat-1")).resolves.toBeUndefined();
  });

  it("swallows a lookup failure", async () => {
    prismaMock.parentPatient.findFirst.mockRejectedValueOnce(
      new Error("db down"),
    );
    await expect(notifyOwnerOfPassportUpdate("pat-1")).resolves.toBeUndefined();
  });

  it("is triggered when a vet attests a record", async () => {
    wireOwner({ linkedUserId: "user-1", email: null });
    await PetClinicalRecordService.attestRecord({
      artifactId: "art-1",
      patientId: "pat-1",
      organisationId: "org-1",
      actor: { type: "PMS_USER", id: "vet-1" },
    });
    expect(sendToUserMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Passport updated 🪪" }),
    );
  });
});
