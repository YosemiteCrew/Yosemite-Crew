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
      updateMany: jest.fn(),
    },
    inventoryItem: { findFirst: jest.fn(), update: jest.fn() },
    inventoryBatch: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    inventoryStockMovement: { create: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
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
const mockItemFindFirst = prisma.inventoryItem.findFirst as jest.Mock;
const mockBatchFindFirst = prisma.inventoryBatch.findFirst as jest.Mock;
const mockTx = {
  inventoryCount: { findFirst: jest.fn(), updateMany: jest.fn() },
  inventoryItem: { update: jest.fn() },
  inventoryBatch: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  },
  inventoryStockMovement: { create: jest.fn() },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};
const mockTransaction = prisma.$transaction as jest.Mock;
const mockAudit = AuditTrailService.recordSafely as jest.Mock;

const countedAt = new Date("2026-03-01T09:00:00.000Z");

const baseCount = {
  id: "count-1",
  organisationId: "org-1",
  inventoryItemId: "item-1",
  inventoryBatchId: null,
  countedBy: "user-1",
  countedAt,
  systemCount: 40,
  physicalCount: 37,
  discrepancy: -3,
  notes: null,
  resolution: null,
  resolutionNotes: null,
  reconciled: false,
  reconciledAt: null,
  reconciledBy: null,
  createdAt: countedAt,
  updatedAt: countedAt,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockItemFindFirst.mockResolvedValue({ id: "item-1" });
  mockTx.$queryRaw.mockResolvedValue([{ allocated: 0 }]);
  mockTransaction.mockImplementation(
    (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
  );
});

describe("InventoryCountService.record", () => {
  it("rejects items outside the requested organisation", async () => {
    mockItemFindFirst.mockResolvedValue(null);
    await expect(
      InventoryCountService.record({
        organisationId: "org-1",
        inventoryItemId: "item-1",
        countedAt,
        systemCount: 10,
        physicalCount: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown or out-of-scope batch", async () => {
    mockBatchFindFirst.mockResolvedValue(null);
    await expect(
      InventoryCountService.record({
        organisationId: "org-1",
        inventoryItemId: "item-1",
        inventoryBatchId: "batch-1",
        countedAt,
        physicalCount: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires a batch or trusted system count", async () => {
    await expect(
      InventoryCountService.record({
        organisationId: "org-1",
        inventoryItemId: "item-1",
        countedAt,
        physicalCount: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

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
        inventoryBatchId: null,
        countedBy: "user-1",
        countedAt,
        systemCount: 40,
        physicalCount: 37,
        discrepancy: -3,
        notes: "Three vials missing",
        reconciled: false,
        reconciledAt: null,
        resolution: null,
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
          inventoryBatchId: null,
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
          resolution: "NO_CHANGE",
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

  it("refuses to count an expired batch", async () => {
    mockBatchFindFirst.mockResolvedValue({
      id: "batch-1",
      quantity: 12,
      expiryDate: new Date(Date.now() - 60_000),
    });
    await expect(
      InventoryCountService.record({
        organisationId: "org-1",
        inventoryItemId: "item-1",
        inventoryBatchId: "batch-1",
        countedAt,
        physicalCount: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "This batch has expired and cannot be counted.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("uses the current organisation-scoped batch quantity as the system count", async () => {
    mockBatchFindFirst.mockResolvedValue({
      id: "batch-1",
      quantity: 12,
      expiryDate: new Date(Date.now() + 86_400_000),
    });
    mockCreate.mockResolvedValue({
      ...baseCount,
      inventoryBatchId: "batch-1",
      systemCount: 12,
      physicalCount: 10,
      discrepancy: -2,
    });

    await InventoryCountService.record({
      organisationId: "org-1",
      inventoryItemId: "item-1",
      inventoryBatchId: "batch-1",
      countedAt,
      physicalCount: 10,
    });

    expect(mockBatchFindFirst).toHaveBeenCalledWith({
      where: {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
      },
      select: { id: true, quantity: true, expiryDate: true },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inventoryBatchId: "batch-1",
          systemCount: 12,
          discrepancy: -2,
        }),
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
  it("updates the batch and item stock with a movement before auditing", async () => {
    const batchCount = { ...baseCount, inventoryBatchId: "batch-1" };
    mockTx.inventoryCount.findFirst
      .mockResolvedValueOnce(batchCount)
      .mockResolvedValueOnce({ ...baseCount, reconciled: true });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      quantity: 40,
      allocated: 2,
    });
    mockTx.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockTx.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantity: 37 },
    });

    const result = await InventoryCountService.reconcile(
      "count-1",
      "org-1",
      "user-2",
      "STOCK_ADJUSTED",
    );

    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mockTx.$executeRaw.mock.calls[0].slice(1)).toEqual([
      37,
      expect.any(Date),
      "batch-1",
      "org-1",
      40,
      37,
    ]);
    expect(mockTx.$executeRaw.mock.calls[0][0].join(" ")).toContain(
      '"allocated" <=',
    );
    expect(mockTx.$executeRaw.mock.calls[0][0].join(" ")).toContain(
      '"quantity" =',
    );
    expect(mockTx.$queryRaw.mock.calls[0][0].join(" ")).toContain("FOR UPDATE");
    expect(mockTx.$queryRaw.mock.calls[0].slice(1)).toEqual([
      "item-1",
      "org-1",
    ]);
    expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockTx.$executeRaw.mock.invocationCallOrder[0],
    );
    expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockTx.inventoryBatch.aggregate.mock.invocationCallOrder[0],
    );
    expect(mockTx.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { onHand: 37 },
    });
    expect(mockTx.inventoryStockMovement.create).toHaveBeenCalledWith({
      data: {
        itemId: "item-1",
        batchId: "batch-1",
        change: -3,
        reason: "INVENTORY_COUNT_ADJUSTMENT",
        userId: "user-2",
        referenceId: "count-1",
      },
    });
    expect(mockTx.$executeRaw.mock.calls[1].slice(1)).toEqual([
      expect.any(Date),
      "user-2",
      "STOCK_ADJUSTED",
      null,
      expect.any(Date),
      "count-1",
      "org-1",
    ]);
    expect(mockTx.$executeRaw.mock.calls[1][0].join(" ")).toContain(
      '"reconciled" = false',
    );
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
          inventoryBatchId: "batch-1",
          discrepancy: -3,
          resolution: "STOCK_ADJUSTED",
          resolutionNotes: null,
        },
      }),
    );
    expect(result.reconciled).toBe(true);
  });

  it("requires an explanation when a discrepancy is left unchanged", async () => {
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "NO_CHANGE",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("records the explanation for an unchanged discrepancy", async () => {
    mockTx.inventoryCount.findFirst
      .mockResolvedValueOnce(baseCount)
      .mockResolvedValueOnce({ ...baseCount, reconciled: true });
    mockTx.$executeRaw.mockResolvedValue(1);

    await InventoryCountService.reconcile(
      "count-1",
      "org-1",
      "user-2",
      "NO_CHANGE",
      " Checked delivery timing and recounted. ",
    );

    expect(mockTx.$executeRaw.mock.calls[0].slice(1)).toEqual([
      expect.any(Date),
      "user-2",
      "NO_CHANGE",
      "Checked delivery timing and recounted.",
      expect.any(Date),
      "count-1",
      "org-1",
    ]);
    expect(mockTx.inventoryStockMovement.create).not.toHaveBeenCalled();
  });

  it("rejects stock adjustment for legacy counts that have no batch", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue(baseCount);
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "STOCK_ADJUSTED",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
  });

  it("rejects a deleted or out-of-scope batch", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue({
      ...baseCount,
      inventoryBatchId: "batch-1",
    });
    mockTx.inventoryBatch.findFirst.mockResolvedValue(null);
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "STOCK_ADJUSTED",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["stock changed since count", 41, 2],
    ["allocated stock exceeds count", 40, 38],
  ])("rejects adjustment when %s", async (_reason, quantity, allocated) => {
    mockTx.inventoryCount.findFirst.mockResolvedValue({
      ...baseCount,
      inventoryBatchId: "batch-1",
    });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      quantity,
      allocated,
    });
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "STOCK_ADJUSTED",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
  });

  it("refuses to adjust stock on a batch that has since expired", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue({
      ...baseCount,
      inventoryBatchId: "batch-1",
    });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      quantity: 40,
      allocated: 0,
      expiryDate: new Date(Date.now() - 60_000),
    });
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "STOCK_ADJUSTED",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ["the item is gone", [], 404],
    ["item allocations exceed the new on-hand total", [{ allocated: 38 }], 409],
  ])(
    "rolls back the adjustment when %s",
    async (_reason, lockedRows, status) => {
      mockTx.inventoryCount.findFirst.mockResolvedValue({
        ...baseCount,
        inventoryBatchId: "batch-1",
      });
      mockTx.inventoryBatch.findFirst.mockResolvedValue({
        id: "batch-1",
        quantity: 40,
        allocated: 0,
        expiryDate: null,
      });
      mockTx.$executeRaw.mockResolvedValue(1);
      mockTx.$queryRaw.mockResolvedValue(lockedRows);
      mockTx.inventoryBatch.aggregate.mockResolvedValue({
        _sum: { quantity: 37 },
      });
      await expect(
        InventoryCountService.reconcile(
          "count-1",
          "org-1",
          "user-2",
          "STOCK_ADJUSTED",
        ),
      ).rejects.toMatchObject({ statusCode: status });
      expect(mockTx.inventoryItem.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryStockMovement.create).not.toHaveBeenCalled();
      expect(mockAudit).not.toHaveBeenCalled();
    },
  );

  it("rejects a concurrent stock change after reading the batch", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue({
      ...baseCount,
      inventoryBatchId: "batch-1",
    });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      quantity: 40,
      allocated: 2,
    });
    mockTx.$executeRaw.mockResolvedValue(0);
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "STOCK_ADJUSTED",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockTx.inventoryItem.update).not.toHaveBeenCalled();
  });

  it("sets item on-hand to zero when no batches remain", async () => {
    mockTx.inventoryCount.findFirst
      .mockResolvedValueOnce({ ...baseCount, inventoryBatchId: "batch-1" })
      .mockResolvedValueOnce({ ...baseCount, reconciled: true });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({
      id: "batch-1",
      quantity: 40,
      allocated: 0,
    });
    mockTx.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockTx.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });

    await InventoryCountService.reconcile(
      "count-1",
      "org-1",
      "user-2",
      "STOCK_ADJUSTED",
    );

    expect(mockTx.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { onHand: 0 },
    });
  });

  it("does not audit if a concurrent request already reconciled the count", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue(baseCount);
    mockTx.$executeRaw.mockResolvedValue(0);
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "NO_CHANGE",
        "Recounted and checked the movement log.",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("rejects a missing count returned after the write", async () => {
    mockTx.inventoryCount.findFirst
      .mockResolvedValueOnce(baseCount)
      .mockResolvedValueOnce(null);
    mockTx.$executeRaw.mockResolvedValue(1);
    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "NO_CHANGE",
        "Recounted and checked the movement log.",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("refuses to reconcile the same count twice", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue({
      ...baseCount,
      reconciled: true,
    });

    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-1",
        "user-2",
        "NO_CHANGE",
        "Already checked",
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Inventory count is already reconciled.",
    });
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("refuses to reconcile a count from another organisation", async () => {
    mockTx.inventoryCount.findFirst.mockResolvedValue(null);

    await expect(
      InventoryCountService.reconcile(
        "count-1",
        "org-2",
        "user-2",
        "NO_CHANGE",
        "Checked",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
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
