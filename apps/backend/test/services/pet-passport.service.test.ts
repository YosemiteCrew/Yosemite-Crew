import {
  PetPassportService,
  PetPassportServiceError,
} from "src/services/pet-passport.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: { findUnique: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    vaccination: { create: jest.fn(), findMany: jest.fn() },
    parasiteTreatment: { create: jest.fn(), findMany: jest.fn() },
    rabiesTitration: { create: jest.fn(), findMany: jest.fn() },
    petPassport: { create: jest.fn(), findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  patient: { findUnique: jest.Mock };
  patientOrganisation: { findFirst: jest.Mock };
  vaccination: { create: jest.Mock; findMany: jest.Mock };
  parasiteTreatment: { create: jest.Mock; findMany: jest.Mock };
  rabiesTitration: { create: jest.Mock; findMany: jest.Mock };
  petPassport: { create: jest.Mock; findFirst: jest.Mock };
  organization: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
};
const auditMock = AuditTrailService.recordSafely as jest.Mock;

const ACTOR = { type: "PMS_USER" as const, id: "vet-1" };

const PATIENT = {
  id: "pat-1",
  dateOfBirth: new Date("2024-01-01T00:00:00.000Z"),
  microchipImplantedAt: new Date("2024-02-01T00:00:00.000Z"),
};

// Echo the created row back as the persisted record (Date round-trip).
const echoCreate = () => {
  prismaMock.vaccination.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: "vac-1",
      createdAt: new Date("2024-04-02T00:00:00.000Z"),
      manufacturer: null,
      batchNumber: null,
      lotNumber: null,
      validFrom: null,
      validUntil: null,
      nextDueDate: null,
      administeringVetName: null,
      vetLicenseNumber: null,
      site: null,
      route: null,
      notes: null,
      ...data,
    }),
  );
  prismaMock.parasiteTreatment.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: "trt-1",
      createdAt: new Date("2024-04-02T00:00:00.000Z"),
      manufacturer: null,
      administeringVetName: null,
      notes: null,
      ...data,
    }),
  );
  prismaMock.rabiesTitration.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: "tit-1",
      createdAt: new Date("2024-04-02T00:00:00.000Z"),
      reportUrl: null,
      ...data,
    }),
  );
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
};

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.patientOrganisation.findFirst.mockResolvedValue({ id: "link-1" });
  prismaMock.patient.findUnique.mockResolvedValue(PATIENT);
  prismaMock.organization.findUnique.mockResolvedValue({
    name: "Yosemite Vet Clinic",
  });
  prismaMock.parentPatient.findFirst.mockResolvedValue(null);
  prismaMock.vaccination.findMany.mockResolvedValue([]);
  prismaMock.parasiteTreatment.findMany.mockResolvedValue([]);
  prismaMock.rabiesTitration.findMany.mockResolvedValue([]);
  prismaMock.petPassport.findFirst.mockResolvedValue(null);
  echoCreate();
});

const record = (overrides: Record<string, unknown> = {}) =>
  PetPassportService.recordVaccination({
    patientId: "pat-1",
    organisationId: "org-1",
    actor: ACTOR,
    input: {
      vaccineType: "RABIES",
      vaccineName: "Nobivac Rabies",
      dateAdministered: "2024-04-01T00:00:00.000Z",
      ...overrides,
    },
  });

describe("PetPassportService.recordVaccination", () => {
  it("records a rabies dose and defaults validFrom to 21 days after administration", async () => {
    const dto = await record({ batchNumber: "A234B" });
    expect(prismaMock.vaccination.create).toHaveBeenCalledTimes(1);
    expect(dto.vaccineType).toBe("RABIES");
    expect(dto.dateAdministered).toBe("2024-04-01T00:00:00.000Z");
    expect(dto.validFrom).toBe("2024-04-22T00:00:00.000Z");
    expect(dto.batchNumber).toBe("A234B");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "VACCINATION_RECORDED",
        patientId: "pat-1",
        entityId: "vac-1",
      }),
    );
  });

  it("honours an explicit validFrom", async () => {
    const dto = await record({ validFrom: "2024-05-01T00:00:00.000Z" });
    expect(dto.validFrom).toBe("2024-05-01T00:00:00.000Z");
  });

  it("does not default validFrom for a non-rabies vaccine", async () => {
    const dto = await record({ vaccineType: "CORE", vaccineName: "DHPP" });
    expect(dto.validFrom).toBeUndefined();
  });

  it("persists and maps every optional field", async () => {
    const dto = await record({
      vaccineType: "CORE",
      vaccineName: "DHPP",
      manufacturer: "MSD",
      batchNumber: "B1",
      lotNumber: "L1",
      validFrom: "2024-04-10T00:00:00.000Z",
      validUntil: "2027-04-10T00:00:00.000Z",
      nextDueDate: "2025-04-10T00:00:00.000Z",
      administeringVetName: "Dr A",
      vetLicenseNumber: "RCVS-1",
      site: "left shoulder",
      route: "subcutaneous",
      notes: "no reaction",
    });
    expect(dto).toMatchObject({
      manufacturer: "MSD",
      lotNumber: "L1",
      validUntil: "2027-04-10T00:00:00.000Z",
      nextDueDate: "2025-04-10T00:00:00.000Z",
      site: "left shoulder",
      route: "subcutaneous",
      notes: "no reaction",
      administeringVetName: "Dr A",
      vetLicenseNumber: "RCVS-1",
    });
  });

  it("handles a system actor with no id", async () => {
    const dto = await PetPassportService.recordVaccination({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: { type: "SYSTEM" },
      input: {
        vaccineType: "CORE",
        vaccineName: "DHPP",
        dateAdministered: "2024-04-01T00:00:00.000Z",
      },
    });
    expect(dto.id).toBe("vac-1");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null }),
    );
  });

  it("rejects a rabies dose for an animal under 12 weeks", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      dateOfBirth: new Date("2024-03-15T00:00:00.000Z"),
    });
    await expect(record()).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.vaccination.create).not.toHaveBeenCalled();
  });

  it("rejects a rabies dose dated before the microchip implant", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      microchipImplantedAt: new Date("2024-05-01T00:00:00.000Z"),
    });
    await expect(record()).rejects.toBeInstanceOf(PetPassportServiceError);
  });

  it("allows a rabies dose when the microchip implant date is unknown", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      microchipImplantedAt: null,
    });
    await expect(record()).resolves.toMatchObject({ vaccineType: "RABIES" });
  });

  it("rejects an invalid dateAdministered", async () => {
    await expect(
      record({ dateAdministered: "not-a-date" }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("404s when the companion is not in the caller's org", async () => {
    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(record()).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.patient.findUnique).not.toHaveBeenCalled();
  });

  it("404s when the companion does not exist", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);
    await expect(record()).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService.listVaccinations", () => {
  it("returns vaccinations newest-first as DTOs", async () => {
    prismaMock.vaccination.findMany.mockResolvedValue([
      {
        id: "vac-1",
        patientId: "pat-1",
        vaccineType: "RABIES",
        vaccineName: "Nobivac Rabies",
        manufacturer: "MSD",
        batchNumber: "A234B",
        lotNumber: null,
        dateAdministered: new Date("2024-04-01T00:00:00.000Z"),
        validFrom: new Date("2024-04-22T00:00:00.000Z"),
        validUntil: null,
        nextDueDate: null,
        administeringVetName: "Dr A",
        vetLicenseNumber: null,
        site: null,
        route: null,
        notes: null,
        createdAt: new Date("2024-04-02T00:00:00.000Z"),
      },
    ]);
    const list = await PetPassportService.listVaccinations("pat-1", "org-1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: "vac-1",
      vaccineName: "Nobivac Rabies",
      manufacturer: "MSD",
      validFrom: "2024-04-22T00:00:00.000Z",
    });
    expect(prismaMock.vaccination.findMany).toHaveBeenCalledWith({
      where: { patientId: "pat-1", organisationId: "org-1" },
      orderBy: { dateAdministered: "desc" },
    });
  });
});

describe("PetPassportService.getPassport", () => {
  const FULL_PATIENT = {
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
  };

  const vaccRow = (over: Record<string, unknown> = {}) => ({
    id: "vac-1",
    patientId: "pat-1",
    vaccineType: "RABIES",
    vaccineName: "Nobivac Rabies",
    manufacturer: null,
    batchNumber: null,
    lotNumber: null,
    dateAdministered: new Date("2024-04-01T00:00:00.000Z"),
    validFrom: new Date("2024-04-22T00:00:00.000Z"),
    validUntil: null,
    nextDueDate: null,
    administeringVetName: null,
    vetLicenseNumber: null,
    site: null,
    route: null,
    notes: null,
    createdAt: new Date("2024-04-02T00:00:00.000Z"),
    ...over,
  });

  it("assembles identity, microchip, rabies and other vaccinations", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(FULL_PATIENT);
    prismaMock.vaccination.findMany.mockResolvedValue([
      vaccRow(),
      vaccRow({ id: "vac-2", vaccineType: "CORE", vaccineName: "DHPP" }),
    ]);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.identity).toMatchObject({
      id: "pat-1",
      name: "Doggy",
      species: "dog",
      sex: "male",
      colour: "black",
      dateOfBirth: "2024-01-01T00:00:00.000Z",
    });
    expect(passport.microchip).toEqual({
      number: "985141000123456",
      implantedAt: "2024-02-01T00:00:00.000Z",
      location: "left neck",
    });
    expect(passport.passportNumber).toBe("GB-YC-1");
    expect(passport.rabies?.vaccineName).toBe("Nobivac Rabies");
    expect(passport.vaccinations).toHaveLength(1);
    expect(passport.vaccinations[0].vaccineName).toBe("DHPP");
  });

  it("handles missing optional identity and microchip detail", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...FULL_PATIENT,
      colour: null,
      photoUrl: null,
      passportNumber: null,
      microchipImplantedAt: null,
      microchipLocation: null,
    });
    prismaMock.vaccination.findMany.mockResolvedValue([]);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.identity.colour).toBeUndefined();
    expect(passport.identity.photoUrl).toBeUndefined();
    expect(passport.passportNumber).toBeUndefined();
    expect(passport.microchip).toEqual({ number: "985141000123456" });
    expect(passport.rabies).toBeUndefined();
    expect(passport.vaccinations).toEqual([]);
  });

  it("404s when the companion does not exist", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);
    await expect(
      PetPassportService.getPassport("pat-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s when the companion is not in the caller's org", async () => {
    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.getPassport("pat-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService treatments and titrations", () => {
  it("records a parasite treatment and maps optional fields", async () => {
    const dto = await PetPassportService.recordParasiteTreatment({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: ACTOR,
      input: {
        treatmentType: "ECHINOCOCCUS",
        productName: "Milbemax",
        manufacturer: "Elanco",
        treatedAt: "2024-06-20T14:00:00.000Z",
        administeringVetName: "Dr A",
        notes: "no reaction",
      },
    });
    expect(dto).toMatchObject({
      id: "trt-1",
      productName: "Milbemax",
      treatmentType: "ECHINOCOCCUS",
      manufacturer: "Elanco",
      administeringVetName: "Dr A",
      notes: "no reaction",
    });
    expect(dto.treatedAt).toBe("2024-06-20T14:00:00.000Z");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TREATMENT_RECORDED" }),
    );
  });

  it("rejects an invalid treatment date", async () => {
    await expect(
      PetPassportService.recordParasiteTreatment({
        patientId: "pat-1",
        organisationId: "org-1",
        actor: ACTOR,
        input: { treatmentType: "TICK", productName: "X", treatedAt: "nope" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s a treatment for a companion outside the caller's org", async () => {
    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PetPassportService.recordParasiteTreatment({
        patientId: "pat-1",
        organisationId: "org-1",
        actor: ACTOR,
        input: {
          treatmentType: "FLEA",
          productName: "X",
          treatedAt: "2024-06-20T00:00:00.000Z",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("lists parasite treatments newest-first", async () => {
    prismaMock.parasiteTreatment.findMany.mockResolvedValue([
      {
        id: "t1",
        patientId: "pat-1",
        treatmentType: "OTHER",
        productName: "X",
        manufacturer: null,
        treatedAt: new Date("2024-06-20T00:00:00.000Z"),
        administeringVetName: null,
        notes: null,
        createdAt: new Date("2024-06-21T00:00:00.000Z"),
      },
    ]);
    const list = await PetPassportService.listParasiteTreatments(
      "pat-1",
      "org-1",
    );
    expect(list).toHaveLength(1);
    expect(prismaMock.parasiteTreatment.findMany).toHaveBeenCalledWith({
      where: { patientId: "pat-1", organisationId: "org-1" },
      orderBy: { treatedAt: "desc" },
    });
  });

  it("records a rabies titration", async () => {
    const dto = await PetPassportService.recordRabiesTitration({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: ACTOR,
      input: {
        approvedLab: "EU Lab",
        sampleDate: "2024-05-01T00:00:00.000Z",
        resultIuMl: 0.8,
        reportUrl: "http://report",
      },
    });
    expect(dto).toMatchObject({
      id: "tit-1",
      approvedLab: "EU Lab",
      resultIuMl: 0.8,
      reportUrl: "http://report",
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TITRATION_RECORDED" }),
    );
  });

  it("rejects a negative titration result", async () => {
    await expect(
      PetPassportService.recordRabiesTitration({
        patientId: "pat-1",
        organisationId: "org-1",
        actor: ACTOR,
        input: {
          approvedLab: "L",
          sampleDate: "2024-05-01T00:00:00.000Z",
          resultIuMl: -1,
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an invalid titration sample date", async () => {
    await expect(
      PetPassportService.recordRabiesTitration({
        patientId: "pat-1",
        organisationId: "org-1",
        actor: ACTOR,
        input: { approvedLab: "L", sampleDate: "nope", resultIuMl: 0.8 },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("lists rabies titrations", async () => {
    prismaMock.rabiesTitration.findMany.mockResolvedValue([
      {
        id: "s1",
        patientId: "pat-1",
        approvedLab: "L",
        sampleDate: new Date("2024-05-01T00:00:00.000Z"),
        resultIuMl: 0.8,
        reportUrl: null,
        createdAt: new Date("2024-05-02T00:00:00.000Z"),
      },
    ]);
    const list = await PetPassportService.listRabiesTitrations(
      "pat-1",
      "org-1",
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ approvedLab: "L", resultIuMl: 0.8 });
  });

  it("getPassport includes parasite treatments and rabies titrations", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      id: "pat-1",
      name: "Doggy",
      type: "dog",
      breed: "Rottweiler",
      gender: "male",
      colour: null,
      photoUrl: null,
      dateOfBirth: new Date("2024-01-01T00:00:00.000Z"),
      microchipNumber: null,
      microchipImplantedAt: null,
      microchipLocation: null,
      passportNumber: null,
    });
    prismaMock.parasiteTreatment.findMany.mockResolvedValue([
      {
        id: "t1",
        patientId: "pat-1",
        treatmentType: "ECHINOCOCCUS",
        productName: "Milbemax",
        manufacturer: null,
        treatedAt: new Date("2024-06-20T14:00:00.000Z"),
        administeringVetName: null,
        notes: null,
        createdAt: new Date("2024-06-20T14:00:00.000Z"),
      },
    ]);
    prismaMock.rabiesTitration.findMany.mockResolvedValue([
      {
        id: "s1",
        patientId: "pat-1",
        approvedLab: "EU Lab",
        sampleDate: new Date("2024-05-01T00:00:00.000Z"),
        resultIuMl: 0.8,
        reportUrl: null,
        createdAt: new Date("2024-05-02T00:00:00.000Z"),
      },
    ]);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.parasiteTreatments).toHaveLength(1);
    expect(passport.parasiteTreatments[0]).toMatchObject({
      productName: "Milbemax",
      treatmentType: "ECHINOCOCCUS",
    });
    expect(passport.rabiesTitrations).toHaveLength(1);
    expect(passport.rabiesTitrations[0]).toMatchObject({
      approvedLab: "EU Lab",
      resultIuMl: 0.8,
    });
  });
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
      issuingVetLicense: "RCVS-1",
    });
    expect(dto.issueDate).toBe("2024-06-24T00:00:00.000Z");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PASSPORT_ISSUED",
        entityId: "pp-1",
      }),
    );
  });

  it("maps optional issuance fields to undefined when absent", async () => {
    const dto = await PetPassportService.issuePassport({
      patientId: "pat-1",
      organisationId: "org-1",
      actor: { type: "SYSTEM" },
      input: { passportNumber: "GB-YC-2" },
    });
    expect(dto).toMatchObject({ passportNumber: "GB-YC-2" });
    expect(dto.issuingCountry).toBeUndefined();
    expect(dto.issuingVetName).toBeUndefined();
    expect(dto.status).toBeUndefined();
  });

  it("404s issuing for a companion outside the caller's org", async () => {
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

  it("getPassport includes the latest issuance and prefers its passport number", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      id: "pat-1",
      name: "Doggy",
      type: "dog",
      breed: "Rottweiler",
      gender: "male",
      colour: null,
      photoUrl: null,
      dateOfBirth: new Date("2024-01-01T00:00:00.000Z"),
      microchipNumber: null,
      microchipImplantedAt: null,
      microchipLocation: null,
      passportNumber: "PATIENT-NO",
    });
    prismaMock.petPassport.findFirst.mockResolvedValue({
      passportNumber: "ISSUED-NO",
      issuingCountry: "GB",
      issuingAuthority: "RCVS",
      issuingVetName: "Dr A",
      issuingVetLicense: "RCVS-1",
      issueDate: new Date("2024-06-24T00:00:00.000Z"),
      status: null,
    });
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.issuance).toMatchObject({
      passportNumber: "ISSUED-NO",
      issuingVetName: "Dr A",
      issuingPractice: "Yosemite Vet Clinic",
    });
    expect(passport.passportNumber).toBe("ISSUED-NO");
  });
});

describe("PetPassportService.getPublicPassport", () => {
  it("resolves the issuing org and assembles the passport", async () => {
    prismaMock.petPassport.findFirst
      .mockResolvedValueOnce({ organisationId: "org-1" })
      .mockResolvedValueOnce(null);
    const passport = await PetPassportService.getPublicPassport("pat-1");
    expect(passport.identity.id).toBe("pat-1");
    expect(prismaMock.petPassport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: "pat-1" } }),
    );
  });

  it("404s when the companion has no issued passport", async () => {
    prismaMock.petPassport.findFirst.mockResolvedValueOnce(null);
    await expect(
      PetPassportService.getPublicPassport("pat-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PetPassportService owner section", () => {
  it("includes the owner for an authenticated getPassport caller", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue({
      firstName: "Sam",
      lastName: "Lee",
      email: "sam@example.com",
      phoneNumber: "123",
    });
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.owner).toEqual({
      name: "Sam Lee",
      email: "sam@example.com",
      phone: "123",
    });
  });

  it("omits the owner when the parent record is missing", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue(null);
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.owner).toBeUndefined();
  });

  it("maps absent owner surname and contact to undefined", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    prismaMock.parent.findUnique.mockResolvedValue({
      firstName: "Sam",
      lastName: null,
      email: null,
      phoneNumber: null,
    });
    const passport = await PetPassportService.getPassport("pat-1", "org-1");
    expect(passport.owner).toEqual({ name: "Sam" });
  });

  it("never loads the owner for the public passport", async () => {
    prismaMock.petPassport.findFirst
      .mockResolvedValueOnce({ organisationId: "org-1" })
      .mockResolvedValueOnce(null);
    const passport = await PetPassportService.getPublicPassport("pat-1");
    expect(passport.owner).toBeUndefined();
    expect(prismaMock.parentPatient.findFirst).not.toHaveBeenCalled();
  });
});
