import { createHash } from "node:crypto";
import {
  PetPassportService,
  PetPassportServiceError,
} from "src/services/pet-passport.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: { findUnique: jest.fn(), findMany: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    passportShareConsent: { findMany: jest.fn() },
    encounter: { findMany: jest.fn() },
    immunization: { findMany: jest.fn() },
    parasiteTreatment: { findMany: jest.fn() },
    rabiesTitration: { findMany: jest.fn() },
    clinicalExamination: { findMany: jest.fn() },
    petPassport: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    organization: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  patient: { findUnique: jest.Mock; findMany: jest.Mock };
  patientOrganisation: { findFirst: jest.Mock };
  passportShareConsent: { findMany: jest.Mock };
  encounter: { findMany: jest.Mock };
  immunization: { findMany: jest.Mock };
  parasiteTreatment: { findMany: jest.Mock };
  rabiesTitration: { findMany: jest.Mock };
  clinicalExamination: { findMany: jest.Mock };
  petPassport: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  organization: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
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

  it("looks the token up by hash and excludes revoked links", async () => {
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
    // First call is the token resolution; assemblePassport looks the row up again.
    const where = prismaMock.petPassport.findFirst.mock.calls[0][0].where;
    // The raw token must never be used as a query value.
    expect(where.publicTokenHash).toBe(
      createHash("sha256").update("raw-token").digest("hex"),
    );
    expect(where.publicTokenHash).not.toBe("raw-token");
    expect(where.publicTokenRevokedAt).toBeNull();
  });

  it("assembles an owner-free record from the issuing org", async () => {
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
    const passport =
      await PetPassportService.getPublicPassportByToken("raw-token");
    expect(passport.owner).toBeUndefined();
    expect(passport.identity.name).toBe("Doggy");
  });
});

describe("PetPassportService public share link", () => {
  it("stores only the hash and returns the raw token once", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({ id: "pp-1" });
    prismaMock.petPassport.update.mockResolvedValue({});
    const { token } = await PetPassportService.issuePublicToken({
      patientId: "pat-1",
      organisationId: "org-1",
    });
    const data = prismaMock.petPassport.update.mock.calls.at(-1)[0].data;
    expect(token).toHaveLength(43);
    expect(data.publicTokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.publicTokenRevokedAt).toBeNull();
  });

  it("issues a different token every time so rotation supersedes old links", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({ id: "pp-1" });
    prismaMock.petPassport.update.mockResolvedValue({});
    const first = await PetPassportService.issuePublicToken({
      patientId: "pat-1",
      organisationId: "org-1",
    });
    const second = await PetPassportService.issuePublicToken({
      patientId: "pat-1",
      organisationId: "org-1",
    });
    expect(first.token).not.toBe(second.token);
  });

  it("clears the hash on revoke so the link stops resolving", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue({ id: "pp-1" });
    prismaMock.petPassport.update.mockResolvedValue({});
    await PetPassportService.revokePublicToken({
      patientId: "pat-1",
      organisationId: "org-1",
    });
    const data = prismaMock.petPassport.update.mock.calls.at(-1)[0].data;
    expect(data.publicTokenHash).toBeNull();
    expect(data.publicTokenRevokedAt).toBeInstanceOf(Date);
  });

  it("404s when the pet has no issued passport", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.issuePublicToken({
        patientId: "pat-x",
        organisationId: "org-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.getPassportForParent", () => {
  const asParent = (linkedUserId: string | null = "user-1") => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue({ linkedUserId });
  };

  it("404s an unauthenticated caller", async () => {
    await expect(
      PetPassportService.getPassportForParent("pat-1", null),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s a caller who is not the pet's parent", async () => {
    asParent("someone-else");
    await expect(
      PetPassportService.getPassportForParent("pat-1", "user-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s when the pet has no linked parent account", async () => {
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
