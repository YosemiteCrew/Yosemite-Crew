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
      ...actual.LabOrderService,
      listOrders: jest.fn(),
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
    it("passes search filters from query params", async () => {
      req.query = {
        appointmentId: "67f001122334455667788990",
        companionId: "67f001122334455667788991",
        status: "SUBMITTED",
        limit: "25",
      };
      mockedLabOrderService.listOrders.mockResolvedValue([]);

      await LabOrderController.listOrders(req as Request, res);

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

    it("ignores body filters and uses query params only", async () => {
      req.body = {
        appointmentId: "body-appointment",
        companionId: "body-companion",
        status: "CREATED",
        limit: 100,
      };
      req.query = {
        appointmentId: "67f001122334455667788992",
      };
      mockedLabOrderService.listOrders.mockResolvedValue([]);

      await LabOrderController.listOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-1",
        appointmentId: "67f001122334455667788992",
        companionId: undefined,
        provider: "idexx",
        status: undefined,
        limit: undefined,
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
});
