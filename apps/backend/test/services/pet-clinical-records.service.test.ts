import {
  PetClinicalRecordService,
  PetClinicalRecordError,
} from "src/services/pet-clinical-records.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    encounter: { findFirst: jest.fn() },
    clinicalArtifact: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  encounter: { findFirst: jest.Mock };
  clinicalArtifact: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};
const auditMock = AuditTrailService.recordSafely as jest.Mock;

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
  prismaMock.clinicalArtifact.create.mockImplementation(echoArtifact);
  prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
    id: "art-1",
    status: "DRAFT",
  });
  prismaMock.clinicalArtifact.update.mockResolvedValue({ id: "art-1" });
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

  it("409s a record that is already attested", async () => {
    prismaMock.clinicalArtifact.findFirst.mockResolvedValue({
      id: "art-1",
      status: "SIGNED",
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
});

describe("PetClinicalRecordService.revokeRecord", () => {
  const base = {
    artifactId: "art-1",
    organisationId: "org-1",
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
});
