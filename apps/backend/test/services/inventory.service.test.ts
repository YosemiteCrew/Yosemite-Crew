import { Types } from 'mongoose';
import {
  InventoryService,
  InventoryAdjustmentService,
  InventoryAllocationService,
  InventoryVendorService,
  InventoryMetaFieldService,
  InventoryAlertService,
} from '../../src/services/inventory.service';

import {
  InventoryItemModel,
  InventoryBatchModel,
  InventoryVendorModel,
  InventoryMetaFieldModel,
  StockMovementModel,
} from '../../src/models/inventory';

// --- Mocks ---
jest.mock('../../src/models/inventory');

// Helper to mock Mongoose chainable queries
const mockChain = (result: any) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
  exec: jest.fn().mockResolvedValue(result),
});

// Stable Constants
const VALID_ID_STR = '507f1f77bcf86cd799439011';
const VALID_ID_OBJ = new Types.ObjectId(VALID_ID_STR);
const VALID_ORG_ID = '507f1f77bcf86cd799439099';

/**
 * Robust Mock Document Generator
 */
const mockDoc = (data: any = {}) => {
  const _id = data._id
    ? (data._id instanceof Types.ObjectId ? data._id : new Types.ObjectId(data._id))
    : new Types.ObjectId();

  return {
    ...data,
    _id,
    id: _id.toString(),
    save: jest.fn().mockImplementation(function (this: any) { return Promise.resolve(this); }),
    toObject: jest.fn().mockImplementation(function (this: any) {
      const { save, toObject, deleteOne, ...pojo } = this;
      return { ...pojo, _id };
    }),
    deleteOne: jest.fn().mockResolvedValue(true),
  };
};

describe('Inventory Services', () => {
  // Removed global fake timers to prevent timeouts in other tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // 1. InventoryService
  // ─────────────────────────────────────────────
  describe('InventoryService', () => {

    describe('createItem', () => {
      it('should throw if required fields missing', async () => {
        await expect(InventoryService.createItem({} as any))
          .rejects.toThrow('organisationId is required');
        await expect(InventoryService.createItem({ organisationId: '1' } as any))
          .rejects.toThrow('name is required');
        await expect(InventoryService.createItem({ organisationId: '1', name: 'N' } as any))
          .rejects.toThrow('category is required');
      });
    });

    describe('updateItem', () => {
      it('should throw if item not found', async () => {
        (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(null));
        await expect(InventoryService.updateItem(VALID_ID_STR, {})).rejects.toThrow('Inventory item not found');
      });

      it('should update fields', async () => {
        const itemDoc = mockDoc({ _id: VALID_ID_OBJ });
        (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(itemDoc));
        (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));

        await InventoryService.updateItem(VALID_ID_STR, {
          name: 'New Name',
          unitCost: 10,
          status: 'HIDDEN'
        });

        expect(itemDoc.name).toBe('New Name');
        expect(itemDoc.unitCost).toBe(10);
        expect(itemDoc.status).toBe('HIDDEN');
        expect(itemDoc.save).toHaveBeenCalled();
      });
    });

    describe('State Changes', () => {
      it('should hide item', async () => {
        const item = mockDoc({});
        (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));
        await InventoryService.hideItem(VALID_ID_STR);
        expect(item.status).toBe('HIDDEN');
      });

      it('should archive item', async () => {
        const item = mockDoc({});
        (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));
        await InventoryService.archiveItem(VALID_ID_STR);
        expect(item.status).toBe('DELETED');
      });

      it('should activate item', async () => {
        const item = mockDoc({});
        (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));
        await InventoryService.activeItem(VALID_ID_STR);
        expect(item.status).toBe('ACTIVE');
      });

      it('should throw if item not found during state change', async () => {
        (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(null));
        await expect(InventoryService.hideItem(VALID_ID_STR)).rejects.toThrow('Inventory item not found');
      });
    });

    describe('listItems', () => {
      it('should filter by stockHealth (lowStockOnly)', async () => {
        const item = mockDoc({ onHand: 10, reorderLevel: 5 }); // HEALTHY
        (InventoryItemModel.find as jest.Mock).mockReturnValue(mockChain([item]));
        (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));

        const res = await InventoryService.listItems({ organisationId: VALID_ORG_ID, lowStockOnly: true });
        expect(res).toHaveLength(0);
      });

      it('should filter by stockHealth (expiredOnly)', async () => {
        const item = mockDoc({});
        (InventoryItemModel.find as jest.Mock).mockReturnValue(mockChain([item]));
        (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));

        const res = await InventoryService.listItems({ organisationId: VALID_ORG_ID, expiredOnly: true });
        expect(res).toHaveLength(0);
      });

      it('should filter by stockHealth (expiringWithinDays)', async () => {
        const item = mockDoc({});
        (InventoryItemModel.find as jest.Mock).mockReturnValue(mockChain([item]));
        (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));

        const res = await InventoryService.listItems({ organisationId: VALID_ORG_ID, expiringWithinDays: 7 });
        expect(res).toHaveLength(0);
      });
    });

    describe('getItemWithBatches', () => {
        it('should return item and batches', async () => {
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(mockDoc({ name: 'I' })));
            (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));
            const res = await InventoryService.getItemWithBatches(VALID_ID_STR, VALID_ORG_ID);
            expect(res.item).toBeDefined();
        });

        it('should throw if not found', async () => {
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(null));
            await expect(InventoryService.getItemWithBatches(VALID_ID_STR, VALID_ORG_ID)).rejects.toThrow('not found');
        });
    });

    describe('Batch Operations', () => {
        it('should add batch and recompute item stock', async () => {
            const item = mockDoc({ _id: VALID_ID_OBJ, onHand: 0 });
            (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);
            (InventoryBatchModel.create as jest.Mock).mockResolvedValue({});

            (InventoryBatchModel.find as jest.Mock)
                .mockReturnValue(mockChain([
                    mockDoc({ quantity: 10, allocated: 5 })
                ]));

            await InventoryService.addBatch(VALID_ID_STR, { quantity: 10 });

            expect(item.onHand).toBe(10);
            expect(item.allocated).toBe(5);
            expect(item.save).toHaveBeenCalled();
        });

        it('should throw if adding batch to missing item', async () => {
            (InventoryItemModel.findById as jest.Mock).mockResolvedValue(null);
            await expect(InventoryService.addBatch(VALID_ID_STR, { quantity: 1 })).rejects.toThrow('not found');
        });

        it('should update batch and recompute', async () => {
            const batch = mockDoc({ itemId: VALID_ID_OBJ });
            (InventoryBatchModel.findById as jest.Mock).mockReturnValue(mockChain(batch));
            (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([{ quantity: 20 }]));
            (InventoryItemModel.findByIdAndUpdate as jest.Mock).mockReturnValue(mockChain({}));

            await InventoryService.updateBatch(VALID_ID_STR, { quantity: 20 });

            expect(batch.quantity).toBe(20);
            expect(batch.save).toHaveBeenCalled();
            expect(InventoryItemModel.findByIdAndUpdate).toHaveBeenCalledWith(VALID_ID_OBJ, { onHand: 20, allocated: 0 });
        });

        it('should throw if updating missing batch', async () => {
            (InventoryBatchModel.findById as jest.Mock).mockReturnValue(mockChain(null));
            await expect(InventoryService.updateBatch(VALID_ID_STR, {})).rejects.toThrow('Batch not found');
        });

        it('should delete batch and recompute', async () => {
            const batch = mockDoc({ itemId: VALID_ID_OBJ });
            (InventoryBatchModel.findById as jest.Mock).mockReturnValue(mockChain(batch));
            (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));
            (InventoryItemModel.findByIdAndUpdate as jest.Mock).mockReturnValue(mockChain({}));

            await InventoryService.deleteBatch(VALID_ID_STR);

            expect(batch.deleteOne).toHaveBeenCalled();
            expect(InventoryItemModel.findByIdAndUpdate).toHaveBeenCalledWith(VALID_ID_STR, { onHand: 0, allocated: 0 });
        });

        it('should do nothing if deleting missing batch', async () => {
            (InventoryBatchModel.findById as jest.Mock).mockReturnValue(mockChain(null));
            await InventoryService.deleteBatch(VALID_ID_STR);
            expect(InventoryItemModel.findByIdAndUpdate).not.toHaveBeenCalled();
        });
    });

    describe('consumeStock', () => {
        it('should consume strictly from batches (FIFO) and update item', async () => {
            const item = mockDoc({ _id: VALID_ID_OBJ, onHand: 10 });
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));

            const b1 = mockDoc({ _id: '507f1f77bcf86cd799439022', quantity: 3, save: jest.fn() });
            const b2 = mockDoc({ _id: '507f1f77bcf86cd799439023', quantity: 5, save: jest.fn() });

            (InventoryBatchModel.find as jest.Mock)
                .mockReturnValueOnce(mockChain([b1, b2])) // consume loop
                .mockReturnValueOnce(mockChain([{ quantity: 3 }])); // recompute

            await InventoryService.consumeStock({ itemId: VALID_ID_STR, quantity: 5, reason: 'OTHER' });

            expect(b1.quantity).toBe(0);
            expect(b2.quantity).toBe(3);
            expect(b1.save).toHaveBeenCalled();
            expect(b2.save).toHaveBeenCalled();
            expect(item.save).toHaveBeenCalled();
        });

        it('should skip empty batches', async () => {
            const item = mockDoc({ _id: VALID_ID_OBJ, onHand: 5 });
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));

            const b1 = mockDoc({ quantity: 0 });
            const b2 = mockDoc({ quantity: 5 });
            (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(mockChain([b1, b2]));
            (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(mockChain([]));

            await InventoryService.consumeStock({ itemId: VALID_ID_STR, quantity: 1, reason: 'OTHER' });

            expect(b1.save).not.toHaveBeenCalled();
            expect(b2.quantity).toBe(4);
        });

        it('should throw if quantity <= 0', async () => {
            await expect(InventoryService.consumeStock({ itemId: VALID_ID_STR, quantity: 0, reason: 'OTHER' }))
                .rejects.toThrow('quantity must be > 0');
        });

        it('should throw if item not found', async () => {
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(null));
            await expect(InventoryService.consumeStock({ itemId: VALID_ID_STR, quantity: 1, reason: 'OTHER' }))
                .rejects.toThrow('Inventory item not found');
        });

        it('should throw if insufficient total stock', async () => {
            const item = mockDoc({ onHand: 5 });
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));
            await expect(InventoryService.consumeStock({ itemId: VALID_ID_STR, quantity: 10, reason: 'OTHER' }))
                .rejects.toThrow('Insufficient stock');
        });

        it('should throw safely if batches exhausted before quantity met', async () => {
            const item = mockDoc({ onHand: 10 });
            (InventoryItemModel.findById as jest.Mock).mockReturnValue(mockChain(item));

            const b1 = mockDoc({ quantity: 2 });
            (InventoryBatchModel.find as jest.Mock).mockReturnValueOnce(mockChain([b1]));

            await expect(InventoryService.consumeStock({ itemId: VALID_ID_STR, quantity: 5, reason: 'OTHER' }))
                .rejects.toThrow('Failed to consume full requested quantity');
        });
    });

    describe('getInventoryTurnoverByItem', () => {
        it('should return empty array if no items', async () => {
            (InventoryItemModel.find as jest.Mock).mockReturnValue(mockChain([]));
            const res = await InventoryService.getInventoryTurnoverByItem({ organisationId: VALID_ORG_ID });
            expect(res).toHaveLength(0);
        });
    });
  });

  // ─────────────────────────────────────────────
  // 2. InventoryAdjustmentService
  // ─────────────────────────────────────────────
  describe('InventoryAdjustmentService', () => {
    it('should handle positive adjustment', async () => {
        const item = mockDoc({ _id: VALID_ID_OBJ, onHand: 10 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);
        (InventoryBatchModel.create as jest.Mock).mockResolvedValue({});
        (InventoryBatchModel.find as jest.Mock).mockResolvedValue([{ quantity: 15, allocated: 0 }]);

        await InventoryAdjustmentService.adjustStock({
            itemId: VALID_ID_STR, newOnHand: 15, reason: 'Fix'
        });

        expect(InventoryBatchModel.create).toHaveBeenCalledWith(expect.objectContaining({ quantity: 5 }));
        expect(StockMovementModel.create).toHaveBeenCalledWith(expect.objectContaining({ change: 5 }));
        expect(item.onHand).toBe(15);
    });

    it('should handle negative adjustment', async () => {
        const item = mockDoc({ _id: VALID_ID_OBJ, onHand: 10 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);

        const b1 = mockDoc({ quantity: 10, save: jest.fn() });
        (InventoryBatchModel.find as jest.Mock)
            .mockReturnValueOnce(mockChain([b1]))
            .mockReturnValueOnce([{ quantity: 5 }]);

        await InventoryAdjustmentService.adjustStock({
            itemId: VALID_ID_STR, newOnHand: 5, reason: 'Fix'
        });

        expect(b1.quantity).toBe(5);
        expect(StockMovementModel.create).toHaveBeenCalledWith(expect.objectContaining({ change: -5 }));
        expect(item.onHand).toBe(5);
    });

    it('should throw if insufficient stock for negative adjustment', async () => {
        const item = mockDoc({ onHand: 10 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);
        (InventoryBatchModel.find as jest.Mock).mockReturnValue(mockChain([]));

        await expect(InventoryAdjustmentService.adjustStock({
            itemId: VALID_ID_STR, newOnHand: 5, reason: 'Fix'
        })).rejects.toThrow('Insufficient stock');
    });

    it('should throw if item not found', async () => {
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(InventoryAdjustmentService.adjustStock({ itemId: VALID_ID_STR, newOnHand: 5, reason: 'R' }))
            .rejects.toThrow('Item not found');
    });
  });

  // ─────────────────────────────────────────────
  // 3. InventoryAllocationService
  // ─────────────────────────────────────────────
  describe('InventoryAllocationService', () => {
    it('should allocate stock', async () => {
        const item = mockDoc({ onHand: 10, allocated: 2 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);

        await InventoryAllocationService.allocateStock({ itemId: VALID_ID_STR, quantity: 5, referenceId: 'ref' });

        expect(item.allocated).toBe(7);
        expect(item.save).toHaveBeenCalled();
        expect(StockMovementModel.create).toHaveBeenCalled();
    });

    it('should throw if not enough unallocated stock', async () => {
        const item = mockDoc({ onHand: 10, allocated: 8 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);
        await expect(InventoryAllocationService.allocateStock({ itemId: VALID_ID_STR, quantity: 3, referenceId: 'ref' }))
            .rejects.toThrow('Not enough unallocated stock');
    });

    it('should throw if item not found during allocation', async () => {
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(InventoryAllocationService.allocateStock({ itemId: VALID_ID_STR, quantity: 1, referenceId: 'r' }))
            .rejects.toThrow('Item not found');
    });

    it('should release allocated stock', async () => {
        const item = mockDoc({ allocated: 5 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);

        await InventoryAllocationService.releaseAllocatedStock({ itemId: VALID_ID_STR, quantity: 2, referenceId: 'ref' });

        expect(item.allocated).toBe(3);
        expect(item.save).toHaveBeenCalled();
    });

    it('should release stock but not go below zero', async () => {
        const item = mockDoc({ allocated: 2 });
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(item);

        await InventoryAllocationService.releaseAllocatedStock({ itemId: VALID_ID_STR, quantity: 5, referenceId: 'ref' });

        expect(item.allocated).toBe(0);
    });

    it('should throw if item not found during release', async () => {
        (InventoryItemModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(InventoryAllocationService.releaseAllocatedStock({ itemId: VALID_ID_STR, quantity: 1, referenceId: 'r' }))
            .rejects.toThrow('Item not found');
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
      await InventoryMetaFieldService.createField({
        businessType: "GENERAL",
        fieldKey: "color",
        label: "Color",
        values: ["Black", "White"],
      } as any);
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

  describe('InventoryMetaFieldService', () => {
    it('should create field', async () => {
        await InventoryMetaFieldService.createField({} as any);
        expect(InventoryMetaFieldModel.create).toHaveBeenCalled();
    });

    it('should update field', async () => {
        const f = mockDoc({});
        (InventoryMetaFieldModel.findById as jest.Mock).mockResolvedValue(f);
        await InventoryMetaFieldService.updateField(VALID_ID_STR, { label: 'L' });
        expect(f.label).toBe('L');
    });

    it('should throw if field missing', async () => {
        (InventoryMetaFieldModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(InventoryMetaFieldService.updateField(VALID_ID_STR, {})).rejects.toThrow('Meta field not found');
    });

    it('should delete field', async () => {
        await InventoryMetaFieldService.deleteField(VALID_ID_STR);
        expect(InventoryMetaFieldModel.findByIdAndDelete).toHaveBeenCalled();
    });

    it('should list fields', async () => {
        (InventoryMetaFieldModel.find as jest.Mock).mockReturnValue(mockChain([]));
        await InventoryMetaFieldService.listFields('type');
        expect(InventoryMetaFieldModel.find).toHaveBeenCalled();
    });
  });

  describe('InventoryAlertService', () => {
    // FIX: Define mockDate here to ensure it's available in this scope
    const mockDate = new Date('2025-01-01T12:00:00Z');

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should get low stock items', async () => {
        const i1 = { onHand: 2, reorderLevel: 5 }; // Low
        const i2 = { onHand: 10, reorderLevel: 5 }; // Ok
        const i3 = { onHand: 5 }; // No reorder level -> skip

        (InventoryItemModel.find as jest.Mock).mockResolvedValue([i1, i2, i3]);

        const res = await InventoryAlertService.getLowStockItems(VALID_ORG_ID);
        expect(res).toHaveLength(1);
        expect(res[0]).toBe(i1);
    });

    it('should get expiring items', async () => {
        (InventoryBatchModel.find as jest.Mock).mockResolvedValue([]);
        await InventoryAlertService.getExpiringItems(VALID_ORG_ID, 7);
        expect(InventoryBatchModel.find).toHaveBeenCalledWith(expect.objectContaining({
            expiryDate: { $lte: expect.any(Date) }
        }));
    });
  });
});