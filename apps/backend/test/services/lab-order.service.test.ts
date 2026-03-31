import { LabOrderService } from "../../src/services/lab-order.service";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import { getLabOrderAdapter } from "../../src/labs";
import LabOrderModel from "../../src/models/lab-order";
import CodeEntryModel from "../../src/models/code-entry";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeEntry: { count: jest.fn(), findMany: jest.fn() },
    labOrder: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/labs", () => {
  const actual = jest.requireActual("../../src/labs");
  return {
    ...actual,
    getLabOrderAdapter: jest.fn(),
  };
});

jest.mock("../../src/models/lab-order", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/code-entry", () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

describe("LabOrderService", () => {
  const readSwitch = isReadFromPostgres as jest.Mock;
  const adapter = {
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    updateOrder: jest.fn(),
    cancelOrder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    readSwitch.mockReturnValue(true);
    (getLabOrderAdapter as jest.Mock).mockReturnValue(adapter);
    adapter.createOrder.mockResolvedValue({
      idexxOrderId: "id-1",
      requestPayload: {},
      responsePayload: {},
      status: "CREATED",
    });
    (prisma.labOrder.create as jest.Mock).mockResolvedValue({
      id: "order-1",
      status: "CREATED",
      modality: "REFERENCE_LAB",
    });
    (prisma.labOrder.update as jest.Mock).mockResolvedValue({
      id: "order-1",
      status: "CREATED",
    });
  });

  it("rejects unsupported provider for listProviderTests", async () => {
    await expect(LabOrderService.listProviderTests("BAD", {})).rejects.toThrow(
      "Unsupported lab provider.",
    );
  });

  it("rejects invalid query type", async () => {
    await expect(
      LabOrderService.listProviderTests("IDEXX", { query: 123 as any }),
    ).rejects.toThrow("Invalid query.");
  });

  it("lists provider tests using postgres", async () => {
    (prisma.codeEntry.count as jest.Mock).mockResolvedValue(2);
    (prisma.codeEntry.findMany as jest.Mock).mockResolvedValue([{ code: "A" }]);

    const result = await LabOrderService.listProviderTests("IDEXX", {
      query: "chem",
      limit: 10,
      page: 1,
    });

    expect(result).toEqual({
      total: 2,
      page: 1,
      limit: 10,
      tests: [{ code: "A" }],
    });
  });

  it("creates order in postgres", async () => {
    const result = await LabOrderService.createOrder("IDEXX", {
      organisationId: "org-1",
      companionId: "comp-1",
      parentId: "parent-1",
      tests: ["T1"],
    });

    expect(result).toEqual({ id: "order-1", status: "CREATED" });
    expect(adapter.createOrder).toHaveBeenCalled();
  });

  it("rejects unsupported provider for createOrder", async () => {
    await expect(
      LabOrderService.createOrder("BAD", {
        organisationId: "org-1",
        companionId: "comp-1",
        tests: ["T1"],
      } as any),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("throws when getOrder missing in postgres", async () => {
    (prisma.labOrder.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      LabOrderService.getOrder("IDEXX", "org-1", "id-1"),
    ).rejects.toThrow("Lab order not found.");
  });

  it("rejects invalid provider in listOrders", async () => {
    await expect(
      LabOrderService.listOrders({
        organisationId: "org-1",
        provider: "BAD",
      }),
    ).rejects.toThrow("Unsupported lab provider.");
  });

  it("rejects updateOrder when status is not CREATED", async () => {
    readSwitch.mockReturnValue(false);
    (LabOrderModel.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockResolvedValue({
        status: "SUBMITTED",
      }),
    });

    await expect(
      LabOrderService.updateOrder("IDEXX", "org-1", "id-1", {
        tests: ["T1"],
      }),
    ).rejects.toThrow("Only CREATED orders can be updated.");
  });

  it("throws when cancelOrder cannot find order", async () => {
    readSwitch.mockReturnValue(false);
    (LabOrderModel.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockResolvedValue(null),
    });

    await expect(
      LabOrderService.cancelOrder("IDEXX", "org-1", "id-1"),
    ).rejects.toThrow("Lab order not found.");
  });

  it("lists orders using mongo", async () => {
    readSwitch.mockReturnValue(false);
    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      setOptions: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    (LabOrderModel.find as jest.Mock).mockReturnValue(mockQuery);

    const result = await LabOrderService.listOrders({
      organisationId: "org-1",
      limit: 5,
    });

    expect(result).toEqual([]);
    expect(LabOrderModel.find).toHaveBeenCalled();
  });
});
