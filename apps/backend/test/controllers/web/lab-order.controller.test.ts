import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { LabOrderController } from "../../../src/controllers/web/lab-order.controller";
import {
  LabOrderService,
  LabOrderServiceError,
} from "../../../src/services/lab-order.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/lab-order.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/lab-order.service",
  ) as typeof import("../../../src/services/lab-order.service");
  return {
    ...actual,
    LabOrderService: {
      cancelOrder: jest.fn(),
      createOrder: jest.fn(),
      getOrder: jest.fn(),
      listOrders: jest.fn(),
      listProviderTests: jest.fn(),
      updateOrder: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

const mockedLabOrderService = jest.mocked(LabOrderService);
const mockedLogger = jest.mocked(logger);

describe("LabOrderController", () => {
  let req: Partial<Request>;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: {
        organisationId: "org-1",
        provider: "idexx",
      },
      query: {},
      body: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe("listOrders", () => {
    it("lists orders without reading query/body filters", async () => {
      req.query = {
        appointmentId: "67f001122334455667788990",
        companionId: "67f001122334455667788991",
        status: "SUBMITTED",
        limit: "25",
      };
      (mockedLabOrderService.listOrders as any).mockResolvedValue([] as any);

      await LabOrderController.listOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-1",
        provider: "idexx",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ orders: [] });
    });

    it("ignores body filters", async () => {
      req.body = {
        appointmentId: "body-appointment",
        companionId: "body-companion",
        status: "CREATED",
        limit: 100,
      };
      req.query = {
        appointmentId: "67f001122334455667788992",
      };
      (mockedLabOrderService.listOrders as any).mockResolvedValue([] as any);

      await LabOrderController.listOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-1",
        provider: "idexx",
      });
    });

    it("handles service errors", async () => {
      mockedLabOrderService.listOrders.mockRejectedValue(
        new LabOrderServiceError("Invalid status.", 400),
      );

      await LabOrderController.listOrders(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid status." });
    });

    it("handles unexpected errors", async () => {
      mockedLabOrderService.listOrders.mockRejectedValue(new Error("boom"));

      await LabOrderController.listOrders(req as Request, res);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Failed to list lab orders.",
      });
    });
  });

  describe("searchOrders", () => {
    it("passes search filters from the request body", async () => {
      req.body = {
        appointmentId: "67f001122334455667788990",
        companionId: "67f001122334455667788991",
        status: "SUBMITTED",
        limit: 25,
      };
      (mockedLabOrderService.listOrders as any).mockResolvedValue([] as any);

      await LabOrderController.searchOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-1",
        appointmentId: "67f001122334455667788990",
        companionId: "67f001122334455667788991",
        provider: "idexx",
        status: "SUBMITTED",
        limit: 25,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ orders: [] });
    });

    it("returns 400 for invalid request bodies", async () => {
      req.body = "not-an-object" as any;

      await LabOrderController.searchOrders(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body.",
      });
      expect(mockedLabOrderService.listOrders).not.toHaveBeenCalled();
    });
  });

  describe("listProviderTests", () => {
    it("passes parsed filters to the service", async () => {
      req.body = {
        query: "chem",
        limit: 10,
        page: 2,
        codes: ["A", "B"],
      };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [{ code: "A" }],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        {
          query: "chem",
          limit: 10,
          page: 2,
          codes: ["A", "B"],
        },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("createIdexxOrder", () => {
    it("creates an order with normalized defaults", async () => {
      req.body = {
        companionId: "comp-1",
        appointmentId: "appt-1",
        tests: ["T1"],
        notes: "urgent",
      };
      (mockedLabOrderService.createOrder as any).mockResolvedValue({
        idexxOrderId: "id-1",
      });

      await LabOrderController.createIdexxOrder(req as Request, res);

      expect(mockedLabOrderService.createOrder).toHaveBeenCalledWith("idexx", {
        organisationId: "org-1",
        companionId: "comp-1",
        appointmentId: "appt-1",
        createdByUserId: undefined,
        tests: ["T1"],
        modality: undefined,
        ivls: undefined,
        veterinarian: null,
        technician: null,
        notes: "urgent",
        specimenCollectionDate: null,
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe("getOrder", () => {
    it("returns the order by id", async () => {
      req.params = {
        ...req.params,
        idexxOrderId: "id-1",
      };
      (mockedLabOrderService.getOrder as any).mockResolvedValue({
        idexxOrderId: "id-1",
      });

      await LabOrderController.getOrder(req as Request, res);

      expect(mockedLabOrderService.getOrder).toHaveBeenCalledWith(
        "idexx",
        "org-1",
        "id-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("updateOrder", () => {
    it("updates the order with normalized payload", async () => {
      req.params = {
        ...req.params,
        idexxOrderId: "id-1",
      };
      req.body = {
        tests: ["T1", "T2"],
        modality: "REFERENCE_LAB",
        ivls: [{ serialNumber: "S1" }],
        veterinarian: "vet-1",
        notes: "follow up",
      };
      (mockedLabOrderService.updateOrder as any).mockResolvedValue({
        idexxOrderId: "id-1",
      });

      await LabOrderController.updateOrder(req as Request, res);

      expect(mockedLabOrderService.updateOrder).toHaveBeenCalledWith(
        "idexx",
        "org-1",
        "id-1",
        {
          tests: ["T1", "T2"],
          modality: "REFERENCE_LAB",
          ivls: [{ serialNumber: "S1" }],
          veterinarian: "vet-1",
          technician: null,
          notes: "follow up",
          specimenCollectionDate: null,
        },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("cancelOrder", () => {
    it("cancels the order by id", async () => {
      req.params = {
        ...req.params,
        idexxOrderId: "id-1",
      };
      (mockedLabOrderService.cancelOrder as any).mockResolvedValue({
        idexxOrderId: "id-1",
        status: "CANCELLED",
      });

      await LabOrderController.cancelOrder(req as Request, res);

      expect(mockedLabOrderService.cancelOrder).toHaveBeenCalledWith(
        "idexx",
        "org-1",
        "id-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
