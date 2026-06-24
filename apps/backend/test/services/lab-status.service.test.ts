import { LabStatusService } from "src/services/lab-status.service";
import { LabOrderService } from "src/services/lab-order.service";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    labOrder: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("src/services/lab-order.service", () => ({
  LabOrderService: {
    getOrder: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const prismaMock = prisma as unknown as {
  labOrder: { findMany: jest.Mock };
};

const labOrderServiceMock = LabOrderService as unknown as {
  getOrder: jest.Mock;
};

const loggerMock = logger as unknown as {
  error: jest.Mock;
};

describe("LabStatusService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("polls pending orders through prisma", async () => {
    prismaMock.labOrder.findMany.mockResolvedValue([
      {
        provider: "IDEXX",
        organisationId: "ORG-1",
        idexxOrderId: "ORDER-1",
      },
    ]);
    labOrderServiceMock.getOrder.mockResolvedValue({ id: "ORDER-1" });

    await LabStatusService.pollPending();

    expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith({
      where: {
        status: { notIn: ["COMPLETE", "CANCELLED", "ERROR"] },
        idexxOrderId: { not: null },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });
    expect(labOrderServiceMock.getOrder).toHaveBeenCalledWith(
      "IDEXX",
      "ORG-1",
      "ORDER-1",
    );
  });

  it("skips refresh when there are no pending orders", async () => {
    prismaMock.labOrder.findMany.mockResolvedValue([]);

    await LabStatusService.pollPending();

    expect(labOrderServiceMock.getOrder).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
