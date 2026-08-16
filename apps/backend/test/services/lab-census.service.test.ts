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

  const stubClient = () => {
    const client = {
      listIvlsDevices: jest.fn().mockResolvedValue({ devices: ["ivls-1"] }),
      listCensus: jest.fn().mockResolvedValue({ census: [{ id: "c-1" }] }),
      deleteCensus: jest.fn().mockResolvedValue({ deleted: true }),
      getCensusById: jest.fn().mockResolvedValue({ id: "census-1" }),
      deleteCensusById: jest.fn().mockResolvedValue({ deleted: "census-1" }),
      getCensusPatient: jest.fn().mockResolvedValue({ id: patientId }),
      addCensusPatient: jest.fn().mockResolvedValue({ ok: true }),
      deleteCensusPatient: jest.fn().mockResolvedValue({ deleted: patientId }),
    };
    (IdexxClient as unknown as jest.Mock).mockImplementation(() => client);
    return client;
  };

  const addAndCapturePayload = async (
    input: Parameters<typeof LabCensusService.addCensusPatient>[2],
  ) => {
    const client = stubClient();
    await LabCensusService.addCensusPatient("IDEXX", organisationId, input);
    return client.addCensusPatient.mock.calls[0][0] as any;
  };

  describe("provider guard", () => {
    it("rejects an empty provider before building a client", async () => {
      await expect(
        LabCensusService.listCensus("", organisationId),
      ).rejects.toThrow("Unsupported lab provider.");

      expect(IntegrationService.requireAccount).not.toHaveBeenCalled();
    });

    it("accepts a lowercase provider alias", async () => {
      const client = stubClient();

      await expect(
        LabCensusService.listCensus("  idexx  ", organisationId),
      ).resolves.toEqual({ census: [{ id: "c-1" }] });

      expect(client.listCensus).toHaveBeenCalledTimes(1);
    });
  });

  describe("IDEXX client passthroughs", () => {
    it("lists IVLS devices with the organisation's credentials", async () => {
      const client = stubClient();

      const result = await LabCensusService.listIvlsDevices(
        "IDEXX",
        organisationId,
      );

      expect(result).toEqual({ devices: ["ivls-1"] });
      expect(IntegrationService.requireAccount).toHaveBeenCalledWith(
        organisationId,
        "IDEXX",
      );
      expect(IdexxClient).toHaveBeenCalledWith({
        username: "u",
        password: "p",
        labAccountId: "lab-1",
        pimsId: "pims-id",
        pimsVersion: "pims-version",
      });
      expect(client.listIvlsDevices).toHaveBeenCalledTimes(1);
    });

    it("deletes the whole census", async () => {
      const client = stubClient();

      await expect(
        LabCensusService.deleteCensus("IDEXX", organisationId),
      ).resolves.toEqual({ deleted: true });
      expect(client.deleteCensus).toHaveBeenCalledTimes(1);
    });

    it("reads and deletes a census by id", async () => {
      const client = stubClient();

      await expect(
        LabCensusService.getCensusById("IDEXX", organisationId, "census-1"),
      ).resolves.toEqual({ id: "census-1" });
      expect(client.getCensusById).toHaveBeenCalledWith("census-1");

      await expect(
        LabCensusService.deleteCensusById("IDEXX", organisationId, "census-1"),
      ).resolves.toEqual({ deleted: "census-1" });
      expect(client.deleteCensusById).toHaveBeenCalledWith("census-1");
    });

    it("reads and deletes a census patient", async () => {
      const client = stubClient();

      await expect(
        LabCensusService.getCensusPatient("IDEXX", organisationId, patientId),
      ).resolves.toEqual({ id: patientId });
      expect(client.getCensusPatient).toHaveBeenCalledWith(patientId);

      await expect(
        LabCensusService.deleteCensusPatient(
          "IDEXX",
          organisationId,
          patientId,
        ),
      ).resolves.toEqual({ deleted: patientId });
      expect(client.deleteCensusPatient).toHaveBeenCalledWith(patientId);
    });
  });

  describe("census payload", () => {
    it("rejects when the companion record itself is missing", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          patientId,
          parentId,
        }),
      ).rejects.toThrow("Companion not found.");
    });

    it("rejects when the parent record itself is missing", async () => {
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          patientId,
          parentId,
        }),
      ).rejects.toThrow("Parent not found.");
    });

    it("rejects when the parent has no last name", async () => {
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        id: parentId,
        firstName: "Pat",
        lastName: null,
      });

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          patientId,
          parentId,
        }),
      ).rejects.toThrow("Parent last name is required for IDEXX census.");
    });

    it("rejects when the companion has no species code", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Buddy",
        gender: "male",
        speciesCode: null,
        breedCode: "LAB",
      });

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          patientId,
          parentId,
        }),
      ).rejects.toThrow("Companion speciesCode and breedCode are required.");
    });

    it("maps a neutered male companion and its birthdate", async () => {
      const payload = await addAndCapturePayload({ patientId, parentId });

      expect(payload.patient).toMatchObject({
        patientId,
        name: "Buddy",
        microchip: "mc-1",
        speciesCode: "MAPPED",
        breedCode: "MAPPED",
        genderCode: "MALE_NEUTERED",
        birthdate: "2020-01-01",
      });
      expect(payload.patient.client.address).toEqual({
        street1: "123 Street",
        city: "City",
        stateProvince: "ST",
        postalCode: "12345",
        country: "US",
        email: "pat@example.com",
        phone: "123",
      });
      expect(payload.veterinarian).toBeUndefined();
      expect(payload.ivls).toBeUndefined();
    });

    it("maps an intact male companion", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Buddy",
        gender: "male",
        isNeutered: false,
        speciesCode: "DOG",
        breedCode: "LAB",
      });

      const payload = await addAndCapturePayload({ patientId, parentId });

      expect(payload.patient.genderCode).toBe("MALE_INTACT");
    });

    it("maps a spayed female companion", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Luna",
        gender: "female",
        isNeutered: true,
        speciesCode: "DOG",
        breedCode: "LAB",
      });

      const payload = await addAndCapturePayload({ patientId, parentId });

      expect(payload.patient.genderCode).toBe("FEMALE_SPAYED");
    });

    it("maps a female companion with an unknown neuter status", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Luna",
        gender: "female",
        isNeutered: null,
        speciesCode: "DOG",
        breedCode: "LAB",
      });

      const payload = await addAndCapturePayload({ patientId, parentId });

      expect(payload.patient.genderCode).toBe("FEMALE_INTACT");
    });

    it("falls back to UNKNOWN for an unrecognised gender", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Rex",
        gender: "other",
        speciesCode: "DOG",
        breedCode: "LAB",
      });

      const payload = await addAndCapturePayload({ patientId, parentId });

      expect(payload.patient.genderCode).toBe("UNKNOWN");
    });

    it("omits optional companion and parent details when absent", async () => {
      (prisma.patient.findUnique as jest.Mock).mockResolvedValueOnce({
        id: patientId,
        name: "Buddy",
        gender: "male",
        isNeutered: true,
        dateOfBirth: null,
        microchipNumber: null,
        speciesCode: "DOG",
        breedCode: "LAB",
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        id: parentId,
        firstName: "Pat",
        lastName: "Doe",
        email: null,
        phoneNumber: null,
        address: null,
      });

      const payload = await addAndCapturePayload({
        patientId,
        parentId,
        veterinarian: null,
        ivls: [{ serialNumber: "SN-2" }],
      });

      expect(payload.patient.birthdate).toBeUndefined();
      expect(payload.patient.microchip).toBeUndefined();
      expect(payload.patient.client.address).toEqual({
        street1: undefined,
        city: undefined,
        stateProvince: undefined,
        postalCode: undefined,
        country: undefined,
        email: undefined,
        phone: undefined,
      });
      expect(payload.veterinarian).toBeUndefined();
      expect(payload.ivls).toEqual([{ serialNumber: "SN-2" }]);
    });
  });
});
