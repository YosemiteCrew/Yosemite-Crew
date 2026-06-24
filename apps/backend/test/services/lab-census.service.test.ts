import { LabCensusService } from "../../src/services/lab-census.service";
import { prisma } from "../../src/config/prisma";
import { IntegrationService } from "../../src/services/integration.service";
import { IdexxClient } from "../../src/integrations/idexx/idexx.client";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeMapping: { findFirst: jest.fn() },
    patient: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
  },
}));

jest.mock("../../src/services/integration.service", () => ({
  IntegrationService: {
    requireAccount: jest.fn(),
  },
}));

jest.mock("../../src/integrations/idexx/idexx.client", () => ({
  IdexxClient: jest.fn(),
}));

describe("LabCensusService", () => {
  const organisationId = "org-1";
  const patientId = "patient-1";
  const parentId = "parent-1";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IDEXX_PIMS_ID = "pims-id";
    process.env.IDEXX_PIMS_VERSION = "pims-version";

    (IntegrationService.requireAccount as jest.Mock).mockResolvedValue({
      credentials: {
        username: "u",
        password: "p",
        labAccountId: "lab-1",
      },
    });

    (prisma.codeMapping.findFirst as jest.Mock).mockResolvedValue({
      targetCode: "MAPPED",
    });
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValue({
      id: "patient-org-link",
    });
    (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValue({
      id: "parent-patient-link",
    });
    (prisma.patient.findUnique as jest.Mock).mockResolvedValue({
      id: patientId,
      name: "Buddy",
      gender: "male",
      isNeutered: true,
      dateOfBirth: new Date("2020-01-01T00:00:00.000Z"),
      microchipNumber: "mc-1",
      speciesCode: "DOG",
      breedCode: "LAB",
    });
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      id: parentId,
      firstName: "Pat",
      lastName: "Doe",
      email: "pat@example.com",
      phoneNumber: "123",
      address: {
        addressLine: "123 Street",
        city: "City",
        state: "ST",
        postalCode: "12345",
        country: "US",
      },
    });

    (IdexxClient as unknown as jest.Mock).mockImplementation(() => ({
      addCensusPatient: jest.fn().mockResolvedValue({ ok: true }),
      listIvlsDevices: jest.fn(),
      listCensus: jest.fn(),
      deleteCensus: jest.fn(),
      getCensusById: jest.fn(),
      deleteCensusById: jest.fn(),
      getCensusPatient: jest.fn(),
      deleteCensusPatient: jest.fn(),
    }));
  });

  it("rejects unsupported providers", async () => {
    await expect(
      LabCensusService.listIvlsDevices("LABCORP", organisationId),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("rejects when parentId is missing", async () => {
    await expect(
      LabCensusService.addCensusPatient("IDEXX", organisationId, {
        patientId,
      }),
    ).rejects.toThrow("parentId is required for census.");
  });

  it("rejects when companion is not linked to organisation", async () => {
    (prisma.patientOrganisation.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );

    await expect(
      LabCensusService.addCensusPatient("IDEXX", organisationId, {
        patientId,
        parentId,
      }),
    ).rejects.toThrow("Companion not found.");
  });

  it("rejects when parent is not linked to companion", async () => {
    (prisma.parentPatient.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      LabCensusService.addCensusPatient("IDEXX", organisationId, {
        patientId,
        parentId,
      }),
    ).rejects.toThrow("Parent not found.");
  });

  it("rejects when companion species or breed is missing", async () => {
    (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
      id: patientId,
      name: "Buddy",
      gender: "male",
      speciesCode: "DOG",
      breedCode: null,
    });

    await expect(
      LabCensusService.addCensusPatient("IDEXX", organisationId, {
        patientId,
        parentId,
      }),
    ).rejects.toThrow("Companion speciesCode and breedCode are required.");
  });

  it("submits a census payload through IDEXX", async () => {
    const addCensusPatient = jest.fn().mockResolvedValue({ ok: true });
    (IdexxClient as unknown as jest.Mock).mockImplementation(() => ({
      addCensusPatient,
      listIvlsDevices: jest.fn(),
      listCensus: jest.fn(),
      deleteCensus: jest.fn(),
      getCensusById: jest.fn(),
      deleteCensusById: jest.fn(),
      getCensusPatient: jest.fn(),
      deleteCensusPatient: jest.fn(),
    }));

    const result = await LabCensusService.addCensusPatient(
      "IDEXX",
      organisationId,
      {
        patientId,
        parentId,
        veterinarian: "Dr Vet",
        ivls: ["SN-1"],
      },
    );

    expect(result).toEqual({ ok: true });
    expect(IntegrationService.requireAccount).toHaveBeenCalledWith(
      organisationId,
      "IDEXX",
    );
    expect(addCensusPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: expect.objectContaining({
          patientId,
          client: expect.objectContaining({
            id: parentId,
          }),
        }),
        ivls: [{ serialNumber: "SN-1" }],
      }),
    );
  });
});
