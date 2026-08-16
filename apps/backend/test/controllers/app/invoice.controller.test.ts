import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { InvoiceController } from "../../../src/controllers/app/invoice.controller";
import { InvoiceService } from "../../../src/services/invoice.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import logger from "../../../src/utils/logger";

// ----------------------------------------------------------------------
// 1. Mock Setup (Preserving the Error Class)
// ----------------------------------------------------------------------
jest.mock("../../../src/services/invoice.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/invoice.service",
  ) as unknown as any;
  return {
    ...actual,
    InvoiceService: {
      getByAppointmentId: jest.fn(),
      getById: jest.fn(),
      getByPaymentIntentId: jest.fn(),
      createCheckoutSessionAndEmailParent: jest.fn(),
      addChargesToAppointment: jest.fn(),
      bootstrapForAppointment: jest.fn(),
      listForOrganisation: jest.fn(),
      markInvoicePaidManually: jest.fn(),
      updatePaymentCollectionMethod: jest.fn(),
      issueCreditNote: jest.fn(),
      voidCreditNote: jest.fn(),
    },
  };
});

jest.mock("../../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../../src/utils/logger");

// Retrieve the REAL Error class for use in our helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { InvoiceServiceError } = jest.requireActual(
  "../../../src/services/invoice.service",
) as unknown as any;

// ----------------------------------------------------------------------
// 2. Typed Mocks
// ----------------------------------------------------------------------
const mockedInvoiceService = jest.mocked(InvoiceService);
const mockedAuthUserMobileService = jest.mocked(AuthUserMobileService);
const mockedLogger = jest.mocked(logger);

describe("InvoiceController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 3. Error Helpers (Fixed Type Casting)
  // ----------------------------------------------------------------------
  const mockServiceError = (
    method: keyof typeof InvoiceService,
    status = 400,
    msg = "Service Error",
  ) => {
    mockedInvoiceService[method].mockRejectedValue(
      new InvoiceServiceError(msg, status),
    );
  };

  const mockGenericError = (method: keyof typeof InvoiceService) => {
    mockedInvoiceService[method].mockRejectedValue(new Error("Boom"));
  };

  const expectFinanceEnvelope = (data: unknown) => {
    expect(jsonMock).toHaveBeenCalledWith({
      data,
      meta: null,
      error: null,
    });
  };

  // ----------------------------------------------------------------------
  // 4. Tests
  // ----------------------------------------------------------------------

  describe("listInvoicesForAppointment", () => {
    it("should success (200)", async () => {
      req.params = { appointmentId: "apt1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockedInvoiceService.getByAppointmentId.mockResolvedValue([]);

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "apt1",
        { organisationId: "org_1", parentId: null },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope([]);
    });

    it("should resolve mobile scope via parentId when no organisation", async () => {
      req.params = { appointmentId: "apt1" };
      (req as { userId?: string }).userId = "provider-1";
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValue({
        parentId: "parent-1",
      } as any);
      mockedInvoiceService.getByAppointmentId.mockResolvedValue([]);

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(
        mockedAuthUserMobileService.getByProviderUserId,
      ).toHaveBeenCalledWith("provider-1");
      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "apt1",
        { organisationId: null, parentId: "parent-1" },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should 403 when mobile user has no linked parent (authUser null)", async () => {
      req.params = { appointmentId: "apt1" };
      (req as { userId?: string }).userId = "provider-1";
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValue(
        null as any,
      );

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
      expect(mockedInvoiceService.getByAppointmentId).not.toHaveBeenCalled();
    });

    it("should 403 when authUser exists but parentId is null", async () => {
      req.params = { appointmentId: "apt1" };
      (req as { userId?: string }).userId = "provider-1";
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValue({
        parentId: null,
      } as any);

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
    });

    it("should 403 when neither organisation nor userId present", async () => {
      req.params = { appointmentId: "apt1" };

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
      expect(
        mockedAuthUserMobileService.getByProviderUserId,
      ).not.toHaveBeenCalled();
    });

    it("should handle service error with custom status", async () => {
      req.params = { appointmentId: "apt1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockServiceError("getByAppointmentId", 404, "No appointment");

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "No appointment" });
    });

    it("should handle generic error (500)", async () => {
      req.params = { appointmentId: "apt1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockGenericError("getByAppointmentId");

      await InvoiceController.listInvoicesForAppointment(
        req as Request,
        res as Response,
      );

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("getInvoiceById", () => {
    it("should 404 if invoice not found", async () => {
      req.params = { invoiceId: "inv1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      // Cast null to any to bypass strict type check on getById return type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedInvoiceService.getById.mockResolvedValue(null as any);

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invoice not found" });
    });

    it("should success (200)", async () => {
      req.params = { invoiceId: "inv1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockedInvoiceService.getById.mockResolvedValue({ id: "inv1" } as any);

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope({ id: "inv1" });
    });

    it("should 403 when scope is unresolved", async () => {
      req.params = { invoiceId: "inv1" };

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
      expect(mockedInvoiceService.getById).not.toHaveBeenCalled();
    });

    it("should handle service error with custom status", async () => {
      req.params = { invoiceId: "inv1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockServiceError("getById", 404, "Not found");

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("should handle generic error (500)", async () => {
      req.params = { invoiceId: "inv1" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockGenericError("getById");

      await InvoiceController.getInvoiceById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("getInvoiceByPaymentIntentId", () => {
    it("should 404 if invoice not found", async () => {
      req.params = { paymentIntentId: "pi_123" };
      (req as { organisationId?: string }).organisationId = "org_1";
      // Cast null to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedInvoiceService.getByPaymentIntentId.mockResolvedValue(null as any);

      await InvoiceController.getInvoiceByPaymentIntentId(
        req as Request,
        res as Response,
      );

      expect(mockedInvoiceService.getByPaymentIntentId).toHaveBeenCalledWith(
        "pi_123",
        { organisationId: "org_1", parentId: null },
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("should success (200)", async () => {
      req.params = { paymentIntentId: "pi_123" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockedInvoiceService.getByPaymentIntentId.mockResolvedValue({
        id: "inv1",
      } as any);

      await InvoiceController.getInvoiceByPaymentIntentId(
        req as Request,
        res as Response,
      );

      expect(mockedInvoiceService.getByPaymentIntentId).toHaveBeenCalledWith(
        "pi_123",
        { organisationId: "org_1", parentId: null },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should 403 when scope is unresolved", async () => {
      req.params = { paymentIntentId: "pi_123" };

      await InvoiceController.getInvoiceByPaymentIntentId(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
      expect(mockedInvoiceService.getByPaymentIntentId).not.toHaveBeenCalled();
    });

    it("should handle service error with custom status", async () => {
      req.params = { paymentIntentId: "pi_123" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockServiceError("getByPaymentIntentId", 404, "Not found");

      await InvoiceController.getInvoiceByPaymentIntentId(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("should handle generic error (500)", async () => {
      req.params = { paymentIntentId: "pi_123" };
      (req as { organisationId?: string }).organisationId = "org_1";
      mockGenericError("getByPaymentIntentId");

      await InvoiceController.getInvoiceByPaymentIntentId(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("addChargesToAppointment", () => {
    const validItem = {
      name: "Item 1",
      quantity: 1,
      unitPrice: 100,
      total: 100,
      description: "desc",
      discountPercent: 0,
    };

    it("should 400 if items array is missing/empty", async () => {
      req.params = { appointmentId: "apt1" };
      req.body = { items: [] }; // empty array

      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Items are required" });

      req.body = {}; // missing items
      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    // --- Validation Helper Coverage (isInvoiceItem) ---

    it("should 400 if item in array is not an object", async () => {
      req.body = { items: [null] };
      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should 400 if item is a truthy non-object (string)", async () => {
      req.body = { items: ["not-an-object"] };
      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should accept item with description null and discountPercent omitted", async () => {
      req.params = { appointmentId: "apt1" };
      const item = {
        name: "Item 1",
        quantity: 1,
        unitPrice: 100,
        total: 100,
        description: null,
      };
      req.body = { items: [item] };
      mockedInvoiceService.addChargesToAppointment.mockResolvedValue({
        id: "inv1",
      } as any);

      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );

      expect(mockedInvoiceService.addChargesToAppointment).toHaveBeenCalledWith(
        "apt1",
        [item],
        undefined,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should accept item with description omitted (undefined)", async () => {
      req.params = { appointmentId: "apt1" };
      const item = {
        name: "Item 2",
        quantity: 2,
        unitPrice: 50,
        total: 100,
        discountPercent: 10,
      };
      req.body = { items: [item] };
      mockedInvoiceService.addChargesToAppointment.mockResolvedValue({
        id: "inv2",
      } as any);

      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should 400 if item has invalid properties (branch coverage)", async () => {
      const base = { ...validItem };

      const testInvalid = async (override: object) => {
        req.body = { items: [{ ...base, ...override }] };
        await InvoiceController.addChargesToAppointment(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(400);
      };

      // Testing 'name'
      await testInvalid({ name: 123 });
      // Testing 'quantity'
      await testInvalid({ quantity: "1" });
      // Testing 'unitPrice'
      await testInvalid({ unitPrice: "100" });
      // Testing 'total'
      await testInvalid({ total: "100" });
      // Testing 'description' invalid type (valid if undefined/null, invalid if number)
      await testInvalid({ description: 123 });
      // Testing 'discountPercent' invalid type
      await testInvalid({ discountPercent: "10" });
    });

    it("should success (200) with valid payload", async () => {
      req.params = { appointmentId: "apt1" };
      req.body = { items: [validItem] };

      mockedInvoiceService.addChargesToAppointment.mockResolvedValue({
        id: "inv1",
      } as any);

      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );

      expect(mockedInvoiceService.addChargesToAppointment).toHaveBeenCalledWith(
        "apt1",
        [validItem],
        undefined,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle Service Error (custom status)", async () => {
      req.params = { appointmentId: "apt1" };
      req.body = { items: [validItem] };

      mockServiceError("addChargesToAppointment", 422, "Unprocessable");

      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Unprocessable" });
    });

    it("should handle Generic Error (500)", async () => {
      req.params = { appointmentId: "apt1" };
      req.body = { items: [validItem] };

      mockGenericError("addChargesToAppointment");

      await InvoiceController.addChargesToAppointment(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("listInvoicesForOrganisation", () => {
    it("should 400 if organisationId missing", async () => {
      req.params = {};
      await InvoiceController.listInvoicesForOrganisation(
        req as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is reqired.",
      });
    });

    it("should success (200)", async () => {
      req.params = { organisationId: "org1" };
      mockedInvoiceService.listForOrganisation.mockResolvedValue([]);

      await InvoiceController.listInvoicesForOrganisation(
        req as Request,
        res as Response,
      );

      expect(mockedInvoiceService.listForOrganisation).toHaveBeenCalledWith(
        "org1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle generic error (500)", async () => {
      req.params = { organisationId: "org1" };
      mockGenericError("listForOrganisation");

      await InvoiceController.listInvoicesForOrganisation(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createCheckoutSessionForInvoice", () => {
    it("should 400 if invoiceId missing", async () => {
      req.params = {};

      await InvoiceController.createCheckoutSessionForInvoice(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
    });

    it("should success (200)", async () => {
      req.params = { invoiceId: "inv1" };
      mockedInvoiceService.createCheckoutSessionAndEmailParent.mockResolvedValue(
        { sessionId: "cs_1" } as any,
      );

      await InvoiceController.createCheckoutSessionForInvoice(
        req as Request,
        res as Response,
      );

      expect(
        mockedInvoiceService.createCheckoutSessionAndEmailParent,
      ).toHaveBeenCalledWith("inv1");
      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope({ sessionId: "cs_1" });
    });

    it("should handle service error with custom status", async () => {
      req.params = { invoiceId: "inv1" };
      mockServiceError("createCheckoutSessionAndEmailParent", 422, "Bad");

      await InvoiceController.createCheckoutSessionForInvoice(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad" });
    });

    it("should handle generic error (500)", async () => {
      req.params = { invoiceId: "inv1" };
      mockGenericError("createCheckoutSessionAndEmailParent");

      await InvoiceController.createCheckoutSessionForInvoice(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("bootstrapInvoiceForAppointment", () => {
    it("should 400 if appointmentId missing", async () => {
      req.params = {};

      await InvoiceController.bootstrapInvoiceForAppointment(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Appointment Id is required",
      });
      expect(
        mockedInvoiceService.bootstrapForAppointment,
      ).not.toHaveBeenCalled();
    });

    it("should success (200)", async () => {
      req.params = { appointmentId: "apt1" };
      mockedInvoiceService.bootstrapForAppointment.mockResolvedValue({
        id: "inv1",
      } as any);

      await InvoiceController.bootstrapInvoiceForAppointment(
        req as any,
        res as Response,
      );

      expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
        "apt1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope({ id: "inv1" });
    });

    it("should handle service error with custom status", async () => {
      req.params = { appointmentId: "apt1" };
      mockServiceError("bootstrapForAppointment", 404, "No appointment");

      await InvoiceController.bootstrapInvoiceForAppointment(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "No appointment" });
    });

    it("should handle generic error (500)", async () => {
      req.params = { appointmentId: "apt1" };
      mockGenericError("bootstrapForAppointment");

      await InvoiceController.bootstrapInvoiceForAppointment(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("markInvoicePaidManually", () => {
    it("should 400 if invoiceId missing", async () => {
      req.params = {};

      await InvoiceController.markInvoicePaidManually(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
    });

    it("should 409 if invoice already paid", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      mockedInvoiceService.markInvoicePaidManually.mockResolvedValue(
        null as any,
      );

      await InvoiceController.markInvoicePaidManually(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice already paid.",
      });
    });

    it("should 400 if organisationId missing", async () => {
      req.params = { invoiceId: "inv1" };

      await InvoiceController.markInvoicePaidManually(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("should success (200)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      mockedInvoiceService.markInvoicePaidManually.mockResolvedValue({
        id: "inv1",
      } as any);

      await InvoiceController.markInvoicePaidManually(
        req as Request,
        res as Response,
      );

      expect(mockedInvoiceService.markInvoicePaidManually).toHaveBeenCalledWith(
        "inv1",
        "org1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope({ id: "inv1" });
    });

    it("should handle service error with custom status", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      mockServiceError("markInvoicePaidManually", 403, "Forbidden");

      await InvoiceController.markInvoicePaidManually(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Forbidden" });
    });

    it("should handle generic error (500)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      mockGenericError("markInvoicePaidManually");

      await InvoiceController.markInvoicePaidManually(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("updatePaymentCollectionMethod", () => {
    it("should 400 if invoiceId missing", async () => {
      req.params = {};

      await InvoiceController.updatePaymentCollectionMethod(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
    });

    it("should 400 if paymentCollectionMethod is not string", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { paymentCollectionMethod: 123 };

      await InvoiceController.updatePaymentCollectionMethod(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "paymentCollectionMethod is required",
      });
    });

    it("should 400 if organisationId missing", async () => {
      req.params = { invoiceId: "inv1" };
      req.body = { paymentCollectionMethod: "AUTO" };

      await InvoiceController.updatePaymentCollectionMethod(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("should success (200)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { paymentCollectionMethod: "AUTO" };
      mockedInvoiceService.updatePaymentCollectionMethod.mockResolvedValue({
        id: "inv1",
      } as any);

      await InvoiceController.updatePaymentCollectionMethod(
        req as any,
        res as Response,
      );

      expect(
        mockedInvoiceService.updatePaymentCollectionMethod,
      ).toHaveBeenCalledWith("inv1", "org1", "AUTO");
      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope({ id: "inv1" });
    });

    it("should handle service error with custom status", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { paymentCollectionMethod: "AUTO" };
      mockServiceError("updatePaymentCollectionMethod", 422, "Bad");

      await InvoiceController.updatePaymentCollectionMethod(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad" });
    });

    it("should handle generic error (500)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { paymentCollectionMethod: "AUTO" };
      mockGenericError("updatePaymentCollectionMethod");

      await InvoiceController.updatePaymentCollectionMethod(
        req as any,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("issueCreditNote", () => {
    it("should 400 if invoiceId missing", async () => {
      (req as any).organisationId = "org1";
      req.params = {};
      req.body = { amount: 10 };

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
    });

    it("should 400 if organisationId missing", async () => {
      req.params = { invoiceId: "inv1" };
      req.body = { amount: 10 };

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
      expect(mockedInvoiceService.issueCreditNote).not.toHaveBeenCalled();
    });

    it("should 400 if amount is zero or negative", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { amount: 0 };

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Credit note amount is required",
      });
    });

    it("should 400 if amount is not a number", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { amount: "25" };

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Credit note amount is required",
      });
    });

    it("should 400 if amount is not finite", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { amount: Number.POSITIVE_INFINITY };

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Credit note amount is required",
      });
    });

    it("should default reason/metadata when omitted or invalid", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      // reason is a non-string, metadata is an array (invalid) => both undefined
      req.body = { amount: 25, reason: 42, metadata: ["not", "valid"] };
      mockedInvoiceService.issueCreditNote.mockResolvedValue({
        id: "cn_1",
      } as any);

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(mockedInvoiceService.issueCreditNote).toHaveBeenCalledWith(
        "inv1",
        {
          amount: 25,
          reason: undefined,
          metadata: undefined,
        },
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("should reject metadata that is a truthy non-object", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { amount: 25, metadata: "not-an-object" };
      mockedInvoiceService.issueCreditNote.mockResolvedValue({
        id: "cn_1",
      } as any);

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(mockedInvoiceService.issueCreditNote).toHaveBeenCalledWith(
        "inv1",
        {
          amount: 25,
          reason: undefined,
          metadata: undefined,
        },
      );
    });

    it("should reject metadata with non-primitive values", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = {
        amount: 25,
        metadata: { nested: { deep: true } },
      };
      mockedInvoiceService.issueCreditNote.mockResolvedValue({
        id: "cn_1",
      } as any);

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(mockedInvoiceService.issueCreditNote).toHaveBeenCalledWith(
        "inv1",
        {
          amount: 25,
          reason: undefined,
          metadata: undefined,
        },
      );
    });

    it("should accept metadata with mixed primitive values", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = {
        amount: 25,
        metadata: { a: "x", b: 1, c: true },
      };
      mockedInvoiceService.issueCreditNote.mockResolvedValue({
        id: "cn_1",
      } as any);

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(mockedInvoiceService.issueCreditNote).toHaveBeenCalledWith(
        "inv1",
        {
          amount: 25,
          reason: undefined,
          metadata: { a: "x", b: 1, c: true },
        },
      );
    });

    it("should success (201)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = {
        amount: 25,
        reason: "Billing correction",
        metadata: { source: "manual" },
      };
      mockedInvoiceService.issueCreditNote.mockResolvedValue({
        id: "cn_1",
      } as any);

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(mockedInvoiceService.issueCreditNote).toHaveBeenCalledWith(
        "inv1",
        {
          amount: 25,
          reason: "Billing correction",
          metadata: { source: "manual" },
        },
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expectFinanceEnvelope({ id: "cn_1" });
    });

    it("should handle service error with custom status", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { amount: 25 };
      mockServiceError("issueCreditNote", 409, "Too much");

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Too much" });
    });

    it("should handle generic error (500)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" };
      req.body = { amount: 25 };
      mockGenericError("issueCreditNote");

      await InvoiceController.issueCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("voidCreditNote", () => {
    it("should 400 if invoiceId missing", async () => {
      (req as any).organisationId = "org1";
      req.params = { creditNoteId: "cn1" } as any;
      req.body = {};

      await InvoiceController.voidCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
      expect(mockedInvoiceService.voidCreditNote).not.toHaveBeenCalled();
    });

    it("should 400 if creditNoteId missing", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1" } as any;
      req.body = {};

      await InvoiceController.voidCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Credit note Id is required",
      });
    });

    it("should 400 if organisationId missing", async () => {
      req.params = { invoiceId: "inv1", creditNoteId: "cn1" };
      req.body = {};

      await InvoiceController.voidCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
      expect(mockedInvoiceService.voidCreditNote).not.toHaveBeenCalled();
    });

    it("should success (200)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1", creditNoteId: "cn1" };
      req.body = { reason: "Entered in error" };
      mockedInvoiceService.voidCreditNote.mockResolvedValue({
        id: "cn1",
        status: "VOIDED",
      } as any);

      await InvoiceController.voidCreditNote(req as any, res as Response);

      expect(mockedInvoiceService.voidCreditNote).toHaveBeenCalledWith(
        "inv1",
        "cn1",
        "Entered in error",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expectFinanceEnvelope({
        id: "cn1",
        status: "VOIDED",
      });
    });

    it("should handle service error with custom status", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1", creditNoteId: "cn1" };
      req.body = {};
      mockServiceError("voidCreditNote", 409, "Cannot void");

      await InvoiceController.voidCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Cannot void" });
    });

    it("should handle generic error (500)", async () => {
      (req as any).organisationId = "org1";
      req.params = { invoiceId: "inv1", creditNoteId: "cn1" };
      req.body = {};
      mockGenericError("voidCreditNote");

      await InvoiceController.voidCreditNote(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });
});
