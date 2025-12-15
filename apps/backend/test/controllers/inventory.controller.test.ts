import { InventoryController } from "../../src/controllers/web/inventory.controller";
import {
  InventoryService,
  InventoryServiceError,
  InventoryAdjustmentService,
  InventoryAllocationService,
} from "../../src/services/inventory.service";

jest.mock("../../src/services/inventory.service", () => {
  const actual = jest.requireActual("../../src/services/inventory.service");
  return {
    ...actual,
    InventoryService: {
      createItem: jest.fn(),
      updateItem: jest.fn(),
      hideItem: jest.fn(),
      archiveItem: jest.fn(),
      listItems: jest.fn(),
      getItemWithBatches: jest.fn(),
      addBatch: jest.fn(),
      updateBatch: jest.fn(),
      deleteBatch: jest.fn(),
      consumeStock: jest.fn(),
    },
    InventoryAdjustmentService: {
      adjustStock: jest.fn(),
    },
    InventoryAllocationService: {
      allocateStock: jest.fn(),
      releaseAllocatedStock: jest.fn(),
    },
    InventoryVendorService: {
      createVendor: jest.fn(),
      updateVendor: jest.fn(),
      listVendors: jest.fn(),
      getVendor: jest.fn(),
      deleteVendor: jest.fn(),
    },
    InventoryMetaFieldService: {
      createField: jest.fn(),
      updateField: jest.fn(),
      deleteField: jest.fn(),
      listFields: jest.fn(),
    },
    InventoryAlertService: {
      getLowStockItems: jest.fn(),
      getExpiringItems: jest.fn(),
    },
  };
});

const mockedInventoryService = InventoryService as unknown as Record<
  string,
  jest.Mock
>;

const mockedAdjustmentService = InventoryAdjustmentService as unknown as {
  adjustStock: jest.Mock;
};

const mockedAllocationService = InventoryAllocationService as unknown as {
  allocateStock: jest.Mock;
  releaseAllocatedStock: jest.Mock;
};

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe("InventoryController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an inventory item", async () => {
    const res = mockResponse();
    const req = {
      body: { organisationId: "org-1", name: "Bandage", category: "Supplies" },
    } as any;
    mockedInventoryService.createItem.mockResolvedValueOnce({ id: "item-1" });

    await InventoryController.createItem(req, res as any);

    expect(mockedInventoryService.createItem).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "item-1" });
  });

  it("handles service error when creating item", async () => {
    const res = mockResponse();
    const req = { body: {} } as any;
    mockedInventoryService.createItem.mockRejectedValueOnce(
      new InventoryServiceError("bad", 422),
    );

    await InventoryController.createItem(req, res as any);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ message: "bad" });
  });

  it("parses list filters", async () => {
    const res = mockResponse();
    const req = {
      params: { organisationId: "org-9" },
      query: {
        businessType: "HOSPITAL",
        status: "ACTIVE,HIDDEN",
        lowStockOnly: "true",
        expiredOnly: "false",
        expiringWithinDays: "10",
        search: "band",
      },
    } as any;

    mockedInventoryService.listItems.mockResolvedValueOnce([]);

    await InventoryController.listItems(req, res as any);

    expect(mockedInventoryService.listItems).toHaveBeenCalledWith({
      organisationId: "org-9",
      businessType: "HOSPITAL",
      category: undefined,
      subCategory: undefined,
      search: "band",
      status: ["ACTIVE", "HIDDEN"],
      lowStockOnly: true,
      expiredOnly: false,
      expiringWithinDays: 10,
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("adjusts stock with user id from header", async () => {
    const res = mockResponse();
    const req = {
      params: { itemId: "item-1" },
      body: { newOnHand: 5, reason: "MANUAL_ADJUSTMENT" },
      headers: { "x-user-id": "user-123" },
      userId: "fallback-user",
    } as any;

    mockedAdjustmentService.adjustStock.mockResolvedValueOnce({ id: "item-1" });

    await InventoryController.adjustStock(req, res as any);

    expect(mockedAdjustmentService.adjustStock).toHaveBeenCalledWith({
      itemId: "item-1",
      newOnHand: 5,
      reason: "MANUAL_ADJUSTMENT",
      userId: "user-123",
    });
    expect(res.json).toHaveBeenCalledWith({ id: "item-1" });
  });

  it("allocates and releases stock", async () => {
    const res = mockResponse();
    const allocateReq = {
      params: { itemId: "item-10" },
      body: { quantity: 2, referenceId: "ref-1" },
    } as any;
    const releaseReq = {
      params: { itemId: "item-10" },
      body: { quantity: 1, referenceId: "ref-1" },
    } as any;

    mockedAllocationService.allocateStock.mockResolvedValueOnce({
      id: "item-10",
    });
    mockedAllocationService.releaseAllocatedStock.mockResolvedValueOnce({
      id: "item-10",
    });

    await InventoryController.allocateStock(allocateReq, res as any);
    await InventoryController.releaseAllocatedStock(releaseReq, res as any);

    expect(mockedAllocationService.allocateStock).toHaveBeenCalledWith({
      itemId: "item-10",
      quantity: 2,
      referenceId: "ref-1",
    });
    expect(mockedAllocationService.releaseAllocatedStock).toHaveBeenCalledWith({
      itemId: "item-10",
      quantity: 1,
      referenceId: "ref-1",
    });
    expect(res.json).toHaveBeenCalledTimes(2);
  });
});
