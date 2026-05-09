import { LabCensusService } from "../../src/services/lab-census.service";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import { IntegrationService } from "../../src/services/integration.service";
import { IdexxClient } from "../../src/integrations/idexx/idexx.client";
import CompanionOrganisationModel from "../../src/models/companion-organisation";
import ParentCompanionModel from "../../src/models/parent-companion";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeMapping: { findFirst: jest.fn() },
    companion: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
    companionOrganisation: { findFirst: jest.fn() },
    parentCompanion: { findFirst: jest.fn() },
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

jest.mock("../../src/models/companion-organisation", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/parent-companion", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/companion", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/parent", () => ({
  ParentModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/code-mapping", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

const mongoQuery = <T>(result: T) => {
  const exec = jest.fn().mockResolvedValue(result);
  const query: any = {};
  query.setOptions = jest.fn().mockReturnValue(query);
  query.select = jest.fn().mockReturnValue(query);
  query.lean = jest.fn().mockReturnValue({ exec });
  query.exec = exec;
  return query;
};

describe("LabCensusService", () => {
  const readSwitch = isReadFromPostgres as jest.Mock;
  const organisationId = "507f1f77bcf86cd799439011";
  const companionId = "507f191e810c19729de860ea";
  const parentId = "507f191e810c19729de860eb";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IDEXX_PIMS_ID = "pims-id";
    process.env.IDEXX_PIMS_VERSION = "pims-version";
  });

  describe("addCensusPatient", () => {
    it("rejects invalid organisationId before any DB calls (mongo)", async () => {
      readSwitch.mockReturnValue(false);

      await expect(
        LabCensusService.addCensusPatient("IDEXX", {} as unknown as string, {
          companionId,
          parentId,
        }),
      ).rejects.toThrow("Invalid organisationId.");

      expect(CompanionOrganisationModel.findOne).not.toHaveBeenCalled();
      expect(ParentCompanionModel.findOne).not.toHaveBeenCalled();
    });

    it("rejects invalid companionId before any DB calls (mongo)", async () => {
      readSwitch.mockReturnValue(false);

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          companionId: {} as unknown as string,
          parentId,
        }),
      ).rejects.toThrow("Invalid companionId.");

      expect(CompanionOrganisationModel.findOne).not.toHaveBeenCalled();
      expect(ParentCompanionModel.findOne).not.toHaveBeenCalled();
    });

    it("rejects when companion is not linked to organisation (postgres)", async () => {
      readSwitch.mockReturnValue(true);
      (prisma.companionOrganisation.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.parentCompanion.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          companionId,
          parentId,
        }),
      ).rejects.toThrow("Companion not found.");

      expect(IntegrationService.requireAccount).not.toHaveBeenCalled();
      expect(IdexxClient).not.toHaveBeenCalled();
    });

    it("rejects when parent is not linked to companion (postgres)", async () => {
      readSwitch.mockReturnValue(true);
      (prisma.companionOrganisation.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });
      (prisma.parentCompanion.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          companionId,
          parentId,
        }),
      ).rejects.toThrow("Parent not found.");

      expect(IntegrationService.requireAccount).not.toHaveBeenCalled();
      expect(IdexxClient).not.toHaveBeenCalled();
    });

    it("rejects when companion is not linked to organisation (mongo)", async () => {
      readSwitch.mockReturnValue(false);
      (CompanionOrganisationModel.findOne as jest.Mock).mockReturnValue(
        mongoQuery(null),
      );
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue(
        mongoQuery({ _id: "link-1" }),
      );

      await expect(
        LabCensusService.addCensusPatient("IDEXX", organisationId, {
          companionId,
          parentId,
        }),
      ).rejects.toThrow("Companion not found.");

      expect(IntegrationService.requireAccount).not.toHaveBeenCalled();
      expect(IdexxClient).not.toHaveBeenCalled();
    });

    it("builds census payload and submits to IDEXX (postgres)", async () => {
      readSwitch.mockReturnValue(true);
      (prisma.companionOrganisation.findFirst as jest.Mock).mockResolvedValue({
        id: "link-1",
      });
      (prisma.parentCompanion.findFirst as jest.Mock).mockResolvedValue({
        id: "link-2",
      });

      (prisma.companion.findUnique as jest.Mock).mockResolvedValue({
        id: companionId,
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

      (prisma.codeMapping.findFirst as jest.Mock).mockResolvedValue({
        targetCode: "MAPPED",
      });

      (IntegrationService.requireAccount as jest.Mock).mockResolvedValue({
        credentials: {
          username: "u",
          password: "p",
          labAccountId: "lab-1",
        },
      });

      const addCensusPatient = jest.fn().mockResolvedValue({ ok: true });
      (IdexxClient as unknown as jest.Mock).mockImplementation(() => ({
        addCensusPatient,
      }));

      const result = await LabCensusService.addCensusPatient(
        "IDEXX",
        organisationId,
        {
          companionId,
          parentId,
          veterinarian: "Dr Vet",
          ivls: ["SN-1"],
        },
      );

      expect(result).toEqual({ ok: true });
      expect(addCensusPatient).toHaveBeenCalledTimes(1);
      expect(IntegrationService.requireAccount).toHaveBeenCalledWith(
        organisationId,
        "IDEXX",
      );
    });
  });
});
