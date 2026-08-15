import dayjs from "dayjs";
import { Prisma } from "@prisma/client";
import {
  InventoryService,
  InventoryAdjustmentService,
  InventoryAllocationService,
  InventoryVendorService,
  InventoryMetaFieldService,
  InventoryAlertService,
  InventoryServiceError,
} from "../../src/services/inventory.service";
import { prisma } from "src/config/prisma";
import {
  calculateInventoryStockStatus,
  calculatePricingMetrics,
  getInventoryCategories,
  isMedicalInventoryCategory,
  validateInventoryCategorySelection,
} from "../../src/services/inventory.catalog";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationBilling: {
      findUnique: jest.fn(),
    },
    inventoryItem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryBatch: {
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    inventoryVendor: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    inventoryMetaField: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    inventoryStockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryCategory: {
      findMany: jest.fn(),
    },
    inventorySubcategory: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/inventory.catalog", () => ({
  calculateInventoryStockStatus: jest.fn(() => "In stock"),
  calculatePricingMetrics: jest.fn(() => ({
    grossProfit: 5,
    marginPercentage: 10,
  })),
  getInventoryCategories: jest.fn(() => []),
  isMedicalInventoryCategory: jest.fn(() => false),
  validateInventoryCategorySelection: jest.fn(() => ({
    categoryExists: false,
    subcategoryValid: true,
  })),
}));

describe("Inventory service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.inventoryCategory.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventorySubcategory.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryStockMovement.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("creates an item and batches in postgres mode", async () => {
    (prisma.inventoryItem.create as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      name: "Bandage",
      category: "Consumables",
      businessType: "HOSPITAL",
      status: "ACTIVE",
      onHand: 2,
      allocated: 6,
    });
    (prisma.inventoryBatch.createMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 3,
      allocated: 6,
    });
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: 3,
        allocated: 0,
      },
    ]);

    const result = await InventoryService.createItem({
      organisationId: "org-1",
      name: "Bandage",
      category: "Consumables",
      businessType: "HOSPITAL",
      initialOnHand: 2,
      allocated: 6,
      initialAllocated: 2,
      stockUnitType: "bottle",
      unitOfMeasure: "mg",
      unitQuantity: 3,
      batches: [{ quantity: 3 }],
    });

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockUnitType: "bottle",
          unitOfMeasure: "mg",
          packageQuantity: 3,
        }),
      }),
    );
    expect(result.item.id).toBe("item-1");
    expect(result.item.allocated).toBe(6);
    expect(result.batches).toHaveLength(1);
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onHand: 3 },
      }),
    );
  });

  it("passes batch warning and barcode fields through createMany", async () => {
    (prisma.inventoryItem.create as jest.Mock).mockResolvedValue({
      id: "item-2",
      organisationId: "org-1",
      name: "Syringe",
      category: "Consumables",
      businessType: "HOSPITAL",
      status: "ACTIVE",
      onHand: 0,
      allocated: 0,
    });
    (prisma.inventoryBatch.createMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-2",
      organisationId: "org-1",
      onHand: 1,
      allocated: 0,
    });
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);

    await InventoryService.createItem({
      organisationId: "org-1",
      name: "Syringe",
      category: "Consumables",
      businessType: "HOSPITAL",
      batches: [
        {
          quantity: 1,
          expiryWarningBefore: "30 days",
          barcode: "ABC-123",
        },
      ],
    });

    expect(prisma.inventoryBatch.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            expiryWarningBefore: "30 days",
            barcode: "ABC-123",
          }),
        ],
      }),
    );
  });

  it("derives stock unit fields from legacy attributes when top-level fields are absent", async () => {
    (prisma.inventoryItem.create as jest.Mock).mockResolvedValue({
      id: "item-legacy",
      organisationId: "org-1",
      name: "Paracetamol",
      category: "Medicine",
      businessType: "HOSPITAL",
      status: "ACTIVE",
      onHand: 0,
      allocated: 0,
    });

    await InventoryService.createItem({
      organisationId: "org-1",
      name: "Paracetamol",
      category: "Medicine",
      businessType: "HOSPITAL",
      attributes: {
        stockType: "strip",
        unitQnt: "10",
      },
    });

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockUnitType: "strip",
          packageQuantity: 10,
        }),
      }),
    );
  });

  it("rejects duplicate sku", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "item-dup",
    });

    await expect(
      InventoryService.createItem({
        organisationId: "org-1",
        name: "Bandage",
        category: "Consumables",
        businessType: "HOSPITAL",
        sku: "SKU-1",
      }),
    ).rejects.toThrow("sku must be unique within the organisation");
  });

  it("updates an item", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      category: "Consumables",
      businessType: "HOSPITAL",
      itemType: "NON_MEDICAL",
      allocated: 2,
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      name: "Updated",
      category: "Consumables",
      businessType: "HOSPITAL",
      allocated: 7,
    });

    const result = await InventoryService.updateItem(
      "item-1",
      {
        name: "Updated",
        genericName: "Paracetamol",
        strength: "650 mg",
        dosageForm: "Tablet",
        routeOfAdministration: "Oral",
        stockUnitType: "bottle",
        unitOfMeasure: "mg",
        allocated: 7,
        unitQuantity: 12,
      },
      "org-1",
    );

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockUnitType: "bottle",
          unitOfMeasure: "mg",
          packageQuantity: 12,
        }),
      }),
    );
    expect(result.item.name).toBe("Updated");
    expect(result.item.allocated).toBe(7);
  });

  it("normalizes empty sku to null on update", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "item-3",
      organisationId: "org-1",
      category: "Consumables",
      businessType: "HOSPITAL",
      itemType: "NON_MEDICAL",
      sku: "",
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValueOnce({
      id: "item-3",
      organisationId: "org-1",
      category: "Consumables",
      businessType: "HOSPITAL",
      sku: null,
    });

    const result = await InventoryService.updateItem(
      "item-3",
      {
        sku: "",
      },
      "org-1",
    );

    expect(prisma.inventoryItem.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sku: null,
        }),
      }),
    );
    expect(result.item.sku).toBeNull();
  });

  it("prefers legacy attribute stock fields during updates when top-level fields are absent", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "item-2",
      organisationId: "org-1",
      category: "Medicine",
      businessType: "HOSPITAL",
      itemType: "MEDICAL",
      genericName: "Paracetamol",
      strength: "650 mg",
      dosageForm: "Tablet",
      routeOfAdministration: "Oral",
      allocated: 0,
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValueOnce({
      id: "item-2",
      organisationId: "org-1",
      name: "Updated",
      category: "Medicine",
      businessType: "HOSPITAL",
      allocated: 0,
    });

    await InventoryService.updateItem(
      "item-2",
      {
        attributes: {
          stockType: "bottle",
          unitQnt: "12",
        },
      },
      "org-1",
    );

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockUnitType: "bottle",
          packageQuantity: 12,
        }),
      }),
    );
  });

  it("hides, archives, and re-activates items", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      status: "HIDDEN",
    });

    const hidden = await InventoryService.hideItem("item-1", "org-1");
    expect(hidden.status).toBe("HIDDEN");

    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      status: "DELETED",
    });
    const archived = await InventoryService.archiveItem("item-1", "org-1");
    expect(archived.status).toBe("DELETED");

    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      status: "ACTIVE",
    });
    const active = await InventoryService.activeItem("item-1", "org-1");
    expect(active.status).toBe("ACTIVE");
  });

  it("lists items with batch metadata", async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "item-1",
        organisationId: "org-1",
        name: "Bandage",
        category: "Consumables",
        businessType: "HOSPITAL",
        status: "ACTIVE",
        onHand: 5,
        allocated: 0,
      },
    ]);
    (prisma.inventoryBatch.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "batch-1",
          itemId: "item-1",
          organisationId: "org-1",
          quantity: 5,
          allocated: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "batch-1",
          itemId: "item-1",
          organisationId: "org-1",
          quantity: 4,
          allocated: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await InventoryService.listItems({
      organisationId: "org-1",
    } as never);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("rejects invalid inventory filters and honors empty status lists", async () => {
    await expect(
      InventoryService.listItems({
        organisationId: "org-1",
        status: "BROKEN" as never,
      } as never),
    ).rejects.toBeInstanceOf(InventoryServiceError);

    const emptyResult = await InventoryService.listItems({
      organisationId: "org-1",
      status: [],
    } as never);

    expect(emptyResult).toEqual([]);
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it("returns categories from the seed catalog when the database is empty", async () => {
    const categories = await InventoryService.getCategories();
    expect(categories).toEqual([]);
  });

  it("loads an item with batches and vendor data", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      name: "Bandage",
      category: "Consumables",
      businessType: "HOSPITAL",
      status: "ACTIVE",
      onHand: 5,
      allocated: 0,
      vendorId: "vendor-1",
    });
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: 5,
        allocated: 0,
      },
    ]);
    (prisma.inventoryVendor.findFirst as jest.Mock).mockResolvedValue({
      id: "vendor-1",
      organisationId: "org-1",
      name: "Supplier",
    });

    const result = await InventoryService.getItemWithBatches("item-1", "org-1");
    expect(result.item.id).toBe("item-1");
    expect(result.batches).toHaveLength(1);
  });

  it("adds, updates, and deletes batches", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 2,
      allocated: 5,
    });
    (prisma.inventoryBatch.create as jest.Mock).mockResolvedValue({
      id: "batch-1",
      itemId: "item-1",
      organisationId: "org-1",
      quantity: 3,
      allocated: 0,
    });
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: 5,
        allocated: 0,
      },
    ]);
    (prisma.inventoryBatch.findFirst as jest.Mock).mockResolvedValue({
      id: "batch-1",
      itemId: "item-1",
      organisationId: "org-1",
      quantity: 5,
      allocated: 0,
    });
    (prisma.inventoryBatch.update as jest.Mock).mockResolvedValue({
      id: "batch-1",
      itemId: "item-1",
      organisationId: "org-1",
      quantity: 4,
      allocated: 0,
    });
    (prisma.inventoryBatch.create as jest.Mock).mockResolvedValue({
      id: "batch-1",
      itemId: "item-1",
      organisationId: "org-1",
      quantity: 3,
      allocated: 0,
      expiryWarningBefore: "30 days",
      barcode: "BAR-123",
    });

    const created = await InventoryService.addBatch(
      "item-1",
      {
        quantity: 3,
        expiryWarningBefore: "30 days",
        barcode: "BAR-123",
      },
      "org-1",
    );
    expect(created.id).toBe("batch-1");
    expect(
      (prisma.inventoryBatch.create as jest.Mock).mock.calls[0][0].data,
    ).toEqual(
      expect.objectContaining({
        expiryWarningBefore: "30 days",
        barcode: "BAR-123",
      }),
    );
    expect(
      (prisma.inventoryItem.update as jest.Mock).mock.calls[0][0].data,
    ).toEqual(
      expect.objectContaining({
        onHand: expect.any(Number),
      }),
    );
    expect(
      (prisma.inventoryItem.update as jest.Mock).mock.calls[0][0].data,
    ).not.toHaveProperty("allocated");

    const updated = await InventoryService.updateBatch(
      "batch-1",
      {
        quantity: 4,
        expiryWarningBefore: "21 days",
        barcode: "BAR-456",
      },
      "org-1",
    );
    expect(updated.quantity).toBe(4);
    expect(
      (prisma.inventoryBatch.update as jest.Mock).mock.calls[0][0].data,
    ).toEqual(
      expect.objectContaining({
        expiryWarningBefore: "21 days",
        barcode: "BAR-456",
      }),
    );
    expect(
      (prisma.inventoryItem.updateMany as jest.Mock).mock.calls[0][0].data,
    ).toEqual(
      expect.objectContaining({
        onHand: expect.any(Number),
      }),
    );
    expect(
      (prisma.inventoryItem.updateMany as jest.Mock).mock.calls[0][0].data,
    ).not.toHaveProperty("allocated");

    await InventoryService.deleteBatch("batch-1", "org-1");
    expect(prisma.inventoryBatch.deleteMany).toHaveBeenCalled();
  });

  it("consumes stock and calculates turnover", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 5,
      allocated: 0,
      name: "Bandage",
      category: "Consumables",
      businessType: "HOSPITAL",
      status: "ACTIVE",
    });
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: 5,
        allocated: 0,
      },
    ]);
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 3,
      allocated: 0,
    });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "item-1",
        organisationId: "org-1",
        onHand: 3,
        category: "Consumables",
        name: "Bandage",
        status: "ACTIVE",
      },
    ]);
    (prisma.inventoryStockMovement.findMany as jest.Mock).mockResolvedValue([
      {
        itemId: "item-1",
        change: -2,
      },
    ]);
    (prisma.inventoryBatch.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 5 },
    });

    const consumed = await InventoryService.consumeStock(
      {
        itemId: "item-1",
        quantity: 2,
        reason: "MANUAL_ADJUSTMENT",
      },
      "org-1",
    );
    expect(consumed.onHand).toBe(3);

    const turnover = await InventoryService.getInventoryTurnoverByItem({
      organisationId: "org-1",
      from: dayjs().subtract(1, "month").toDate(),
      to: new Date(),
    });
    expect(turnover).toHaveLength(1);
  });

  it("consumeStock leaves an existing reservation untouched", async () => {
    // Reservations are held on the item by allocateStock and are never mirrored
    // onto the batch rows, so consumption must not recompute them from batches.
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 5,
      allocated: 5,
    });
    (prisma.inventoryBatch.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "batch-1",
          itemId: "item-1",
          organisationId: "org-1",
          quantity: 5,
          allocated: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "batch-1",
          itemId: "item-1",
          organisationId: "org-1",
          quantity: 3,
          allocated: 0,
        },
      ]);
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 3,
      allocated: 5,
    });

    const consumed = await InventoryService.consumeStock(
      { itemId: "item-1", quantity: 2, reason: "MANUAL_ADJUSTMENT" },
      "org-1",
    );

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { onHand: 3 },
    });
    expect(consumed.allocated).toBe(5);
  });

  it("adjusts, allocates, and releases inventory", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 2,
      allocated: 0,
    });
    (prisma.inventoryBatch.create as jest.Mock).mockResolvedValue({
      id: "batch-1",
      itemId: "item-1",
      organisationId: "org-1",
      quantity: 5,
      allocated: 0,
    });
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: 5,
        allocated: 0,
      },
    ]);
    (prisma.inventoryItem.update as jest.Mock)
      .mockResolvedValueOnce({
        id: "item-1",
        organisationId: "org-1",
        onHand: 5,
        allocated: 0,
      })
      .mockResolvedValueOnce({
        id: "item-1",
        organisationId: "org-1",
        onHand: 5,
        allocated: 1,
      })
      .mockResolvedValueOnce({
        id: "item-1",
        organisationId: "org-1",
        onHand: 5,
        allocated: 0,
      });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "item-1",
        organisationId: "org-1",
        onHand: 5,
        allocated: 0,
      },
    ]);

    const adjusted = await InventoryAdjustmentService.adjustStock({
      itemId: "item-1",
      newOnHand: 5,
      reason: "ADJUSTMENT",
      organisationId: "org-1",
    });
    expect(adjusted.onHand).toBe(5);

    const allocated = await InventoryAllocationService.allocateStock({
      itemId: "item-1",
      quantity: 1,
      referenceId: "ref-1",
      organisationId: "org-1",
    });
    expect(allocated.allocated).toBeGreaterThanOrEqual(1);

    const released = await InventoryAllocationService.releaseAllocatedStock({
      itemId: "item-1",
      quantity: 1,
      referenceId: "ref-1",
      organisationId: "org-1",
    });
    expect(released.allocated).toBeGreaterThanOrEqual(0);
  });

  it("manages vendors, meta fields, and alerts", async () => {
    (prisma.inventoryVendor.create as jest.Mock).mockResolvedValue({
      id: "vendor-1",
      organisationId: "org-1",
      name: "Supplier",
    });
    (prisma.inventoryVendor.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryVendor.findFirst as jest.Mock).mockResolvedValue({
      id: "vendor-1",
      organisationId: "org-1",
      name: "Supplier",
    });
    (prisma.inventoryVendor.update as jest.Mock).mockResolvedValue({
      id: "vendor-1",
      organisationId: "org-1",
      name: "Supplier",
    });
    (prisma.inventoryMetaField.create as jest.Mock).mockResolvedValue({
      id: "field-1",
      businessType: "HOSPITAL",
      fieldKey: "color",
      label: "Color",
      values: [],
    });
    (prisma.inventoryMetaField.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryMetaField.update as jest.Mock).mockResolvedValue({
      id: "field-1",
      businessType: "HOSPITAL",
      fieldKey: "color",
      label: "Color",
      values: [],
    });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: "item-1",
        organisationId: "org-1",
        onHand: 1,
        reorderLevel: 2,
        category: "Consumables",
        name: "Bandage",
        status: "ACTIVE",
      },
    ]);
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        expiryDate: new Date(Date.now() + 86400000),
        quantity: 1,
        allocated: 0,
      },
    ]);

    const vendor = await InventoryVendorService.createVendor({
      organisationId: "org-1",
      name: "Supplier",
    });
    expect(vendor.id).toBe("vendor-1");

    const field = await InventoryMetaFieldService.createField({
      businessType: "HOSPITAL",
      fieldKey: "color",
      label: "Color",
      values: [],
    });
    expect(field.id).toBe("field-1");

    const lowStock = await InventoryAlertService.getLowStockItems("org-1");
    expect(lowStock).toHaveLength(1);

    const expiring = await InventoryAlertService.getExpiringItems("org-1", 7);
    expect(expiring).toHaveLength(1);
  });

  it("rejects invalid create input and missing stock records", async () => {
    await expect(
      InventoryService.createItem({
        name: "Bandage",
        category: "Consumables",
        businessType: "HOSPITAL",
      } as never),
    ).rejects.toThrow("organisationId is required");

    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      InventoryAdjustmentService.adjustStock({
        itemId: "item-missing",
        newOnHand: 10,
        reason: "MANUAL_ADJUSTMENT",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("Item not found");
  });

  it("rejects stock allocations that exceed unallocated inventory", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "item-1",
      onHand: 5,
      allocated: 5,
    });

    await expect(
      InventoryAllocationService.allocateStock({
        itemId: "item-1",
        quantity: 1,
        referenceId: "ref-1",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("Not enough unallocated stock");
  });

  it("rejects invalid vendor and meta-field inputs", async () => {
    await expect(
      InventoryVendorService.createVendor({
        name: "Vendor",
      } as never),
    ).rejects.toThrow("organisationId required");

    await expect(
      InventoryMetaFieldService.createField({
        businessType: "INVALID",
        fieldKey: "key",
        label: "Label",
        values: [],
      }),
    ).rejects.toThrow("Invalid businessType");
  });

  describe("cross-organisation access is rejected (IDOR)", () => {
    // The authorized organisation is "org-1" (resolved by withOrgPermissions
    // from the verified token / x-org-id). The attacker references a record
    // that belongs to "org-2". Every query must be bound to the authorized
    // org, so the foreign record is invisible (treated as not found).

    it("addBatch refuses an item from another organisation", async () => {
      // Scoped lookup (id + authorized org) returns nothing for a foreign item.
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InventoryService.addBatch("foreign-item", { quantity: 1 }, "org-1"),
      ).rejects.toThrow("Inventory item not found");

      expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-item", organisationId: "org-1" },
      });
      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
    });

    it("updateBatch refuses a batch from another organisation", async () => {
      (prisma.inventoryBatch.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        InventoryService.updateBatch("foreign-batch", { quantity: 9 }, "org-1"),
      ).rejects.toThrow("Batch not found");

      expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-batch", organisationId: "org-1" },
      });
      expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
    });

    it("deleteBatch does not delete a batch from another organisation", async () => {
      (prisma.inventoryBatch.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await InventoryService.deleteBatch("foreign-batch", "org-1");

      expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-batch", organisationId: "org-1" },
      });
      expect(prisma.inventoryBatch.deleteMany).not.toHaveBeenCalled();
    });

    it("consumeStock refuses an item from another organisation", async () => {
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InventoryService.consumeStock(
          { itemId: "foreign-item", quantity: 1, reason: "OTHER" },
          "org-1",
        ),
      ).rejects.toThrow("Inventory item not found");

      expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-item", organisationId: "org-1" },
      });
    });

    it("adjustStock refuses an item from another organisation", async () => {
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InventoryAdjustmentService.adjustStock({
          itemId: "foreign-item",
          newOnHand: 10,
          reason: "MANUAL_ADJUSTMENT",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Item not found");

      expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-item", organisationId: "org-1" },
      });
    });

    it("allocateStock refuses an item from another organisation", async () => {
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InventoryAllocationService.allocateStock({
          itemId: "foreign-item",
          quantity: 1,
          referenceId: "ref-1",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Item not found");

      expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-item", organisationId: "org-1" },
      });
    });

    it("releaseAllocatedStock refuses an item from another organisation", async () => {
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InventoryAllocationService.releaseAllocatedStock({
          itemId: "foreign-item",
          quantity: 1,
          referenceId: "ref-1",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Item not found");

      expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-item", organisationId: "org-1" },
      });
    });

    it("getVendor scopes the lookup to the authorized organisation", async () => {
      (prisma.inventoryVendor.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      const result = await InventoryVendorService.getVendor(
        "foreign-vendor",
        "org-1",
      );

      expect(result).toBeNull();
      expect(prisma.inventoryVendor.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-vendor", organisationId: "org-1" },
      });
    });

    it("updateVendor refuses a vendor from another organisation", async () => {
      (prisma.inventoryVendor.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        InventoryVendorService.updateVendor(
          "foreign-vendor",
          { name: "Hacked" },
          "org-1",
        ),
      ).rejects.toThrow("Vendor not found");

      expect(prisma.inventoryVendor.findFirst).toHaveBeenCalledWith({
        where: { id: "foreign-vendor", organisationId: "org-1" },
      });
      expect(prisma.inventoryVendor.update).not.toHaveBeenCalled();
    });

    it("deleteVendor only deletes within the authorized organisation", async () => {
      (prisma.inventoryVendor.deleteMany as jest.Mock).mockResolvedValueOnce({
        count: 0,
      });

      await InventoryVendorService.deleteVendor("foreign-vendor", "org-1");

      expect(prisma.inventoryVendor.deleteMany).toHaveBeenCalledWith({
        where: { id: "foreign-vendor", organisationId: "org-1" },
      });
    });
  });

  // These run last with reset mocks: earlier tests intentionally leave
  // queued mockResolvedValueOnce values that later tests consume.
  it("applies a status change during update", async () => {
    (prisma.inventoryItem.findFirst as jest.Mock).mockReset();
    (prisma.inventoryItem.update as jest.Mock).mockReset();
    (prisma.inventoryBatch.findMany as jest.Mock).mockReset();
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "item-4",
      organisationId: "org-1",
      category: "Consumables",
      businessType: "HOSPITAL",
      itemType: "NON_MEDICAL",
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValueOnce({
      id: "item-4",
      organisationId: "org-1",
      status: "HIDDEN",
    });

    const result = await InventoryService.updateItem(
      "item-4",
      {
        status: "HIDDEN",
      },
      "org-1",
    );

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "HIDDEN",
        }),
      }),
    );
    expect(result.item.status).toBe("HIDDEN");
  });

  it("translates business, category, and search filters into the prisma where clause", async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockReset();
    (prisma.inventoryBatch.findMany as jest.Mock).mockReset();
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);

    const result = await InventoryService.listItems({
      organisationId: "org-1",
      businessType: "HOSPITAL",
      category: "Consumables",
      subCategory: "Bandages",
      search: "band",
    } as never);

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          businessType: "HOSPITAL",
          category: "Consumables",
          subCategory: "Bandages",
          OR: [
            { name: { contains: "band", mode: "insensitive" } },
            { sku: { contains: "band", mode: "insensitive" } },
            { description: { contains: "band", mode: "insensitive" } },
          ],
        }),
      }),
    );
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Guard / helper / branch coverage.
//
// This suite deliberately resets every mock before each test so it is
// independent of the ordering-sensitive queues used by the suite above.
// ─────────────────────────────────────────────────────────────
describe("Inventory service guards, helpers, and branch paths", () => {
  const mockOf = (fn: unknown) => fn as jest.Mock;

  const itemRow = (over: Record<string, unknown> = {}) => ({
    id: "item-1",
    organisationId: "org-1",
    name: "Item",
    sku: null,
    category: "Consumables",
    subCategory: null,
    businessType: "HOSPITAL",
    itemType: "NON_MEDICAL",
    status: "ACTIVE",
    onHand: 5,
    allocated: 0,
    reorderLevel: null,
    minimumStock: null,
    emergencyStockLevel: null,
    unitOfMeasure: null,
    stockUnitType: null,
    unitCost: null,
    sellingPrice: null,
    vendorId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...over,
  });

  const batchRow = (over: Record<string, unknown> = {}) => ({
    id: "batch-1",
    itemId: "item-1",
    organisationId: "org-1",
    quantity: 5,
    allocated: 0,
    expiryDate: null,
    ...over,
  });

  const listOf = async (filter: Record<string, unknown>) =>
    (await InventoryService.listItems(filter as never)) as Array<
      Record<string, unknown>
    >;

  beforeEach(() => {
    jest.resetAllMocks();

    mockOf(calculateInventoryStockStatus).mockReturnValue("In stock");
    mockOf(calculatePricingMetrics).mockReturnValue({
      grossProfit: 5,
      marginPercentage: 10,
    });
    mockOf(getInventoryCategories).mockReturnValue([
      {
        code: "SEED",
        name: "Seed",
        isMedical: false,
        sortOrder: 1,
        subcategories: [],
      },
    ]);
    mockOf(isMedicalInventoryCategory).mockReturnValue(false);
    mockOf(validateInventoryCategorySelection).mockReturnValue({
      categoryExists: true,
      subcategoryValid: true,
    });

    mockOf(prisma.organizationBilling.findUnique).mockResolvedValue({
      currency: "gbp",
    });
    mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(null);
    mockOf(prisma.inventoryItem.findMany).mockResolvedValue([]);
    mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());
    mockOf(prisma.inventoryItem.updateMany).mockResolvedValue({ count: 1 });
    mockOf(prisma.inventoryBatch.findFirst).mockResolvedValue(null);
    mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([]);
    mockOf(prisma.inventoryBatch.create).mockResolvedValue(batchRow());
    mockOf(prisma.inventoryBatch.createMany).mockResolvedValue({ count: 1 });
    mockOf(prisma.inventoryBatch.update).mockResolvedValue(batchRow());
    mockOf(prisma.inventoryBatch.deleteMany).mockResolvedValue({ count: 1 });
    mockOf(prisma.inventoryBatch.aggregate).mockResolvedValue({
      _sum: { quantity: 0 },
    });
    mockOf(prisma.inventoryVendor.findMany).mockResolvedValue([]);
    mockOf(prisma.inventoryVendor.findFirst).mockResolvedValue(null);
    mockOf(prisma.inventoryVendor.deleteMany).mockResolvedValue({ count: 0 });
    mockOf(prisma.inventoryMetaField.findMany).mockResolvedValue([]);
    mockOf(prisma.inventoryMetaField.deleteMany).mockResolvedValue({
      count: 1,
    });
    mockOf(prisma.inventoryCategory.findMany).mockResolvedValue([]);
    mockOf(prisma.inventorySubcategory.findMany).mockResolvedValue([]);
    mockOf(prisma.inventoryStockMovement.findMany).mockResolvedValue([]);
    mockOf(prisma.inventoryStockMovement.create).mockResolvedValue({
      id: "mv-1",
    });
  });

  // ── createItem: required field guards ──
  describe("createItem validation", () => {
    const baseInput = {
      organisationId: "org-1",
      name: "Bandage",
      category: "Consumables",
      businessType: "HOSPITAL" as const,
    };

    it.each([
      [{ name: undefined }, "name is required"],
      [{ category: undefined }, "category is required"],
      [{ name: "x".repeat(256) }, "name is too long"],
      [{ sku: "   " }, "sku is required"],
      [{ businessType: "SPACESHIP" }, "Invalid businessType"],
    ])("rejects %p", async (patch, message) => {
      await expect(
        InventoryService.createItem({
          ...baseInput,
          ...patch,
        } as never),
      ).rejects.toThrow(message);
      expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only organisationId", async () => {
      await expect(
        InventoryService.createItem({
          ...baseInput,
          organisationId: "   ",
        } as never),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("rejects a subcategory that does not belong to the category", async () => {
      mockOf(validateInventoryCategorySelection).mockReturnValue({
        categoryExists: true,
        subcategoryValid: false,
      });

      await expect(
        InventoryService.createItem({
          ...baseInput,
          subCategory: "Syringes",
        }),
      ).rejects.toThrow("subcategory must belong to category");
      expect(validateInventoryCategorySelection).toHaveBeenCalledWith(
        "Consumables",
        "Syringes",
      );
    });

    it("accepts an unknown category whose subcategory cannot be validated", async () => {
      mockOf(validateInventoryCategorySelection).mockReturnValue({
        categoryExists: false,
        subcategoryValid: false,
      });
      mockOf(prisma.inventoryItem.create).mockResolvedValue(itemRow());

      await expect(
        InventoryService.createItem({ ...baseInput, subCategory: "Anything" }),
      ).resolves.toMatchObject({ item: { _id: "item-1" } });
    });

    it.each([
      ["genericName", {}],
      ["strength", { genericName: "Paracetamol" }],
      ["dosageForm", { genericName: "Paracetamol", strength: "650 mg" }],
      [
        "routeOfAdministration",
        {
          genericName: "Paracetamol",
          strength: "650 mg",
          dosageForm: "Tablet",
        },
      ],
    ])("requires %s for medical items", async (field, provided) => {
      mockOf(isMedicalInventoryCategory).mockReturnValue(true);

      await expect(
        InventoryService.createItem({
          ...baseInput,
          category: "Medicine",
          ...provided,
        } as never),
      ).rejects.toThrow(`${field} is required for medical items`);
    });

    it("classifies an item as NON_MEDICAL when the caller overrides a medical category", async () => {
      mockOf(isMedicalInventoryCategory).mockReturnValue(true);
      mockOf(prisma.inventoryItem.create).mockResolvedValue(itemRow());

      await InventoryService.createItem({
        ...baseInput,
        category: "Medicine",
        itemType: "NON_MEDICAL",
      });

      expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ itemType: "NON_MEDICAL" }),
        }),
      );
    });

    it("derives MEDICAL from the category when no itemType is supplied", async () => {
      mockOf(isMedicalInventoryCategory).mockReturnValue(true);
      mockOf(prisma.inventoryItem.create).mockResolvedValue(itemRow());

      await InventoryService.createItem({
        ...baseInput,
        category: "Medicine",
        genericName: "Paracetamol",
        strength: "650 mg",
        dosageForm: "Tablet",
        routeOfAdministration: "Oral",
      });

      expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ itemType: "MEDICAL" }),
        }),
      );
    });

    it.each([
      ["initialOnHand", { initialOnHand: -1 }],
      ["allocated", { allocated: -2 }],
      ["initialAllocated", { initialAllocated: -3 }],
      ["minimumStock", { minimumStock: -4 }],
      ["emergencyStockLevel", { emergencyStockLevel: -5 }],
      ["reorderLevel", { reorderLevel: -6 }],
      ["unitCost", { costPrice: -7 }],
      ["sellingPrice", { sellingPrice: -8 }],
      ["taxRate", { taxRate: -9 }],
      ["packageQuantity", { unitQuantity: -10 }],
    ])("rejects a negative %s", async (field, patch) => {
      await expect(
        InventoryService.createItem({ ...baseInput, ...patch } as never),
      ).rejects.toThrow(`${field} cannot be negative`);
    });

    it("falls back to packageQuantity when unitQuantity is absent", async () => {
      await expect(
        InventoryService.createItem({
          ...baseInput,
          packageQuantity: -11,
        } as never),
      ).rejects.toThrow("packageQuantity cannot be negative");
    });

    it("requires batches when expiry tracking is enabled", async () => {
      await expect(
        InventoryService.createItem({
          ...baseInput,
          expiryTrackingRequired: true,
        }),
      ).rejects.toThrow(
        "expiry date is required when expiry tracking is enabled",
      );
    });

    it.each([
      ["a missing expiry date", undefined],
      ["an unparsable expiry date", new Date("not-a-date")],
    ])("rejects %s when expiry tracking is enabled", async (_label, expiry) => {
      await expect(
        InventoryService.createItem({
          ...baseInput,
          expiryTrackingRequired: true,
          batches: [{ quantity: 1, expiryDate: expiry }],
        }),
      ).rejects.toThrow(
        "expiry date is required when expiry tracking is enabled",
      );
    });

    it("accepts expiry-tracked items whose batches all carry a valid expiry", async () => {
      mockOf(prisma.inventoryItem.create).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ quantity: 4 }),
      ]);

      const result = await InventoryService.createItem({
        ...baseInput,
        expiryTrackingRequired: true,
        batches: [{ quantity: 4, expiryDate: new Date("2030-01-01") }],
      });

      expect(prisma.inventoryBatch.createMany).toHaveBeenCalled();
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]._id).toBe("batch-1");
    });
  });

  describe("createItem persistence details", () => {
    it("reads packaging from numeric legacy attributes and honours an explicit status", async () => {
      mockOf(prisma.inventoryItem.create).mockResolvedValue(
        itemRow({ status: "HIDDEN" }),
      );

      await InventoryService.createItem({
        organisationId: "org-1",
        name: "Syrup",
        category: "Consumables",
        businessType: "HOSPITAL",
        status: "HIDDEN",
        attributes: { stockUnitType: "bottle", unitQuantity: 12 },
      });

      expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "HIDDEN",
            stockUnitType: "bottle",
            packageQuantity: 12,
            currency: "gbp",
          }),
        }),
      );
    });

    it.each([
      ["a non-positive number", -3],
      ["an unparsable string", "abc"],
      ["a blank string", "   "],
      ["a non-positive numeric string", "0"],
    ])(
      "ignores %s in the legacy unitQnt attribute",
      async (_label, unitQnt) => {
        mockOf(prisma.inventoryItem.create).mockResolvedValue(itemRow());

        await InventoryService.createItem({
          organisationId: "org-1",
          name: "Syrup",
          category: "Consumables",
          businessType: "HOSPITAL",
          attributes: { unitQnt } as never,
        });

        expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ packageQuantity: undefined }),
          }),
        );
      },
    );
  });

  // ── updateItem ──
  describe("updateItem", () => {
    it.each([
      ["itemId", "", "org-1", "Invalid itemId"],
      ["organisationId", "item-1", "  ", "Invalid organisationId"],
    ])("rejects a blank %s", async (_field, itemId, orgId, message) => {
      await expect(
        InventoryService.updateItem(itemId, { name: "x" }, orgId),
      ).rejects.toThrow(message);
      expect(prisma.inventoryItem.findFirst).not.toHaveBeenCalled();
    });

    it("returns 404 when the item is not visible to the organisation", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(null);

      await expect(
        InventoryService.updateItem("item-1", { name: "x" }, "org-1"),
      ).rejects.toMatchObject({
        message: "Inventory item not found",
        statusCode: 404,
      });
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it("rejects a sku already used by another item in the organisation", async () => {
      mockOf(prisma.inventoryItem.findFirst)
        .mockResolvedValueOnce(itemRow())
        .mockResolvedValueOnce(itemRow({ id: "item-2", sku: "SKU-1" }));

      await expect(
        InventoryService.updateItem("item-1", { sku: "SKU-1" }, "org-1"),
      ).rejects.toMatchObject({
        message: "sku must be unique within the organisation",
        statusCode: 409,
      });
      expect(prisma.inventoryItem.findFirst).toHaveBeenLastCalledWith({
        where: { organisationId: "org-1", sku: "SKU-1", NOT: { id: "item-1" } },
      });
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it("keeps a sku that is only used by the item itself", async () => {
      mockOf(prisma.inventoryItem.findFirst)
        .mockResolvedValueOnce(itemRow())
        .mockResolvedValueOnce(null);
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ sku: "SKU-1" }),
      );

      const result = await InventoryService.updateItem(
        "item-1",
        { sku: "SKU-1" },
        "org-1",
      );

      expect(result.item.sku).toBe("SKU-1");
    });

    it.each([
      ["minimumStock", { minimumStock: -1 }],
      ["emergencyStockLevel", { emergencyStockLevel: -1 }],
      ["reorderLevel", { reorderLevel: -1 }],
      ["unitCost", { unitCost: -1 }],
      ["sellingPrice", { sellingPrice: -1 }],
      ["taxRate", { taxRate: -1 }],
      ["packageQuantity", { packageQuantity: -1 }],
      ["allocated", { allocated: -1 }],
    ])("rejects a negative %s", async (field, patch) => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());

      await expect(
        InventoryService.updateItem("item-1", patch as never, "org-1"),
      ).rejects.toThrow(`${field} cannot be negative`);
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it("clears nullable fields, coerces booleans, and stores DbNull attachments", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());

      await InventoryService.updateItem(
        "item-1",
        {
          subCategory: null,
          description: null,
          sellingPrice: null,
          reorderLevel: null,
          vendorId: null,
          prescriptionRequired: true,
          controlledItem: null,
          expiryTrackingRequired: null,
          attachments: null,
          itemType: "NON_MEDICAL",
        } as never,
        "org-1",
      );

      const data = mockOf(prisma.inventoryItem.update).mock.calls[0][0].data;
      expect(data.subCategory).toBeNull();
      expect(data.description).toBeNull();
      expect(data.sellingPrice).toBeNull();
      expect(data.reorderLevel).toBeNull();
      expect(data.vendorId).toBeNull();
      expect(data.prescriptionRequired).toBe(true);
      expect(data.controlledItem).toBe(false);
      expect(data.expiryTrackingRequired).toBe(false);
      expect(data.itemType).toBe("NON_MEDICAL");
      expect(data.attachments).toBe(Prisma.DbNull);
    });

    it("stores a provided attachments array as JSON", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());

      await InventoryService.updateItem(
        "item-1",
        { attachments: [{ key: "a.pdf" }] },
        "org-1",
      );

      expect(
        mockOf(prisma.inventoryItem.update).mock.calls[0][0].data.attachments,
      ).toEqual([{ key: "a.pdf" }]);
    });

    it("re-derives the itemType when the category becomes medical", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ itemType: null }),
      );
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ itemType: "MEDICAL" }),
      );
      mockOf(isMedicalInventoryCategory).mockReturnValue(true);

      await InventoryService.updateItem(
        "item-1",
        {
          category: "Medicine",
          genericName: "Paracetamol",
          strength: "650 mg",
          dosageForm: "Tablet",
          routeOfAdministration: "Oral",
        },
        "org-1",
      );

      expect(
        mockOf(prisma.inventoryItem.update).mock.calls[0][0].data.itemType,
      ).toBe("MEDICAL");
    });

    it("leaves the itemType untouched when it already matches the category", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ category: null, itemType: "NON_MEDICAL" }),
      );
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());

      await InventoryService.updateItem("item-1", { name: "Renamed" }, "org-1");

      expect(
        mockOf(prisma.inventoryItem.update).mock.calls[0][0].data,
      ).not.toHaveProperty("itemType");
      expect(validateInventoryCategorySelection).not.toHaveBeenCalled();
    });

    it("prefers costPrice over unitCost and refreshes the currency", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());

      await InventoryService.updateItem(
        "item-1",
        { costPrice: 12, unitCost: 99, currency: "usd" },
        "org-1",
      );

      const data = mockOf(prisma.inventoryItem.update).mock.calls[0][0].data;
      expect(data.unitCost).toBe(12);
      expect(data.currency).toBe("gbp");
    });

    it("nulls the unit cost when both cost fields are cleared", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());

      await InventoryService.updateItem("item-1", { unitCost: null }, "org-1");

      expect(
        mockOf(prisma.inventoryItem.update).mock.calls[0][0].data.unitCost,
      ).toBeNull();
    });

    it("nulls packageQuantity when the legacy attribute cannot be parsed", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());

      await InventoryService.updateItem(
        "item-1",
        { attributes: { unitQnt: "not-a-number" } },
        "org-1",
      );

      const data = mockOf(prisma.inventoryItem.update).mock.calls[0][0].data;
      expect(data.packageQuantity).toBeNull();
      expect(data).not.toHaveProperty("stockUnitType");
    });

    it("returns the item's batches with legacy _id aliases", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryItem.update).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "batch-a" }),
        batchRow({ id: "batch-b" }),
      ]);

      const result = await InventoryService.updateItem(
        "item-1",
        { name: "Renamed" },
        "org-1",
      );

      expect(result.batches.map((batch) => batch._id)).toEqual([
        "batch-a",
        "batch-b",
      ]);
    });
  });

  describe("status transitions", () => {
    it("returns 404 when hiding an item the organisation cannot see", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(null);

      await expect(
        InventoryService.hideItem("item-1", "org-1"),
      ).rejects.toMatchObject({
        message: "Inventory item not found",
        statusCode: 404,
      });
      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it("rejects a blank itemId before touching the database", async () => {
      await expect(InventoryService.archiveItem("  ", "org-1")).rejects.toThrow(
        "Invalid itemId",
      );
      expect(prisma.inventoryItem.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── listItems ──
  describe("listItems filters", () => {
    it("rejects a blank organisationId", async () => {
      await expect(listOf({ organisationId: "   " })).rejects.toThrow(
        "Invalid organisationId",
      );
    });

    it.each([
      [{ businessType: "SPACESHIP" }, "Invalid businessType"],
      [{ category: "   " }, "Invalid category"],
      [{ subCategory: "" }, "Invalid subCategory"],
      [{ status: ["NOPE", "ALSO_NOPE"] }, "Invalid status"],
    ])("rejects %p", async (patch, message) => {
      await expect(
        listOf({ organisationId: "org-1", ...patch }),
      ).rejects.toThrow(message);
      expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    });

    it("maps a single valid status onto an equality filter", async () => {
      await listOf({ organisationId: "org-1", status: "ACTIVE" });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });

    it("drops unknown entries from a mixed status list", async () => {
      await listOf({
        organisationId: "org-1",
        status: ["ACTIVE", "NOPE", "HIDDEN"],
      });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["ACTIVE", "HIDDEN"] },
          }),
        }),
      );
    });

    it("defaults to excluding deleted items", async () => {
      await listOf({ organisationId: "org-1" });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: "DELETED" } }),
        }),
      );
    });

    it("ignores a whitespace-only search term", async () => {
      await listOf({ organisationId: "org-1", search: "   " });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ OR: expect.anything() }),
        }),
      );
    });

    it("escapes regex metacharacters in the search term", async () => {
      await listOf({ organisationId: "org-1", search: "a+b(c)" });

      const where = mockOf(prisma.inventoryItem.findMany).mock.calls[0][0]
        .where;
      expect(where.OR[0]).toEqual({
        name: { contains: String.raw`a\+b\(c\)`, mode: "insensitive" },
      });
    });

    it("restricts the query to the vendors matching the vendor filter", async () => {
      mockOf(prisma.inventoryVendor.findMany).mockResolvedValue([
        { id: "vendor-1" },
        { id: "vendor-2" },
      ]);

      await listOf({ organisationId: "org-1", vendor: "Acme" });

      expect(prisma.inventoryVendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId: { in: ["vendor-1", "vendor-2"] },
          }),
        }),
      );
    });

    it("returns an empty list when the vendor filter matches no vendor", async () => {
      mockOf(prisma.inventoryVendor.findMany).mockResolvedValue([]);

      await expect(
        listOf({ organisationId: "org-1", vendor: "Nobody" }),
      ).resolves.toEqual([]);
      expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    });

    it("skips the vendor lookup when the vendor filter is blank", async () => {
      await listOf({ organisationId: "org-1", vendor: "   " });

      expect(prisma.inventoryVendor.findMany).not.toHaveBeenCalled();
    });
  });

  describe("listItems stock health and projections", () => {
    const daysFromNow = (days: number) =>
      dayjs().add(days, "day").startOf("day").toDate();

    it("classifies expired, expiring, low, and healthy stock", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "expired", onHand: 10 }),
        itemRow({ id: "expiring", onHand: 10 }),
        itemRow({ id: "low", onHand: 1, reorderLevel: 5 }),
        itemRow({ id: "healthy", onHand: 10, reorderLevel: 1 }),
      ]);
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({
          id: "b1",
          itemId: "expired",
          expiryDate: daysFromNow(-5),
        }),
        batchRow({ id: "b2", itemId: "expiring", expiryDate: daysFromNow(3) }),
        batchRow({ id: "b3", itemId: "healthy", expiryDate: daysFromNow(400) }),
      ]);

      const rows = await listOf({ organisationId: "org-1" });

      expect(rows.map((row) => [row.id, row.stockHealth])).toEqual([
        ["expired", "EXPIRED"],
        ["expiring", "EXPIRING_SOON"],
        ["low", "LOW_STOCK"],
        ["healthy", "HEALTHY"],
      ]);
    });

    it("keeps only low-stock rows when lowStockOnly is set", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "low", onHand: 1, reorderLevel: 5 }),
        itemRow({ id: "healthy", onHand: 10, reorderLevel: 1 }),
      ]);

      const rows = await listOf({
        organisationId: "org-1",
        lowStockOnly: true,
      });

      expect(rows.map((row) => row.id)).toEqual(["low"]);
    });

    it("keeps only expired rows when expiredOnly is set", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "expired" }),
        itemRow({ id: "healthy" }),
      ]);
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b1", itemId: "expired", expiryDate: daysFromNow(-2) }),
      ]);

      const rows = await listOf({ organisationId: "org-1", expiredOnly: true });

      expect(rows.map((row) => row.id)).toEqual(["expired"]);
    });

    it("keeps expiring and expired rows when expiringWithinDays is set", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "soon" }),
        itemRow({ id: "expired" }),
        itemRow({ id: "healthy" }),
      ]);
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b1", itemId: "soon", expiryDate: daysFromNow(20) }),
        batchRow({ id: "b2", itemId: "expired", expiryDate: daysFromNow(-1) }),
      ]);

      const rows = await listOf({
        organisationId: "org-1",
        expiringWithinDays: 30,
      });

      expect(rows.map((row) => row.id)).toEqual(["soon", "expired"]);
    });

    it("ignores a non-positive expiringWithinDays and keeps the 7 day default", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "soon" }),
      ]);
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b1", itemId: "soon", expiryDate: daysFromNow(20) }),
      ]);

      const rows = await listOf({
        organisationId: "org-1",
        expiringWithinDays: -5,
      });

      expect(rows.map((row) => row.stockHealth)).toEqual(["HEALTHY"]);
    });

    it("picks the nearest expiry across batches and ignores dateless batches", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([itemRow()]);
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b1", expiryDate: null }),
        batchRow({ id: "b2", expiryDate: new Date("2031-01-01") }),
        batchRow({ id: "b3", expiryDate: new Date("2030-01-01") }),
        batchRow({ id: "b4", expiryDate: new Date("2032-01-01") }),
      ]);

      const rows = await listOf({ organisationId: "org-1" });

      expect(rows[0].nearestExpiryDate).toEqual(new Date("2030-01-01"));
      expect(rows[0].batches).toHaveLength(4);
    });

    it("projects legacy pricing and packaging aliases", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({
          id: "with-stock-unit",
          onHand: null,
          unitCost: 4,
          minimumStock: 2,
          emergencyStockLevel: 1,
          unitOfMeasure: "ml",
          stockUnitType: "bottle",
        }),
        itemRow({ id: "uom-fallback", unitOfMeasure: "ml" }),
        itemRow({ id: "no-units" }),
      ]);

      const rows = await listOf({ organisationId: "org-1" });

      expect(rows[0]).toMatchObject({
        currentStock: 0,
        costPrice: 4,
        minimumStock: 2,
        emergencyStockLevel: 1,
        stockUnitType: "bottle",
        grossProfit: 5,
        marginPercentage: 10,
      });
      expect(rows[1].stockUnitType).toBe("ml");
      expect(rows[2].stockUnitType).toBeNull();
      expect(rows[2].costPrice).toBeNull();
    });

    it("uses the reorder level as the minimum stock when none is configured", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ reorderLevel: 3 }),
      ]);

      await listOf({ organisationId: "org-1" });

      expect(calculateInventoryStockStatus).toHaveBeenCalledWith(
        expect.objectContaining({ minimumStock: 3, active: true }),
      );
    });

    it.each([
      ["a single value", "Low stock", ["low"]],
      ["a list of values", ["Low stock", "Expired"], ["low", "gone"]],
    ])("filters on stockStatus given %s", async (_label, filter, expected) => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "ok" }),
        itemRow({ id: "low" }),
        itemRow({ id: "gone" }),
      ]);
      mockOf(calculateInventoryStockStatus)
        .mockReturnValueOnce("In stock")
        .mockReturnValueOnce("Low stock")
        .mockReturnValueOnce("Expired");

      const rows = await listOf({
        organisationId: "org-1",
        stockStatus: filter,
      });

      expect(rows.map((row) => row.id)).toEqual(expected);
    });

    it("ignores a stockStatus list with no recognised entries", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([itemRow()]);

      const rows = await listOf({
        organisationId: "org-1",
        stockStatus: ["Nonsense"],
      });

      expect(rows).toHaveLength(1);
    });
  });

  describe("listItems sorting and pagination", () => {
    const threeItems = [
      itemRow({
        id: "i-b",
        name: "Bravo",
        onHand: 3,
        createdAt: new Date("2024-02-01"),
      }),
      itemRow({
        id: "i-a",
        name: "Alpha",
        onHand: 9,
        createdAt: new Date("2023-02-01"),
      }),
      itemRow({ id: "i-c", name: "Charlie", onHand: 1, createdAt: null }),
    ];

    it("sorts by name ascending by default", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue(threeItems);

      const rows = await listOf({ organisationId: "org-1", sortBy: "name" });

      expect(rows.map((row) => row.id)).toEqual(["i-a", "i-b", "i-c"]);
    });

    it("sorts by stock descending", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue(threeItems);

      const rows = await listOf({
        organisationId: "org-1",
        sortBy: "stock",
        sortOrder: "desc",
      });

      expect(rows.map((row) => row.id)).toEqual(["i-a", "i-b", "i-c"]);
    });

    it("sorts by createdAt ascending and pushes missing dates last", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue(threeItems);

      const rows = await listOf({
        organisationId: "org-1",
        sortBy: "createdAt",
      });

      expect(rows.map((row) => row.id)).toEqual(["i-a", "i-b", "i-c"]);
    });

    it("sorts string createdAt values with a lexical comparison", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "later", createdAt: "2024-05-01" }),
        itemRow({ id: "earlier", createdAt: "2024-01-01" }),
      ]);

      const rows = await listOf({
        organisationId: "org-1",
        sortBy: "createdAt",
      });

      expect(rows.map((row) => row.id)).toEqual(["earlier", "later"]);
    });

    it.each([
      [
        "the dated row comes second",
        [itemRow({ id: "none" }), itemRow({ id: "dated" })],
      ],
      [
        "the dated row comes first",
        [itemRow({ id: "dated" }), itemRow({ id: "none" })],
      ],
    ])(
      "sorts expiry dates ahead of missing ones when %s",
      async (_label, items) => {
        mockOf(prisma.inventoryItem.findMany).mockResolvedValue(items);
        mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
          batchRow({ itemId: "dated", expiryDate: new Date("2030-01-01") }),
        ]);

        const rows = await listOf({
          organisationId: "org-1",
          sortBy: "expiryDate",
        });

        expect(rows.map((row) => row.id)).toEqual(["dated", "none"]);
      },
    );

    it("keeps the original order when both expiry dates are missing", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "first" }),
        itemRow({ id: "second" }),
      ]);

      const rows = await listOf({
        organisationId: "org-1",
        sortBy: "expiryDate",
      });

      expect(rows.map((row) => row.id)).toEqual(["first", "second"]);
    });

    it("sorts two dated rows chronologically", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "late" }),
        itemRow({ id: "early" }),
      ]);
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({
          id: "b1",
          itemId: "late",
          expiryDate: new Date("2031-01-01"),
        }),
        batchRow({
          id: "b2",
          itemId: "early",
          expiryDate: new Date("2030-01-01"),
        }),
      ]);

      const rows = await listOf({
        organisationId: "org-1",
        sortBy: "expiryDate",
      });

      expect(rows.map((row) => row.id)).toEqual(["early", "late"]);
    });

    it("returns a paged envelope when page or pageSize is supplied", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue(threeItems);

      const result = (await InventoryService.listItems({
        organisationId: "org-1",
        page: 2,
        pageSize: 2,
      } as never)) as {
        items: Array<{ id: string }>;
        page: number;
        pageSize: number;
        total: number;
      };

      expect(result).toMatchObject({ page: 2, pageSize: 2, total: 3 });
      expect(result.items.map((row) => row.id)).toEqual(["i-c"]);
    });

    it("falls back to page 1 and a 25 row page for unusable pagination values", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue(threeItems);

      const result = (await InventoryService.listItems({
        organisationId: "org-1",
        page: 0,
        pageSize: "40",
      } as never)) as { page: number; pageSize: number; total: number };

      expect(result).toMatchObject({ page: 1, pageSize: 25, total: 3 });
    });

    it("truncates a fractional page number", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue(threeItems);

      const result = (await InventoryService.listItems({
        organisationId: "org-1",
        page: 2.9,
        pageSize: 1,
      } as never)) as { page: number; items: Array<{ id: string }> };

      expect(result.page).toBe(2);
      expect(result.items.map((row) => row.id)).toEqual(["i-a"]);
    });
  });

  describe("getCategories", () => {
    it("returns the database catalog and matches subcategories by id or code", async () => {
      mockOf(prisma.inventoryCategory.findMany).mockResolvedValue([
        {
          id: "c1",
          code: "MED",
          name: "Medicine",
          isMedical: true,
          sortOrder: 1,
        },
        {
          id: "c2",
          code: "CON",
          name: "Consumables",
          isMedical: false,
          sortOrder: 2,
        },
      ]);
      mockOf(prisma.inventorySubcategory.findMany).mockResolvedValue([
        {
          id: "s1",
          categoryId: "c1",
          code: "TAB",
          name: "Tablets",
          sortOrder: 1,
          isActive: true,
        },
        {
          id: "s2",
          categoryId: "CON",
          code: "BAN",
          name: "Bandages",
          sortOrder: 1,
          isActive: true,
        },
        {
          id: "s3",
          categoryId: "orphan",
          code: "ORP",
          name: "Orphan",
          sortOrder: 9,
          isActive: false,
        },
      ]);

      const categories = await InventoryService.getCategories();

      expect(categories).toHaveLength(2);
      expect(categories[0].subcategories.map((sub) => sub.code)).toEqual([
        "TAB",
      ]);
      expect(categories[1].subcategories.map((sub) => sub.code)).toEqual([
        "BAN",
      ]);
      expect(getInventoryCategories).not.toHaveBeenCalled();
    });

    it("falls back to the seed catalog when no categories are stored", async () => {
      const categories = await InventoryService.getCategories();

      expect(getInventoryCategories).toHaveBeenCalled();
      expect(categories).toEqual([
        {
          code: "SEED",
          name: "Seed",
          isMedical: false,
          sortOrder: 1,
          subcategories: [],
        },
      ]);
    });
  });

  describe("getItemWithBatches", () => {
    it("returns 404 when the item does not exist", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(null);

      await expect(
        InventoryService.getItemWithBatches("item-1", "org-1"),
      ).rejects.toMatchObject({
        message: "Inventory item not found",
        statusCode: 404,
      });
    });

    it("returns 404 when the item belongs to a different organisation", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ organisationId: "org-2" }),
      );

      await expect(
        InventoryService.getItemWithBatches("item-1", "org-1"),
      ).rejects.toMatchObject({
        message: "Inventory item not found",
        statusCode: 404,
      });
      expect(prisma.inventoryVendor.findFirst).not.toHaveBeenCalled();
    });

    it("returns a null vendor for items with no supplier", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: null }),
      );

      const result = await InventoryService.getItemWithBatches(
        "item-1",
        "org-1",
      );

      expect(prisma.inventoryVendor.findFirst).not.toHaveBeenCalled();
      expect(result.item).toMatchObject({
        vendor: null,
        currentStock: 0,
        costPrice: null,
      });
    });

    it("rejects a blank itemId", async () => {
      await expect(
        InventoryService.getItemWithBatches("", "org-1"),
      ).rejects.toThrow("Invalid itemId");
    });
  });

  describe("batch operations", () => {
    it("rejects blank identifiers before hitting the database", async () => {
      await expect(
        InventoryService.addBatch("", { quantity: 1 }, "org-1"),
      ).rejects.toThrow("Invalid id");
      await expect(
        InventoryService.updateBatch("", { quantity: 1 }, "org-1"),
      ).rejects.toThrow("Invalid batchId");
      await expect(InventoryService.deleteBatch("", "org-1")).rejects.toThrow(
        "Invalid batchId",
      );
      expect(prisma.inventoryBatch.findFirst).not.toHaveBeenCalled();
    });

    it("recomputes onHand from batches, tolerating null quantities and expiries", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(itemRow());
      mockOf(prisma.inventoryBatch.create).mockResolvedValue(
        batchRow({ id: "batch-new" }),
      );
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b1", quantity: null, allocated: null }),
        batchRow({ id: "b2", quantity: 4, expiryDate: new Date("2031-01-01") }),
        batchRow({ id: "b3", quantity: 6, expiryDate: new Date("2030-01-01") }),
        batchRow({ id: "b4", quantity: 1, expiryDate: new Date("2032-01-01") }),
      ]);

      const created = await InventoryService.addBatch(
        "item-1",
        { quantity: 3 },
        "org-1",
      );

      expect(created._id).toBe("batch-new");
      expect(prisma.inventoryBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiryWarningBefore: undefined,
            barcode: undefined,
            allocated: 0,
          }),
        }),
      );
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { onHand: 11 },
      });
    });

    it("clears every optional batch field when explicitly nulled", async () => {
      mockOf(prisma.inventoryBatch.findFirst).mockResolvedValue(batchRow());
      mockOf(prisma.inventoryBatch.update).mockResolvedValue(batchRow());

      await InventoryService.updateBatch(
        "batch-1",
        {
          batchNumber: null,
          lotNumber: null,
          regulatoryTrackingId: null,
          expiryWarningBefore: null,
          barcode: null,
          manufactureDate: null,
          expiryDate: null,
          minShelfLifeAlertDate: null,
          allocated: 2,
        } as never,
        "org-1",
      );

      expect(
        mockOf(prisma.inventoryBatch.update).mock.calls[0][0].data,
      ).toEqual({
        batchNumber: null,
        lotNumber: null,
        regulatoryTrackingId: null,
        expiryWarningBefore: null,
        barcode: null,
        manufactureDate: null,
        expiryDate: null,
        minShelfLifeAlertDate: null,
        allocated: 2,
      });
    });

    it("recomputes onHand and allocated after a delete", async () => {
      mockOf(prisma.inventoryBatch.findFirst).mockResolvedValue(
        batchRow({ id: "batch-1", itemId: "item-9" }),
      );
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b2", itemId: "item-9", quantity: 2, allocated: 1 }),
      ]);

      await InventoryService.deleteBatch("batch-1", "org-1");

      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: "item-9" },
        data: { onHand: 2, allocated: 1 },
      });
    });
  });

  describe("consumeStock", () => {
    it("rejects a non-positive quantity", async () => {
      await expect(
        InventoryService.consumeStock(
          { itemId: "item-1", quantity: 0, reason: "OTHER" },
          "org-1",
        ),
      ).rejects.toMatchObject({
        message: "quantity must be > 0",
        statusCode: 400,
      });
      expect(prisma.inventoryItem.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a request larger than the recorded stock", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: null }),
      );

      await expect(
        InventoryService.consumeStock(
          { itemId: "item-1", quantity: 1, reason: "OTHER" },
          "org-1",
        ),
      ).rejects.toMatchObject({
        message: "Insufficient stock",
        statusCode: 400,
      });
      expect(prisma.inventoryBatch.findMany).not.toHaveBeenCalled();
    });

    it("fails loudly when the batches cannot cover the item level stock", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: 10 }),
      );
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "b1", quantity: 4 }),
      ]);

      await expect(
        InventoryService.consumeStock(
          { itemId: "item-1", quantity: 10, reason: "OTHER" },
          "org-1",
        ),
      ).rejects.toMatchObject({
        message: "Failed to consume full requested quantity",
        statusCode: 500,
      });
      expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
    });

    it("skips empty batches, drains the rest in FIFO order, and stops early", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: 16 }),
      );
      mockOf(prisma.inventoryBatch.findMany)
        .mockResolvedValueOnce([
          batchRow({ id: "unknown", quantity: null }),
          batchRow({ id: "empty", quantity: 0 }),
          batchRow({ id: "first", quantity: 4 }),
          batchRow({ id: "second", quantity: 5 }),
          batchRow({ id: "untouched", quantity: 7 }),
        ])
        .mockResolvedValueOnce([
          batchRow({ id: "second", quantity: 3 }),
          batchRow({ id: "untouched", quantity: 7 }),
        ]);
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ onHand: 10 }),
      );

      const updated = await InventoryService.consumeStock(
        { itemId: "item-1", quantity: 6, reason: "APPOINTMENT_USAGE" },
        "org-1",
      );

      expect(mockOf(prisma.inventoryBatch.update).mock.calls).toEqual([
        [{ where: { id: "first" }, data: { quantity: 0 } }],
        [{ where: { id: "second" }, data: { quantity: 3 } }],
      ]);
      expect(updated.onHand).toBe(10);
      expect(updated._id).toBe("item-1");
    });
  });

  describe("bulkConsumeStock", () => {
    it.each([
      ["a non-array payload", { items: "nope" }],
      ["an empty array", { items: [] }],
    ])("rejects %s", async (_label, payload) => {
      await expect(
        InventoryService.bulkConsumeStock(payload as never, "org-1"),
      ).rejects.toMatchObject({
        message: "items must be a non-empty array",
        statusCode: 400,
      });
    });

    it("rejects a blank organisationId", async () => {
      await expect(
        InventoryService.bulkConsumeStock(
          { items: [{ itemId: "item-1", quantity: 1, reason: "OTHER" }] },
          "  ",
        ),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("consumes each line in order and returns one row per line", async () => {
      mockOf(prisma.inventoryItem.findFirst)
        .mockResolvedValueOnce(itemRow({ id: "item-1", onHand: 5 }))
        .mockResolvedValueOnce(itemRow({ id: "item-2", onHand: 5 }));
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ quantity: 5 }),
      ]);
      mockOf(prisma.inventoryItem.update)
        .mockResolvedValueOnce(itemRow({ id: "item-1", onHand: 4 }))
        .mockResolvedValueOnce(itemRow({ id: "item-2", onHand: 3 }));

      const results = await InventoryService.bulkConsumeStock(
        {
          items: [
            { itemId: "item-1", quantity: 1, reason: "OTHER" },
            { itemId: "item-2", quantity: 2, reason: "OTHER" },
          ],
        },
        "org-1",
      );

      expect(results.map((row) => [row._id, row.onHand])).toEqual([
        ["item-1", 4],
        ["item-2", 3],
      ]);
    });

    it("propagates the first failing line", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(null);

      await expect(
        InventoryService.bulkConsumeStock(
          { items: [{ itemId: "missing", quantity: 1, reason: "OTHER" }] },
          "org-1",
        ),
      ).rejects.toThrow("Inventory item not found");
    });
  });

  describe("getInventoryTurnoverByItem", () => {
    it.each([
      ["to", { to: new Date("nope") }, "Invalid to"],
      ["from", { from: new Date("nope") }, "Invalid from"],
    ])("rejects an invalid %s date", (_label, patch, message) => {
      expect(() =>
        InventoryService.getInventoryTurnoverByItem({
          organisationId: "org-1",
          ...patch,
        }),
      ).toThrow(message);
      expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    });

    it("rejects a blank organisationId", () => {
      expect(() =>
        InventoryService.getInventoryTurnoverByItem({ organisationId: "  " }),
      ).toThrow("Invalid organisationId");
    });

    it("returns an empty report when the organisation has no items", async () => {
      await expect(
        InventoryService.getInventoryTurnoverByItem({
          organisationId: "org-1",
        }),
      ).resolves.toEqual([]);
      expect(prisma.inventoryStockMovement.findMany).not.toHaveBeenCalled();
    });

    it("defaults the window to the last twelve months", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([itemRow()]);

      await InventoryService.getInventoryTurnoverByItem({
        organisationId: "org-1",
      });

      const where = mockOf(prisma.inventoryStockMovement.findMany).mock
        .calls[0][0].where;
      const spanDays =
        (where.createdAt.lte.getTime() - where.createdAt.gte.getTime()) /
        86_400_000;
      expect(spanDays).toBeGreaterThan(360);
      expect(spanDays).toBeLessThan(370);
    });

    it("grades every turnover band and ignores movements without an item", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "excellent", onHand: 10, subCategory: "Gauze" }),
        itemRow({ id: "healthy", onHand: 10 }),
        itemRow({ id: "moderate", onHand: 10 }),
        itemRow({ id: "slow", onHand: 10 }),
        itemRow({ id: "idle", onHand: null }),
      ]);
      mockOf(prisma.inventoryStockMovement.findMany).mockResolvedValue([
        { itemId: "excellent", change: 300 },
        { itemId: "healthy", change: 70 },
        { itemId: "moderate", change: 40 },
        { itemId: "slow", change: 10 },
        { itemId: null, change: 999 },
        { itemId: "excellent", change: null },
      ]);
      mockOf(prisma.inventoryBatch.aggregate)
        .mockResolvedValueOnce({ _sum: { quantity: 10 } })
        .mockResolvedValueOnce({ _sum: { quantity: 10 } })
        .mockResolvedValueOnce({ _sum: { quantity: 10 } })
        .mockResolvedValueOnce({ _sum: { quantity: 10 } })
        .mockResolvedValueOnce({ _sum: { quantity: null } });

      const report = await InventoryService.getInventoryTurnoverByItem({
        organisationId: "org-1",
        from: new Date("2024-01-01"),
        to: new Date("2024-12-31"),
      });

      expect(report.map((row) => [row.itemId, row.status])).toEqual([
        ["excellent", "EXCELLENT"],
        ["healthy", "HEALTHY"],
        ["moderate", "MODERATE"],
        ["slow", "LOW"],
        ["idle", "LOW"],
      ]);
      expect(report[0]).toMatchObject({
        subCategory: "Gauze",
        avgInventory: 10,
        turnsPerYear: 30,
        daysOnShelf: 12.2,
      });
      expect(report[4]).toMatchObject({
        subCategory: undefined,
        beginningInventory: 0,
        endingInventory: 0,
        turnsPerYear: 0,
        daysOnShelf: 0,
      });
    });
  });

  describe("InventoryAdjustmentService.adjustStock", () => {
    it("rejects a blank itemId and a blank organisationId", async () => {
      await expect(
        InventoryAdjustmentService.adjustStock({
          itemId: "",
          newOnHand: 1,
          reason: "MANUAL_ADJUSTMENT",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Invalid id");

      await expect(
        InventoryAdjustmentService.adjustStock({
          itemId: "item-1",
          newOnHand: 1,
          reason: "MANUAL_ADJUSTMENT",
          organisationId: "   ",
        }),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("only recomputes when the target equals the current stock", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: 5 }),
      );

      await InventoryAdjustmentService.adjustStock({
        itemId: "item-1",
        newOnHand: 5,
        reason: "MANUAL_ADJUSTMENT",
        organisationId: "org-1",
      });

      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockMovement.create).not.toHaveBeenCalled();
    });

    it("draws down batches in expiry order and logs one movement per batch", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: null }),
      );
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "unknown", quantity: null }),
        batchRow({ id: "first", quantity: 4 }),
        batchRow({ id: "second", quantity: 5 }),
        batchRow({ id: "untouched", quantity: 7 }),
      ]);
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ onHand: 3 }),
      );

      const result = await InventoryAdjustmentService.adjustStock({
        itemId: "item-1",
        newOnHand: -6,
        reason: "SHRINKAGE",
        userId: "user-1",
        organisationId: "org-1",
      });

      expect(mockOf(prisma.inventoryBatch.update).mock.calls).toEqual([
        [{ where: { id: "unknown" }, data: { quantity: 0 } }],
        [{ where: { id: "first" }, data: { quantity: 0 } }],
        [{ where: { id: "second" }, data: { quantity: 3 } }],
      ]);
      expect(prisma.inventoryStockMovement.create).toHaveBeenCalledTimes(3);
      expect(
        mockOf(prisma.inventoryStockMovement.create).mock.calls[2][0].data,
      ).toMatchObject({
        itemId: "item-1",
        batchId: "second",
        change: -2,
        reason: "SHRINKAGE",
        userId: "user-1",
      });
      expect(result._id).toBe("item-1");
    });

    it("refuses to draw down more stock than the batches hold", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: 10 }),
      );
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ id: "only", quantity: 3 }),
      ]);

      await expect(
        InventoryAdjustmentService.adjustStock({
          itemId: "item-1",
          newOnHand: 0,
          reason: "MANUAL_ADJUSTMENT",
          organisationId: "org-1",
        }),
      ).rejects.toMatchObject({
        message: "Insufficient stock for adjustment",
        statusCode: 400,
      });
    });

    it("creates a top-up batch and a positive movement when stock increases", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: 2 }),
      );
      mockOf(prisma.inventoryBatch.findMany).mockResolvedValue([
        batchRow({ quantity: 7 }),
      ]);
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ onHand: 7 }),
      );

      await InventoryAdjustmentService.adjustStock({
        itemId: "item-1",
        newOnHand: 7,
        reason: "RESTOCK",
        organisationId: "org-1",
      });

      expect(prisma.inventoryBatch.create).toHaveBeenCalledWith({
        data: {
          itemId: "item-1",
          organisationId: "org-1",
          quantity: 5,
          allocated: 0,
        },
      });
      expect(
        mockOf(prisma.inventoryStockMovement.create).mock.calls[0][0].data,
      ).toMatchObject({ change: 5, reason: "RESTOCK", batchId: undefined });
    });
  });

  describe("InventoryAllocationService", () => {
    it("rejects blank identifiers", async () => {
      await expect(
        InventoryAllocationService.allocateStock({
          itemId: "",
          quantity: 1,
          referenceId: "ref-1",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Invalid id");

      await expect(
        InventoryAllocationService.releaseAllocatedStock({
          itemId: "item-1",
          quantity: 1,
          referenceId: "ref-1",
          organisationId: "  ",
        }),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("treats missing counters as zero when checking availability", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: null, allocated: null }),
      );

      await expect(
        InventoryAllocationService.allocateStock({
          itemId: "item-1",
          quantity: 1,
          referenceId: "ref-1",
          organisationId: "org-1",
        }),
      ).rejects.toThrow("Not enough unallocated stock");
    });

    it("treats a missing reservation as zero when allocating", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ onHand: 5, allocated: null }),
      );
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ allocated: 2 }),
      );

      const allocated = await InventoryAllocationService.allocateStock({
        itemId: "item-1",
        quantity: 2,
        referenceId: "ref-1",
        organisationId: "org-1",
      });

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { allocated: 2 },
      });
      expect(allocated.allocated).toBe(2);
      expect(
        mockOf(prisma.inventoryStockMovement.create).mock.calls[0][0].data,
      ).toMatchObject({
        reason: "ALLOCATED",
        referenceId: "ref-1",
        change: 0,
        batchId: undefined,
        userId: undefined,
      });
    });

    it("never releases below zero", async () => {
      mockOf(prisma.inventoryItem.findFirst).mockResolvedValue(
        itemRow({ allocated: null }),
      );
      mockOf(prisma.inventoryItem.update).mockResolvedValue(
        itemRow({ allocated: 0 }),
      );

      const released = await InventoryAllocationService.releaseAllocatedStock({
        itemId: "item-1",
        quantity: 5,
        referenceId: "ref-1",
        organisationId: "org-1",
      });

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { allocated: 0 },
      });
      expect(released.allocated).toBe(0);
      expect(
        mockOf(prisma.inventoryStockMovement.create).mock.calls[0][0].data,
      ).toMatchObject({ reason: "UNALLOCATED", referenceId: "ref-1" });
    });
  });

  describe("InventoryVendorService", () => {
    it("rejects a blank vendorId and a blank organisationId", async () => {
      await expect(
        InventoryVendorService.updateVendor("", {}, "org-1"),
      ).rejects.toThrow("Invalid id");
      await expect(
        InventoryVendorService.deleteVendor("", "org-1"),
      ).rejects.toThrow("Invalid id");
      expect(() => InventoryVendorService.getVendor("vendor-1", "  ")).toThrow(
        "Invalid organisationId",
      );
      expect(() => InventoryVendorService.getVendor("", "org-1")).toThrow(
        "Invalid id",
      );
      expect(() => InventoryVendorService.listVendors("   ")).toThrow(
        "Invalid organisationId",
      );
      expect(prisma.inventoryVendor.findFirst).not.toHaveBeenCalled();
      expect(prisma.inventoryVendor.deleteMany).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only organisationId when creating a vendor", async () => {
      await expect(
        InventoryVendorService.createVendor({
          organisationId: "   ",
          name: "Supplier",
        }),
      ).rejects.toThrow("Invalid organisationId");
      expect(prisma.inventoryVendor.create).not.toHaveBeenCalled();
    });

    it("updates only the fields the caller supplied", async () => {
      mockOf(prisma.inventoryVendor.findFirst).mockResolvedValue({
        id: "vendor-1",
        organisationId: "org-1",
      });
      mockOf(prisma.inventoryVendor.update).mockResolvedValue({
        id: "vendor-1",
        organisationId: "org-1",
        name: "Renamed",
      });

      const updated = await InventoryVendorService.updateVendor(
        "vendor-1",
        { name: "Renamed" },
        "org-1",
      );

      expect(prisma.inventoryVendor.update).toHaveBeenCalledWith({
        where: { id: "vendor-1" },
        data: {
          name: "Renamed",
          brand: undefined,
          vendorType: undefined,
          licenseNumber: undefined,
          paymentTerms: undefined,
          deliveryFrequency: undefined,
          leadTimeDays: undefined,
          contactInfo: undefined,
        },
      });
      expect(updated.name).toBe("Renamed");
    });

    it("leaves the vendor name untouched when the patch omits it", async () => {
      mockOf(prisma.inventoryVendor.findFirst).mockResolvedValue({
        id: "vendor-1",
        organisationId: "org-1",
      });
      mockOf(prisma.inventoryVendor.update).mockResolvedValue({
        id: "vendor-1",
      });

      await InventoryVendorService.updateVendor(
        "vendor-1",
        {
          brand: "Acme",
          vendorType: "DISTRIBUTOR",
          licenseNumber: "LIC-1",
          paymentTerms: "NET30",
          deliveryFrequency: "WEEKLY",
          leadTimeDays: 3,
          contactInfo: { email: "sales@example.com" },
        } as never,
        "org-1",
      );

      expect(
        mockOf(prisma.inventoryVendor.update).mock.calls[0][0].data,
      ).toEqual({
        name: undefined,
        brand: "Acme",
        vendorType: "DISTRIBUTOR",
        licenseNumber: "LIC-1",
        paymentTerms: "NET30",
        deliveryFrequency: "WEEKLY",
        leadTimeDays: 3,
        contactInfo: { email: "sales@example.com" },
      });
    });

    it("lists vendors for the authorized organisation only", async () => {
      mockOf(prisma.inventoryVendor.findMany).mockResolvedValue([
        { id: "vendor-1", name: "Acme" },
      ]);

      await expect(
        InventoryVendorService.listVendors("org-1"),
      ).resolves.toEqual([{ id: "vendor-1", name: "Acme" }]);
      expect(prisma.inventoryVendor.findMany).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("InventoryMetaFieldService", () => {
    it("defaults the value list when none is supplied", async () => {
      mockOf(prisma.inventoryMetaField.create).mockResolvedValue({
        id: "field-1",
      });

      await InventoryMetaFieldService.createField({
        businessType: "HOSPITAL",
        fieldKey: "color",
        label: "Color",
      } as never);

      expect(prisma.inventoryMetaField.create).toHaveBeenCalledWith({
        data: {
          businessType: "HOSPITAL",
          fieldKey: "color",
          label: "Color",
          values: [],
        },
      });
    });

    it("updates a field and leaves omitted properties alone", async () => {
      mockOf(prisma.inventoryMetaField.update).mockResolvedValue({
        id: "field-1",
        label: "Colour",
      });

      const updated = await InventoryMetaFieldService.updateField("field-1", {
        label: "Colour",
      });

      expect(prisma.inventoryMetaField.update).toHaveBeenCalledWith({
        where: { id: "field-1" },
        data: { label: "Colour", values: undefined },
      });
      expect(updated.label).toBe("Colour");
    });

    it("writes a replacement value list when one is supplied", async () => {
      mockOf(prisma.inventoryMetaField.update).mockResolvedValue({
        id: "field-1",
      });

      await InventoryMetaFieldService.updateField("field-1", {
        values: ["red", "blue"],
      });

      expect(
        mockOf(prisma.inventoryMetaField.update).mock.calls[0][0].data.values,
      ).toEqual(["red", "blue"]);
    });

    it("deletes a field by id", async () => {
      await InventoryMetaFieldService.deleteField("field-1");

      expect(prisma.inventoryMetaField.deleteMany).toHaveBeenCalledWith({
        where: { id: "field-1" },
      });
    });

    it.each([
      ["updateField", () => InventoryMetaFieldService.updateField("", {})],
      ["deleteField", () => InventoryMetaFieldService.deleteField("  ")],
    ])("rejects a blank fieldId in %s", async (_label, call) => {
      await expect(call()).rejects.toThrow("Invalid id");
      expect(prisma.inventoryMetaField.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMetaField.deleteMany).not.toHaveBeenCalled();
    });

    it("lists fields for a valid business type", async () => {
      mockOf(prisma.inventoryMetaField.findMany).mockResolvedValue([
        { id: "field-1" },
      ]);

      await expect(
        InventoryMetaFieldService.listFields("GROOMING"),
      ).resolves.toEqual([{ id: "field-1" }]);
      expect(prisma.inventoryMetaField.findMany).toHaveBeenCalledWith({
        where: { businessType: "GROOMING" },
        orderBy: { label: "asc" },
      });
    });

    it("rejects an unknown business type when listing fields", async () => {
      expect(() => InventoryMetaFieldService.listFields("SPACESHIP")).toThrow(
        "Invalid businessType",
      );
      expect(prisma.inventoryMetaField.findMany).not.toHaveBeenCalled();
    });
  });

  describe("InventoryAlertService", () => {
    it("ignores items without a reorder level and treats missing stock as zero", async () => {
      mockOf(prisma.inventoryItem.findMany).mockResolvedValue([
        itemRow({ id: "no-threshold", reorderLevel: null, onHand: 0 }),
        itemRow({ id: "zero-threshold", reorderLevel: 0, onHand: 0 }),
        itemRow({ id: "below", reorderLevel: 5, onHand: null }),
        itemRow({ id: "above", reorderLevel: 1, onHand: 9 }),
      ]);

      const low = await InventoryAlertService.getLowStockItems("org-1");

      expect(low.map((item) => item.id)).toEqual(["below"]);
    });

    it("rejects a blank organisationId", async () => {
      await expect(
        InventoryAlertService.getLowStockItems("  "),
      ).rejects.toThrow("Invalid organisationId");
      expect(() => InventoryAlertService.getExpiringItems("  ")).toThrow(
        "Invalid organisationId",
      );
    });

    it("falls back to a 7 day horizon for a non-positive day count", async () => {
      InventoryAlertService.getExpiringItems("org-1", 0);

      const threshold = mockOf(prisma.inventoryBatch.findMany).mock.calls[0][0]
        .where.expiryDate.lte as Date;
      const days = (threshold.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.5);
      expect(days).toBeLessThan(7.5);
    });

    it("honours an explicit day count", async () => {
      InventoryAlertService.getExpiringItems("org-1", 30);

      const threshold = mockOf(prisma.inventoryBatch.findMany).mock.calls[0][0]
        .where.expiryDate.lte as Date;
      const days = (threshold.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.5);
      expect(days).toBeLessThan(30.5);
    });
  });
});
