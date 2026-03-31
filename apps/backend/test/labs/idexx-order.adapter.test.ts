import { Types } from "mongoose";
import { IdexxOrderAdapter } from "src/labs/idexx/idexx-order.adapter";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import CompanionModel from "src/models/companion";
import ParentCompanionModel from "src/models/parent-companion";
import { ParentModel } from "src/models/parent";
import CodeMappingModel from "src/models/code-mapping";
import CodeEntryModel from "src/models/code-entry";
import { IntegrationService } from "src/services/integration.service";

jest.mock("src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    codeMapping: { findFirst: jest.fn() },
    codeEntry: { count: jest.fn() },
    companion: { findFirst: jest.fn() },
    parent: { findFirst: jest.fn() },
    parentCompanion: { findFirst: jest.fn() },
  },
}));

jest.mock("src/models/companion", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock("src/models/parent-companion", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("src/models/parent", () => ({
  ParentModel: { findById: jest.fn() },
}));

jest.mock("src/models/code-mapping", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("src/models/code-entry", () => ({
  __esModule: true,
  default: { countDocuments: jest.fn() },
}));

jest.mock("src/services/integration.service", () => ({
  IntegrationService: { requireAccount: jest.fn() },
}));

jest.mock("src/services/lab-order.service", () => {
  class LabOrderServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { LabOrderServiceError };
});

const mockIdexxClient = {
  getCensusPatient: jest.fn(),
  addCensusPatient: jest.fn(),
  createOrder: jest.fn(),
  getOrder: jest.fn(),
  updateOrder: jest.fn(),
  cancelOrder: jest.fn(),
};

jest.mock("src/integrations/idexx/idexx.client", () => ({
  IdexxClient: jest.fn(() => mockIdexxClient),
}));

describe("IdexxOrderAdapter", () => {
  const mockReadSwitch = isReadFromPostgres as jest.Mock;
  const prismaMock = prisma as any;

  const adapter = new IdexxOrderAdapter();

  const baseCompanion = {
    id: "comp-1",
    name: "Buddy",
    speciesCode: "DOG",
    breedCode: "LAB",
    gender: "male",
    isNeutered: true,
    microchipNumber: "123",
    dateOfBirth: new Date("2020-01-01"),
  };

  const baseParent = {
    id: "parent-1",
    firstName: "Pat",
    lastName: "Smith",
    email: "pat@example.com",
    phoneNumber: "123",
    address: {
      addressLine: "123 Main",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IDEXX_PIMS_ID = "pims";
    process.env.IDEXX_PIMS_VERSION = "1.0";

    mockReadSwitch.mockReturnValue(true);

    (IntegrationService.requireAccount as jest.Mock).mockResolvedValue({
      credentials: {
        username: "user",
        password: "pass",
        labAccountId: "lab-1",
      },
    });

    prismaMock.codeMapping.findFirst.mockResolvedValue({
      targetCode: "IDX",
    } as any);
    prismaMock.codeEntry.count.mockResolvedValue(1 as any);
    prismaMock.companion.findFirst.mockResolvedValue(baseCompanion as any);
    prismaMock.parent.findFirst.mockResolvedValue(baseParent as any);
    prismaMock.parentCompanion.findFirst.mockResolvedValue({
      parentId: "parent-1",
    } as any);

    mockIdexxClient.getCensusPatient.mockRejectedValue({
      response: { status: 404 },
    });
    mockIdexxClient.addCensusPatient.mockRejectedValue({
      response: { status: 409 },
    });
    mockIdexxClient.createOrder.mockResolvedValue({
      status: "complete",
      uiURL: "ui",
      pdfURL: "pdf",
      idexxOrderId: "IDX-1",
    });
    mockIdexxClient.getOrder.mockResolvedValue({ status: "submitted" });
    mockIdexxClient.updateOrder.mockResolvedValue({ status: "running" });
    mockIdexxClient.cancelOrder.mockResolvedValue({ status: "unknown" });
  });

  it("errors when primary parent is missing", async () => {
    prismaMock.parentCompanion.findFirst.mockResolvedValueOnce(null as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Primary parent not found for companion.");
  });

  it("errors when tests are missing", async () => {
    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: [],
      } as any),
    ).rejects.toThrow("tests are required.");
  });

  it("errors when test codes are invalid", async () => {
    prismaMock.codeEntry.count.mockResolvedValueOnce(0 as any);
    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("One or more test codes are invalid.");
  });

  it("errors when companion is missing", async () => {
    prismaMock.companion.findFirst.mockResolvedValueOnce(null as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Companion not found.");
  });

  it("errors when parent is missing", async () => {
    prismaMock.parent.findFirst.mockResolvedValueOnce(null as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Parent not found.");
  });

  it("errors when parent last name is missing", async () => {
    prismaMock.parent.findFirst.mockResolvedValueOnce({
      ...baseParent,
      lastName: null,
    } as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Parent last name is required for IDEXX orders.");
  });

  it("errors when companion species or breed is missing", async () => {
    prismaMock.companion.findFirst.mockResolvedValueOnce({
      ...baseCompanion,
      breedCode: null,
    } as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Companion speciesCode and breedCode are required.");
  });

  it("errors when IDEXX mapping is missing", async () => {
    prismaMock.codeMapping.findFirst.mockResolvedValueOnce(null as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Missing IDEXX mapping for code DOG.");
  });

  it("errors when in-house order is missing ivls", async () => {
    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
        modality: "IN_HOUSE",
      } as any),
    ).rejects.toThrow("ivls is required for IN_HOUSE orders.");
  });

  it("creates an in-house order and handles census flows", async () => {
    const result = await adapter.createOrder({
      organisationId: "org-1",
      companionId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
      modality: "IN_HOUSE",
      ivls: [{ serialNumber: "SN-1" }],
      veterinarian: "Dr. V",
      technician: "Tech",
      notes: "note",
      specimenCollectionDate: "2024-01-01",
    } as any);

    expect(mockIdexxClient.getCensusPatient).toHaveBeenCalled();
    expect(mockIdexxClient.addCensusPatient).toHaveBeenCalled();
    expect(mockIdexxClient.createOrder).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        idexxOrderId: "IDX-1",
        status: "COMPLETE",
        externalStatus: "complete",
        uiUrl: "ui",
        pdfUrl: "pdf",
      }),
    );
  });

  it("throws when census lookup fails with non-404 status", async () => {
    mockIdexxClient.getCensusPatient.mockRejectedValueOnce({
      response: { status: 500 },
    });

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "SN-1" }],
      } as any),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("throws when census add fails with non-409 status", async () => {
    mockIdexxClient.getCensusPatient.mockRejectedValueOnce({
      response: { status: 404 },
    });
    mockIdexxClient.addCensusPatient.mockRejectedValueOnce({
      response: { status: 500 },
    });

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "SN-1" }],
      } as any),
    ).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("builds getOrder responses with explicit id", async () => {
    const result = await adapter.getOrder("IDX-99", {
      organisationId: "org-1",
      companionId: "comp-1",
      tests: ["T1"],
    } as any);

    expect(mockIdexxClient.getOrder).toHaveBeenCalledWith("IDX-99");
    expect(result.idexxOrderId).toBe("IDX-99");
    expect(result.status).toBe("SUBMITTED");
  });

  it("errors when updateOrder is missing parentId", async () => {
    await expect(
      adapter.updateOrder("IDX-99", {
        organisationId: "org-1",
        companionId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("parentId is required to update order.");
  });

  it("returns cancelled status when cancel response is unknown", async () => {
    const result = await adapter.cancelOrder("IDX-99", {
      organisationId: "org-1",
      companionId: "comp-1",
      tests: ["T1"],
    } as any);

    expect(mockIdexxClient.cancelOrder).toHaveBeenCalledWith("IDX-99");
    expect(result.status).toBe("CANCELLED");
  });

  it("uses mongo models when read from postgres is false", async () => {
    mockReadSwitch.mockReturnValue(false);

    const companionId = "507f1f77bcf86cd799439011";
    const parentId = "507f1f77bcf86cd799439012";

    (CompanionModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: { toString: () => "mongo-comp" },
        name: "Buddy",
        speciesCode: "DOG",
        breedCode: "LAB",
        gender: "female",
        isNeutered: false,
        microchipNumber: "999",
        dateOfBirth: new Date("2020-01-01"),
      }),
    });

    (ParentModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: { toString: () => "mongo-parent" },
        firstName: "Pat",
        lastName: "Smith",
        address: { addressLine: "123 Main" },
      }),
    });

    (CodeMappingModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ targetCode: "IDX" }),
    });

    (CodeEntryModel.countDocuments as jest.Mock).mockResolvedValue(1);

    const result = await adapter.updateOrder("IDX-77", {
      organisationId: "org-1",
      companionId,
      parentId,
      tests: ["T1"],
      modality: "REFERENCE_LAB",
    } as any);

    expect(result.status).toBe("RUNNING");
    expect(mockIdexxClient.updateOrder).toHaveBeenCalledWith(
      "IDX-77",
      expect.objectContaining({
        patients: expect.any(Array),
        tests: ["T1"],
        ivls: undefined,
      }),
    );
    expect(CompanionModel.findById).toHaveBeenCalledWith(
      new Types.ObjectId(companionId),
    );
  });

  it("uses mongo parent link when parentId is missing", async () => {
    mockReadSwitch.mockReturnValue(false);

    const companionId = "507f1f77bcf86cd799439013";

    (ParentCompanionModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ parentId: "mongo-parent" }),
    });

    (CompanionModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: { toString: () => "mongo-comp" },
        name: "Buddy",
        speciesCode: "DOG",
        breedCode: "LAB",
        gender: "other",
        isNeutered: null,
        dateOfBirth: new Date("2020-01-01"),
      }),
    });

    (ParentModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: { toString: () => "mongo-parent" },
        firstName: "Pat",
        lastName: "Smith",
        address: { addressLine: "123 Main" },
      }),
    });

    (CodeMappingModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ targetCode: "IDX" }),
    });

    (CodeEntryModel.countDocuments as jest.Mock).mockResolvedValue(1);

    await adapter.createOrder({
      organisationId: "org-1",
      companionId,
      tests: ["T1"],
      modality: "REFERENCE_LAB",
    } as any);

    expect(ParentCompanionModel.findOne).toHaveBeenCalled();
    expect(mockIdexxClient.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        patients: [
          expect.objectContaining({
            genderCode: "UNKNOWN",
          }),
        ],
      }),
    );
  });

  it("coerces numeric order ids to strings", async () => {
    mockIdexxClient.createOrder.mockResolvedValueOnce({
      status: "complete",
      idexxOrderId: 123,
    });

    const result = await adapter.createOrder({
      organisationId: "org-1",
      companionId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
    } as any);

    expect(result.idexxOrderId).toBe("123");
  });

  it("returns null when response order id cannot be coerced", async () => {
    mockIdexxClient.createOrder.mockResolvedValueOnce({
      status: "complete",
      idexxOrderId: { value: "bad" },
    });

    const result = await adapter.createOrder({
      organisationId: "org-1",
      companionId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
    } as any);

    expect(result.idexxOrderId).toBeNull();
  });

  it("throws when companion document is missing an id", async () => {
    prismaMock.companion.findFirst.mockResolvedValueOnce({
      name: "Buddy",
      speciesCode: "DOG",
      breedCode: "LAB",
      gender: "male",
    } as any);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        companionId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Missing document id.");
  });

  it("errors when IDEXX credentials are missing", async () => {
    (IntegrationService.requireAccount as jest.Mock).mockResolvedValueOnce({
      credentials: { username: "" },
    });

    await expect(
      adapter.getOrder("IDX-1", {
        organisationId: "org-1",
        companionId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("IDEXX credentials missing.");
  });

  it("errors when PIMS config is missing", async () => {
    process.env.IDEXX_PIMS_ID = "";

    await expect(
      adapter.getOrder("IDX-1", {
        organisationId: "org-1",
        companionId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("IDEXX PIMS config missing.");
  });
});
