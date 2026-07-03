import { LabResultService } from "src/services/lab-result.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    labOrder: {
      findMany: jest.fn(),
    },
    labResult: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  labOrder: { findMany: jest.Mock };
  labResult: { findMany: jest.Mock; findFirst: jest.Mock };
};

describe("LabResultService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists results by patient through prisma lab orders and direct patient matches", async () => {
    prismaMock.labOrder.findMany.mockResolvedValue([
      { idexxOrderId: "ORDER-1" },
      { idexxOrderId: null },
    ]);
    prismaMock.labResult.findMany.mockResolvedValue([{ resultId: "RESULT-1" }]);

    const results = await LabResultService.list({
      organisationId: "ORG-1",
      provider: "IDEXX",
      patientId: "PATIENT-1",
    });

    expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith({
      where: { patientId: "PATIENT-1" },
      select: { idexxOrderId: true },
    });
    expect(prismaMock.labResult.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "ORG-1",
        provider: "IDEXX",
        OR: [{ patientId: "PATIENT-1" }, { orderId: { in: ["ORDER-1"] } }],
      },
      orderBy: { updatedAt: "desc" },
      take: undefined,
    });
    expect(results).toEqual([{ resultId: "RESULT-1" }]);
  });

  it("lists results by patient when there are no linked lab orders", async () => {
    prismaMock.labOrder.findMany.mockResolvedValue([]);
    prismaMock.labResult.findMany.mockResolvedValue([{ resultId: "RESULT-2" }]);

    const results = await LabResultService.list({
      organisationId: "ORG-1",
      provider: "IDEXX",
      patientId: "PATIENT-1",
    });

    expect(prismaMock.labResult.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "ORG-1",
        provider: "IDEXX",
        OR: [{ patientId: "PATIENT-1" }],
      },
      orderBy: { updatedAt: "desc" },
      take: undefined,
    });
    expect(results).toEqual([{ resultId: "RESULT-2" }]);
  });

  it("gets a result by id through prisma", async () => {
    prismaMock.labResult.findFirst.mockResolvedValue({
      resultId: "RESULT-2",
    });

    const result = await LabResultService.getByResultId(
      "ORG-1",
      "IDEXX",
      "RESULT-2",
    );

    expect(prismaMock.labResult.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: "ORG-1",
        provider: "IDEXX",
        resultId: "RESULT-2",
      },
    });
    expect(result).toEqual({ resultId: "RESULT-2" });
  });
});
