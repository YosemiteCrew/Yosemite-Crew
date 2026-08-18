import {
  InventoryCountService,
  InventoryCountError,
} from "../../src/services/inventory-count.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    inventoryCount: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import { AuditTrailService } from "../../src/services/audit-trail.service";

const mockCreate = prisma.inventoryCount.create as jest.Mock;
const mockFindFirst = prisma.inventoryCount.findFirst as jest.Mock;
const mockFindMany = prisma.inventoryCount.findMany as jest.Mock;
const mockUpdate = prisma.inventoryCount.update as jest.Mock;
const mockAudit = AuditTrailService.recordSafely as jest.Mock;

const countedAt = new Date("2026-03-01T09:00:00.000Z");

const baseCount = {
  id: "count-1",
  organisationId: "org-1",
  inventoryItemId: "item-1",
  countedBy: "user-1",
  countedAt,
  systemCount: 40,
  physicalCount: 37,
  discrepancy: -3,
  notes: null,
  reconciled: false,
  reconciledAt: null,
  reconciledBy: null,
  createdAt: countedAt,
  updatedAt: countedAt,
};

beforeEach(() => jest.clearAllMocks());

describe("InventoryCountService.record", () => {
  it("stores the shortfall as a negative discrepancy and leaves it unreconciled", async () => {
    mockCreate.mockResolvedValue(baseCount);

    const result = await InventoryCountService.record({
      organisationId: "org-1",
      inventoryItemId: "item-1",
      countedBy: "user-1",
      countedAt,
      systemCount: 40,
      physicalCount: 37,
      notes: "Three vials missing",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organisationId: "org-1",
        inventoryItemId: "item-1",
        countedBy: "user-1",
        countedAt,
        systemCount: 40,
        physicalCount: 37,
        discrepancy: -3,
        notes: "Three vials missing",
        reconciled: false,
        reconciledAt: null,
      },
      select: expect.objectContaining({ id: true, discrepancy: true }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "",
        eventType: "INVENTORY_COUNT_RECORDED",
        actorType: "PMS_USER",
        actorId: "user-1",
        entityType: "COMPANION",
        entityId: "item-1",
        metadata: {
          countId: "count-1",
          inventoryItemId: "item-1",
          discrepancy: -3,
          hasDiscrepancy: true,
        },
      }),
    );
    expect(result).toBe(baseCount);
  });

  it("auto-reconciles a count that matches the system figure", async () => {
    mockCreate.mockResolvedValue({
      ...baseCount,
      physicalCount: 40,
      discrepancy: 0,
      reconciled: true,
    });

    await InventoryCountService.record({
      organisationId: "org-1",
      inventoryItemId: "item-1",
      countedAt,
      systemCount: 40,
      physicalCount: 40,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discrepancy: 0,
          reconciled: true,
          reconciledAt: expect.any(Date),
          countedBy: null,
          notes: null,
        }),
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        metadata: expect.objectContaining({
          discrepancy: 0,
          hasDiscrepancy: false,
        }),
      }),
    );
  });

  it("stores a surplus as a positive discrepancy", async () => {
    mockCreate.mockResolvedValue({
      ...baseCount,
      physicalCount: 45,
      discrepancy: 5,
    });

    await InventoryCountService.record({
      organisationId: "org-1",
      inventoryItemId: "item-1",
      countedAt,
      systemCount: 40,
      physicalCount: 45,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ discrepancy: 5, reconciled: false }),
      }),
    );
  });
});

describe("InventoryCountService.get", () => {
  it("scopes the lookup to the organisation", async () => {
    mockFindFirst.mockResolvedValue(baseCount);

    await expect(InventoryCountService.get("count-1", "org-1")).resolves.toBe(
      baseCount,
    );
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "count-1", organisationId: "org-1" },
      select: expect.objectContaining({ id: true }),
    });
  });

  it("throws a 404 for a record in another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      InventoryCountService.get("count-1", "org-2"),
    ).rejects.toBeInstanceOf(InventoryCountError);
    await expect(
      InventoryCountService.get("count-1", "org-2"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Inventory count record not found.",
    });
  });
});

describe("InventoryCountService.list", () => {
  it("builds a two-sided date window from both bounds", async () => {
    const fromDate = new Date("2026-02-01T00:00:00.000Z");
    const toDate = new Date("2026-03-01T00:00:00.000Z");
    mockFindMany.mockResolvedValue([baseCount]);

    await InventoryCountService.list({
      organisationId: "org-1",
      inventoryItemId: "item-1",
      reconciled: false,
      fromDate,
      toDate,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        inventoryItemId: "item-1",
        reconciled: false,
        countedAt: { gte: fromDate, lte: toDate },
      },
      select: expect.objectContaining({ id: true }),
      orderBy: { countedAt: "desc" },
    });
  });

  it("builds a one-sided window from a lower bound alone", async () => {
    const fromDate = new Date("2026-02-01T00:00:00.000Z");
    mockFindMany.mockResolvedValue([]);

    await InventoryCountService.list({ organisationId: "org-1", fromDate });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", countedAt: { gte: fromDate } },
      }),
    );
  });

  it("builds a one-sided window from an upper bound alone", async () => {
    const toDate = new Date("2026-03-01T00:00:00.000Z");
    mockFindMany.mockResolvedValue([]);

    await InventoryCountService.list({ organisationId: "org-1", toDate });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", countedAt: { lte: toDate } },
      }),
    );
  });

  it("omits the date filter entirely when neither bound is given", async () => {
    mockFindMany.mockResolvedValue([]);

    await InventoryCountService.list({ organisationId: "org-1" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: "org-1" } }),
    );
  });
});

describe("InventoryCountService.reconcile", () => {
  it("marks the count reconciled, stamps the user and audits the discrepancy", async () => {
    mockFindFirst.mockResolvedValue(baseCount);
    mockUpdate.mockResolvedValue({
      ...baseCount,
      reconciled: true,
      reconciledBy: "user-2",
      notes: "Stock write-off raised",
    });

    const result = await InventoryCountService.reconcile(
      "count-1",
      "org-1",
      "user-2",
      "Stock write-off raised",
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "count-1" },
      data: {
        reconciled: true,
        reconciledAt: expect.any(Date),
        reconciledBy: "user-2",
        notes: "Stock write-off raised",
      },
      select: expect.objectContaining({ id: true }),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        patientId: "",
        eventType: "INVENTORY_DISCREPANCY_RECONCILED",
        actorId: "user-2",
        entityId: "item-1",
        metadata: {
          countId: "count-1",
          inventoryItemId: "item-1",
          discrepancy: -3,
        },
      }),
    );
    expect(result.reconciled).toBe(true);
  });

  it("leaves the existing notes alone when none are supplied", async () => {
    mockFindFirst.mockResolvedValue(baseCount);
    mockUpdate.mockResolvedValue({ ...baseCount, reconciled: true });

    await InventoryCountService.reconcile("count-1", "org-1", "user-2");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reconciled: true,
          reconciledAt: expect.any(Date),
          reconciledBy: "user-2",
        },
      }),
    );
  });

  it("refuses to reconcile the same count twice", async () => {
    mockFindFirst.mockResolvedValue({ ...baseCount, reconciled: true });

    await expect(
      InventoryCountService.reconcile("count-1", "org-1", "user-2"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Inventory count is already reconciled.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("refuses to reconcile a count from another organisation", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      InventoryCountService.reconcile("count-1", "org-2", "user-2"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("InventoryCountService.unreconciled", () => {
  it("returns only the outstanding counts, newest first", async () => {
    mockFindMany.mockResolvedValue([baseCount]);

    await expect(InventoryCountService.unreconciled("org-1")).resolves.toEqual([
      baseCount,
    ]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1", reconciled: false },
      select: expect.objectContaining({ id: true }),
      orderBy: { countedAt: "desc" },
    });
  });
});
