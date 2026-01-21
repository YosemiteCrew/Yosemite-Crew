import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import {
  InventoryService,
  InventoryAdjustmentService,
  InventoryAllocationService,
  InventoryVendorService,
  InventoryMetaFieldService,
  InventoryAlertService,
} from "../../src/services/inventory.service";
import {
  InventoryItemModel,
  InventoryBatchModel,
  InventoryVendorModel,
  InventoryMetaFieldModel,
  StockMovementModel,
} from "../../src/models/inventory";

// ----------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------
jest.mock("../../src/models/inventory");

// Helper to mock mongoose chaining: find().sort().exec() or lean()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMongooseChain = (resolvedValue: any) => {
  const chain: any = {
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exec: (jest.fn() as any).mockResolvedValue(resolvedValue),
  };
  // Allow awaiting the chain directly
  chain.then = (resolve: any, reject: any) =>
    chain.exec().then(resolve, reject);
  return chain;
};

// Helper to create a mock document with save/toObject methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDoc = (data: any) => ({
  ...data,
  _id: data._id || new Types.ObjectId(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save: (jest.fn() as any).mockResolvedValue({
    ...data,
    _id: data._id || new Types.ObjectId(),
  }),
  toObject: jest.fn().mockReturnValue(data),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteOne: (jest.fn() as any).mockResolvedValue(true),
});

describe("Inventory Module", () => {
  const orgId = new Types.ObjectId().toString();
  const itemId = new Types.ObjectId().toString();
  const batchId = new Types.ObjectId().toString();
  const validVendorId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // 1. InventoryService
  // ======================================================================
  describe("InventoryService", () => {
    // --- createItem ---
    describe("createItem", () => {
      it("should throw if required fields are missing", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(InventoryService.createItem({} as any)).rejects.toThrow(
          "organisationId is required",
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(
          InventoryService.createItem({ organisationId: orgId } as any),
        ).rejects.toThrow("name is required");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(
          InventoryService.createItem({
            organisationId: orgId,
            name: "Item",
          } as any),
        ).rejects.toThrow("category is required");
      });

      it("should create an item without batches", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const input: any = {
          organisationId: orgId,
          businessType: "GENERAL",
          name: "Test Item",
          category: "Meds",
          unitCost: 10,
          sellingPrice: 20,
          reorderLevel: 5,
          vendorId: new Types.ObjectId().toString(),
          status: "ACTIVE",
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.create as any).mockResolvedValue(
          mockDoc({ ...input, _id: itemId }),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );

        const result = await InventoryService.createItem(input);

        expect(InventoryItemModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Test Item" }),
        );
        expect(result.item).toBeDefined();
        expect(result.batches).toEqual([]);
      });

      it("should create an item WITH batches and recompute stock", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const input: any = {
          organisationId: orgId,
          businessType: "GENERAL",
          name: "Batch Item",
          category: "Meds",
          batches: [
            { quantity: 10, expiryDate: new Date("2030-01-01") },
            { quantity: 5, allocated: 2 },
          ],
        };

        const itemDoc = mockDoc({
          ...input,
          _id: itemId,
          onHand: 0,
          allocated: 0,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.create as any).mockResolvedValue(itemDoc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.insertMany as any).mockResolvedValue(
          input.batches,
        );

        // Mock finding batches for recomputation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([
            { quantity: 10, allocated: 0, expiryDate: new Date("2030-01-01") },
            { quantity: 5, allocated: 2 },
          ]),
        );

        await InventoryService.createItem(input);

        // Verification of recompute logic via save calls
        expect(InventoryBatchModel.insertMany).toHaveBeenCalled();
        expect(itemDoc.save).toHaveBeenCalled();
        expect(itemDoc.onHand).toBe(15);
        expect(itemDoc.allocated).toBe(2);
      });
    });

    // --- updateItem ---
    describe("updateItem", () => {
      it("should throw if item not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        await expect(InventoryService.updateItem(itemId, {})).rejects.toThrow(
          "Inventory item not found",
        );
      });

      it("should update specific fields", async () => {
        const itemDoc = mockDoc({ _id: itemId, name: "Old", attributes: {} });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );

        const updateData = {
          name: "New",
          sku: "SKU1",
          category: "Cat",
          subCategory: "Sub",
          description: "Desc",
          imageUrl: "http://img",
          attributes: { key: "val" },
          unitCost: 10,
          sellingPrice: 20,
          currency: "EUR",
          reorderLevel: 5,
          vendorId: new Types.ObjectId().toString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: "HIDDEN" as any,
        };

        await InventoryService.updateItem(itemId, updateData);

        expect(itemDoc.name).toBe("New");
        expect(itemDoc.unitCost).toBe(10);
        expect(itemDoc.save).toHaveBeenCalled();
      });

      it("should handle partial updates (undefined checks)", async () => {
        const itemDoc = mockDoc({ _id: itemId, name: "Old" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );

        // Passing undefined explicitly to ensure branches are hit
        await InventoryService.updateItem(itemId, { name: undefined });
        expect(itemDoc.name).toBe("Old");
      });
    });

    // --- Status Updates ---
    describe("Status Updates (hide, archive, active)", () => {
      it("should hide item", async () => {
        const itemDoc = mockDoc({ _id: itemId, status: "ACTIVE" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        await InventoryService.hideItem(itemId);
        expect(itemDoc.status).toBe("HIDDEN");
        expect(itemDoc.save).toHaveBeenCalled();
      });
      it("should throw if item to hide not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        await expect(InventoryService.hideItem(itemId)).rejects.toThrow(
          "not found",
        );
      });

      it("should archive item", async () => {
        const itemDoc = mockDoc({ _id: itemId, status: "ACTIVE" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        await InventoryService.archiveItem(itemId);
        expect(itemDoc.status).toBe("DELETED");
      });
      it("should throw if item to archive not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        await expect(InventoryService.archiveItem(itemId)).rejects.toThrow(
          "not found",
        );
      });

      it("should activate item", async () => {
        const itemDoc = mockDoc({ _id: itemId, status: "HIDDEN" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        await InventoryService.activeItem(itemId);
        expect(itemDoc.status).toBe("ACTIVE");
      });
      it("should throw if item to activate not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        await expect(InventoryService.activeItem(itemId)).rejects.toThrow(
          "not found",
        );
      });

      it("should throw on invalid ObjectId", async () => {
        await expect(InventoryService.activeItem("bad-id")).rejects.toThrow(
          "Invalid itemId",
        );
      });
    });

    // --- getItemWithBatches ---
    describe("getItemWithBatches", () => {
      it("should return item and batches", async () => {
        const itemDoc = { _id: itemId };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain(["batch1"]),
        );

        const result = await InventoryService.getItemWithBatches(itemId, orgId);
        expect(result.item).toEqual(itemDoc);
        expect(result.batches).toEqual(["batch1"]);
      });

      it("should throw if item missing", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );
        await expect(
          InventoryService.getItemWithBatches(itemId, orgId),
        ).rejects.toThrow("not found");
      });
    });

    // --- Batch Operations (add, update, delete) ---
    describe("Batch Operations", () => {
      it("addBatch: should create batch and update item", async () => {
        const itemDoc = mockDoc({
          _id: itemId,
          organisationId: orgId,
          save: jest.fn(),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockResolvedValue(itemDoc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.create as any).mockResolvedValue({
          quantity: 10,
          allocated: 0,
        } as any);
        // recompute helper mock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([{ quantity: 10, allocated: 0 }]),
        );

        await InventoryService.addBatch(itemId, { quantity: 10 });

        expect(InventoryBatchModel.create).toHaveBeenCalled();
        expect(itemDoc.save).toHaveBeenCalled();
        expect(itemDoc.onHand).toBe(10);
      });

      it("addBatch: should throw if item not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockResolvedValue(null);
        await expect(
          InventoryService.addBatch(itemId, { quantity: 1 }),
        ).rejects.toThrow("not found");
      });

      it("updateBatch: should update batch and recompute item", async () => {
        const batchDoc = mockDoc({
          _id: batchId,
          itemId: new Types.ObjectId(itemId),
          quantity: 5,
          save: jest.fn(),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.findById as any).mockReturnValue(
          mockMongooseChain(batchDoc),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([{ quantity: 10 }]),
        ); // Mock sum
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findByIdAndUpdate as any).mockReturnValue(
          mockMongooseChain({}),
        );

        await InventoryService.updateBatch(batchId, { quantity: 10 });

        expect(batchDoc.quantity).toBe(10);
        expect(batchDoc.save).toHaveBeenCalled();
        expect(InventoryItemModel.findByIdAndUpdate).toHaveBeenCalled();
      });

      it("updateBatch: should throw if batch not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        await expect(InventoryService.updateBatch(batchId, {})).rejects.toThrow(
          "Batch not found",
        );
      });

      it("deleteBatch: should delete batch and recompute", async () => {
        const batchDoc = mockDoc({
          _id: batchId,
          itemId: new Types.ObjectId(itemId),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.findById as any).mockReturnValue(
          mockMongooseChain(batchDoc),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findByIdAndUpdate as any).mockReturnValue(
          mockMongooseChain({}),
        );

        await InventoryService.deleteBatch(batchId);

        expect(batchDoc.deleteOne).toHaveBeenCalled();
        expect(InventoryItemModel.findByIdAndUpdate).toHaveBeenCalled();
      });

      it("deleteBatch: should return if batch not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        const res = await InventoryService.deleteBatch(batchId);
        expect(res).toBeUndefined();
      });
    });

    // --- consumeStock ---
    describe("consumeStock", () => {
      it("should throw if qty <= 0", async () => {
        await expect(
          InventoryService.consumeStock({
            itemId,
            quantity: 0,
            reason: "OTHER",
          }),
        ).rejects.toThrow("quantity must be > 0");
      });

      it("should throw if item not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(null),
        );
        await expect(
          InventoryService.consumeStock({
            itemId,
            quantity: 1,
            reason: "OTHER",
          }),
        ).rejects.toThrow("not found");
      });

      it("should throw if insufficient stock", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain({ onHand: 5 }),
        );
        await expect(
          InventoryService.consumeStock({
            itemId,
            quantity: 10,
            reason: "OTHER",
          }),
        ).rejects.toThrow("Insufficient stock");
      });

      it("should consume stock FIFO", async () => {
        const itemDoc = mockDoc({ _id: itemId, onHand: 15, allocated: 0 });
        const b1 = mockDoc({ _id: "b1", quantity: 5, save: jest.fn() });
        const b2 = mockDoc({ _id: "b2", quantity: 10, save: jest.fn() });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValueOnce(
          mockMongooseChain([b1, b2]),
        ); // For consumption loop

        // For recompute
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([{ quantity: 7 }]),
        );

        await InventoryService.consumeStock({
          itemId,
          quantity: 8,
          reason: "OTHER",
        });

        // b1 (5) should be fully consumed (0), b2 (10) should lose 3 (7)
        expect(b1.quantity).toBe(0);
        expect(b1.save).toHaveBeenCalled();
        expect(b2.quantity).toBe(7);
        expect(b2.save).toHaveBeenCalled();
      });

      it("should throw 500 if consumption fails logic", async () => {
        const itemDoc = mockDoc({ _id: itemId, onHand: 100 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockReturnValue(
          mockMongooseChain(itemDoc),
        );
        // Return NO batches, causing remaining > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );

        await expect(
          InventoryService.consumeStock({
            itemId,
            quantity: 50,
            reason: "OTHER",
          }),
        ).rejects.toThrow("Failed to consume full requested quantity");
      });
    });
  });

  // ======================================================================
  // 2. InventoryAdjustmentService
  // ======================================================================
  describe("InventoryAdjustmentService", () => {
    describe("adjustStock", () => {
      it("should create batch for positive adjustment", async () => {
        const itemDoc = mockDoc({ _id: itemId, onHand: 10 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockResolvedValue(itemDoc as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.create as any).mockResolvedValue({} as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (StockMovementModel.create as any).mockResolvedValue({} as any);
        // recompute
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockResolvedValue([
          { quantity: 15, allocated: 0 },
        ] as any);

        // New onHand 15 (delta +5)
        await InventoryAdjustmentService.adjustStock({
          itemId,
          newOnHand: 15,
          reason: "Fix",
        });

        expect(InventoryBatchModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ quantity: 5 }),
        );
        expect(StockMovementModel.create).toHaveBeenCalled();
        expect(itemDoc.onHand).toBe(15);
      });

      it("should consume batches for negative adjustment", async () => {
        const itemDoc = mockDoc({ _id: itemId, onHand: 10 });
        const batch = mockDoc({ _id: "b1", quantity: 10, save: jest.fn() });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockResolvedValue(itemDoc as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([batch]),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (StockMovementModel.create as any).mockResolvedValue({} as any);

        // New onHand 5 (delta -5)
        await InventoryAdjustmentService.adjustStock({
          itemId,
          newOnHand: 5,
          reason: "Fix",
        });

        expect(batch.quantity).toBe(5);
        expect(batch.save).toHaveBeenCalled();
      });

      it("should throw if insufficient stock for negative adjustment", async () => {
        const itemDoc = mockDoc({ _id: itemId, onHand: 10 });
        // No batches returned to consume
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockResolvedValue(itemDoc as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryBatchModel.find as any).mockReturnValue(
          mockMongooseChain([]),
        );

        await expect(
          InventoryAdjustmentService.adjustStock({
            itemId,
            newOnHand: 5,
            reason: "Fix",
          }),
        ).rejects.toThrow("Insufficient stock for adjustment");
      });

      it("should throw if item not found", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (InventoryItemModel.findById as any).mockResolvedValue(null as any);
        await expect(
          InventoryAdjustmentService.adjustStock({
            itemId,
            newOnHand: 5,
            reason: "",
          }),
        ).rejects.toThrow("Item not found");
      });
    });
  });

  // ======================================================================
  // 3. InventoryAllocationService
  // ======================================================================
  describe("InventoryAllocationService", () => {
    it("allocateStock: should allocate if stock exists", async () => {
      const itemDoc = mockDoc({ _id: itemId, onHand: 10, allocated: 0 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryItemModel.findById as any).mockResolvedValue(itemDoc as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (StockMovementModel.create as any).mockResolvedValue({} as any);

      await InventoryAllocationService.allocateStock({
        itemId,
        quantity: 5,
        referenceId: "ref",
      });
      expect(itemDoc.allocated).toBe(5);
      expect(itemDoc.save).toHaveBeenCalled();
    });

    it("allocateStock: should throw if not enough free stock", async () => {
      const itemDoc = mockDoc({ _id: itemId, onHand: 10, allocated: 8 }); // Free = 2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryItemModel.findById as any).mockResolvedValue(itemDoc as any);

      await expect(
        InventoryAllocationService.allocateStock({
          itemId,
          quantity: 5,
          referenceId: "ref",
        }),
      ).rejects.toThrow("Not enough unallocated stock");
    });

    it("allocateStock: should throw if item not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryItemModel.findById as any).mockResolvedValue(null as any);
      await expect(
        InventoryAllocationService.allocateStock({
          itemId,
          quantity: 1,
          referenceId: "ref",
        }),
      ).rejects.toThrow("Item not found");
    });

    it("releaseAllocatedStock: should decrease allocated", async () => {
      const itemDoc = mockDoc({ _id: itemId, allocated: 5 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryItemModel.findById as any).mockResolvedValue(itemDoc as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (StockMovementModel.create as any).mockResolvedValue({} as any);

      await InventoryAllocationService.releaseAllocatedStock({
        itemId,
        quantity: 3,
        referenceId: "ref",
      });
      expect(itemDoc.allocated).toBe(2);
    });

    it("releaseAllocatedStock: should throw if item not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryItemModel.findById as any).mockResolvedValue(null as any);
      await expect(
        InventoryAllocationService.releaseAllocatedStock({
          itemId,
          quantity: 1,
          referenceId: "ref",
        }),
      ).rejects.toThrow("Item not found");
    });
  });

  // ======================================================================
  // 4. InventoryVendorService
  // ======================================================================
  describe("InventoryVendorService", () => {
    it("createVendor: success", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryVendorModel.create as any).mockResolvedValue({
        _id: "v1",
      } as any);
      const res = await InventoryVendorService.createVendor({
        organisationId: orgId,
        name: "V",
      });
      expect(res).toEqual({ _id: "v1" });
    });
    it("createVendor: missing orgId", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(
        InventoryVendorService.createVendor({ name: "V" } as any),
      ).rejects.toThrow("organisationId required");
    });

    it("updateVendor: success", async () => {
      const vendor = mockDoc({ name: "Old" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryVendorModel.findById as any).mockResolvedValue(vendor as any);
      await InventoryVendorService.updateVendor(validVendorId, { name: "New" });
      expect(vendor.name).toBe("New");
      expect(vendor.save).toHaveBeenCalled();
    });

    it("updateVendor: not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryVendorModel.findById as any).mockResolvedValue(null as any);
      await expect(
        InventoryVendorService.updateVendor(validVendorId, {}),
      ).rejects.toThrow("Vendor not found");
    });

    it("listVendors", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryVendorModel.find as any).mockReturnValue(mockMongooseChain([]));
      await InventoryVendorService.listVendors(orgId);
      expect(InventoryVendorModel.find).toHaveBeenCalledWith({
        organisationId: orgId,
      });
    });

    it("getVendor", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryVendorModel.findById as any).mockResolvedValue({} as any);
      await InventoryVendorService.getVendor(validVendorId);
      expect(InventoryVendorModel.findById).toHaveBeenCalled();
    });

    it("deleteVendor", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryVendorModel.findByIdAndDelete as any).mockResolvedValue(
        {} as any,
      );
      await InventoryVendorService.deleteVendor(validVendorId);
      expect(InventoryVendorModel.findByIdAndDelete).toHaveBeenCalled();
    });
  });

  // ======================================================================
  // 5. InventoryMetaFieldService
  // ======================================================================
  describe("InventoryMetaFieldService", () => {
    it("createField", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryMetaFieldModel.create as any).mockResolvedValue({} as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await InventoryMetaFieldService.createField({} as any);
      expect(InventoryMetaFieldModel.create).toHaveBeenCalled();
    });

    it("updateField: success", async () => {
      const field = mockDoc({ label: "Old" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryMetaFieldModel.findById as any).mockResolvedValue(field as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await InventoryMetaFieldService.updateField(
        new Types.ObjectId().toString(),
        { label: "New" } as any,
      );
      expect(field.label).toBe("New");
    });

    it("updateField: not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryMetaFieldModel.findById as any).mockResolvedValue(null as any);
      await expect(
        InventoryMetaFieldService.updateField(
          new Types.ObjectId().toString(),
          {},
        ),
      ).rejects.toThrow("not found");
    });

    it("deleteField", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryMetaFieldModel.findByIdAndDelete as any).mockResolvedValue(
        {} as any,
      );
      await InventoryMetaFieldService.deleteField(
        new Types.ObjectId().toString(),
      );
      expect(InventoryMetaFieldModel.findByIdAndDelete).toHaveBeenCalled();
    });

    it("listFields", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryMetaFieldModel.find as any).mockReturnValue(
        mockMongooseChain([]),
      );
      await InventoryMetaFieldService.listFields("GENERAL");
      expect(InventoryMetaFieldModel.find).toHaveBeenCalledWith({
        businessType: "GENERAL",
      });
    });
  });

  // ======================================================================
  // 6. InventoryAlertService
  // ======================================================================
  describe("InventoryAlertService", () => {
    it("getLowStockItems: filters correctly", async () => {
      const i1 = { reorderLevel: 10, onHand: 5 }; // Low
      const i2 = { reorderLevel: 5, onHand: 10 }; // OK
      const i3 = { reorderLevel: null, onHand: 0 }; // No level

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryItemModel.find as any).mockResolvedValue([i1, i2, i3] as any);

      const res = await InventoryAlertService.getLowStockItems(orgId);
      expect(res).toHaveLength(1);
      expect(res[0]).toBe(i1);
    });

    it("getExpiringItems: queries batches", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (InventoryBatchModel.find as any).mockResolvedValue([] as any);
      await InventoryAlertService.getExpiringItems(orgId, 7);
      expect(InventoryBatchModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: orgId,
          expiryDate: { $lte: expect.any(Date) },
        }),
      );
    });
  });

  // ======================================================================
  // Utils (ensureObjectId)
  // ======================================================================
  describe("Utils", () => {
    it("ensureObjectId throws on invalid", async () => {
      await expect(InventoryService.updateItem("bad-id", {})).rejects.toThrow(
        "Invalid itemId",
      );
    });
  });
});
