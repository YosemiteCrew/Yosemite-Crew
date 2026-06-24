import dayjs from "dayjs";
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
import { isReadFromPostgres } from "src/config/read-switch";

jest.mock("src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

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
    (isReadFromPostgres as jest.Mock).mockReturnValue(true);
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
      allocated: 0,
    });
    (prisma.inventoryBatch.createMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
      id: "item-1",
      organisationId: "org-1",
      onHand: 3,
      allocated: 0,
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
      stockUnitType: "bottle",
      batches: [{ quantity: 3 }],
    });

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockUnitType: "bottle",
          unitOfMeasure: "bottle",
        }),
      }),
    );
    expect(result.item.id).toBe("item-1");
    expect(result.batches).toHaveLength(1);
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
    });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValueOnce({
      id: "item-1",
      organisationId: "org-1",
      name: "Updated",
      category: "Consumables",
      businessType: "HOSPITAL",
    });

    const result = await InventoryService.updateItem(
      "item-1",
      { name: "Updated", stockUnitType: "bottle" },
      "org-1",
    );

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockUnitType: "bottle",
          unitOfMeasure: "bottle",
        }),
      }),
    );
    expect(result.item.name).toBe("Updated");
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
    (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
      {
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org-1",
        quantity: 5,
        allocated: 0,
      },
    ]);

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
      allocated: 0,
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

    const created = await InventoryService.addBatch("item-1", { quantity: 3 });
    expect(created.id).toBe("batch-1");

    const updated = await InventoryService.updateBatch("batch-1", {
      quantity: 4,
    });
    expect(updated.quantity).toBe(4);

    await InventoryService.deleteBatch("batch-1");
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

    const consumed = await InventoryService.consumeStock({
      itemId: "item-1",
      quantity: 2,
      reason: "MANUAL_ADJUSTMENT",
    });
    expect(consumed.onHand).toBe(3);

    const turnover = await InventoryService.getInventoryTurnoverByItem({
      organisationId: "org-1",
      from: dayjs().subtract(1, "month").toDate(),
      to: new Date(),
    });
    expect(turnover).toHaveLength(1);
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
    });
    expect(adjusted.onHand).toBe(5);

    const allocated = await InventoryAllocationService.allocateStock({
      itemId: "item-1",
      quantity: 1,
      referenceId: "ref-1",
    });
    expect(allocated.allocated).toBeGreaterThanOrEqual(1);

    const released = await InventoryAllocationService.releaseAllocatedStock({
      itemId: "item-1",
      quantity: 1,
      referenceId: "ref-1",
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
});
