import { Types } from "mongoose";
import {
  InventoryItemModel,
  InventoryBatchModel,
} from "../../src/models/inventory";
import {
  InventoryService,
  InventoryServiceError,
} from "../../src/services/inventory.service";

jest.mock("../../src/models/inventory", () => ({
  __esModule: true,
  InventoryItemModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  InventoryBatchModel: {
    insertMany: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
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
  },
}));

const mockedItemModel = InventoryItemModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
  findByIdAndUpdate: jest.Mock;
};

const mockedBatchModel = InventoryBatchModel as unknown as {
  insertMany: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
};

describe("InventoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createItem", () => {
    it("requires organisationId", async () => {
      await expect(
        InventoryService.createItem({
          organisationId: "",
          businessType: "HOSPITAL",
          name: "Bandage",
          category: "Supplies",
        }),
      ).rejects.toBeInstanceOf(InventoryServiceError);
      expect(mockedItemModel.create).not.toHaveBeenCalled();
    });

    it("inserts batches and recomputes stock", async () => {
      const save = jest.fn();
      const itemId = new Types.ObjectId("66cc1b4d2f9f87222f3a1234");
      mockedItemModel.create.mockResolvedValueOnce({
        _id: itemId,
        organisationId: "org-1",
        onHand: 0,
        allocated: 0,
        save,
      });

      mockedBatchModel.insertMany.mockResolvedValueOnce(undefined);
      // First call: recomputeStockFromBatches (uses .find().lean())
      mockedBatchModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([
          { quantity: 4, allocated: 1 },
          { quantity: 3, allocated: 0 },
        ]),
      });
      // Second call: fetch batches for return (uses .find().sort().exec())
      mockedBatchModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await InventoryService.createItem({
        organisationId: "org-1",
        businessType: "HOSPITAL",
        name: "Bandage",
        category: "Supplies",
        batches: [{ quantity: 4, allocated: 1 }, { quantity: 3 }],
      });

      expect(mockedItemModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          name: "Bandage",
          category: "Supplies",
        }),
      );
      expect(mockedBatchModel.insertMany).toHaveBeenCalledWith([
        expect.objectContaining({
          itemId: itemId.toString(),
          quantity: 4,
          allocated: 1,
        }),
        expect.objectContaining({
          itemId: itemId.toString(),
          quantity: 3,
          allocated: 0,
        }),
      ]);
      expect(mockedBatchModel.find).toHaveBeenCalledWith({
        itemId: itemId.toString(),
      });
      expect(save).toHaveBeenCalled();
      expect(result.item.onHand).toBe(7);
      expect(result.item.allocated).toBe(1);
    });
  });

  describe("listItems", () => {
    it("computes stock health and applies low stock filter", async () => {
      const lowStockId = new Types.ObjectId("66cc1b4d2f9f87222f3a0001");
      const healthyId = new Types.ObjectId("66cc1b4d2f9f87222f3a0002");

      const lowStockItem = {
        _id: lowStockId,
        organisationId: "org-1",
        onHand: 2,
        reorderLevel: 5,
        status: "ACTIVE",
        toObject: jest.fn().mockReturnValue({
          _id: lowStockId,
          organisationId: "org-1",
          onHand: 2,
          reorderLevel: 5,
          status: "ACTIVE",
        }),
      };

      const healthyItem = {
        _id: healthyId,
        organisationId: "org-1",
        onHand: 10,
        reorderLevel: 5,
        status: "ACTIVE",
        toObject: jest.fn().mockReturnValue({
          _id: healthyId,
          organisationId: "org-1",
          onHand: 10,
          reorderLevel: 5,
          status: "ACTIVE",
        }),
      };

      mockedItemModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([lowStockItem, healthyItem]),
        }),
      });
      mockedBatchModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await InventoryService.listItems({
        organisationId: "org-1",
        lowStockOnly: true,
      });

      expect(mockedItemModel.find).toHaveBeenCalledWith({
        organisationId: "org-1",
        status: { $ne: "DELETED" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]._id).toEqual(lowStockId);
      expect(result[0].stockHealth).toBe("LOW_STOCK");
    });
  });

  describe("consumeStock", () => {
    it("throws when stock is insufficient", async () => {
      const itemId = new Types.ObjectId().toString();
      mockedItemModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: itemId,
          onHand: 1,
          allocated: 0,
        }),
      });

      await expect(
        InventoryService.consumeStock({
          itemId,
          quantity: 3,
          reason: "OTHER",
        }),
      ).rejects.toThrow("Insufficient stock");
      expect(mockedBatchModel.find).not.toHaveBeenCalled();
    });
  });
});
