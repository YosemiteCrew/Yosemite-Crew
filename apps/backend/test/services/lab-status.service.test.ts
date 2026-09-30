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

  it("refreshes orders one at a time and logs a failure without stopping", async () => {
    prismaMock.labOrder.findMany.mockResolvedValue(
      ["ORDER-1", "ORDER-2", "ORDER-3"].map((idexxOrderId) => ({
        provider: "IDEXX",
        organisationId: "ORG-1",
        idexxOrderId,
      })),
    );
    let releaseFirst!: (value: unknown) => void;
    labOrderServiceMock.getOrder
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error("idexx down"))
      .mockResolvedValueOnce({ id: "ORDER-3" });

    const pending = LabStatusService.pollPending();
    await new Promise((resolve) => setImmediate(resolve));

    // The next order waits for the one in progress.
    expect(labOrderServiceMock.getOrder).toHaveBeenCalledTimes(1);

    releaseFirst({ id: "ORDER-1" });
    await expect(pending).resolves.toBeUndefined();
    expect(labOrderServiceMock.getOrder).toHaveBeenCalledTimes(3);

    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledWith(
      "Failed to refresh lab order status",
      expect.any(Error),
    );
  });

  it("skips refresh when there are no pending orders", async () => {
    prismaMock.labOrder.findMany.mockResolvedValue([]);

    await LabStatusService.pollPending();

    expect(labOrderServiceMock.getOrder).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
