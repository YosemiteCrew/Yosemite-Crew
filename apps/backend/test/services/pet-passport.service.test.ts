import { createHash } from "node:crypto";
import {
  PetPassportService,
  PetPassportServiceError,
} from "src/services/pet-passport.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    patientOrganisation: { findFirst: jest.fn() },
    passportShareConsent: { findMany: jest.fn() },
    encounter: { findMany: jest.fn() },
    immunization: { findMany: jest.fn() },
    parasiteTreatment: { findMany: jest.fn() },
    rabiesTitration: { findMany: jest.fn() },
    clinicalExamination: { findMany: jest.fn() },
    petPassport: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    organization: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn(), findMany: jest.fn() },
    parent: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  patient: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
  patientOrganisation: { findFirst: jest.Mock };
  passportShareConsent: { findMany: jest.Mock };
  encounter: { findMany: jest.Mock };
  immunization: { findMany: jest.Mock };
  parasiteTreatment: { findMany: jest.Mock };
  rabiesTitration: { findMany: jest.Mock };
  clinicalExamination: { findMany: jest.Mock };
  petPassport: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  organization: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock; findMany: jest.Mock };
  parent: { findUnique: jest.Mock; findFirst: jest.Mock };
};
const auditMock = AuditTrailService.recordSafely as jest.Mock;

const ACTOR = { type: "PMS_USER" as const, id: "vet-1" };

const PATIENT = {
  id: "pat-1",
  name: "Doggy",
  type: "dog",
  breed: "Rottweiler",
  gender: "male",
  colour: "black",
  photoUrl: "http://img/doggy.png",
  dateOfBirth: new Date("2024-01-01T00:00:00.000Z"),
  microchipNumber: "985141000123456",
  microchipImplantedAt: new Date("2024-02-01T00:00:00.000Z"),
  microchipLocation: "left neck",
  passportNumber: "GB-YC-1",
  physicalAttribute: { markings: "white chest blaze" },
};

const vet = (over: Record<string, unknown> = {}) => ({
  artifact: {
    attestation: {
      signatoryName: "Dr Vet",
      signatoryLicence: "RCVS-1",
      ...over,
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.patientOrganisation.findFirst.mockResolvedValue({ id: "link-1" });
  prismaMock.patient.findUnique.mockResolvedValue(PATIENT);
  prismaMock.patient.findMany.mockResolvedValue([{ id: "pat-1" }]);
  prismaMock.passportShareConsent.findMany.mockResolvedValue([]);
  prismaMock.organization.findUnique.mockResolvedValue({
    name: "Yosemite Vet Clinic",
  });
  prismaMock.parentPatient.findFirst.mockResolvedValue(null);
  prismaMock.parent.findFirst.mockResolvedValue(null);
  prismaMock.patient.update.mockResolvedValue(PATIENT);
  // issuePassport writes the PetPassport row and mirrors the number onto the
  // canonical Patient column in one transaction.
  prismaMock.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
    Promise.all(ops),
  );
  prismaMock.encounter.findMany.mockResolvedValue([{ id: "enc-1" }]);
  prismaMock.immunization.findMany.mockResolvedValue([]);
  prismaMock.parasiteTreatment.findMany.mockResolvedValue([]);
  prismaMock.rabiesTitration.findMany.mockResolvedValue([]);
  prismaMock.clinicalExamination.findMany.mockResolvedValue([]);
  prismaMock.petPassport.findFirst.mockResolvedValue(null);
  prismaMock.petPassport.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: "pp-1",
      issueDate: new Date("2024-06-24T00:00:00.000Z"),
      issuingCountry: null,
      issuingAuthority: null,
      issuingVetName: null,
      issuingVetLicense: null,
      status: null,
      ...data,
    }),
  );
});

describe("PetPassportService.issuePassport", () => {
  it("issues a passport with all fields and audits", async () => {
    const dto = await PetPassportService.issuePassport({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: ACTOR,
      input: {
        passportNumber: "GB-YC-1",
        issuingCountry: "GB",
        issuingAuthority: "RCVS",
        issuingVetName: "Dr A",
        issuingVetLicense: "RCVS-1",
      },
    });
    expect(dto).toMatchObject({
      passportNumber: "GB-YC-1",
      issuingCountry: "GB",
      issuingAuthority: "RCVS",
      issuingVetName: "Dr A",
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PASSPORT_ISSUED" }),
    );
  });

  it("defaults optional issuance fields and rejects a cross-org companion", async () => {
    const dto = await PetPassportService.issuePassport({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: { type: "PMS_USER", id: null },
      input: { passportNumber: "GB-YC-9" },
    });
    expect(dto.issuingCountry).toBeUndefined();

    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.issuePassport({
        patientId: "pat-1",
        organisationId: "org-1",
        actor: ACTOR,
        input: { passportNumber: "X" },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.getPassport", () => {
  it("asserts org membership before assembling", async () => {
    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.getPassport("pat-1", "org-1"),
    ).rejects.toBeInstanceOf(PetPassportServiceError);
  });

  it("404s when the companion does not exist", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);
    await expect(
      PetPassportService.getPassport("pat-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // A wallet pass embeds the public share link in its QR, so PIMS needs to know
  // whether one is live before offering the action. Derived from the passport
  // row already loaded, so it costs no extra query.
  it("reports publicShareActive when the share link is live", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      passportNumber: "GB-YC-1",
      issueDate: new Date("2024-06-24T00:00:00.000Z"),
      publicToken: "tok-live",
      publicTokenRevokedAt: null,
    });
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.publicShareActive).toBe(true);
  });

  it("reports publicShareActive false once the share link is revoked", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      passportNumber: "GB-YC-1",
      issueDate: new Date("2024-06-24T00:00:00.000Z"),
      publicToken: "tok-dead",
      publicTokenRevokedAt: new Date("2024-07-01T00:00:00.000Z"),
    });
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.publicShareActive).toBe(false);
  });

  it("reports publicShareActive false when no passport has been issued", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(null);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.issuance).toBeUndefined();
    expect(passport.publicShareActive).toBe(false);
  });

  it("assembles identity, microchip, marks, issuance, owner and records", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      passportNumber: "GB-YC-1",
      issuingCountry: "GB",
      issuingAuthority: "RCVS",
      issuingVetName: "Dr A",
      issuingVetLicense: "RCVS-1",
      issueDate: new Date("2024-06-24T00:00:00.000Z"),
      status: null,
    });
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue({
      firstName: "Sam",
      lastName: "Lee",
      email: "sam@x.com",
      phoneNumber: "123",
    });
    prismaMock.immunization.findMany.mockResolvedValue([
      {
        id: "imm-1",
        vaccineType: "RABIES",
        vaccineName: "Nobivac Rabies",
        manufacturer: null,
        batchNumber: "A234B",
        lotNumber: null,
        dateAdministered: new Date("2024-04-01T00:00:00.000Z"),
        validFrom: null,
        validUntil: new Date("2027-03-14T00:00:00.000Z"),
        nextDueDate: null,
        site: "left flank",
        route: "SC",
        notes: "ok",
        createdAt: new Date("2024-04-02T00:00:00.000Z"),
        ...vet(),
      },
      {
        id: "imm-2",
        vaccineType: "CORE",
        vaccineName: "DHPP",
        manufacturer: "MSD",
        batchNumber: null,
        lotNumber: null,
        dateAdministered: new Date("2024-03-15T00:00:00.000Z"),
        validFrom: null,
        validUntil: null,
        nextDueDate: null,
        site: null,
        route: null,
        notes: null,
        createdAt: new Date("2024-03-16T00:00:00.000Z"),
        artifact: { attestation: null },
      },
    ]);
    prismaMock.parasiteTreatment.findMany.mockResolvedValue([
      {
        id: "trt-1",
        treatmentType: "ECHINOCOCCUS",
        productName: "Milbemax",
        manufacturer: null,
        treatedAt: new Date("2024-06-20T14:00:00.000Z"),
        notes: null,
        createdAt: new Date("2024-06-20T14:00:00.000Z"),
        ...vet(),
      },
    ]);
    prismaMock.rabiesTitration.findMany.mockResolvedValue([
      {
        id: "tit-1",
        approvedLab: "EU Lab",
        sampleDate: new Date("2024-05-01T00:00:00.000Z"),
        resultIuMl: 0.8,
        reportUrl: null,
        createdAt: new Date("2024-05-02T00:00:00.000Z"),
      },
    ]);
    prismaMock.clinicalExamination.findMany.mockResolvedValue([
      {
        id: "exam-1",
        examinedAt: new Date("2024-06-23T00:00:00.000Z"),
        fitForTravel: true,
        findings: "healthy",
        weightKg: 32.4,
        temperatureC: 38.5,
        createdAt: new Date("2024-06-23T00:00:00.000Z"),
        ...vet(),
      },
    ]);

    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.clinicalExams[0]).toMatchObject({
      fitForTravel: true,
      weightKg: 32.4,
      examiningVetName: "Dr Vet",
    });
    expect(passport.identity).toMatchObject({
      name: "Doggy",
      species: "dog",
      distinguishingMarks: "white chest blaze",
    });
    expect(passport.microchip).toEqual({
      number: "985141000123456",
      implantedAt: "2024-02-01T00:00:00.000Z",
      location: "left neck",
    });
    expect(passport.rabies?.vaccineName).toBe("Nobivac Rabies");
    expect(passport.rabies?.administeringVetName).toBe("Dr Vet");
    expect(passport.rabies?.vetLicenseNumber).toBe("RCVS-1");
    expect(passport.vaccinations).toHaveLength(1);
    expect(passport.vaccinations[0]).toMatchObject({
      vaccineName: "DHPP",
      manufacturer: "MSD",
      administeringVetName: undefined,
    });
    expect(passport.parasiteTreatments[0]).toMatchObject({
      productName: "Milbemax",
      administeringVetName: "Dr Vet",
    });
    expect(passport.rabiesTitrations[0]).toMatchObject({
      approvedLab: "EU Lab",
      resultIuMl: 0.8,
    });
    expect(passport.owner).toMatchObject({
      name: "Sam Lee",
      email: "sam@x.com",
    });
    expect(passport.issuance).toMatchObject({
      passportNumber: "GB-YC-1",
      issuingPractice: "Yosemite Vet Clinic",
    });
  });

  it("aggregates records from practices granted cross-practice consent", async () => {
    prismaMock.passportShareConsent.findMany.mockResolvedValue([
      { ownerOrganisationId: "org-2" },
    ]);
    prismaMock.patient.findMany.mockResolvedValue([
      { id: "pat-1" },
      { id: "pat-1b" },
    ]);
    // Same owner on both chip rows, so both are the same physical pet.
    prismaMock.parentPatient.findMany
      .mockResolvedValueOnce([{ parentId: "par-1" }])
      .mockResolvedValueOnce([{ patientId: "pat-1" }, { patientId: "pat-1b" }]);
    await PetPassportService.getPassport("pat-1", "org-1");
    expect(prismaMock.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: { in: ["pat-1", "pat-1b"] },
          organisationId: { in: ["org-1", "org-2"] },
        }),
      }),
    );
  });

  // `microchipNumber` is caller-supplied and not unique, so a row that merely
  // shares the number - with a different owner - must not pull the real pet's
  // records into the passport.
  it("ignores chip-matched patients that share no owner with the authorised one", async () => {
    prismaMock.patient.findMany.mockResolvedValue([
      { id: "pat-1" },
      { id: "spoofed-1" },
    ]);
    prismaMock.parentPatient.findMany
      .mockResolvedValueOnce([{ parentId: "par-1" }])
      .mockResolvedValueOnce([{ patientId: "pat-1" }]);

    await PetPassportService.getPassport("pat-1", "org-1");

    expect(prismaMock.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: { in: ["pat-1"] } }),
      }),
    );
  });

  it("falls back to the authorised patient when it has no active parent", async () => {
    prismaMock.patient.findMany.mockResolvedValue([
      { id: "pat-1" },
      { id: "spoofed-1" },
    ]);
    prismaMock.parentPatient.findMany.mockResolvedValueOnce([]);

    await PetPassportService.getPassport("pat-1", "org-1");

    expect(prismaMock.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: { in: ["pat-1"] } }),
      }),
    );
  });

  it("skips clinical reads when the patient has no encounters", async () => {
    prismaMock.encounter.findMany.mockResolvedValue([]);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.vaccinations).toEqual([]);
    expect(passport.parasiteTreatments).toEqual([]);
    expect(passport.rabiesTitrations).toEqual([]);
    expect(prismaMock.immunization.findMany).not.toHaveBeenCalled();
  });

  it("omits owner data when the parent link resolves to no parent", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue(null);
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      colour: null,
      photoUrl: null,
      microchipNumber: null,
      physicalAttribute: null,
    });
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.owner).toBeUndefined();
    expect(passport.microchip).toBeUndefined();
    expect(passport.identity.distinguishingMarks).toBeUndefined();
    expect(passport.identity.colour).toBeUndefined();
  });

  it("covers optional date fields, null attestation contact and missing ids", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      microchipLocation: null,
      passportNumber: null,
      physicalAttribute: null,
    });
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue({
      firstName: "A",
      lastName: "B",
      email: null,
      phoneNumber: null,
    });
    prismaMock.immunization.findMany.mockResolvedValue([
      {
        id: "imm-9",
        vaccineType: "CORE",
        vaccineName: "Lepto",
        manufacturer: null,
        batchNumber: null,
        lotNumber: null,
        dateAdministered: new Date("2024-04-01T00:00:00.000Z"),
        validFrom: new Date("2024-04-22T00:00:00.000Z"),
        validUntil: null,
        nextDueDate: new Date("2025-04-01T00:00:00.000Z"),
        site: null,
        route: null,
        notes: null,
        createdAt: new Date("2024-04-02T00:00:00.000Z"),
        artifact: {
          attestation: { signatoryName: null, signatoryLicence: null },
        },
      },
    ]);

    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.microchip).toMatchObject({ number: "985141000123456" });
    expect(passport.microchip?.location).toBeUndefined();
    expect(passport.passportNumber).toBeUndefined();
    expect(passport.owner).toMatchObject({ name: "A B" });
    expect(passport.owner?.email).toBeUndefined();
    expect(passport.owner?.phone).toBeUndefined();
    expect(passport.vaccinations[0]).toMatchObject({
      validFrom: "2024-04-22T00:00:00.000Z",
      nextDueDate: "2025-04-01T00:00:00.000Z",
      administeringVetName: undefined,
    });
  });
});

describe("PetPassportService.clinicalExams", () => {
  it("maps a clinical exam with null fields and no attestation", async () => {
    prismaMock.clinicalExamination.findMany.mockResolvedValue([
      {
        id: "exam-2",
        examinedAt: new Date("2024-06-23T00:00:00.000Z"),
        fitForTravel: false,
        findings: null,
        weightKg: null,
        temperatureC: null,
        createdAt: new Date("2024-06-23T00:00:00.000Z"),
        artifact: { attestation: null },
      },
    ]);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.clinicalExams[0]).toMatchObject({ fitForTravel: false });
    expect(passport.clinicalExams[0].findings).toBeUndefined();
    expect(passport.clinicalExams[0].weightKg).toBeUndefined();
    expect(passport.clinicalExams[0].temperatureC).toBeUndefined();
    expect(passport.clinicalExams[0].examiningVetName).toBeUndefined();
  });
});

describe("PetPassportService.getPublicPassportByToken", () => {
  it("404s on an empty token without touching the database", async () => {
    prismaMock.petPassport.findFirst.mockClear();
    await expect(
      PetPassportService.getPublicPassportByToken(""),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.petPassport.findFirst).not.toHaveBeenCalled();
  });

  it("404s for an unknown or revoked token", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.getPublicPassportByToken("nope"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("looks the token up directly and excludes revoked links", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      patientId: "pat-1",
      organisationId: "org-1",
      passportNumber: "GB-YC-1",
      issuingCountry: null,
      issuingAuthority: null,
      issuingVetName: null,
      issuingVetLicense: null,
      issueDate: new Date("2024-06-24T00:00:00.000Z"),
      status: null,
    });
    await PetPassportService.getPublicPassportByToken("raw-token");
    const where = prismaMock.petPassport.findFirst.mock.calls[0][0].where;
    expect(where.publicToken).toBe("raw-token");
    expect(where.publicTokenRevokedAt).toBeNull();
  });

  it("404s when the passport has never been formally issued", async () => {
    // No passportNumber means no issued document to verify against.
    prismaMock.petPassport.findFirst.mockResolvedValue({
      patientId: "pat-1",
      organisationId: "org-1",
      passportNumber: null,
    });
    await expect(
      PetPassportService.getPublicPassportByToken("raw-token"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.ensurePublicToken", () => {
  it("reuses a live token so regenerating a pass keeps old ones working", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      id: "pp-1",
      publicToken: "existing-token",
      publicTokenRevokedAt: null,
    });
    const token = await PetPassportService.ensurePublicToken("pat-1");
    expect(token).toBe("existing-token");
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });

  it("mints a token when none exists", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      id: "pp-1",
      publicToken: null,
      publicTokenRevokedAt: null,
    });
    prismaMock.petPassport.update.mockResolvedValue({});
    const token = await PetPassportService.ensurePublicToken("pat-1");
    expect(token).toHaveLength(43);
    const data = prismaMock.petPassport.update.mock.calls.at(-1)[0].data;
    expect(data.publicToken).toBe(token);
    expect(data.publicTokenRevokedAt).toBeNull();
  });

  it("mints a replacement after a revoke rather than resurrecting the old one", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      id: "pp-1",
      publicToken: "old-token",
      publicTokenRevokedAt: new Date(),
    });
    prismaMock.petPassport.update.mockResolvedValue({});
    const token = await PetPassportService.ensurePublicToken("pat-1");
    expect(token).not.toBe("old-token");
  });

  it("404s when the pet has no issued passport", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.ensurePublicToken("pat-x"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.revokePublicToken", () => {
  it("refuses a caller who is not the pet's parent", async () => {
    prismaMock.parent.findFirst.mockResolvedValue(null);
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.revokePublicToken({
        patientId: "pat-1",
        userId: "staff-9",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });

  it("clears the token for the pet's parent", async () => {
    prismaMock.parent.findFirst.mockResolvedValue({ id: "par-1" });
    prismaMock.parentPatient.findFirst.mockResolvedValue({ id: "pp-link-1" });
    prismaMock.patientOrganisation.findFirst.mockResolvedValue({
      organisationId: "org-1",
    });
    prismaMock.petPassport.findFirst.mockResolvedValue({ id: "pp-1" });
    prismaMock.petPassport.update.mockResolvedValue({});
    await PetPassportService.revokePublicToken({
      patientId: "pat-1",
      userId: "user-1",
    });
    const data = prismaMock.petPassport.update.mock.calls.at(-1)[0].data;
    expect(data.publicToken).toBeNull();
    expect(data.publicTokenRevokedAt).toBeInstanceOf(Date);
  });
});

describe("PetPassportService.issuePassport canonical number", () => {
  it("mirrors the issued number onto Patient.passportNumber", async () => {
    // Cards and the companion detail view read Patient.passportNumber, so
    // writing only the PetPassport row left a freshly issued number invisible
    // everywhere but the passport itself.
    await PetPassportService.issuePassport({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: ACTOR,
      input: { passportNumber: "GB12345" },
    });
    expect(prismaMock.patient.update).toHaveBeenCalledWith({
      where: { id: "pat-1" },
      data: { passportNumber: "GB12345" },
    });
    // Both writes go through one transaction so they cannot half-apply.
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("PetPassportService co-parent access", () => {
  it("lets an active CO_PARENT read the passport", async () => {
    // Resolving the link by PRIMARY role 404'd every co-parent, which the
    // mobile app renders as the misleading "no passport issued" empty state.
    prismaMock.parent.findFirst.mockResolvedValue({ id: "par-2" });
    prismaMock.parentPatient.findFirst.mockResolvedValue({ id: "pp-link-2" });
    prismaMock.patientOrganisation.findFirst.mockResolvedValue({
      organisationId: "org-1",
    });
    const passport = await PetPassportService.getPassportForParent(
      "pat-1",
      "co-parent-user",
    );
    expect(passport.identity.name).toBe("Doggy");
    expect(prismaMock.parentPatient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ["PRIMARY", "CO_PARENT"] },
        }),
      }),
    );
  });

  it("restricts share-link revocation to the primary parent", async () => {
    prismaMock.parent.findFirst.mockResolvedValue({ id: "par-2" });
    prismaMock.parentPatient.findFirst.mockResolvedValue({ id: "pp-link-2" });
    prismaMock.patientOrganisation.findFirst.mockResolvedValue({
      organisationId: "org-1",
    });
    prismaMock.petPassport.findFirst.mockResolvedValue({ id: "pp-1" });
    prismaMock.petPassport.update.mockResolvedValue({});
    await PetPassportService.revokePublicToken({
      patientId: "pat-1",
      userId: "co-parent-user",
    });
    expect(prismaMock.parentPatient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: { in: ["PRIMARY"] } }),
      }),
    );
  });
});

describe("PetPassportService.getExistingPublicToken", () => {
  it("returns a live token without minting", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      publicToken: "tok-1",
      publicTokenRevokedAt: null,
    });
    await expect(
      PetPassportService.getExistingPublicToken("pat-1"),
    ).resolves.toBe("tok-1");
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });

  it("returns null rather than minting when there is no live token", async () => {
    // Staff-facing pass builders must never create a public owner credential.
    prismaMock.petPassport.findFirst.mockResolvedValue({
      publicToken: null,
      publicTokenRevokedAt: null,
    });
    await expect(
      PetPassportService.getExistingPublicToken("pat-1"),
    ).resolves.toBeNull();
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });

  it("returns null for a revoked token", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      publicToken: "tok-1",
      publicTokenRevokedAt: new Date(),
    });
    await expect(
      PetPassportService.getExistingPublicToken("pat-1"),
    ).resolves.toBeNull();
  });

  it("404s a pet with no issued passport", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.getExistingPublicToken("pat-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.getPassportForParent", () => {
  const asParent = () => {
    prismaMock.parent.findFirst.mockResolvedValue({ id: "par-1" });
    prismaMock.parentPatient.findFirst.mockResolvedValue({ id: "pp-link-1" });
  };

  it("404s an unauthenticated caller", async () => {
    await expect(
      PetPassportService.getPassportForParent("pat-1", null),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s a caller who is not the pet's parent", async () => {
    prismaMock.parent.findFirst.mockResolvedValue({ id: "par-1" });
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.getPassportForParent("pat-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s when the pet has no linked parent account", async () => {
    prismaMock.parent.findFirst.mockResolvedValue(null);
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.getPassportForParent("pat-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("assembles the owner view for the pet's parent", async () => {
    asParent();
    prismaMock.patientOrganisation.findFirst.mockResolvedValue({
      organisationId: "org-1",
    });
    const passport = await PetPassportService.getPassportForParent(
      "pat-1",
      "user-1",
    );
    expect(passport.identity.name).toBe("Doggy");
  });
});

describe("PetPassportService token scope split", () => {
  const issued = {
    patientId: "pat-1",
    organisationId: "org-1",
    passportNumber: "GB-YC-1",
  };

  it("resolves the owner's public token across every practice", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValueOnce(issued);

    await PetPassportService.getPublicPassportByToken("owner-token");

    const where = prismaMock.encounter.findMany.mock.calls[0][0].where;
    expect(where.organisationId).toBeUndefined();
  });

  it("confines a practice wallet token to its own consent boundary", async () => {
    // This is the whole point of the second token. If a practice token ever
    // resolved with owner scope, a practice could read the cross-practice
    // history its own passport view withholds - through a pass it minted.
    prismaMock.petPassport.findFirst
      .mockResolvedValueOnce(null) // not the owner's public token
      .mockResolvedValueOnce(issued); // matched on practiceWalletToken

    await PetPassportService.getPublicPassportByToken("practice-token");

    const where = prismaMock.encounter.findMany.mock.calls[0][0].where;
    expect(where.organisationId).toBeDefined();
    expect(where.organisationId.in).toContain("org-1");
  });

  it("looks the practice token up only after the public one misses, and excludes revoked", async () => {
    prismaMock.petPassport.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(issued);

    await PetPassportService.getPublicPassportByToken("practice-token");

    const second = prismaMock.petPassport.findFirst.mock.calls[1][0].where;
    expect(second.practiceWalletToken).toBe("practice-token");
    expect(second.practiceWalletTokenRevokedAt).toBeNull();
  });

  it("404s when neither token matches", async () => {
    prismaMock.petPassport.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      PetPassportService.getPublicPassportByToken("nothing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.getOrCreatePracticeWalletToken", () => {
  const issuedRow = {
    id: "pp-1",
    passportNumber: "GB-YC-1",
    practiceWalletToken: null,
    practiceWalletTokenRevokedAt: null,
  };

  it("scopes the passport lookup to the caller's organisation", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      ...issuedRow,
      practiceWalletToken: "live-token",
    });

    await PetPassportService.getOrCreatePracticeWalletToken("pat-1", "org-1");

    const where = prismaMock.petPassport.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      patientId: "pat-1",
      organisationId: "org-1",
    });
  });

  it("reuses a live token so regenerating a pass keeps issued ones working", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      ...issuedRow,
      practiceWalletToken: "live-token",
    });

    const token = await PetPassportService.getOrCreatePracticeWalletToken(
      "pat-1",
      "org-1",
    );

    expect(token).toBe("live-token");
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });

  it("mints on first use, which staff may do because it grants no more than their session", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(issuedRow);

    const token = await PetPassportService.getOrCreatePracticeWalletToken(
      "pat-1",
      "org-1",
    );

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
    const update = prismaMock.petPassport.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "pp-1" });
    expect(update.data.practiceWalletToken).toBe(token);
    expect(update.data.practiceWalletTokenRevokedAt).toBeNull();
  });

  it("reissues rather than reusing after a revoke, so a revoked pass stays dead", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      ...issuedRow,
      practiceWalletToken: "old-token",
      practiceWalletTokenRevokedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const token = await PetPassportService.getOrCreatePracticeWalletToken(
      "pat-1",
      "org-1",
    );

    expect(token).not.toBe("old-token");
    expect(
      prismaMock.petPassport.update.mock.calls[0][0].data
        .practiceWalletTokenRevokedAt,
    ).toBeNull();
  });

  it("404s when no passport row exists for this organisation", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(null);

    await expect(
      PetPassportService.getOrCreatePracticeWalletToken("pat-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });

  it("404s when the passport was never formally issued", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({
      ...issuedRow,
      passportNumber: null,
    });

    await expect(
      PetPassportService.getOrCreatePracticeWalletToken("pat-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.petPassport.update).not.toHaveBeenCalled();
  });
});
