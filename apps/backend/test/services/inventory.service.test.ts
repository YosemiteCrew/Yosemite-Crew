import { Types } from "mongoose";
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
import {
  InventoryItemModel,
  InventoryBatchModel,
  InventoryVendorModel,
  InventoryMetaFieldModel,
  StockMovementModel,
} from "../../src/models/inventory";
import { OrgBilling } from "../../src/models/organization.billing";
import { prisma } from "src/config/prisma";

jest.mock("../../src/models/inventory", () => ({
  InventoryItemModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  InventoryBatchModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
    aggregate: jest.fn(),
  },
  InventoryVendorModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
  InventoryMetaFieldModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
  StockMovementModel: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/organization.billing", () => ({
  OrgBilling: {
    findOne: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationBilling: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    inventoryItem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
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
    inventoryStockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryVendor: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    inventoryMetaField: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const validId = new Types.ObjectId().toString();

const createChainable = (resolvedValue: any) => ({
  sort: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolvedValue),
  lean: jest.fn().mockResolvedValue(resolvedValue),
});

const createMockDoc = (data: any) => ({
  _id: validId,
  ...data,
  save: jest.fn().mockResolvedValue(true),
  deleteOne: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue({ _id: validId, ...data }),
});

describe("Inventory Service Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";

    (InventoryItemModel.findByIdAndUpdate as jest.Mock).mockReturnValue(
      createChainable(true),
    );
  });

  describe("InventoryServiceError", () => {
    it("should instantiate correctly with defaults", () => {
      const err = new InventoryServiceError("Test Error");
      expect(err.message).toBe("Test Error");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("InventoryServiceError");
    });
  });

  describe("InventoryService.createItem", () => {
    it("throws if organisationId is missing", async () => {
      await expect(InventoryService.createItem({} as any)).rejects.toThrow(
        "organisationId is required",
      );
    });
    it("throws if name is missing", async () => {
      await expect(
        InventoryService.createItem({ organisationId: "org1" } as any),
      ).rejects.toThrow("name is required");
    });
    it("throws if category is missing", async () => {
      await expect(
        InventoryService.createItem({
          organisationId: "org1",
          name: "n",
        } as any),
      ).rejects.toThrow("category is required");
    });
    it("throws if businessType is invalid", async () => {
      await expect(
        InventoryService.createItem({
          organisationId: "org1",
          name: "n",
          category: "c",
          businessType: "INVALID" as any,
        }),
      ).rejects.toThrow("Invalid businessType");
    });

    it("creates an item successfully without batches", async () => {
      (OrgBilling.findOne as jest.Mock).mockResolvedValueOnce(null); // test fallback to "usd"
      const mockDoc = createMockDoc({ _id: validId, organisationId: "org1" });
      (InventoryItemModel.create as jest.Mock).mockResolvedValueOnce(mockDoc);
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );

      const res = await InventoryService.createItem({
        organisationId: "org1",
        name: "Item",
        category: "Cat",
        businessType: "HOSPITAL",
        subCategory: "Sub",
        attributes: { size: "L" },
        unitCost: 10,
        status: "ACTIVE",
      });

      expect(InventoryItemModel.create).toHaveBeenCalled();
      expect(res.item).toEqual(mockDoc);
      expect(res.batches).toEqual([]);
    });

    it("creates an item and handles batches (recomputing stock)", async () => {
      (OrgBilling.findOne as jest.Mock).mockResolvedValueOnce({
        currency: "eur",
      });
      const mockDoc = createMockDoc({
        _id: validId,
        organisationId: "org1",
        onHand: 0,
        allocated: 0,
      });
      (InventoryItemModel.create as jest.Mock).mockResolvedValueOnce(mockDoc);

      const batches = [
        { quantity: 5, expiryDate: new Date("2026-01-01") }, // no allocated defaults to 0
        { quantity: 10, allocated: 2, expiryDate: new Date("2025-01-01") }, // nearest expiry
        { quantity: 0 }, // no expiry
      ];

      (InventoryBatchModel.insertMany as jest.Mock).mockResolvedValueOnce(true);
      (InventoryBatchModel.find as jest.Mock)
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(batches) }) // For recompute
        .mockReturnValueOnce(createChainable(batches)); // For final return

      const res = await InventoryService.createItem({
        organisationId: "org1",
        name: "Item",
        category: "Cat",
        businessType: "HOSPITAL",
        batches: batches as any,
      });

      expect(InventoryBatchModel.insertMany).toHaveBeenCalled();
      expect(mockDoc.onHand).toBe(15);
      expect(mockDoc.allocated).toBe(2);
      expect(mockDoc.save).toHaveBeenCalled();
      expect(res.batches).toHaveLength(3);
    });

    it("creates an item using prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
        currency: "eur",
      });
      (prisma.inventoryItem.create as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org1",
        businessType: "HOSPITAL",
        name: "Item",
        category: "Cat",
        status: "ACTIVE",
        onHand: 0,
        allocated: 0,
      });
      (prisma.inventoryBatch.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.inventoryBatch.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: "batch-1",
            itemId: "item-1",
            organisationId: "org1",
            quantity: 3,
            allocated: 1,
            expiryDate: new Date("2026-01-01"),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "batch-1",
            itemId: "item-1",
            organisationId: "org1",
            quantity: 3,
            allocated: 1,
            expiryDate: new Date("2026-01-01"),
          },
        ]);
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org1",
        businessType: "HOSPITAL",
        name: "Item",
        category: "Cat",
        status: "ACTIVE",
        onHand: 3,
        allocated: 1,
      });

      const res = await InventoryService.createItem({
        organisationId: "org1",
        name: "Item",
        category: "Cat",
        businessType: "HOSPITAL",
        batches: [{ quantity: 3, allocated: 1 }] as any,
      });

      expect(prisma.inventoryItem.create).toHaveBeenCalled();
      expect(prisma.inventoryBatch.createMany).toHaveBeenCalled();
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { onHand: 3, allocated: 1 } }),
      );
      expect(res.item).toEqual(
        expect.objectContaining({ organisationId: "org1", _id: "item-1" }),
      );
      expect(res.batches).toHaveLength(1);
    });
  });

  describe("InventoryService.updateItem", () => {
    it("throws if itemId is invalid", async () => {
      await expect(InventoryService.updateItem("bad-id", {})).rejects.toThrow(
        "Invalid itemId",
      );
    });
    it("throws if item not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(InventoryService.updateItem(validId, {})).rejects.toThrow(
        "Inventory item not found",
      );
    });

    it("updates all fields correctly", async () => {
      const mockDoc = createMockDoc({ organisationId: "org1" });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockDoc),
      );
      (OrgBilling.findOne as jest.Mock).mockResolvedValueOnce({
        currency: "gbp",
      });
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );

      await InventoryService.updateItem(validId, {
        name: "New",
        sku: "SKU1",
        category: "C",
        subCategory: "S",
        description: "D",
        imageUrl: "I",
        attributes: { a: 1 },
        unitCost: 100,
        sellingPrice: 150,
        currency: "usd", // will be overridden by getOrgBillingCurrency
        reorderLevel: 5,
        vendorId: validId,
        status: "HIDDEN",
      });

      expect(mockDoc.name).toBe("New");
      expect(mockDoc.currency).toBe("gbp");
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("handles undefined/null resets perfectly", async () => {
      const mockDoc = createMockDoc({ organisationId: "org1" });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockDoc),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );

      await InventoryService.updateItem(validId, {
        unitCost: null,
        sellingPrice: null,
        reorderLevel: null,
        vendorId: null,
      });

      expect(mockDoc.unitCost).toBeUndefined();
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("updates nothing if empty input (hits uncovered negative branches)", async () => {
      const mockDoc = createMockDoc({ organisationId: "org1" });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockDoc),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );

      await InventoryService.updateItem(validId, {});

      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org1",
      });
      (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
        currency: "usd",
      });
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org1",
        name: "Updated",
        category: "Cat",
        status: "ACTIVE",
      });
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);

      const res = await InventoryService.updateItem("item-1", {
        name: "Updated",
        category: "Cat",
        currency: "cad",
        status: "ACTIVE",
      });

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-1" },
        }),
      );
      expect(res.item).toEqual(expect.objectContaining({ name: "Updated" }));
    });
  });

  describe("InventoryService status toggles (hide/archive/active)", () => {
    it("hideItem works", async () => {
      const mockDoc = createMockDoc({ status: "ACTIVE" });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockDoc),
      );
      await InventoryService.hideItem(validId);
      expect(mockDoc.status).toBe("HIDDEN");
    });
    it("archiveItem works", async () => {
      const mockDoc = createMockDoc({ status: "ACTIVE" });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockDoc),
      );
      await InventoryService.archiveItem(validId);
      expect(mockDoc.status).toBe("DELETED");
    });
    it("activeItem works", async () => {
      const mockDoc = createMockDoc({ status: "HIDDEN" });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockDoc),
      );
      await InventoryService.activeItem(validId);
      expect(mockDoc.status).toBe("ACTIVE");
    });
    it("throws if not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockReturnValue(
        createChainable(null),
      );
      await expect(InventoryService.hideItem(validId)).rejects.toThrow(
        "Inventory item not found",
      );
      await expect(InventoryService.archiveItem(validId)).rejects.toThrow(
        "Inventory item not found",
      );
      await expect(InventoryService.activeItem(validId)).rejects.toThrow(
        "Inventory item not found",
      );
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        status: "HIDDEN",
      });
      const hidden = await InventoryService.hideItem("item-1");
      expect(hidden.status).toBe("HIDDEN");
    });
  });

  describe("InventoryService.listItems", () => {
    it("throws on missing organisationId", async () => {
      await expect(InventoryService.listItems({} as any)).rejects.toThrow(
        "Invalid organisationId",
      );
    });

    it("throws on invalid businessType, category, or subCategory strings", async () => {
      await expect(
        InventoryService.listItems({
          organisationId: "org",
          businessType: "BAD" as any,
        }),
      ).rejects.toThrow("Invalid businessType");
      await expect(
        InventoryService.listItems({ organisationId: "org", category: " " }),
      ).rejects.toThrow("Invalid category");
      await expect(
        InventoryService.listItems({ organisationId: "org", subCategory: " " }),
      ).rejects.toThrow("Invalid subCategory");
    });

    it("handles status array correctly (empty, invalid, valid)", async () => {
      const res1 = await InventoryService.listItems({
        organisationId: "org",
        status: [],
      });
      expect(res1).toEqual([]);

      await expect(
        InventoryService.listItems({
          organisationId: "org",
          status: ["BAD"] as any,
        }),
      ).rejects.toThrow("Invalid status");

      await expect(
        InventoryService.listItems({
          organisationId: "org",
          status: "BAD" as any,
        }),
      ).rejects.toThrow("Invalid status");
    });

    it("applies search regex and filter logic perfectly (including negative dates/NaN)", async () => {
      const mockItemExpired = createMockDoc({
        _id: new Types.ObjectId(),
        name: "Expired Item",
        onHand: 10,
        reorderLevel: null,
      });
      const mockItemLow = createMockDoc({
        _id: new Types.ObjectId(),
        name: "Low Item",
        onHand: 2,
        reorderLevel: 5,
      });
      const mockItemSoon = createMockDoc({
        _id: new Types.ObjectId(),
        name: "Soon Item",
        onHand: 20,
      });
      const mockItemHealthy = createMockDoc({
        _id: new Types.ObjectId(),
        name: "Healthy",
        onHand: 50,
      });

      (InventoryItemModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([
          mockItemExpired,
          mockItemLow,
          mockItemSoon,
          mockItemHealthy,
        ]),
      );

      const batches = [
        {
          itemId: mockItemExpired._id,
          expiryDate: dayjs().subtract(5, "day").toDate(),
        }, // EXPIRED
        {
          itemId: mockItemSoon._id,
          expiryDate: dayjs().add(3, "day").toDate(),
        }, // EXPIRING_SOON
      ];
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable(batches),
      );

      const res = await InventoryService.listItems({
        organisationId: "org",
        search: "Item.*[test]", // Tests escapeRegex
        status: ["ACTIVE", "HIDDEN"],
        lowStockOnly: false,
        expiredOnly: false,
        expiringWithinDays: -5, // tests sanitizePositiveNumber negative path -> falls back undefined
      });

      expect(res).toHaveLength(4);
      expect(res[0].stockHealth).toBe("EXPIRED");
      expect(res[2].stockHealth).toBe("EXPIRING_SOON");
    });

    it("applies expiredOnly and lowStockOnly logic", async () => {
      const mockItem = createMockDoc({
        _id: new Types.ObjectId(),
        onHand: 1,
        reorderLevel: 5,
      }); // LOW_STOCK
      (InventoryItemModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([mockItem]),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );

      const res = await InventoryService.listItems({
        organisationId: "org",
        expiredOnly: true,
      });
      expect(res).toHaveLength(0);

      (InventoryItemModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([mockItem]),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      const res2 = await InventoryService.listItems({
        organisationId: "org",
        lowStockOnly: true,
      });
      expect(res2).toHaveLength(1);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "item-1",
          organisationId: "org",
          name: "Item A",
          category: "Cat",
          status: "ACTIVE",
          onHand: 5,
          reorderLevel: 2,
        },
      ]);
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);

      const res = await InventoryService.listItems({
        organisationId: "org",
        search: "Item",
        status: ["ACTIVE"],
      });

      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: "org" }),
        }),
      );
      expect(res).toHaveLength(1);
    });
  });

  describe("InventoryService.getItemWithBatches", () => {
    it("throws if not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      await expect(
        InventoryService.getItemWithBatches(validId, "org"),
      ).rejects.toThrow("Inventory item not found");
    });
    it("returns item and batches", async () => {
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ id: 1 }),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([{ id: 2 }]),
      );
      const res = await InventoryService.getItemWithBatches(validId, "org");
      expect(res.item).toEqual({ id: 1 });
      expect(res.batches).toHaveLength(1);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org",
      });
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
        { id: "batch-1", itemId: "item-1", organisationId: "org" },
      ]);

      const res = await InventoryService.getItemWithBatches("item-1", "org");
      expect(res.item).toEqual(expect.objectContaining({ _id: "item-1" }));
      expect(res.batches).toHaveLength(1);
    });
  });

  describe("InventoryService Batch Operations", () => {
    it("addBatch: success", async () => {
      const mockItem = createMockDoc({ organisationId: "org" });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );
      (InventoryBatchModel.create as jest.Mock).mockResolvedValueOnce({
        id: "b1",
      });
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([{ quantity: 10 }]),
      }); // Recompute

      await InventoryService.addBatch(validId, { quantity: 10 });
      expect(mockItem.onHand).toBe(10);
    });

    it("addBatch: throws if itemId is invalid (tests ensureObjectId default parameter fallback)", async () => {
      await expect(
        InventoryService.addBatch("bad-id", { quantity: 1 }),
      ).rejects.toThrow("Invalid id");
    });

    it("addBatch: throws if item not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InventoryService.addBatch(validId, { quantity: 10 }),
      ).rejects.toThrow("Inventory item not found");
    });

    it("updateBatch: success", async () => {
      const mockBatch = createMockDoc({ itemId: validId, quantity: 5 });
      (InventoryBatchModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockBatch),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([{ quantity: 20 }]),
      }); // Recompute

      await InventoryService.updateBatch(validId, {
        batchNumber: "B1",
        lotNumber: "L1",
        regulatoryTrackingId: "R1",
        manufactureDate: new Date(),
        expiryDate: new Date(),
        minShelfLifeAlertDate: new Date(),
        quantity: 20,
        allocated: 5,
      });

      expect(mockBatch.batchNumber).toBe("B1");
    });

    it("updateBatch: handles empty input gracefully (hits negative branch logic)", async () => {
      const mockBatch = createMockDoc({ itemId: validId, quantity: 5 });
      (InventoryBatchModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockBatch),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([]),
      }); // Recompute empty

      await InventoryService.updateBatch(validId, {});
      expect(mockBatch.save).toHaveBeenCalled();
    });

    it("updateBatch: throws if batch not found", async () => {
      (InventoryBatchModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(InventoryService.updateBatch(validId, {})).rejects.toThrow(
        "Batch not found",
      );
    });

    it("deleteBatch: success and skip if not found", async () => {
      (InventoryBatchModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await InventoryService.deleteBatch(validId); // skips silently

      const mockBatch = createMockDoc({ itemId: validId });
      (InventoryBatchModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockBatch),
      );
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([]),
      }); // Recompute empty

      await InventoryService.deleteBatch(validId);
      expect(mockBatch.deleteOne).toHaveBeenCalled();
      expect(InventoryItemModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it("uses prisma for batch operations when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org",
      });
      (prisma.inventoryBatch.create as jest.Mock).mockResolvedValue({
        id: "batch-1",
        itemId: "item-1",
        organisationId: "org",
        quantity: 2,
      });
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 0,
        allocated: 0,
      });

      await InventoryService.addBatch("item-1", { quantity: 2 });
      expect(prisma.inventoryBatch.create).toHaveBeenCalled();
      expect(prisma.inventoryItem.update).toHaveBeenCalled();

      (prisma.inventoryBatch.findFirst as jest.Mock).mockResolvedValue({
        id: "batch-1",
        itemId: "item-1",
      });
      (prisma.inventoryBatch.update as jest.Mock).mockResolvedValue({
        id: "batch-1",
        itemId: "item-1",
      });
      await InventoryService.updateBatch("batch-1", { quantity: 5 });
      expect(prisma.inventoryBatch.update).toHaveBeenCalled();

      await InventoryService.deleteBatch("batch-1");
      expect(prisma.inventoryBatch.deleteMany).toHaveBeenCalled();
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalled();
    });
  });

  describe("InventoryService.consumeStock & bulkConsumeStock", () => {
    it("consumeStock: quantity <= 0 throws", async () => {
      await expect(
        InventoryService.consumeStock({
          itemId: validId,
          quantity: 0,
          reason: "OTHER",
        }),
      ).rejects.toThrow("quantity must be > 0");
    });

    it("consumeStock: item not found throws", async () => {
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(null),
      );
      await expect(
        InventoryService.consumeStock({
          itemId: validId,
          quantity: 5,
          reason: "OTHER",
        }),
      ).rejects.toThrow("Inventory item not found");
    });

    it("consumeStock: insufficient stock throws", async () => {
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable({ onHand: 2 }),
      );
      await expect(
        InventoryService.consumeStock({
          itemId: validId,
          quantity: 5,
          reason: "OTHER",
        }),
      ).rejects.toThrow("Insufficient stock");
    });

    it("consumeStock: consumes FIFO and recomputes", async () => {
      const mockItem = createMockDoc({ onHand: 10 });
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockItem),
      );

      const b1 = createMockDoc({ quantity: 0 }); // Skip empty
      const b2 = createMockDoc({ quantity: 3 }); // Consumed fully
      const b3 = createMockDoc({ quantity: 10 }); // Consumed partially (2)

      (InventoryBatchModel.find as jest.Mock)
        .mockReturnValueOnce(createChainable([b1, b2, b3])) // loop
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue([{ quantity: 5 }]),
        }); // recompute

      await InventoryService.consumeStock({
        itemId: validId,
        quantity: 5,
        reason: "OTHER",
      });

      expect(b2.quantity).toBe(0);
      expect(b3.quantity).toBe(8);
      expect(mockItem.onHand).toBe(5); // Result of recompute
    });

    it("consumeStock: throws 500 if remaining > 0 (data integrity error)", async () => {
      const mockItem = createMockDoc({ onHand: 10 }); // Item thinks it has 10
      (InventoryItemModel.findById as jest.Mock).mockReturnValueOnce(
        createChainable(mockItem),
      );

      const b1 = createMockDoc({ quantity: 2 }); // Batches actually only have 2
      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([b1]),
      );

      await expect(
        InventoryService.consumeStock({
          itemId: validId,
          quantity: 5,
          reason: "OTHER",
        }),
      ).rejects.toThrow("Failed to consume full requested quantity");
    });

    it("bulkConsumeStock: empty array throws", async () => {
      await expect(
        InventoryService.bulkConsumeStock({ items: [] }),
      ).rejects.toThrow("items must be a non-empty array");
    });

    it("bulkConsumeStock: succeeds", async () => {
      const spy = jest
        .spyOn(InventoryService, "consumeStock")
        .mockResolvedValue({ id: 1 } as any);
      const res = await InventoryService.bulkConsumeStock({
        items: [{ itemId: validId, quantity: 1, reason: "OTHER" }],
      });
      expect(res).toEqual([{ id: 1 }]);
      spy.mockRestore();
    });

    it("consumeStock uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 5,
        allocated: 0,
      });
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([
        { id: "b1", itemId: "item-1", quantity: 3 },
        { id: "b2", itemId: "item-1", quantity: 2 },
      ]);
      (prisma.inventoryBatch.update as jest.Mock).mockResolvedValue({});
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 0,
        allocated: 0,
      });

      const res = await InventoryService.consumeStock({
        itemId: "item-1",
        quantity: 5,
        reason: "OTHER",
      });

      expect(prisma.inventoryBatch.update).toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ _id: "item-1" }));
    });
  });

  describe("InventoryService.getInventoryTurnoverByItem", () => {
    it("throws on invalid dates", async () => {
      await expect(
        InventoryService.getInventoryTurnoverByItem({
          organisationId: "org",
          to: new Date("invalid"),
        }),
      ).rejects.toThrow("Invalid to");
      await expect(
        InventoryService.getInventoryTurnoverByItem({
          organisationId: "org",
          from: new Date("invalid"),
        }),
      ).rejects.toThrow("Invalid from");
    });

    it("returns empty if no items", async () => {
      (InventoryItemModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      const res = await InventoryService.getInventoryTurnoverByItem({
        organisationId: "org",
      });
      expect(res).toEqual([]);
    });

    it("calculates turnover correctly across all bands", async () => {
      const item1 = { _id: new Types.ObjectId(), name: "i1", onHand: 10 }; // EXCELLENT (Turns: 12+)
      const item2 = { _id: new Types.ObjectId(), name: "i2", onHand: 10 }; // HEALTHY (Turns: 6-11)
      const item3 = { _id: new Types.ObjectId(), name: "i3", onHand: 10 }; // MODERATE (Turns: 3-5)
      const item4 = { _id: new Types.ObjectId(), name: "i4", onHand: 10 }; // LOW (Turns: <3)
      const item5 = { _id: new Types.ObjectId(), name: "i5", onHand: 0 }; // Div by zero edge case

      (InventoryItemModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([item1, item2, item3, item4, item5]),
      );

      // Purchases
      (StockMovementModel.find as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([
          { itemId: item1._id, change: 120 },
          { itemId: item2._id, change: 60 },
          { itemId: item3._id, change: 30 },
          { itemId: item4._id, change: 10 },
        ]),
      });

      (InventoryBatchModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ qty: 10 }])
        .mockResolvedValueOnce([{ qty: 10 }])
        .mockResolvedValueOnce([{ qty: 10 }])
        .mockResolvedValueOnce([{ qty: 10 }])
        .mockResolvedValueOnce([{ qty: 0 }]); // For item 5

      const res = await InventoryService.getInventoryTurnoverByItem({
        organisationId: "org",
      });

      expect(res).toHaveLength(5);
      expect(res[0].status).toBe("EXCELLENT");
      expect(res[1].status).toBe("HEALTHY");
      expect(res[2].status).toBe("MODERATE");
      expect(res[3].status).toBe("LOW");
      expect(res[4].turnsPerYear).toBe(0); // 0/0 edge case handled
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
        { id: "item-1", name: "I1", category: "Cat", onHand: 10 },
      ]);
      (prisma.inventoryStockMovement.findMany as jest.Mock).mockResolvedValue([
        { itemId: "item-1", change: 20 },
      ]);
      (prisma.inventoryBatch.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 5 },
      });

      const res = await InventoryService.getInventoryTurnoverByItem({
        organisationId: "org",
      });

      expect(res).toHaveLength(1);
      expect(res[0].itemId).toBe("item-1");
    });
  });

  describe("InventoryAdjustmentService", () => {
    it("throws if item not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InventoryAdjustmentService.adjustStock({
          itemId: validId,
          newOnHand: 10,
          reason: "R",
        }),
      ).rejects.toThrow();
    });

    it("handles positive delta (creates batch)", async () => {
      const mockItem = createMockDoc({ onHand: 5 });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );
      (InventoryBatchModel.find as jest.Mock).mockResolvedValueOnce([
        { quantity: 10 },
      ]);

      await InventoryAdjustmentService.adjustStock({
        itemId: validId,
        newOnHand: 10,
        reason: "R",
      });

      expect(InventoryBatchModel.create).toHaveBeenCalled(); // virtual batch
      expect(StockMovementModel.create).toHaveBeenCalled(); // log movement
      expect(mockItem.onHand).toBe(10);
    });

    it("handles negative delta (consumes batches)", async () => {
      const mockItem = createMockDoc({ onHand: 10 });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );

      const b1 = createMockDoc({ quantity: 5 }); // consumed fully
      (InventoryBatchModel.find as jest.Mock)
        .mockReturnValueOnce(createChainable([b1])) // for consumption
        .mockResolvedValueOnce([]); // for recompute

      await InventoryAdjustmentService.adjustStock({
        itemId: validId,
        newOnHand: 5,
        reason: "R",
      });
      expect(b1.quantity).toBe(0);
      expect(StockMovementModel.create).toHaveBeenCalled();
    });

    it("handles zero delta (bypasses logic directly to recompute)", async () => {
      const mockItem = createMockDoc({ onHand: 10 });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );
      (InventoryBatchModel.find as jest.Mock).mockResolvedValueOnce([]); // Recompute empty

      await InventoryAdjustmentService.adjustStock({
        itemId: validId,
        newOnHand: 10,
        reason: "R",
      });

      expect(StockMovementModel.create).not.toHaveBeenCalled();
      expect(mockItem.onHand).toBe(0); // Because recompute returned empty batches
    });

    it("throws 400 if negative delta exceeds available batches", async () => {
      const mockItem = createMockDoc({ onHand: 10 });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );

      (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([createMockDoc({ quantity: 1 })]),
      );

      await expect(
        InventoryAdjustmentService.adjustStock({
          itemId: validId,
          newOnHand: 5,
          reason: "R",
        }),
      ).rejects.toThrow("Insufficient stock for adjustment");
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
        id: "item-1",
        organisationId: "org",
        onHand: 1,
      });
      (prisma.inventoryBatch.create as jest.Mock).mockResolvedValue({});
      (prisma.inventoryStockMovement.create as jest.Mock).mockResolvedValue({});
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 2,
        allocated: 0,
      });

      const res = await InventoryAdjustmentService.adjustStock({
        itemId: "item-1",
        newOnHand: 2,
        reason: "MANUAL",
      });

      expect(prisma.inventoryBatch.create).toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ _id: "item-1" }));
    });
  });

  describe("InventoryAllocationService", () => {
    it("allocateStock: throws if not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InventoryAllocationService.allocateStock({
          itemId: validId,
          quantity: 1,
          referenceId: "R",
        }),
      ).rejects.toThrow();
    });
    it("allocateStock: throws if insufficient unallocated stock", async () => {
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        createMockDoc({ onHand: 10, allocated: 9 }),
      );
      await expect(
        InventoryAllocationService.allocateStock({
          itemId: validId,
          quantity: 2,
          referenceId: "R",
        }),
      ).rejects.toThrow("Not enough unallocated stock");
    });
    it("allocateStock: success", async () => {
      const mockItem = createMockDoc({ onHand: 10, allocated: 0 });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );
      await InventoryAllocationService.allocateStock({
        itemId: validId,
        quantity: 2,
        referenceId: "R",
      });
      expect(mockItem.allocated).toBe(2);
      expect(StockMovementModel.create).toHaveBeenCalled();
    });

    it("releaseAllocatedStock: throws if not found", async () => {
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InventoryAllocationService.releaseAllocatedStock({
          itemId: validId,
          quantity: 1,
          referenceId: "R",
        }),
      ).rejects.toThrow();
    });
    it("releaseAllocatedStock: success (floors at 0)", async () => {
      const mockItem = createMockDoc({ allocated: 1 });
      (InventoryItemModel.findById as jest.Mock).mockResolvedValueOnce(
        mockItem,
      );
      await InventoryAllocationService.releaseAllocatedStock({
        itemId: validId,
        quantity: 5,
        referenceId: "R",
      });
      expect(mockItem.allocated).toBe(0);
      expect(StockMovementModel.create).toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 5,
        allocated: 1,
      });
      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 5,
        allocated: 3,
      });
      (prisma.inventoryStockMovement.create as jest.Mock).mockResolvedValue({});

      const res = await InventoryAllocationService.allocateStock({
        itemId: "item-1",
        quantity: 2,
        referenceId: "ref",
      });

      expect(res).toEqual(expect.objectContaining({ _id: "item-1" }));

      (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({
        id: "item-1",
        onHand: 5,
        allocated: 0,
      });
      await InventoryAllocationService.releaseAllocatedStock({
        itemId: "item-1",
        quantity: 5,
        referenceId: "ref",
      });
      expect(prisma.inventoryItem.update).toHaveBeenCalled();
    });
  });

  describe("InventoryVendorService", () => {
    it("createVendor", async () => {
      await expect(
        InventoryVendorService.createVendor({} as any),
      ).rejects.toThrow("organisationId required");
      await InventoryVendorService.createVendor({
        organisationId: "org",
        name: "V",
      });
      expect(InventoryVendorModel.create).toHaveBeenCalled();
    });
    it("updateVendor", async () => {
      (InventoryVendorModel.findById as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InventoryVendorService.updateVendor(validId, {}),
      ).rejects.toThrow("Vendor not found");

      const mockDoc = createMockDoc({ name: "A" });
      (InventoryVendorModel.findById as jest.Mock).mockResolvedValueOnce(
        mockDoc,
      );
      await InventoryVendorService.updateVendor(validId, { name: "B" });
      expect(mockDoc.name).toBe("B");
    });
    it("listVendors", async () => {
      (InventoryVendorModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      await InventoryVendorService.listVendors("org");
      expect(InventoryVendorModel.find).toHaveBeenCalled();
    });
    it("getVendor", async () => {
      await InventoryVendorService.getVendor(validId);
      expect(InventoryVendorModel.findById).toHaveBeenCalled();
    });
    it("deleteVendor", async () => {
      await InventoryVendorService.deleteVendor(validId);
      expect(InventoryVendorModel.findByIdAndDelete).toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryVendor.create as jest.Mock).mockResolvedValue({
        id: "vendor-1",
      });
      (prisma.inventoryVendor.update as jest.Mock).mockResolvedValue({
        id: "vendor-1",
        name: "B",
      });
      (prisma.inventoryVendor.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.inventoryVendor.findFirst as jest.Mock).mockResolvedValue({
        id: "vendor-1",
      });
      (prisma.inventoryVendor.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await InventoryVendorService.createVendor({
        organisationId: "org",
        name: "V",
      });
      await InventoryVendorService.updateVendor("vendor-1", { name: "B" });
      await InventoryVendorService.listVendors("org");
      await InventoryVendorService.getVendor("vendor-1");
      await InventoryVendorService.deleteVendor("vendor-1");

      expect(prisma.inventoryVendor.create).toHaveBeenCalled();
      expect(prisma.inventoryVendor.update).toHaveBeenCalled();
      expect(prisma.inventoryVendor.deleteMany).toHaveBeenCalled();
    });
  });

  describe("InventoryMetaFieldService", () => {
    it("createField", async () => {
      await expect(
        InventoryMetaFieldService.createField({ businessType: "BAD" } as any),
      ).rejects.toThrow();
      await InventoryMetaFieldService.createField({
        businessType: "HOSPITAL",
        fieldKey: "k",
        label: "l",
        values: [],
      });
      expect(InventoryMetaFieldModel.create).toHaveBeenCalled();
    });
    it("updateField", async () => {
      (InventoryMetaFieldModel.findById as jest.Mock).mockResolvedValueOnce(
        null,
      );
      await expect(
        InventoryMetaFieldService.updateField(validId, {}),
      ).rejects.toThrow();

      const mockDoc = createMockDoc({ label: "A" });
      (InventoryMetaFieldModel.findById as jest.Mock).mockResolvedValueOnce(
        mockDoc,
      );
      await InventoryMetaFieldService.updateField(validId, { label: "B" });
      expect(mockDoc.label).toBe("B");
    });
    it("deleteField", async () => {
      await InventoryMetaFieldService.deleteField(validId);
      expect(InventoryMetaFieldModel.findByIdAndDelete).toHaveBeenCalled();
    });
    it("listFields", async () => {
      await expect(
        InventoryMetaFieldService.listFields("BAD"),
      ).rejects.toThrow();
      (InventoryMetaFieldModel.find as jest.Mock).mockReturnValueOnce(
        createChainable([]),
      );
      await InventoryMetaFieldService.listFields("HOSPITAL");
      expect(InventoryMetaFieldModel.find).toHaveBeenCalled();
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryMetaField.create as jest.Mock).mockResolvedValue({
        id: "field-1",
      });
      (prisma.inventoryMetaField.update as jest.Mock).mockResolvedValue({
        id: "field-1",
        label: "B",
      });
      (prisma.inventoryMetaField.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.inventoryMetaField.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await InventoryMetaFieldService.createField({
        businessType: "HOSPITAL",
        fieldKey: "k",
        label: "l",
        values: [],
      });
      await InventoryMetaFieldService.updateField("field-1", { label: "B" });
      await InventoryMetaFieldService.listFields("HOSPITAL");
      await InventoryMetaFieldService.deleteField("field-1");

      expect(prisma.inventoryMetaField.create).toHaveBeenCalled();
      expect(prisma.inventoryMetaField.deleteMany).toHaveBeenCalled();
    });
  });

  describe("InventoryAlertService", () => {
    it("getLowStockItems skips items with no reorder level and filters correctly", async () => {
      const i1 = { onHand: 10 }; // Skip (no reorderLevel)
      const i2 = { onHand: 10, reorderLevel: 5 }; // Skip (onHand > reorder)
      const i3 = { onHand: 2, reorderLevel: 5 }; // Include
      const i4 = { reorderLevel: 5 }; // onHand is undefined, defaults to 0 <= 5 (Include)
      (InventoryItemModel.find as jest.Mock).mockResolvedValueOnce([
        i1,
        i2,
        i3,
        i4,
      ]);

      const res = await InventoryAlertService.getLowStockItems("org");
      expect(res).toHaveLength(2);
      expect(res[0]).toBe(i3);
      expect(res[1]).toBe(i4);
    });

    it("getExpiringItems works with default and provided days, and negative fallback", async () => {
      await InventoryAlertService.getExpiringItems("org");
      expect(InventoryBatchModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ expiryDate: expect.any(Object) }),
      );

      await InventoryAlertService.getExpiringItems("org", 10);
      expect(InventoryBatchModel.find).toHaveBeenCalledTimes(2);

      await InventoryAlertService.getExpiringItems("org", -5);
      expect(InventoryBatchModel.find).toHaveBeenCalledTimes(3);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
        { id: "i1", onHand: 1, reorderLevel: 2 },
        { id: "i2", onHand: 5, reorderLevel: 1 },
      ]);
      (prisma.inventoryBatch.findMany as jest.Mock).mockResolvedValue([]);

      const low = await InventoryAlertService.getLowStockItems("org");
      expect(low).toHaveLength(1);

      await InventoryAlertService.getExpiringItems("org", 3);
      expect(prisma.inventoryBatch.findMany).toHaveBeenCalled();
    });
  });
});
