import { Types } from "mongoose";
import ServiceModel from "../../src/models/service";
import OrganizationModel from "src/models/organization";
import {
  ServiceService,
  ServiceServiceError,
} from "../../src/services/service.service";
import {
  fromServiceRequestDTO,
  toServiceResponseDTO,
  type ServiceRequestDTO,
} from "@yosemite-crew/types";

jest.mock("../../src/models/service", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock("@yosemite-crew/types", () => ({
  __esModule: true,
  fromServiceRequestDTO: jest.fn(),
  toServiceResponseDTO: jest.fn(),
}));

const mockedServiceModel = ServiceModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
  deleteOne: jest.Mock;
};

const mockedOrgModel = OrganizationModel as unknown as {
  find: jest.Mock;
};

const mockedTypes = {
  fromServiceRequestDTO: fromServiceRequestDTO as jest.Mock,
  toServiceResponseDTO: toServiceResponseDTO as jest.Mock,
};

const makeDoc = (data: Record<string, any>) => {
  const doc: any = { ...data };
  doc.save = jest.fn().mockResolvedValue(true);
  doc.deleteOne = jest.fn().mockResolvedValue(true);
  doc.toObject = () => {
    const { save, deleteOne, toObject, ...rest } = doc;
    return {
      ...rest,
      _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
    };
  };
  return doc;
};

describe("ServiceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates a service and maps response", async () => {
      const dto: ServiceRequestDTO = {
        resourceType: "HealthcareService",
      } as any;
      mockedTypes.fromServiceRequestDTO.mockReturnValue({
        organisationId: "507f1f77bcf86cd799439011",
        name: "Consultation",
        description: null,
        durationMinutes: 30,
        cost: 100,
        maxDiscount: null,
        specialityId: null,
        serviceType: "CONSULTATION",
        observationToolId: null,
        isActive: true,
      });

      const doc = makeDoc({
        organisationId: new Types.ObjectId("507f1f77bcf86cd799439011"),
        name: "Consultation",
        durationMinutes: 30,
        cost: 100,
        serviceType: "CONSULTATION",
        observationToolId: null,
        isActive: true,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      });
      mockedServiceModel.create.mockResolvedValueOnce(doc);
      mockedTypes.toServiceResponseDTO.mockImplementation(
        (value: any) => value,
      );

      const result = await ServiceService.create(dto);

      expect(mockedTypes.fromServiceRequestDTO).toHaveBeenCalledWith(dto);
      expect(mockedServiceModel.create).toHaveBeenCalledWith({
        organisationId: new Types.ObjectId("507f1f77bcf86cd799439011"),
        name: "Consultation",
        description: null,
        durationMinutes: 30,
        cost: 100,
        maxDiscount: null,
        specialityId: null,
        serviceType: "CONSULTATION",
        observationToolId: null,
        isActive: true,
      });
      expect(result).toMatchObject({
        organisationId: expect.any(String),
        name: "Consultation",
        cost: 100,
      });
      expect(mockedTypes.toServiceResponseDTO).toHaveBeenCalledTimes(1);
    });
  });

  describe("update", () => {
    it("applies partial updates and returns DTO", async () => {
      const existing = makeDoc({
        organisationId: new Types.ObjectId(),
        name: "Old",
        description: "desc",
        durationMinutes: 20,
        cost: 50,
        maxDiscount: 10,
        specialityId: null,
        headOfServiceId: null,
        teamMemberIds: [],
        serviceType: "CONSULTATION",
        observationToolId: null,
        isActive: true,
      });

      mockedServiceModel.findById.mockResolvedValueOnce(existing);
      mockedTypes.fromServiceRequestDTO.mockReturnValue({
        name: "New Name",
        durationMinutes: 40,
        teamMemberIds: ["abc"],
        serviceType: "OBSERVATION_TOOL",
        observationToolId: "507f1f77bcf86cd799439022",
      });
      mockedTypes.toServiceResponseDTO.mockImplementation(
        (value: any) => value,
      );

      const result = await ServiceService.update("507f1f77bcf86cd799439011", {
        resourceType: "HealthcareService",
      } as any);

      expect(existing.name).toBe("New Name");
      expect(existing.durationMinutes).toBe(40);
      expect(existing.serviceType).toBe("OBSERVATION_TOOL");
      expect(existing.observationToolId?.toString()).toBe(
        "507f1f77bcf86cd799439022",
      );
      expect(existing.teamMemberIds).toEqual([]);
      expect(existing.save).toHaveBeenCalled();
      expect(result.name).toBe("New Name");
      expect(mockedTypes.toServiceResponseDTO).toHaveBeenCalledTimes(1);
    });

    it("throws when service missing", async () => {
      mockedServiceModel.findById.mockResolvedValueOnce(null);
      mockedTypes.fromServiceRequestDTO.mockReturnValue({});

      await expect(
        ServiceService.update("507f1f77bcf86cd799439011", {
          resourceType: "HealthcareService",
        } as any),
      ).rejects.toBeInstanceOf(ServiceServiceError);
    });
  });

  describe("search", () => {
    it("searches with optional organisation filter", async () => {
      const docs = [
        makeDoc({
          organisationId: new Types.ObjectId(),
          name: "Cardio",
          durationMinutes: 30,
          cost: 100,
          isActive: true,
        }),
      ];

      mockedServiceModel.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue(docs),
      });
      mockedTypes.toServiceResponseDTO.mockImplementation(
        (value: any) => value,
      );

      const results = await ServiceService.search(
        "cardio",
        "507f1f77bcf86cd799439011",
      );

      expect(mockedServiceModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: expect.any(Types.ObjectId),
          $text: { $search: "cardio" },
        }),
      );
      expect(results).toHaveLength(1);
    });
  });

  describe("listOrganisationsProvidingService", () => {
    it("returns organisations mapped from services", async () => {
      mockedServiceModel.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { organisationId: new Types.ObjectId("507f1f77bcf86cd799439011") },
            { organisationId: new Types.ObjectId("507f1f77bcf86cd799439012") },
          ]),
      });

      mockedOrgModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: "507f1f77bcf86cd799439011", name: "Org 1", isActive: true },
          { _id: "507f1f77bcf86cd799439012", name: "Org 2", isActive: true },
        ]),
      });

      const results =
        await ServiceService.listOrganisationsProvidingService("Cardio");

      expect(mockedServiceModel.find).toHaveBeenCalled();
      expect(mockedOrgModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: {
            $in: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
          },
        }),
      );
      expect(results).toEqual([
        {
          id: "507f1f77bcf86cd799439011",
          name: "Org 1",
          imageURL: undefined,
          phoneNo: undefined,
          type: undefined,
          address: undefined,
        },
        {
          id: "507f1f77bcf86cd799439012",
          name: "Org 2",
          imageURL: undefined,
          phoneNo: undefined,
          type: undefined,
          address: undefined,
        },
      ]);
    });
  });
});
