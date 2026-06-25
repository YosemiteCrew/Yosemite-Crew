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
  },
}));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  patient: { findUnique: jest.Mock };
  patientOrganisation: { findFirst: jest.Mock };
  vaccination: { create: jest.Mock; findMany: jest.Mock };
};
const auditMock = AuditTrailService.recordSafely as jest.Mock;

const ACTOR = { type: "PMS_USER" as const, id: "vet-1" };

const PATIENT = {
  id: "pat-1",
  dateOfBirth: new Date("2024-01-01T00:00:00.000Z"),
  microchipImplantedAt: new Date("2024-02-01T00:00:00.000Z"),
};

// Echo the created row back as the persisted record (Date round-trip).
const echoCreate = () =>
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

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.patientOrganisation.findFirst.mockResolvedValue({ id: "link-1" });
  prismaMock.patient.findUnique.mockResolvedValue(PATIENT);
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
