import { LabResultService } from "../../src/services/lab-result.service";
import LabResultModel from "../../src/models/lab-result";
import LabOrderModel from "../../src/models/lab-order";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    labResult: { findMany: jest.fn(), findFirst: jest.fn() },
    labOrder: { findMany: jest.fn() },
  },
}));

jest.mock("../../src/models/lab-result", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/lab-order", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

describe("LabResultService", () => {
  const readSwitch = isReadFromPostgres as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    readSwitch.mockReturnValue(true);
    (prisma.labResult.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.labResult.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.labOrder.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("lists using postgres filters", async () => {
    await LabResultService.list({
      organisationId: "org",
      provider: "IDEXX",
      orderId: "order",
      limit: 10,
    });

    expect(prisma.labResult.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org",
        provider: "IDEXX",
        orderId: "order",
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
  });

  it("uses companionId to derive order ids in postgres", async () => {
    (prisma.labOrder.findMany as jest.Mock).mockResolvedValue([
      { idexxOrderId: "o1" },
      { idexxOrderId: null },
    ]);

    await LabResultService.list({
      companionId: "507f191e810c19729de860ea",
    });

    expect(prisma.labOrder.findMany).toHaveBeenCalled();
    expect(prisma.labResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: { in: ["o1"] } },
      }),
    );
  });

  it("rejects invalid companionId in postgres", async () => {
    await expect(LabResultService.list({ companionId: "bad" })).rejects.toThrow(
      "Invalid companionId",
    );
  });

  it("lists using mongo filters", async () => {
    readSwitch.mockReturnValue(false);

    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      setOptions: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    (LabResultModel.find as jest.Mock).mockReturnValue(mockQuery);

    await LabResultService.list({
      organisationId: "org",
      provider: "IDEXX",
      orderId: "order",
      limit: 5,
    });

    expect(LabResultModel.find).toHaveBeenCalledWith({
      organisationId: "org",
      provider: "IDEXX",
      orderId: "order",
    });
    expect(mockQuery.limit).toHaveBeenCalledWith(5);
  });

  it("uses companionId to derive order ids in mongo", async () => {
    readSwitch.mockReturnValue(false);

    const mockOrders = {
      setOptions: jest.fn().mockReturnThis(),
      lean: jest
        .fn()
        .mockResolvedValue([{ idexxOrderId: "o1" }, { idexxOrderId: null }]),
    };
    (LabOrderModel.find as jest.Mock).mockReturnValue(mockOrders);

    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      setOptions: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    (LabResultModel.find as jest.Mock).mockReturnValue(mockQuery);

    await LabResultService.list({
      companionId: "507f191e810c19729de860ea",
    });

    expect(LabResultModel.find).toHaveBeenCalledWith({
      orderId: { $in: ["o1"] },
    });
  });

  it("rejects invalid companionId in mongo", async () => {
    readSwitch.mockReturnValue(false);
    await expect(LabResultService.list({ companionId: "bad" })).rejects.toThrow(
      "Invalid companionId",
    );
  });

  it("gets by result id in postgres", async () => {
    await LabResultService.getByResultId("IDEXX", "res");
    expect(prisma.labResult.findFirst).toHaveBeenCalledWith({
      where: { provider: "IDEXX", resultId: "res" },
    });
  });

  it("gets by result id in mongo", async () => {
    readSwitch.mockReturnValue(false);
    const mockQuery = {
      setOptions: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({}),
    };
    (LabResultModel.findOne as jest.Mock).mockReturnValue(mockQuery);

    await LabResultService.getByResultId("IDEXX", "res");

    expect(LabResultModel.findOne).toHaveBeenCalledWith({
      provider: "IDEXX",
      resultId: "res",
    });
  });

  it("rejects invalid provider or resultId", async () => {
    await expect(LabResultService.getByResultId("", "")).rejects.toThrow(
      "Invalid provider or resultId",
    );
  });
});
