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
        patientId: "67f001122334455667788991",
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
        patientId: "body-patient",
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
        new LabOrderServiceError(
          "Invalid status.",
          400,
          "DIAGNOSTIC_PROVIDER_CODE_MAPPING_UNSUPPORTED",
          {
            provider: "IDEXX",
            field: "providerCode",
            code: "TEST-001",
          },
        ),
      );

      await LabOrderController.listOrders(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid status.",
        error: {
          code: "DIAGNOSTIC_PROVIDER_CODE_MAPPING_UNSUPPORTED",
          details: {
            provider: "IDEXX",
            field: "providerCode",
            code: "TEST-001",
          },
        },
      });
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
        patientId: "67f001122334455667788991",
        status: "SUBMITTED",
        limit: 25,
      };
      (mockedLabOrderService.listOrders as any).mockResolvedValue([] as any);

      await LabOrderController.searchOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-1",
        appointmentId: "67f001122334455667788990",
        patientId: "67f001122334455667788991",
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

    it("reads the filters off the query string on a GET", async () => {
      /* The picker sends a GET, and this handler is registered for GET as well
         as POST. It used to read only req.body, so query/limit/page arrived
         undefined and the service returned an unfiltered alphabetical first
         page - typing "SDMA" found nothing while "ACTH" worked purely because
         it sorts early (#2485). */
      req.body = {};
      req.query = { query: "SDMA", limit: "10", page: "3" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        { query: "SDMA", limit: 10, page: 3, codes: undefined },
      );
    });

    it("prefers the body over the query string when both carry a value", async () => {
      req.body = { query: "body-wins", limit: 5 };
      req.query = { query: "ignored", limit: "99" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        { query: "body-wins", limit: 5, page: undefined, codes: undefined },
      );
    });

    it("falls back rather than passing a non-numeric limit through", async () => {
      /* Number("abc") is NaN, which would reach the service and fail its
         `> 0` test in a way that silently reinstates the default. Rejected
         here so the service sees `undefined` and applies its own default. */
      req.body = {};
      req.query = { limit: "abc", page: "" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        {
          query: undefined,
          limit: undefined,
          page: undefined,
          codes: undefined,
        },
      );
    });

    it("rejects fractional pagination rather than passing it to Prisma", async () => {
      /* skip/take reach Prisma, which requires integers, so ?limit=2.5 turned
         into a 500 instead of falling back to the default. The service's own
         `> 0` guard passes a fraction straight through. */
      req.body = {};
      req.query = { limit: "2.5", page: "1.5" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        expect.objectContaining({ limit: undefined, page: undefined }),
      );
    });

    it("applies the same integer requirement to a body", async () => {
      // `{ limit: 2.5 }` is a number, so the strict body path would otherwise
      // have handed Prisma the same fraction.
      req.body = { limit: 2.5, page: 0 };
      req.query = {};
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        expect.objectContaining({ limit: undefined, page: undefined }),
      );
    });

    it("still accepts whole-number pagination from either source", async () => {
      req.body = {};
      req.query = { limit: "25", page: "2" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        expect.objectContaining({ limit: 25, page: 2 }),
      );
    });

    it("accepts codes as a comma-separated string on a GET", async () => {
      req.body = {};
      req.query = { codes: "A, B ,,C" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        expect.objectContaining({ codes: ["A", "B", "C"] }),
      );
    });

    it("ignores a blank query rather than filtering on an empty string", async () => {
      req.body = {};
      req.query = { query: "   " };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      } as any);

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        expect.objectContaining({ query: undefined }),
      );
    });
  });

  describe("createIdexxOrder", () => {
    it("creates an order with normalized defaults", async () => {
      req.body = {
        patientId: "patient-1",
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
        patientId: "patient-1",
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

  describe("request validation", () => {
    it("returns 400 when organisationId is missing", async () => {
      req.params = { provider: "idexx" };

      await LabOrderController.listOrders(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "organisationId is required.",
      });
      expect(mockedLabOrderService.listOrders).not.toHaveBeenCalled();
    });

    it("returns 400 when provider is missing", async () => {
      req.params = { organisationId: "org-1" };

      await LabOrderController.listOrders(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "provider is required.",
      });
      expect(mockedLabOrderService.listOrders).not.toHaveBeenCalled();
    });

    it("returns 400 when idexxOrderId is missing", async () => {
      await LabOrderController.getOrder(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "idexxOrderId is required.",
      });
      expect(mockedLabOrderService.getOrder).not.toHaveBeenCalled();
    });
  });

  describe("error responses", () => {
    it("searchOrders maps unexpected errors to 500", async () => {
      (mockedLabOrderService.listOrders as any).mockRejectedValue(
        new Error("boom"),
      );

      await LabOrderController.searchOrders(req as Request, res);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Failed to search lab orders.",
      });
    });

    it("listProviderTests maps unexpected errors to 500", async () => {
      (mockedLabOrderService.listProviderTests as any).mockRejectedValue(
        new Error("boom"),
      );

      await LabOrderController.listProviderTests(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Failed to list lab tests.",
      });
    });

    it("createIdexxOrder maps service errors to their status", async () => {
      (mockedLabOrderService.createOrder as any).mockRejectedValue(
        new LabOrderServiceError("IDEXX credentials missing.", 400),
      );

      await LabOrderController.createIdexxOrder(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "IDEXX credentials missing.",
      });
    });

    it("getOrder maps service errors to their status", async () => {
      req.params = { ...req.params, idexxOrderId: "id-1" };
      (mockedLabOrderService.getOrder as any).mockRejectedValue(
        new LabOrderServiceError("Order not found.", 404),
      );

      await LabOrderController.getOrder(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Order not found." });
    });

    it("updateOrder maps unexpected errors to 500", async () => {
      req.params = { ...req.params, idexxOrderId: "id-1" };
      (mockedLabOrderService.updateOrder as any).mockRejectedValue(
        new Error("boom"),
      );

      await LabOrderController.updateOrder(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Failed to update lab order.",
      });
    });

    it("cancelOrder maps unexpected errors to 500", async () => {
      req.params = { ...req.params, idexxOrderId: "id-1" };
      (mockedLabOrderService.cancelOrder as any).mockRejectedValue(
        new Error("boom"),
      );

      await LabOrderController.cancelOrder(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Failed to cancel lab order.",
      });
    });
  });

  describe("organisation guard across handlers", () => {
    const handlers = [
      ["searchOrders", "listOrders"],
      ["listProviderTests", "listProviderTests"],
      ["createIdexxOrder", "createOrder"],
      ["getOrder", "getOrder"],
      ["updateOrder", "updateOrder"],
      ["cancelOrder", "cancelOrder"],
    ] as const;

    it.each(handlers)(
      "%s stops before the service when organisationId is missing",
      async (handler, serviceMethod) => {
        req.params = { provider: "idexx", idexxOrderId: "id-1" };

        await (LabOrderController as any)[handler](req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          message: "organisationId is required.",
        });
        expect(
          (mockedLabOrderService as any)[serviceMethod],
        ).not.toHaveBeenCalled();
      },
    );

    it.each([["updateOrder"], ["cancelOrder"]] as const)(
      "%s requires an idexxOrderId",
      async (handler) => {
        await (LabOrderController as any)[handler](req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          message: "idexxOrderId is required.",
        });
      },
    );

    it("uses the organisation authorized by the middleware", async () => {
      req.params = { provider: "idexx" };
      (req as unknown as { organisationId: string }).organisationId = "org-mw";
      (mockedLabOrderService.listOrders as any).mockResolvedValue([]);

      await LabOrderController.listOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-mw",
        provider: "idexx",
      });
    });
  });

  describe("search body coercion", () => {
    it("treats a null body as an empty filter set", async () => {
      req.body = null;
      (mockedLabOrderService.listOrders as any).mockResolvedValue([]);

      await LabOrderController.searchOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith({
        organisationId: "org-1",
        appointmentId: undefined,
        patientId: undefined,
        provider: "idexx",
        status: undefined,
        limit: undefined,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("coerces a numeric string limit", async () => {
      req.body = { limit: "25" };
      (mockedLabOrderService.listOrders as any).mockResolvedValue([]);

      await LabOrderController.searchOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it("ignores a blank string limit", async () => {
      req.body = { limit: "   " };
      (mockedLabOrderService.listOrders as any).mockResolvedValue([]);

      await LabOrderController.searchOrders(req as Request, res);

      expect(mockedLabOrderService.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ limit: undefined }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("rejects a non-numeric limit as an invalid body", async () => {
      req.body = { limit: "many" };

      await LabOrderController.searchOrders(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body.",
      });
      expect(mockedLabOrderService.listOrders).not.toHaveBeenCalled();
    });
  });

  describe("listProviderTests coercion", () => {
    it("drops non-string and non-numeric filters", async () => {
      req.body = { query: 5, limit: "10", page: "2", codes: "A,B" };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      });

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        {
          query: undefined,
          limit: undefined,
          page: undefined,
          codes: undefined,
        },
      );
    });

    it("trims and compacts the codes array", async () => {
      req.body = { codes: [" A ", "", "B"] };
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      });

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        expect.objectContaining({ codes: ["A", "B"] }),
      );
    });

    it("handles an absent body", async () => {
      req.body = undefined;
      (mockedLabOrderService.listProviderTests as any).mockResolvedValue({
        tests: [],
      });

      await LabOrderController.listProviderTests(req as Request, res);

      expect(mockedLabOrderService.listProviderTests).toHaveBeenCalledWith(
        "idexx",
        {
          query: undefined,
          limit: undefined,
          page: undefined,
          codes: undefined,
        },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("createIdexxOrder", () => {
    it("stamps the acting user and forwards every optional field", async () => {
      (req as unknown as { userId: string }).userId = "user-9";
      req.body = {
        patientId: "patient-1",
        appointmentId: "appt-1",
        tests: ["T1"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "S1" }],
        veterinarian: "vet-1",
        technician: "tech-1",
        notes: "note",
        specimenCollectionDate: "2026-01-02",
      };
      (mockedLabOrderService.createOrder as any).mockResolvedValue({
        idexxOrderId: "id-1",
      });

      await LabOrderController.createIdexxOrder(req as Request, res);

      expect(mockedLabOrderService.createOrder).toHaveBeenCalledWith("idexx", {
        organisationId: "org-1",
        patientId: "patient-1",
        appointmentId: "appt-1",
        createdByUserId: "user-9",
        tests: ["T1"],
        modality: "IN_HOUSE",
        ivls: [{ serialNumber: "S1" }],
        veterinarian: "vet-1",
        technician: "tech-1",
        notes: "note",
        specimenCollectionDate: "2026-01-02",
      });
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("defaults an empty body to blank identifiers", async () => {
      req.body = {};
      (mockedLabOrderService.createOrder as any).mockResolvedValue({});

      await LabOrderController.createIdexxOrder(req as Request, res);

      expect(mockedLabOrderService.createOrder).toHaveBeenCalledWith("idexx", {
        organisationId: "org-1",
        patientId: "",
        appointmentId: undefined,
        createdByUserId: undefined,
        tests: [],
        modality: undefined,
        ivls: undefined,
        veterinarian: null,
        technician: null,
        notes: null,
        specimenCollectionDate: null,
      });
    });
  });

  describe("updateOrder", () => {
    it("passes an empty body through as explicit nulls", async () => {
      req.params = { ...req.params, idexxOrderId: "id-1" };
      req.body = {};
      (mockedLabOrderService.updateOrder as any).mockResolvedValue({});

      await LabOrderController.updateOrder(req as Request, res);

      expect(mockedLabOrderService.updateOrder).toHaveBeenCalledWith(
        "idexx",
        "org-1",
        "id-1",
        {
          tests: undefined,
          modality: undefined,
          ivls: undefined,
          veterinarian: null,
          technician: null,
          notes: null,
          specimenCollectionDate: null,
        },
      );
    });
  });
});
