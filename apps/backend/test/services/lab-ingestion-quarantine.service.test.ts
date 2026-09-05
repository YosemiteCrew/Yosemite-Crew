import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { prisma } from "src/config/prisma";
import { LabIngestionQuarantineService } from "src/services/lab-ingestion-quarantine.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    labResultQuarantine: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe("LabIngestionQuarantineService.listUnresolved", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.labResultQuarantine.count.mockResolvedValue(0 as never);
    mockedPrisma.labResultQuarantine.findMany.mockResolvedValue([] as never);
  });

  it("reads only rows nobody has resolved yet, for the requested provider", async () => {
    await LabIngestionQuarantineService.listUnresolved();

    expect(mockedPrisma.labResultQuarantine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "IDEXX", resolvedAt: null },
      }),
    );
    expect(mockedPrisma.labResultQuarantine.count).toHaveBeenCalledWith({
      where: { provider: "IDEXX", resolvedAt: null },
    });
  });

  // #2709 is the same defect in the other direction: a list endpoint with no bound. This
  // table grows with provider mistakes, so the read is capped and the cap is asserted.
  it("bounds the read and reports the true total separately", async () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({
      id: `q-${index}`,
    }));
    mockedPrisma.labResultQuarantine.count.mockResolvedValue(981 as never);
    mockedPrisma.labResultQuarantine.findMany.mockResolvedValue(rows as never);

    const result = await LabIngestionQuarantineService.listUnresolved();

    expect(mockedPrisma.labResultQuarantine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    // A truncated page has to be visible as truncated, or 981 stuck rows read as 200.
    expect(result.total).toBe(981);
    expect(result.returned).toBe(200);
  });

  it("returns the oldest first, because that is the one that has waited longest", async () => {
    await LabIngestionQuarantineService.listUnresolved();

    expect(mockedPrisma.labResultQuarantine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
  });

  // This endpoint is super-admin, so it is cross-tenant. The stored payload is the raw
  // provider body - patient name, client name, clinical detail - and none of it is needed to
  // decide which status value the mapper is missing.
  it("never selects the raw provider payload", async () => {
    await LabIngestionQuarantineService.listUnresolved();

    const call = mockedPrisma.labResultQuarantine.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(call.select.payload).toBeUndefined();
    expect(call.select.externalStatus).toBe(true);
  });
});
