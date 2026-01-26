import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 3 levels to src from test/controllers/
// ----------------------------------------------------------------------
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
import logger from "../../src/utils/logger";

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock("../../src/services/inventory.service");
jest.mock("../../src/utils/logger");

// Retrieve the REAL Error class
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { InventoryServiceError: RealInventoryServiceError } = jest.requireActual(
  "../../src/services/inventory.service",
) as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedInventoryService = jest.mocked(InventoryService);
const mockedAdjustmentService = jest.mocked(InventoryAdjustmentService);
const mockedAllocationService = jest.mocked(InventoryAllocationService);
const mockedVendorService = jest.mocked(InventoryVendorService);
const mockedMetaFieldService = jest.mocked(InventoryMetaFieldService);
const mockedAlertService = jest.mocked(InventoryAlertService);
const mockedLogger = jest.mocked(logger);

describe("Inventory Controllers", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 4. ERROR HELPERS (FIXED CASTING)
  // ----------------------------------------------------------------------
  const mockServiceError = (
    mockFn: jest.Mock,
    status = 400,
    msg = "Service Error",
  ) => {
    const error = new RealInventoryServiceError(msg, status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFn as any).mockRejectedValue(error);
  };

  const mockGenericError = (mockFn: jest.Mock) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFn as any).mockRejectedValue(new Error("Boom"));
  };

  /* ========================================================================
   * INVENTORY CONTROLLER TESTS
   * ======================================================================*/
  describe("InventoryController", () => {
    // --- CREATE ITEM ---
    describe("createItem", () => {
      it("should success (201)", async () => {
        req.body = { name: "Item 1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.createItem as any).mockResolvedValue({
          id: "i1",
        });

        await InventoryController.createItem(req as any, res as Response);
        expect(mockedInventoryService.createItem).toHaveBeenCalledWith(
          req.body,
        );
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should handle service error", async () => {
        mockServiceError(mockedInventoryService.createItem as jest.Mock, 400);
        await InventoryController.createItem(req as any, res as Response);
      });
    });

    // --- UPDATE ITEM ---
    describe("updateItem", () => {
      it("should success (200)", async () => {
        req.params = { itemId: "i1" };
        req.body = { name: "Updated" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.updateItem as any).mockResolvedValue({
          id: "i1",
        });

        await InventoryController.updateItem(req as any, res as Response);
        expect(mockedInventoryService.updateItem).toHaveBeenCalledWith(
          "i1",
          req.body,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle generic error", async () => {
        mockGenericError(mockedInventoryService.updateItem as jest.Mock);
        await InventoryController.updateItem(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- HIDE ITEM ---
    describe("hideItem", () => {
      it("should success (200)", async () => {
        req.params = { itemId: "i1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.hideItem as any).mockResolvedValue({
          id: "i1",
        });

        await InventoryController.hideItem(req as any, res as Response);
        expect(mockedInventoryService.hideItem).toHaveBeenCalledWith("i1");
      });

      it("should handle error", async () => {
        mockServiceError(mockedInventoryService.hideItem as jest.Mock, 404);
        await InventoryController.hideItem(req as any, res as Response);
      });
    });

    // --- ACTIVE ITEM ---
    describe("activeItem", () => {
      it("should success (200)", async () => {
        req.params = { itemId: "i1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.activeItem as any).mockResolvedValue({
          id: "i1",
        });

        await InventoryController.activeItem(req as any, res as Response);
        expect(mockedInventoryService.activeItem).toHaveBeenCalledWith("i1");
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.activeItem as jest.Mock);
        await InventoryController.activeItem(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- ARCHIVE ITEM ---
    describe("archiveItem", () => {
      it("should success (200)", async () => {
        req.params = { itemId: "i1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.archiveItem as any).mockResolvedValue({
          id: "i1",
        });

        await InventoryController.archiveItem(req as any, res as Response);
        expect(mockedInventoryService.archiveItem).toHaveBeenCalledWith("i1");
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.archiveItem as jest.Mock);
        await InventoryController.archiveItem(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- LIST ITEMS ---
    describe("listItems", () => {
      it("should parse status string (single)", async () => {
        req.params = { organisationId: "o1" };
        req.query = { status: "ACTIVE", lowStockOnly: "true" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.listItems as any).mockResolvedValue([]);

        await InventoryController.listItems(req as any, res as Response);
        expect(mockedInventoryService.listItems).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "ACTIVE",
            lowStockOnly: true,
          }),
        );
      });

      it("should parse status string (multiple)", async () => {
        req.params = { organisationId: "o1" };
        req.query = { status: "ACTIVE,HIDDEN", expiringWithinDays: "30" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.listItems as any).mockResolvedValue([]);

        await InventoryController.listItems(req as any, res as Response);
        expect(mockedInventoryService.listItems).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ["ACTIVE", "HIDDEN"],
            expiringWithinDays: 30,
          }),
        );
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.listItems as jest.Mock);
        await InventoryController.listItems(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- GET ITEM WITH BATCHES ---
    describe("getItemWithBatches", () => {
      it("should success", async () => {
        req.params = { itemId: "i1", organisationId: "o1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.getItemWithBatches as any).mockResolvedValue(
          {},
        );
        await InventoryController.getItemWithBatches(
          req as any,
          res as Response,
        );
        expect(mockedInventoryService.getItemWithBatches).toHaveBeenCalledWith(
          "i1",
          "o1",
        );
      });

      it("should handle error", async () => {
        mockGenericError(
          mockedInventoryService.getItemWithBatches as jest.Mock,
        );
        await InventoryController.getItemWithBatches(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- ADD BATCH ---
    describe("addBatch", () => {
      it("should success (201)", async () => {
        req.params = { itemId: "i1" };
        req.body = { batchNumber: "B1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.addBatch as any).mockResolvedValue({});
        await InventoryController.addBatch(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.addBatch as jest.Mock);
        await InventoryController.addBatch(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- UPDATE BATCH ---
    describe("updateBatch", () => {
      it("should success", async () => {
        req.params = { batchId: "b1" };
        req.body = { quantity: 10 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.updateBatch as any).mockResolvedValue({});
        await InventoryController.updateBatch(req as any, res as Response);
        expect(mockedInventoryService.updateBatch).toHaveBeenCalledWith(
          "b1",
          req.body,
        );
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.updateBatch as jest.Mock);
        await InventoryController.updateBatch(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- DELETE BATCH ---
    describe("deleteBatch", () => {
      it("should success (204)", async () => {
        req.params = { batchId: "b1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.deleteBatch as any).mockResolvedValue(
          undefined,
        );
        await InventoryController.deleteBatch(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(204);
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.deleteBatch as jest.Mock);
        await InventoryController.deleteBatch(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- CONSUME STOCK ---
    describe("consumeStock", () => {
      it("should success", async () => {
        req.body = { itemId: "i1", quantity: 5 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedInventoryService.consumeStock as any).mockResolvedValue({});
        await InventoryController.consumeStock(req as any, res as Response);
        expect(mockedInventoryService.consumeStock).toHaveBeenCalledWith(
          req.body,
        );
      });

      it("should handle error", async () => {
        mockGenericError(mockedInventoryService.consumeStock as jest.Mock);
        await InventoryController.consumeStock(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- ADJUST STOCK ---
    describe("adjustStock", () => {
      it("should success with header userId", async () => {
        req.params = { itemId: "i1" };
        req.body = { newOnHand: 10, reason: "Lost" };
        req.headers = { "x-user-id": "u1" };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAdjustmentService.adjustStock as any).mockResolvedValue({});

        await InventoryController.adjustStock(req as any, res as Response);
        expect(mockedAdjustmentService.adjustStock).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "u1",
          }),
        );
      });

      it("should success with req.userId fallback", async () => {
        req.params = { itemId: "i1" };
        req.body = { newOnHand: 10, reason: "Lost" };
        (req as any).userId = "u2";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAdjustmentService.adjustStock as any).mockResolvedValue({});

        await InventoryController.adjustStock(req as any, res as Response);
        expect(mockedAdjustmentService.adjustStock).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "u2",
          }),
        );
      });

      it("should handle error", async () => {
        mockGenericError(mockedAdjustmentService.adjustStock as jest.Mock);
        await InventoryController.adjustStock(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- ALLOCATE STOCK ---
    describe("allocateStock", () => {
      it("should success", async () => {
        req.params = { itemId: "i1" };
        req.body = { quantity: 2, referenceId: "ref1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAllocationService.allocateStock as any).mockResolvedValue({});
        await InventoryController.allocateStock(req as any, res as Response);
        expect(mockedAllocationService.allocateStock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(mockedAllocationService.allocateStock as jest.Mock);
        await InventoryController.allocateStock(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- RELEASE ALLOCATED STOCK ---
    describe("releaseAllocatedStock", () => {
      it("should success", async () => {
        req.params = { itemId: "i1" };
        req.body = { quantity: 2, referenceId: "ref1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (
          mockedAllocationService.releaseAllocatedStock as any
        ).mockResolvedValue({});
        await InventoryController.releaseAllocatedStock(
          req as any,
          res as Response,
        );
        expect(
          mockedAllocationService.releaseAllocatedStock,
        ).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(
          mockedAllocationService.releaseAllocatedStock as jest.Mock,
        );
        await InventoryController.releaseAllocatedStock(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    // --- GET INVENTORY TURNOVER ---
    describe("getInventoryTurnOver", () => {
      it("should success with defaults", async () => {
        req.params = { organisationId: "o1" };
        req.query = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (
          mockedInventoryService.getInventoryTurnoverByItem as any
        ).mockResolvedValue([]);

        await InventoryController.getInventoryTurnOver(
          req as any,
          res as Response,
        );
        expect(
          mockedInventoryService.getInventoryTurnoverByItem,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            from: undefined,
            to: undefined,
          }),
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should success with dates", async () => {
        req.params = { organisationId: "o1" };
        req.query = { from: "2023-01-01", to: "2023-01-31" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (
          mockedInventoryService.getInventoryTurnoverByItem as any
        ).mockResolvedValue([]);

        await InventoryController.getInventoryTurnOver(
          req as any,
          res as Response,
        );
        expect(
          mockedInventoryService.getInventoryTurnoverByItem,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            from: new Date("2023-01-01"),
            to: new Date("2023-01-31"),
          }),
        );
      });

      it("should handle service error", async () => {
        mockServiceError(
          mockedInventoryService.getInventoryTurnoverByItem as jest.Mock,
          400,
        );
        await InventoryController.getInventoryTurnOver(
          req as any,
          res as Response,
        );
      });

      it("should handle generic error", async () => {
        mockGenericError(
          mockedInventoryService.getInventoryTurnoverByItem as jest.Mock,
        );
        await InventoryController.getInventoryTurnOver(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  /* ========================================================================
   * VENDOR CONTROLLER TESTS
   * ======================================================================*/
  describe("InventoryVendorController", () => {
    describe("createVendor", () => {
      it("should success (201)", async () => {
        req.body = { name: "Vendor 1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedVendorService.createVendor as any).mockResolvedValue({
          id: "v1",
        });
        await InventoryVendorController.createVendor(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should handle error", async () => {
        mockGenericError(mockedVendorService.createVendor as jest.Mock);
        await InventoryVendorController.createVendor(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("updateVendor", () => {
      it("should success", async () => {
        req.params = { vendorId: "v1" };
        req.body = { name: "V2" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedVendorService.updateVendor as any).mockResolvedValue({});
        await InventoryVendorController.updateVendor(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(mockedVendorService.updateVendor as jest.Mock);
        await InventoryVendorController.updateVendor(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("listVendors", () => {
      it("should success", async () => {
        req.params = { organisationId: "o1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedVendorService.listVendors as any).mockResolvedValue([]);
        await InventoryVendorController.listVendors(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(mockedVendorService.listVendors as jest.Mock);
        await InventoryVendorController.listVendors(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("getVendor", () => {
      it("should 404 if not found", async () => {
        req.params = { vendorId: "v1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedVendorService.getVendor as any).mockResolvedValue(null);
        await InventoryVendorController.getVendor(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should success if found", async () => {
        req.params = { vendorId: "v1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedVendorService.getVendor as any).mockResolvedValue({ id: "v1" });
        await InventoryVendorController.getVendor(req as any, res as Response);
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(mockedVendorService.getVendor as jest.Mock);
        await InventoryVendorController.getVendor(req as any, res as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("deleteVendor", () => {
      it("should success (204)", async () => {
        req.params = { vendorId: "v1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedVendorService.deleteVendor as any).mockResolvedValue(undefined);
        await InventoryVendorController.deleteVendor(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(204);
      });

      it("should handle error", async () => {
        mockGenericError(mockedVendorService.deleteVendor as jest.Mock);
        await InventoryVendorController.deleteVendor(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  /* ========================================================================
   * META FIELD CONTROLLER TESTS
   * ======================================================================*/
  describe("InventoryMetaFieldController", () => {
    describe("createField", () => {
      it("should success (201)", async () => {
        req.body = { fieldKey: "color" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedMetaFieldService.createField as any).mockResolvedValue({});
        await InventoryMetaFieldController.createField(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should handle error", async () => {
        mockGenericError(mockedMetaFieldService.createField as jest.Mock);
        await InventoryMetaFieldController.createField(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("updateField", () => {
      it("should success", async () => {
        req.params = { fieldId: "f1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedMetaFieldService.updateField as any).mockResolvedValue({});
        await InventoryMetaFieldController.updateField(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(mockedMetaFieldService.updateField as jest.Mock);
        await InventoryMetaFieldController.updateField(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("deleteField", () => {
      it("should success (204)", async () => {
        req.params = { fieldId: "f1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedMetaFieldService.deleteField as any).mockResolvedValue(
          undefined,
        );
        await InventoryMetaFieldController.deleteField(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(204);
      });

      it("should handle error", async () => {
        mockGenericError(mockedMetaFieldService.deleteField as jest.Mock);
        await InventoryMetaFieldController.deleteField(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("listFields", () => {
      it("should 400 if businessType missing", async () => {
        req.query = {};
        await InventoryMetaFieldController.listFields(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should success", async () => {
        req.query = { businessType: "RETAIL" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedMetaFieldService.listFields as any).mockResolvedValue([]);
        await InventoryMetaFieldController.listFields(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        req.query = { businessType: "RETAIL" };
        mockGenericError(mockedMetaFieldService.listFields as jest.Mock);
        await InventoryMetaFieldController.listFields(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  /* ========================================================================
   * ALERT CONTROLLER TESTS
   * ======================================================================*/
  describe("InventoryAlertController", () => {
    describe("getLowStockItems", () => {
      it("should success", async () => {
        req.params = { organisationId: "o1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAlertService.getLowStockItems as any).mockResolvedValue([]);
        await InventoryAlertController.getLowStockItems(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockGenericError(mockedAlertService.getLowStockItems as jest.Mock);
        await InventoryAlertController.getLowStockItems(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("getExpiringItems", () => {
      it("should success with default days", async () => {
        req.params = { organisationId: "o1" };
        req.query = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAlertService.getExpiringItems as any).mockResolvedValue([]);
        await InventoryAlertController.getExpiringItems(
          req as any,
          res as Response,
        );
        expect(mockedAlertService.getExpiringItems).toHaveBeenCalledWith(
          "o1",
          7,
        );
      });

      it("should success with explicit days", async () => {
        req.params = { organisationId: "o1" };
        req.query = { days: "15" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAlertService.getExpiringItems as any).mockResolvedValue([]);
        await InventoryAlertController.getExpiringItems(
          req as any,
          res as Response,
        );
        expect(mockedAlertService.getExpiringItems).toHaveBeenCalledWith(
          "o1",
          15,
        );
      });

      it("should handle error", async () => {
        mockGenericError(mockedAlertService.getExpiringItems as jest.Mock);
        await InventoryAlertController.getExpiringItems(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });
});
