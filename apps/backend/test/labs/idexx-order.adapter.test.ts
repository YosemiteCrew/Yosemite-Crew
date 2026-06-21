import { IdexxOrderAdapter } from "src/labs/idexx/idexx-order.adapter";
import { prisma } from "src/config/prisma";
import { IntegrationService } from "src/services/integration.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    codeMapping: { findFirst: jest.fn() },
    codeEntry: { count: jest.fn() },
    patient: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
  },
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

    (IntegrationService.requireAccount as jest.Mock).mockResolvedValue({
      credentials: {
        username: "user",
        password: "pass",
        labAccountId: "lab-1",
      },
    });

    prismaMock.codeMapping.findFirst.mockResolvedValue({ targetCode: "IDX" });
    prismaMock.codeEntry.count.mockResolvedValue(1);
    prismaMock.patient.findUnique.mockResolvedValue(baseCompanion);
    prismaMock.parent.findUnique.mockResolvedValue(baseParent);
    prismaMock.parentPatient.findFirst.mockResolvedValue({
      parentId: "parent-1",
    });

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

  it("errors when tests are missing", async () => {
    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: [],
      } as any),
    ).rejects.toThrow("tests are required.");
  });

  it("errors when test codes are invalid", async () => {
    prismaMock.codeEntry.count.mockResolvedValueOnce(0);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("One or more test codes are invalid.");
  });

  it("errors when companion is missing", async () => {
    prismaMock.patient.findUnique.mockResolvedValueOnce(null);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Companion not found.");
  });

  it("errors when parent is missing", async () => {
    prismaMock.parent.findUnique.mockResolvedValueOnce(null);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Parent not found.");
  });

  it("errors when parent last name is missing", async () => {
    prismaMock.parent.findUnique.mockResolvedValueOnce({
      ...baseParent,
      lastName: null,
    });

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Parent last name is required for IDEXX orders.");
  });

  it("errors when companion species or breed is missing", async () => {
    prismaMock.patient.findUnique.mockResolvedValueOnce({
      ...baseCompanion,
      breedCode: null,
    });

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Companion speciesCode and breedCode are required.");
  });

  it("errors when IDEXX mapping is missing", async () => {
    prismaMock.codeMapping.findFirst.mockResolvedValueOnce(null);

    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Missing IDEXX mapping for code DOG.");
  });

  it("errors when in-house order is missing ivls", async () => {
    await expect(
      adapter.createOrder({
        organisationId: "org-1",
        patientId: "comp-1",
        parentId: "parent-1",
        tests: ["T1"],
        modality: "IN_HOUSE",
      } as any),
    ).rejects.toThrow("ivls is required for IN_HOUSE orders.");
  });

  it("creates an in-house order and handles census flows", async () => {
    const result = await adapter.createOrder({
      organisationId: "org-1",
      patientId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
      modality: "IN_HOUSE",
      ivls: [{ serialNumber: "SN-1" }],
      veterinarian: "Dr. V",
      technician: "Tech",
      notes: "note",
      specimenCollectionDate: "2024-01-01",
    } as any);

    expect(mockIdexxClient.getCensusPatient).toHaveBeenCalledWith("comp-1");
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
        patientId: "comp-1",
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
        patientId: "comp-1",
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
      patientId: "comp-1",
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
        patientId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("parentId is required to update order.");
  });

  it("updates an order with the current payload", async () => {
    const result = await adapter.updateOrder("IDX-77", {
      organisationId: "org-1",
      patientId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
      modality: "REFERENCE_LAB",
    } as any);

    expect(mockIdexxClient.updateOrder).toHaveBeenCalledWith(
      "IDX-77",
      expect.objectContaining({
        tests: ["T1"],
        ivls: undefined,
      }),
    );
    expect(result.status).toBe("RUNNING");
  });

  it("creates an order using the primary parent lookup when parentId is missing", async () => {
    await adapter.createOrder({
      organisationId: "org-1",
      patientId: "comp-1",
      tests: ["T1"],
      modality: "REFERENCE_LAB",
    } as any);

    expect(prismaMock.parentPatient.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: "comp-1",
        role: "PRIMARY",
        status: "ACTIVE",
      },
    });
    expect(mockIdexxClient.createOrder).toHaveBeenCalled();
  });

  it("returns cancelled status when cancel response is unknown", async () => {
    const result = await adapter.cancelOrder("IDX-99", {
      organisationId: "org-1",
      patientId: "comp-1",
      tests: ["T1"],
    } as any);

    expect(mockIdexxClient.cancelOrder).toHaveBeenCalledWith("IDX-99");
    expect(result.status).toBe("CANCELLED");
  });

  it("coerces numeric order ids to strings", async () => {
    mockIdexxClient.createOrder.mockResolvedValueOnce({
      status: "complete",
      idexxOrderId: 123,
    });

    const result = await adapter.createOrder({
      organisationId: "org-1",
      patientId: "comp-1",
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
      patientId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
    } as any);

    expect(result.idexxOrderId).toBeNull();
  });

  it("errors when credentials are missing", async () => {
    (IntegrationService.requireAccount as jest.Mock).mockResolvedValueOnce({
      credentials: { username: "" },
    });

    await expect(
      adapter.getOrder("IDX-1", {
        organisationId: "org-1",
        patientId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("IDEXX credentials missing.");
  });

  it("errors when PIMS config is missing", async () => {
    process.env.IDEXX_PIMS_ID = "";

    await expect(
      adapter.getOrder("IDX-1", {
        organisationId: "org-1",
        patientId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("IDEXX PIMS config missing.");
  });
});
