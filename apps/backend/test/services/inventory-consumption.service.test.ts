import { prisma } from "src/config/prisma";
import {
  InventoryConsumptionService,
  InventoryConsumptionServiceError,
} from "../../src/services/inventory-consumption.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    inventoryConsumptionRule: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryConsumptionEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    inventoryBatch: {
      findMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryStockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    productItem: {
      findFirst: jest.fn(),
    },
  },
}));

type MockedPrisma = typeof prisma & {
  $transaction: jest.Mock;
  inventoryConsumptionRule: {
    upsert: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  inventoryConsumptionEvent: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  inventoryItem: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  inventoryBatch: {
    findMany: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  inventoryStockMovement: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  productItem: {
    findFirst: jest.Mock;
  };
};

describe("InventoryConsumptionService", () => {
  const mockedPrisma = prisma as unknown as MockedPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return undefined;
    });
    mockedPrisma.inventoryConsumptionEvent.findUnique.mockResolvedValue(null);
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValue([]);
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValue(null);
  });

  it("upserts normalized mapping rules", async () => {
    mockedPrisma.inventoryConsumptionRule.upsert.mockResolvedValue({
      id: "rule-1",
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceKey: "amoxicillin",
      inventoryItemId: "item-1",
      quantityMultiplier: 1.5,
      active: true,
    });

    await InventoryConsumptionService.upsertRule({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceKey: " Amoxicillin ",
      inventoryItemId: "item-1",
      quantityMultiplier: 1.5,
      notes: "Antibiotic",
    });

    expect(mockedPrisma.inventoryConsumptionRule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId_sourceType_sourceKey_inventoryItemId: {
            organisationId: "org-1",
            sourceType: "PRESCRIPTION",
            sourceKey: "amoxicillin",
            inventoryItemId: "item-1",
          },
        },
        create: expect.objectContaining({
          sourceKey: "amoxicillin",
          quantityMultiplier: 1.5,
          notes: "Antibiotic",
          active: true,
        }),
      }),
    );
  });

  it("rejects invalid rule input", async () => {
    await expect(
      InventoryConsumptionService.upsertRule({
        organisationId: " ",
        sourceType: "PRESCRIPTION",
        sourceKey: "amoxicillin",
        inventoryItemId: "item-1",
      }),
    ).rejects.toThrow(InventoryConsumptionServiceError);
  });

  it("consumes inventory from a direct line and stock batches", async () => {
    mockedPrisma.inventoryItem.findFirst
      .mockResolvedValueOnce({ id: "item-1" })
      .mockResolvedValueOnce({
        id: "item-1",
        organisationId: "org-1",
        onHand: 5,
        allocated: 0,
      });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([
        { id: "batch-1", quantity: 2, allocated: 0 },
        { id: "batch-2", quantity: 4, allocated: 0 },
      ])
      .mockResolvedValueOnce([
        { id: "batch-1", quantity: 0, allocated: 0 },
        { id: "batch-2", quantity: 3, allocated: 0 },
      ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-1",
    });

    const events = await InventoryConsumptionService.consume({
      organisationId: "org-1",
      sourceType: "PRESCRIPTION",
      sourceId: "rx-1",
      lines: [
        {
          sourceLineKey: "line-1",
          inventoryItemSku: "sku-1",
          quantity: 3,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 3, allocated: 0 },
      }),
    );
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledTimes(2);
  });

  it("rejects direct consumption when quantity is invalid", async () => {
    await expect(
      InventoryConsumptionService.consume({
        organisationId: "org-1",
        sourceType: "PRESCRIPTION",
        sourceId: "rx-1",
        lines: [
          {
            sourceLineKey: "line-1",
            inventoryItemId: "item-1",
            quantity: 0,
          },
        ],
      }),
    ).rejects.toThrow("quantity must be a positive integer");
  });

  it("consumes prescription lines through a mapping rule", async () => {
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce({
      inventoryItemId: "item-1",
      quantityMultiplier: 2,
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 10,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 10, allocated: 0 }])
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 6, allocated: 0 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-2",
    });

    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [
        {
          name: "Amoxicillin",
          quantity: 2,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(
      mockedPrisma.inventoryConsumptionRule.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceKey: "amoxicillin",
        }),
      }),
    );
  });

  it("resolves prescription batch selectors before consuming", async () => {
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValueOnce({
      id: "batch-7",
      itemId: "item-7",
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-7",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-7", quantity: 5, allocated: 0 }])
      .mockResolvedValueOnce([{ id: "batch-7", quantity: 3, allocated: 0 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-7",
    });

    const events = await InventoryConsumptionService.consumePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-7",
      medications: [
        {
          sourceLineKey: "line-batch",
          batchId: "batch-7",
          quantity: 2,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "batch-7",
          organisationId: "org-1",
        }),
      }),
    );
  });

  it("reserves prescription inventory without decrementing stock", async () => {
    mockedPrisma.inventoryBatch.findFirst.mockResolvedValueOnce({
      id: "batch-8",
      itemId: "item-8",
    });
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-reserve-1",
    });

    const events = await InventoryConsumptionService.reservePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-8",
      medications: [
        {
          inventoryItemId: "item-8",
          batchId: "batch-8",
          quantity: 1,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryItem.update).not.toHaveBeenCalled();
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "RESERVE",
          status: "APPLIED",
        }),
      }),
    );
  });

  it("voids a dispense with audit metadata preserved", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-void-1",
        itemId: "item-9",
        batchId: "batch-9",
        change: -1,
        reason: "PRESCRIPTION_DISPENSE",
        referenceId: "rx-9",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-9",
      organisationId: "org-1",
      onHand: 4,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-9", quantity: 4, allocated: 0 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-void-1",
    });

    const events = await InventoryConsumptionService.voidDispensePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-9",
      medications: [
        {
          inventoryItemId: "item-9",
          batchId: "batch-9",
          quantity: 1,
        },
      ],
      metadata: { voidedBy: "user-1" },
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "PRESCRIPTION_VOID_DISPENSE",
          referenceId: "rx-9",
        }),
      }),
    );
    expect(mockedPrisma.inventoryConsumptionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            voided: true,
            originalMetadata: { voidedBy: "user-1" },
          }),
        }),
      }),
    );
  });

  it("releases prescription lines back into inventory", async () => {
    mockedPrisma.inventoryStockMovement.findMany.mockResolvedValueOnce([
      {
        id: "movement-1",
        itemId: "item-1",
        batchId: "batch-1",
        change: -2,
        reason: "MANUAL_ADJUSTMENT",
        referenceId: "rx-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 8,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-1", quantity: 8, allocated: 0 },
    ]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-release-1",
    });

    const events = await InventoryConsumptionService.releasePrescription({
      organisationId: "org-1",
      prescriptionId: "rx-1",
      medications: [
        {
          inventoryItemId: "item-1",
          quantity: 2,
          sourceLineKey: "line-1",
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        data: { quantity: { increment: 2 } },
      }),
    );
    expect(mockedPrisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 8, allocated: 0 },
      }),
    );
    expect(mockedPrisma.inventoryStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          change: 2,
          reason: "PRESCRIPTION_RELEASE",
          referenceId: "rx-1",
        }),
      }),
    );
  });

  it("loads package mappings before consuming package inventory", async () => {
    mockedPrisma.productItem.findFirst.mockResolvedValueOnce({
      id: "pkg-1",
      package: {
        items: [
          {
            childProductItemId: "component-1",
            quantity: 2,
            sortOrder: 0,
          },
        ],
      },
    });
    mockedPrisma.inventoryConsumptionRule.findFirst.mockResolvedValueOnce({
      inventoryItemId: "item-1",
      quantityMultiplier: 1,
    });
    mockedPrisma.inventoryItem.findFirst.mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      onHand: 4,
      allocated: 0,
    });
    mockedPrisma.inventoryBatch.findMany
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 4, allocated: 0 }])
      .mockResolvedValueOnce([{ id: "batch-1", quantity: 2, allocated: 0 }]);
    mockedPrisma.inventoryBatch.update.mockResolvedValue({});
    mockedPrisma.inventoryStockMovement.create.mockResolvedValue({});
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
    mockedPrisma.inventoryConsumptionEvent.create.mockResolvedValue({
      id: "event-3",
    });

    const events = await InventoryConsumptionService.consumePackageProduct({
      organisationId: "org-1",
      packageProductItemId: "pkg-1",
      sourceId: "visit-1",
      quantity: 1,
    });

    expect(events).toHaveLength(1);
    expect(mockedPrisma.productItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "pkg-1",
          kind: "PACKAGE",
        }),
      }),
    );
  });

  it("rejects procedure consumption when no mapping exists", async () => {
    mockedPrisma.inventoryConsumptionRule.findMany.mockResolvedValueOnce([]);

    await expect(
      InventoryConsumptionService.consumeProcedureProduct({
        organisationId: "org-1",
        procedureProductItemId: "proc-1",
        sourceId: "visit-1",
      }),
    ).rejects.toThrow("Missing inventory mapping for procedure proc-1.");
  });
});
