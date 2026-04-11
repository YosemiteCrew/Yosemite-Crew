// test/controllers/inventory.controller.test.ts
import { Request, Response } from "express";
import {
  InventoryController,
  InventoryVendorController,
  InventoryMetaFieldController,
  InventoryAlertController,
} from "../../src/controllers/web/inventory.controller";
import {
  InventoryService,
  InventoryAdjustmentService,
  InventoryAllocationService,
  InventoryVendorService,
  InventoryMetaFieldService,
  InventoryAlertService,
  InventoryServiceError,
} from "../../src/services/inventory.service";

// --- MOCKS ---
jest.mock("../../src/services/inventory.service", () => {
  // Provide the actual class for instanceof checks in handleError
  class MockInventoryServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
      this.name = "InventoryServiceError";
    }
  }

  return {
    InventoryService: {
      createItem: jest.fn(),
      updateItem: jest.fn(),
      hideItem: jest.fn(),
      activeItem: jest.fn(),
      archiveItem: jest.fn(),
      listItems: jest.fn(),
      getItemWithBatches: jest.fn(),
      addBatch: jest.fn(),
      updateBatch: jest.fn(),
      deleteBatch: jest.fn(),
      consumeStock: jest.fn(),
      bulkConsumeStock: jest.fn(),
      getInventoryTurnoverByItem: jest.fn(),
    },
    InventoryAdjustmentService: { adjustStock: jest.fn() },
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
    InventoryServiceError: MockInventoryServiceError,
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// --- HELPERS ---
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockRequest = (overrides: Partial<Request> = {}) => {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
};

describe("Inventory Controllers", () => {
  let req: Request;
  let res: Response;

  beforeAll(() => {
    // Silence console.error from the internal handleError function
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Shared Error Handler (`handleError`) Testing", () => {
    it("should handle custom InventoryServiceError", async () => {
      req = mockRequest();
      (InventoryService.createItem as jest.Mock).mockRejectedValueOnce(
        new InventoryServiceError("Custom Bad Request", 400),
      );

      await InventoryController.createItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Custom Bad Request" });
    });

    it("should handle standard Error object", async () => {
      req = mockRequest();
      (InventoryService.createItem as jest.Mock).mockRejectedValueOnce(
        new Error("Standard Failure"),
      );

      await InventoryController.createItem(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Standard Failure" });
    });

    it("should handle unknown string error", async () => {
      req = mockRequest();
      (InventoryService.createItem as jest.Mock).mockRejectedValueOnce(
        "String Error",
      );

      await InventoryController.createItem(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    });
  });

  describe("InventoryController", () => {
    describe("createItem", () => {
      it("should create item successfully", async () => {
        req = mockRequest({ body: { name: "Test" } });
        (InventoryService.createItem as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryController.createItem(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
    });

    describe("updateItem", () => {
      it("should update item successfully", async () => {
        req = mockRequest({ params: { itemId: "1" }, body: { name: "Up" } });
        (InventoryService.updateItem as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryController.updateItem(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.updateItem as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.updateItem(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("hideItem", () => {
      it("should hide item successfully", async () => {
        req = mockRequest({ params: { itemId: "1" } });
        (InventoryService.hideItem as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryController.hideItem(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.hideItem as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.hideItem(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("activeItem", () => {
      it("should activate item successfully", async () => {
        req = mockRequest({ params: { itemId: "1" } });
        (InventoryService.activeItem as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryController.activeItem(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.activeItem as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.activeItem(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("archiveItem", () => {
      it("should archive item successfully", async () => {
        req = mockRequest({ params: { itemId: "1" } });
        (InventoryService.archiveItem as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryController.archiveItem(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.archiveItem as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.archiveItem(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("listItems", () => {
      it("parses single status and calls listItems", async () => {
        req = mockRequest({
          params: { organisationId: "org1" },
          query: { status: "ACTIVE" },
        });
        await InventoryController.listItems(req as any, res);
        expect(InventoryService.listItems).toHaveBeenCalledWith(
          expect.objectContaining({ status: "ACTIVE" }),
        );
      });

      it("parses multiple comma-separated statuses", async () => {
        req = mockRequest({
          params: { organisationId: "org1" },
          query: { status: "ACTIVE, LOW_STOCK" },
        });
        await InventoryController.listItems(req as any, res);
        expect(InventoryService.listItems).toHaveBeenCalledWith(
          expect.objectContaining({ status: ["ACTIVE", "LOW_STOCK"] }),
        );
      });

      it("parses booleans and numbers correctly", async () => {
        req = mockRequest({
          params: { organisationId: "org1" },
          query: {
            lowStockOnly: "true",
            expiredOnly: "true",
            expiringWithinDays: "30",
          },
        });
        await InventoryController.listItems(req as any, res);
        expect(InventoryService.listItems).toHaveBeenCalledWith(
          expect.objectContaining({
            lowStockOnly: true,
            expiredOnly: true,
            expiringWithinDays: 30,
          }),
        );
      });

      it("handles completely empty query params safely", async () => {
        req = mockRequest({ params: { organisationId: "org1" }, query: {} });
        await InventoryController.listItems(req as any, res);
        expect(InventoryService.listItems).toHaveBeenCalledWith(
          expect.objectContaining({ organisationId: "org1" }),
        );
      });

      it("catches errors", async () => {
        req = mockRequest({ params: { organisationId: "org1" }, query: {} });
        (InventoryService.listItems as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.listItems(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("getItemWithBatches", () => {
      it("fetches item details", async () => {
        req = mockRequest({ params: { itemId: "1", organisationId: "org1" } });
        (
          InventoryService.getItemWithBatches as jest.Mock
        ).mockResolvedValueOnce({ id: "1" });
        await InventoryController.getItemWithBatches(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (
          InventoryService.getItemWithBatches as jest.Mock
        ).mockRejectedValueOnce(new Error("Err"));
        await InventoryController.getItemWithBatches(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("addBatch", () => {
      it("adds batch", async () => {
        req = mockRequest({ params: { itemId: "1" }, body: { q: 10 } });
        (InventoryService.addBatch as jest.Mock).mockResolvedValueOnce({
          id: "b1",
        });
        await InventoryController.addBatch(req as any, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "b1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.addBatch as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.addBatch(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("updateBatch", () => {
      it("updates batch", async () => {
        req = mockRequest({ params: { batchId: "b1" }, body: { q: 5 } });
        (InventoryService.updateBatch as jest.Mock).mockResolvedValueOnce({
          id: "b1",
        });
        await InventoryController.updateBatch(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "b1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.updateBatch as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.updateBatch(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("deleteBatch", () => {
      it("deletes batch", async () => {
        req = mockRequest({ params: { batchId: "b1" } });
        await InventoryController.deleteBatch(req as any, res);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.deleteBatch as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.deleteBatch(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("consumeStock", () => {
      it("consumes stock", async () => {
        req = mockRequest({ body: { itemId: "1", quantity: 2 } });
        (InventoryService.consumeStock as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryController.consumeStock(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.consumeStock as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.consumeStock(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("bulkConsumeStock", () => {
      it("consumes in bulk", async () => {
        req = mockRequest({ body: { items: [] } });
        (InventoryService.bulkConsumeStock as jest.Mock).mockResolvedValueOnce([
          { id: "1" },
        ]);
        await InventoryController.bulkConsumeStock(req as any, res);
        expect(res.json).toHaveBeenCalledWith([{ id: "1" }]);
      });
      it("catches errors", async () => {
        req = mockRequest();
        (InventoryService.bulkConsumeStock as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryController.bulkConsumeStock(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("adjustStock & User Resolution", () => {
      it("resolves user from x-user-id string header", async () => {
        req = mockRequest({
          params: { itemId: "1" },
          body: { newOnHand: 10, reason: "Audit" },
          headers: { "x-user-id": "headerUser123" },
        });
        await InventoryController.adjustStock(req as any, res);
        expect(InventoryAdjustmentService.adjustStock).toHaveBeenCalledWith(
          expect.objectContaining({ userId: "headerUser123" }),
        );
      });

      it("resolves user from authReq.userId if header is empty/array", async () => {
        req = mockRequest({
          params: { itemId: "1" },
          body: { newOnHand: 10, reason: "Audit" },
          headers: { "x-user-id": ["arrayHeader"] }, // triggers array check
        });
        (req as any).userId = "authReqUser123";

        await InventoryController.adjustStock(req as any, res);
        expect(InventoryAdjustmentService.adjustStock).toHaveBeenCalledWith(
          expect.objectContaining({ userId: "authReqUser123" }),
        );

        // Also test empty string header
        req.headers = { "x-user-id": "   " };
        await InventoryController.adjustStock(req as any, res);
        expect(InventoryAdjustmentService.adjustStock).toHaveBeenCalledWith(
          expect.objectContaining({ userId: "authReqUser123" }),
        );
      });

      it("catches errors", async () => {
        req = mockRequest();
        (
          InventoryAdjustmentService.adjustStock as jest.Mock
        ).mockRejectedValueOnce(new Error("Err"));
        await InventoryController.adjustStock(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("allocateStock", () => {
      it("allocates stock", async () => {
        req = mockRequest({ params: { itemId: "1" }, body: { quantity: 2 } });
        await InventoryController.allocateStock(req as any, res);
        expect(InventoryAllocationService.allocateStock).toHaveBeenCalled();
      });
      it("catches errors", async () => {
        req = mockRequest();
        (
          InventoryAllocationService.allocateStock as jest.Mock
        ).mockRejectedValueOnce(new Error("Err"));
        await InventoryController.allocateStock(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("releaseAllocatedStock", () => {
      it("releases stock", async () => {
        req = mockRequest({ params: { itemId: "1" }, body: { quantity: 2 } });
        await InventoryController.releaseAllocatedStock(req as any, res);
        expect(
          InventoryAllocationService.releaseAllocatedStock,
        ).toHaveBeenCalled();
      });
      it("catches errors", async () => {
        req = mockRequest();
        (
          InventoryAllocationService.releaseAllocatedStock as jest.Mock
        ).mockRejectedValueOnce(new Error("Err"));
        await InventoryController.releaseAllocatedStock(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe("getInventoryTurnOver", () => {
      it("returns turnover with provided dates", async () => {
        req = mockRequest({
          params: { organisationId: "1" },
          query: { from: "2023-01-01", to: "2023-12-31" },
        });
        (
          InventoryService.getInventoryTurnoverByItem as jest.Mock
        ).mockResolvedValueOnce([]);
        await InventoryController.getInventoryTurnOver(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ items: [] }),
        );
      });

      it("returns turnover with default missing dates", async () => {
        req = mockRequest({
          params: { organisationId: "1" },
          query: {},
        });
        await InventoryController.getInventoryTurnOver(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ from: "last_12_months" }),
        );
      });

      it("handles local specific InventoryServiceError", async () => {
        req = mockRequest({ params: { organisationId: "1" } });
        (
          InventoryService.getInventoryTurnoverByItem as jest.Mock
        ).mockRejectedValueOnce(new InventoryServiceError("Turnover err", 400));
        await InventoryController.getInventoryTurnOver(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Turnover err" });
      });
    });
  });

  describe("InventoryVendorController", () => {
    it("createVendor", async () => {
      req = mockRequest();
      await InventoryVendorController.createVendor(req as any, res);
      expect(res.status).toHaveBeenCalledWith(201);

      (InventoryVendorService.createVendor as jest.Mock).mockRejectedValueOnce(
        new Error("Err"),
      );
      await InventoryVendorController.createVendor(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("updateVendor", async () => {
      req = mockRequest({ params: { vendorId: "1" } });
      await InventoryVendorController.updateVendor(req as any, res);
      expect(InventoryVendorService.updateVendor).toHaveBeenCalled();

      (InventoryVendorService.updateVendor as jest.Mock).mockRejectedValueOnce(
        new Error("Err"),
      );
      await InventoryVendorController.updateVendor(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("listVendors", async () => {
      req = mockRequest({ params: { organisationId: "1" } });
      await InventoryVendorController.listVendors(req as any, res);
      expect(InventoryVendorService.listVendors).toHaveBeenCalled();

      (InventoryVendorService.listVendors as jest.Mock).mockRejectedValueOnce(
        new Error("Err"),
      );
      await InventoryVendorController.listVendors(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    describe("getVendor", () => {
      it("returns vendor if found", async () => {
        req = mockRequest({ params: { vendorId: "1" } });
        (InventoryVendorService.getVendor as jest.Mock).mockResolvedValueOnce({
          id: "1",
        });
        await InventoryVendorController.getVendor(req as any, res);
        expect(res.json).toHaveBeenCalledWith({ id: "1" });
      });

      it("returns 404 if not found", async () => {
        req = mockRequest({ params: { vendorId: "1" } });
        (InventoryVendorService.getVendor as jest.Mock).mockResolvedValueOnce(
          null,
        );
        await InventoryVendorController.getVendor(req as any, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "Vendor not found" });
      });

      it("catches errors", async () => {
        req = mockRequest();
        (InventoryVendorService.getVendor as jest.Mock).mockRejectedValueOnce(
          new Error("Err"),
        );
        await InventoryVendorController.getVendor(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    it("deleteVendor", async () => {
      req = mockRequest({ params: { vendorId: "1" } });
      await InventoryVendorController.deleteVendor(req as any, res);
      expect(res.status).toHaveBeenCalledWith(204);

      (InventoryVendorService.deleteVendor as jest.Mock).mockRejectedValueOnce(
        new Error("Err"),
      );
      await InventoryVendorController.deleteVendor(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("InventoryMetaFieldController", () => {
    it("createField", async () => {
      req = mockRequest();
      await InventoryMetaFieldController.createField(req as any, res);
      expect(res.status).toHaveBeenCalledWith(201);

      (
        InventoryMetaFieldService.createField as jest.Mock
      ).mockRejectedValueOnce(new Error("Err"));
      await InventoryMetaFieldController.createField(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("updateField", async () => {
      req = mockRequest({ params: { fieldId: "1" } });
      await InventoryMetaFieldController.updateField(req as any, res);
      expect(InventoryMetaFieldService.updateField).toHaveBeenCalled();

      (
        InventoryMetaFieldService.updateField as jest.Mock
      ).mockRejectedValueOnce(new Error("Err"));
      await InventoryMetaFieldController.updateField(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("deleteField", async () => {
      req = mockRequest({ params: { fieldId: "1" } });
      await InventoryMetaFieldController.deleteField(req as any, res);
      expect(res.status).toHaveBeenCalledWith(204);

      (
        InventoryMetaFieldService.deleteField as jest.Mock
      ).mockRejectedValueOnce(new Error("Err"));
      await InventoryMetaFieldController.deleteField(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    describe("listFields", () => {
      it("returns 400 if businessType is missing", async () => {
        req = mockRequest({ query: {} });
        await InventoryMetaFieldController.listFields(req as any, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("fetches fields if businessType exists", async () => {
        req = mockRequest({ query: { businessType: "RETAIL" } });
        await InventoryMetaFieldController.listFields(req as any, res);
        expect(InventoryMetaFieldService.listFields).toHaveBeenCalledWith(
          "RETAIL",
        );
      });

      it("catches errors", async () => {
        req = mockRequest({ query: { businessType: "RETAIL" } });
        (
          InventoryMetaFieldService.listFields as jest.Mock
        ).mockRejectedValueOnce(new Error("Err"));
        await InventoryMetaFieldController.listFields(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("InventoryAlertController", () => {
    it("getLowStockItems", async () => {
      req = mockRequest({ params: { organisationId: "1" } });
      await InventoryAlertController.getLowStockItems(req as any, res);
      expect(InventoryAlertService.getLowStockItems).toHaveBeenCalled();

      (
        InventoryAlertService.getLowStockItems as jest.Mock
      ).mockRejectedValueOnce(new Error("Err"));
      await InventoryAlertController.getLowStockItems(req as any, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    describe("getExpiringItems", () => {
      it("parses days if provided", async () => {
        req = mockRequest({
          params: { organisationId: "1" },
          query: { days: "14" },
        });
        await InventoryAlertController.getExpiringItems(req as any, res);
        expect(InventoryAlertService.getExpiringItems).toHaveBeenCalledWith(
          "1",
          14,
        );
      });

      it("defaults to 7 days if not provided", async () => {
        req = mockRequest({
          params: { organisationId: "1" },
          query: {},
        });
        await InventoryAlertController.getExpiringItems(req as any, res);
        expect(InventoryAlertService.getExpiringItems).toHaveBeenCalledWith(
          "1",
          7,
        );
      });

      it("catches errors", async () => {
        req = mockRequest();
        (
          InventoryAlertService.getExpiringItems as jest.Mock
        ).mockRejectedValueOnce(new Error("Err"));
        await InventoryAlertController.getExpiringItems(req as any, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });
});
