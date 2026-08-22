import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { Request, Response } from "express";
import { FinanceController } from "../../../src/controllers/app/finance.controller";
import { StripeService } from "../../../src/services/stripe.service";
import {
  InvoiceService,
  InvoiceServiceError,
} from "../../../src/services/invoice.service";
import {
  FinancePaymentService,
  FinancePaymentError,
} from "../../../src/services/finance/payment";
import { FinanceSubscriptionService } from "../../../src/services/finance/subscription";
import {
  FinanceEventService,
  resolveActorDisplayName,
} from "../../../src/services/finance/events";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "../../../src/services/appointment.prisma.service";
import {
  FinanceDiscountSettingsError,
  FinanceDiscountSettingsService,
} from "../../../src/services/finance/discount-settings";
import { StripeController } from "../../../src/controllers/web/stripe.controller";
import { resolveVerifiedUserId } from "../../../src/utils/request";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/stripe.service", () => ({
  StripeService: {
    retrievePaymentIntent: jest.fn(),
  },
}));

jest.mock("../../../src/services/invoice.service", () => ({
  InvoiceServiceError: class InvoiceServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "InvoiceServiceError";
    }
  },
  InvoiceService: {
    createDraftForAppointment: jest.fn(),
    listForOrganisation: jest.fn(),
    getByAppointmentId: jest.fn(),
    listForParent: jest.fn(),
    listForCompanion: jest.fn(),
    addItemsToInvoice: jest.fn(),
    getById: jest.fn(),
    bootstrapForAppointment: jest.fn(),
    finalizeTaxForInvoice: jest.fn(),
    previewTaxForInvoice: jest.fn(),
    markAppointmentReadyForBilling: jest.fn(),
    reverseAppointmentReadyForBilling: jest.fn(),
    settleInvoiceAtCloseout: jest.fn(),
    handleInvoiceCancellation: jest.fn(),
    addChargesToAppointment: jest.fn(),
  },
}));

jest.mock("../../../src/services/finance/payment", () => ({
  FinancePaymentError: class FinancePaymentError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "FinancePaymentError";
    }
  },
  FinancePaymentService: {
    recordInvoicePayment: jest.fn(),
    refundPaymentById: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
    createPaymentIntentForInvoice: jest.fn(),
  },
}));

jest.mock("../../../src/services/finance/subscription", () => ({
  FinanceSubscriptionService: {
    getSubscriptionOverview: jest.fn(),
    resolveSubscriptionSeatSyncPlan: jest.fn(),
    getUsageOverview: jest.fn(),
    getCurrentSubscription: jest.fn(),
    upsertSubscription: jest.fn(),
    listUsageSnapshots: jest.fn(),
    recordBusinessCheckoutCustomer: jest.fn(),
    recordBusinessCheckoutCompleted: jest.fn(),
    recordSubscriptionUpdated: jest.fn(),
    recordSubscriptionDeleted: jest.fn(),
    recordSubscriptionInvoicePaid: jest.fn(),
    recordSubscriptionInvoiceFailed: jest.fn(),
    recordUsageEvent: jest.fn(),
    captureUsageSnapshot: jest.fn(),
  },
}));

jest.mock("../../../src/services/finance/events", () => ({
  FinanceEventService: {
    recordEvent: jest.fn(),
  },
  resolveActorDisplayName: jest.fn(),
}));

jest.mock("../../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../../src/services/appointment.prisma.service", () => ({
  AppointmentPrismaServiceError: class AppointmentPrismaServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "AppointmentPrismaServiceError";
    }
  },
  AppointmentPrismaService: {
    getById: jest.fn(),
  },
}));

jest.mock("../../../src/controllers/web/stripe.controller", () => ({
  StripeController: {
    webhook: jest.fn(),
  },
}));

jest.mock("../../../src/utils/request", () => ({
  resolveVerifiedUserId: jest.fn(),
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("FinanceController", () => {
  const mockedStripeService = jest.mocked(StripeService);
  const mockedInvoiceService = jest.mocked(InvoiceService);
  const mockedPaymentService = jest.mocked(FinancePaymentService);
  const mockedSubscriptionService = jest.mocked(FinanceSubscriptionService);
  const mockedEventService = jest.mocked(FinanceEventService);
  const mockedResolveActorDisplayName = jest.mocked(resolveActorDisplayName);
  const mockedAuthUserMobileService = jest.mocked(AuthUserMobileService);
  const mockedAppointmentPrismaService = jest.mocked(AppointmentPrismaService);
  const mockedStripeController = jest.mocked(StripeController);
  const mockedResolveUserIdFromRequest = jest.mocked(resolveVerifiedUserId);
  const mockedLogger = jest.mocked(logger);

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  const setReq = (overrides: {
    params?: Record<string, string>;
    body?: unknown;
    query?: unknown;
    organisationId?: string;
    userId?: string;
  }) => {
    req.params = overrides.params ?? {};
    req.body = overrides.body ?? {};
    req.query = (overrides.query ?? {}) as Request["query"];
    (req as unknown as { organisationId?: string }).organisationId =
      overrides.organisationId;
    (req as unknown as { userId?: string }).userId = overrides.userId;
  };

  const run = (handler: (req: Request, res: Response) => unknown) =>
    Promise.resolve(handler(req as Request, res as Response));

  const invoiceItem = {
    name: "Consultation",
    quantity: 1,
    unitPrice: 100,
    total: 100,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: {},
      body: {},
      query: {},
    } as unknown as Partial<Request>;
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  });

  describe("createInvoice", () => {
    const validBody = {
      appointmentId: "appt-1",
      parentId: "parent-1",
      patientId: "pat-1",
      organisationId: "org-1",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [
        {
          name: "A",
          quantity: 1,
          unitPrice: 10,
          total: 10,
          description: "d-A",
        },
        { name: "B", quantity: 2, unitPrice: 5, total: 10 },
      ],
      invoiceDiscount: { type: "PERCENTAGE", value: 10 },
      notes: "note",
    };

    it("rejects an invalid body with 400", async () => {
      setReq({ body: {} });

      await run(FinanceController.createInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("creates a draft invoice and defaults item description to name", async () => {
      setReq({ body: validBody });
      mockedInvoiceService.createDraftForAppointment.mockResolvedValueOnce({
        id: "inv-1",
      } as never);

      await run(FinanceController.createInvoice);

      expect(
        mockedInvoiceService.createDraftForAppointment,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: "appt-1",
          items: [
            expect.objectContaining({ name: "A", description: "d-A" }),
            expect.objectContaining({ name: "B", description: "B" }),
          ],
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: { id: "inv-1" },
        meta: null,
        error: null,
      });
    });

    it("maps InvoiceServiceError to its status code", async () => {
      setReq({ body: validBody });
      mockedInvoiceService.createDraftForAppointment.mockRejectedValueOnce(
        new InvoiceServiceError("Appointment not found", 404) as never,
      );

      await run(FinanceController.createInvoice);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Appointment not found",
      });
    });

    it("maps unknown errors to 500", async () => {
      setReq({ body: validBody });
      mockedInvoiceService.createDraftForAppointment.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.createInvoice);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("listInvoices", () => {
    it("rejects an invalid query with 400", async () => {
      setReq({ query: { organisationId: "" } });

      await run(FinanceController.listInvoices);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request query",
      });
    });

    it("scopes to the appointment when both organisationId and appointmentId are provided", async () => {
      setReq({
        query: { organisationId: "org-1", appointmentId: "appt-1" },
        organisationId: "org-1",
      });
      mockedInvoiceService.getByAppointmentId.mockResolvedValueOnce([
        { id: "inv-1" },
      ] as never);

      await run(FinanceController.listInvoices);

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "appt-1",
        { organisationId: "org-1" },
      );
      expect(mockedInvoiceService.listForOrganisation).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("scopes appointment invoices to the authorized org, not the raw query value", async () => {
      setReq({
        query: { appointmentId: "appt-other-org" },
        organisationId: "org-auth",
      });
      mockedInvoiceService.getByAppointmentId.mockResolvedValueOnce(
        [] as never,
      );

      await run(FinanceController.listInvoices);

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "appt-other-org",
        { organisationId: "org-auth" },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists organisation invoices when only organisationId is provided", async () => {
      setReq({ query: { organisationId: "org-1" }, organisationId: "org-1" });
      mockedInvoiceService.listForOrganisation.mockResolvedValueOnce(
        [] as never,
      );

      await run(FinanceController.listInvoices);

      expect(mockedInvoiceService.listForOrganisation).toHaveBeenCalledWith(
        "org-1",
      );
      expect(mockedInvoiceService.getByAppointmentId).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists parent invoices when only parentId is provided", async () => {
      setReq({ query: { parentId: "parent-1" }, organisationId: "org-1" });
      mockedInvoiceService.listForParent.mockResolvedValueOnce([] as never);

      await run(FinanceController.listInvoices);

      expect(mockedInvoiceService.listForParent).toHaveBeenCalledWith(
        "parent-1",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists companion invoices when only patientId is provided", async () => {
      setReq({ query: { patientId: "pat-1" }, organisationId: "org-1" });
      mockedInvoiceService.listForCompanion.mockResolvedValueOnce([] as never);

      await run(FinanceController.listInvoices);

      expect(mockedInvoiceService.listForCompanion).toHaveBeenCalledWith(
        "pat-1",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("rejects when no filter is provided", async () => {
      setReq({ query: {}, organisationId: "org-1" });

      await run(FinanceController.listInvoices);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message:
          "At least one of organisationId, appointmentId, parentId, or patientId is required",
      });
    });

    it("rejects when a filter is present but no authorized organisation resolves", async () => {
      setReq({ query: { parentId: "parent-1" } });

      await run(FinanceController.listInvoices);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("returns 500 when a lookup throws", async () => {
      setReq({
        query: { organisationId: "org-1", appointmentId: "appt-1" },
        organisationId: "org-1",
      });
      mockedInvoiceService.getByAppointmentId.mockRejectedValueOnce(
        new Error("db down") as never,
      );

      await run(FinanceController.listInvoices);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listInvoicesForOrganisation", () => {
    it("rejects a missing organisation param with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.listInvoicesForOrganisation);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("returns 404 when the authorized org does not match the param", async () => {
      setReq({ params: { organisationId: "org-2" }, organisationId: "org-1" });

      await run(FinanceController.listInvoicesForOrganisation);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation not found",
      });
    });

    it("returns 404 when there is no authorized organisation", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.listInvoicesForOrganisation);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("lists the organisation invoices when authorized", async () => {
      setReq({ params: { organisationId: "org-1" }, organisationId: "org-1" });
      mockedInvoiceService.listForOrganisation.mockResolvedValueOnce([
        { id: "inv-1" },
      ] as never);

      await run(FinanceController.listInvoicesForOrganisation);

      expect(mockedInvoiceService.listForOrganisation).toHaveBeenCalledWith(
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 when the lookup throws", async () => {
      setReq({ params: { organisationId: "org-1" }, organisationId: "org-1" });
      mockedInvoiceService.listForOrganisation.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.listInvoicesForOrganisation);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("addInvoiceItems", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.addInvoiceItems);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });

      await run(FinanceController.addInvoiceItems);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("adds items and returns the updated invoice", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
      });
      mockedInvoiceService.addItemsToInvoice.mockResolvedValueOnce({
        id: "inv-1",
      } as never);

      await run(FinanceController.addInvoiceItems);

      expect(mockedInvoiceService.addItemsToInvoice).toHaveBeenCalledWith(
        "inv-1",
        [invoiceItem],
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
      });
      mockedInvoiceService.addItemsToInvoice.mockRejectedValueOnce(
        new InvoiceServiceError("locked", 409) as never,
      );

      await run(FinanceController.addInvoiceItems);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ message: "locked" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
      });
      mockedInvoiceService.addItemsToInvoice.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.addInvoiceItems);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listInvoicesForAppointment", () => {
    it("rejects a missing appointment id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.listInvoicesForAppointment);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Appointment Id is required",
      });
    });

    it("returns 403 when neither an org nor a mobile parent resolves", async () => {
      setReq({ params: { appointmentId: "appt-1" } });

      await run(FinanceController.listInvoicesForAppointment);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
    });

    it("lists invoices for the org scope", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedInvoiceService.getByAppointmentId.mockResolvedValueOnce(
        [] as never,
      );

      await run(FinanceController.listInvoicesForAppointment);

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "appt-1",
        { organisationId: "org-1", parentId: null },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists invoices for the mobile parent scope", async () => {
      setReq({ params: { appointmentId: "appt-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedInvoiceService.getByAppointmentId.mockResolvedValueOnce(
        [] as never,
      );

      await run(FinanceController.listInvoicesForAppointment);

      expect(mockedInvoiceService.getByAppointmentId).toHaveBeenCalledWith(
        "appt-1",
        { organisationId: null, parentId: "parent-1" },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedInvoiceService.getByAppointmentId.mockRejectedValueOnce(
        new InvoiceServiceError("nope", 403) as never,
      );

      await run(FinanceController.listInvoicesForAppointment);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ message: "nope" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedInvoiceService.getByAppointmentId.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.listInvoicesForAppointment);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listInvoicesForParent", () => {
    it("rejects a missing parent id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.listInvoicesForParent);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent Id is required",
      });
    });

    it("returns 403 when the mobile user has no linked parent", async () => {
      setReq({ params: { parentId: "parent-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce(
        null as never,
      );

      await run(FinanceController.listInvoicesForParent);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
    });

    it("returns 403 when accessing another parent's invoices", async () => {
      setReq({ params: { parentId: "parent-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-2",
      } as never);

      await run(FinanceController.listInvoicesForParent);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Cannot access invoices for another parent",
      });
    });

    it("lists invoices for the authenticated matching parent", async () => {
      setReq({
        params: { parentId: "parent-1" },
        userId: "user-1",
        organisationId: "org-1",
      });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedInvoiceService.listForParent.mockResolvedValueOnce([] as never);

      await run(FinanceController.listInvoicesForParent);

      expect(mockedInvoiceService.listForParent).toHaveBeenCalledWith(
        "parent-1",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists invoices without a userId, defaulting org scope to null", async () => {
      setReq({ params: { parentId: "parent-1" } });
      mockedInvoiceService.listForParent.mockResolvedValueOnce([] as never);

      await run(FinanceController.listInvoicesForParent);

      expect(
        mockedAuthUserMobileService.getByProviderUserId,
      ).not.toHaveBeenCalled();
      expect(mockedInvoiceService.listForParent).toHaveBeenCalledWith(
        "parent-1",
        null,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 when the lookup throws", async () => {
      setReq({ params: { parentId: "parent-1" } });
      mockedInvoiceService.listForParent.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.listInvoicesForParent);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getInvoiceById", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.getInvoiceById);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 403 when no scope resolves", async () => {
      setReq({ params: { invoiceId: "inv-1" } });

      await run(FinanceController.getInvoiceById);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("returns the invoice for the resolved scope", async () => {
      setReq({ params: { invoiceId: "inv-1" }, organisationId: "org-1" });
      mockedInvoiceService.getById.mockResolvedValueOnce({
        invoice: { id: "inv-1" },
      } as never);

      await run(FinanceController.getInvoiceById);

      expect(mockedInvoiceService.getById).toHaveBeenCalledWith("inv-1", {
        organisationId: "org-1",
        parentId: null,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({ params: { invoiceId: "inv-1" }, organisationId: "org-1" });
      mockedInvoiceService.getById.mockRejectedValueOnce(
        new InvoiceServiceError("missing", 404) as never,
      );

      await run(FinanceController.getInvoiceById);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { invoiceId: "inv-1" }, organisationId: "org-1" });
      mockedInvoiceService.getById.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.getInvoiceById);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("retrievePaymentIntent", () => {
    it("retrieves the Stripe payment intent by id", async () => {
      setReq({
        params: { paymentIntentId: "pi_123" },
        organisationId: "org-1",
      });
      mockedStripeService.retrievePaymentIntent.mockResolvedValueOnce({
        id: "pi_123",
        amount: 2500,
        currency: "usd",
      } as never);

      await run(FinanceController.retrievePaymentIntent);

      expect(mockedStripeService.retrievePaymentIntent).toHaveBeenCalledWith(
        "pi_123",
        { organisationId: "org-1", parentId: null },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: { id: "pi_123", amount: 2500, currency: "usd" },
        meta: null,
        error: null,
      });
    });

    it("rejects missing payment intent ids", async () => {
      setReq({ params: {}, organisationId: "org-1" });

      await run(FinanceController.retrievePaymentIntent);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Payment Intent Id is required",
      });
    });

    it("returns 403 when no scope resolves", async () => {
      setReq({ params: { paymentIntentId: "pi_123" } });

      await run(FinanceController.retrievePaymentIntent);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("maps FinancePaymentError to its status", async () => {
      setReq({
        params: { paymentIntentId: "pi_123" },
        organisationId: "org-1",
      });
      mockedStripeService.retrievePaymentIntent.mockRejectedValueOnce(
        new FinancePaymentError("forbidden", 402) as never,
      );

      await run(FinanceController.retrievePaymentIntent);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(jsonMock).toHaveBeenCalledWith({ message: "forbidden" });
    });

    it("returns a 500 on unexpected Stripe errors", async () => {
      setReq({
        params: { paymentIntentId: "pi_123" },
        organisationId: "org-1",
      });
      mockedStripeService.retrievePaymentIntent.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.retrievePaymentIntent);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("bootstrapInvoiceForAppointment", () => {
    it("rejects a missing appointment id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 403 when the mobile parent cannot be resolved", async () => {
      setReq({ params: { appointmentId: "appt-1" } });

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Forbidden" });
    });

    it("returns 403 when the mobile user has no linked parent", async () => {
      setReq({ params: { appointmentId: "appt-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: null,
      } as never);

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(
        mockedAuthUserMobileService.getByProviderUserId,
      ).toHaveBeenCalledWith("user-1");
      expect(mockedAppointmentPrismaService.getById).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Forbidden" });
    });

    it("bootstraps the invoice for a linked appointment", async () => {
      setReq({ params: { appointmentId: "appt-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedAppointmentPrismaService.getById.mockResolvedValueOnce({
        id: "appt-1",
      } as never);
      mockedInvoiceService.bootstrapForAppointment.mockResolvedValueOnce({
        id: "inv-1",
      } as never);

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(mockedAppointmentPrismaService.getById).toHaveBeenCalledWith(
        "appt-1",
        { parentId: "parent-1" },
      );
      expect(mockedInvoiceService.bootstrapForAppointment).toHaveBeenCalledWith(
        "appt-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({ params: { appointmentId: "appt-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedAppointmentPrismaService.getById.mockResolvedValueOnce({} as never);
      mockedInvoiceService.bootstrapForAppointment.mockRejectedValueOnce(
        new InvoiceServiceError("bad", 422) as never,
      );

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({ message: "bad" });
    });

    it("maps AppointmentPrismaServiceError to its status", async () => {
      setReq({ params: { appointmentId: "appt-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedAppointmentPrismaService.getById.mockRejectedValueOnce(
        new AppointmentPrismaServiceError("not found", 404) as never,
      );

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "not found" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { appointmentId: "appt-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedAppointmentPrismaService.getById.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.bootstrapInvoiceForAppointment);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("finalizeInvoice", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.finalizeInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { taxProvider: "" } });

      await run(FinanceController.finalizeInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("finalizes tax for the invoice", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { taxProvider: "stripe-tax" },
      });
      mockedInvoiceService.finalizeTaxForInvoice.mockResolvedValueOnce({
        id: "inv-1",
      } as never);

      await run(FinanceController.finalizeInvoice);

      expect(mockedInvoiceService.finalizeTaxForInvoice).toHaveBeenCalledWith(
        "inv-1",
        "stripe-tax",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedInvoiceService.finalizeTaxForInvoice.mockRejectedValueOnce(
        new InvoiceServiceError("tax fail", 502) as never,
      );

      await run(FinanceController.finalizeInvoice);

      expect(statusMock).toHaveBeenCalledWith(502);
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedInvoiceService.finalizeTaxForInvoice.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.finalizeInvoice);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("settleInvoiceAtCloseout", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { reference: "" } });

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("settles an invoice at visit closeout", async () => {
      setReq({
        params: { invoiceId: "inv-closeout" },
        body: {
          settlementChannel: "CASH",
          reference: "front-desk",
          receivedAt: "2026-06-24T10:15:00.000Z",
        },
        organisationId: "org-1",
      });
      mockedInvoiceService.settleInvoiceAtCloseout.mockResolvedValueOnce({
        id: "inv-closeout",
        status: "PAID",
      } as never);

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(mockedInvoiceService.settleInvoiceAtCloseout).toHaveBeenCalledWith(
        "inv-closeout",
        "org-1",
        expect.objectContaining({
          settlementChannel: "CASH",
          reference: "front-desk",
          receivedAt: new Date("2026-06-24T10:15:00.000Z"),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("settles with defaulted optional fields when omitted", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.settleInvoiceAtCloseout.mockResolvedValueOnce({
        id: "inv-1",
      } as never);

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(mockedInvoiceService.settleInvoiceAtCloseout).toHaveBeenCalledWith(
        "inv-1",
        "org-1",
        expect.objectContaining({
          settlementChannel: undefined,
          receivedAt: undefined,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.settleInvoiceAtCloseout.mockRejectedValueOnce(
        new InvoiceServiceError("cannot settle", 409) as never,
      );

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it("maps FinancePaymentError to its status", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.settleInvoiceAtCloseout.mockRejectedValueOnce(
        new FinancePaymentError("payment issue", 402) as never,
      );

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(jsonMock).toHaveBeenCalledWith({ message: "payment issue" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.settleInvoiceAtCloseout.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.settleInvoiceAtCloseout);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("previewInvoiceTax", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.previewInvoiceTax);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { taxProvider: "" } });

      await run(FinanceController.previewInvoiceTax);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("previews the tax for the invoice", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedInvoiceService.previewTaxForInvoice.mockResolvedValueOnce({
        tax: 5,
      } as never);

      await run(FinanceController.previewInvoiceTax);

      expect(mockedInvoiceService.previewTaxForInvoice).toHaveBeenCalledWith(
        "inv-1",
        undefined,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedInvoiceService.previewTaxForInvoice.mockRejectedValueOnce(
        new InvoiceServiceError("no tax", 422) as never,
      );

      await run(FinanceController.previewInvoiceTax);

      expect(statusMock).toHaveBeenCalledWith(422);
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedInvoiceService.previewTaxForInvoice.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.previewInvoiceTax);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getSubscriptionOverview", () => {
    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.getSubscriptionOverview);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns the subscription overview", async () => {
      setReq({ params: { organisationId: "org-1" } });
      mockedSubscriptionService.getSubscriptionOverview.mockResolvedValueOnce({
        plan: "TEAM",
      } as never);

      await run(FinanceController.getSubscriptionOverview);

      expect(
        mockedSubscriptionService.getSubscriptionOverview,
      ).toHaveBeenCalledWith("org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: { organisationId: "org-1" } });
      mockedSubscriptionService.getSubscriptionOverview.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.getSubscriptionOverview);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getSubscriptionSeatSyncPlan", () => {
    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.getSubscriptionSeatSyncPlan);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns the seat sync plan", async () => {
      setReq({ params: { organisationId: "org-1" } });
      mockedSubscriptionService.resolveSubscriptionSeatSyncPlan.mockResolvedValueOnce(
        { seats: 5 } as never,
      );

      await run(FinanceController.getSubscriptionSeatSyncPlan);

      expect(
        mockedSubscriptionService.resolveSubscriptionSeatSyncPlan,
      ).toHaveBeenCalledWith("org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: { organisationId: "org-1" } });
      mockedSubscriptionService.resolveSubscriptionSeatSyncPlan.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.getSubscriptionSeatSyncPlan);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getUsageOverview", () => {
    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.getUsageOverview);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns the usage overview", async () => {
      setReq({ params: { organisationId: "org-1" } });
      mockedSubscriptionService.getUsageOverview.mockResolvedValueOnce({
        used: 3,
      } as never);

      await run(FinanceController.getUsageOverview);

      expect(mockedSubscriptionService.getUsageOverview).toHaveBeenCalledWith(
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: { organisationId: "org-1" } });
      mockedSubscriptionService.getUsageOverview.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.getUsageOverview);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getCurrentSubscription", () => {
    it("rejects an invalid query with 400", async () => {
      setReq({ query: {} });

      await run(FinanceController.getCurrentSubscription);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns the current subscription", async () => {
      setReq({ query: { organisationId: "org-1" } });
      mockedSubscriptionService.getCurrentSubscription.mockResolvedValueOnce({
        id: "sub-1",
      } as never);

      await run(FinanceController.getCurrentSubscription);

      expect(
        mockedSubscriptionService.getCurrentSubscription,
      ).toHaveBeenCalledWith("org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ query: { organisationId: "org-1" } });
      mockedSubscriptionService.getCurrentSubscription.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.getCurrentSubscription);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("upsertSubscription", () => {
    const validBody = {
      organisationId: "org-1",
      planCode: "TEAM",
      provider: "STRIPE",
      providerSubscriptionId: "sub_1",
      quantity: 3,
    };

    it("rejects an invalid body with 400", async () => {
      setReq({ body: {} });

      await run(FinanceController.upsertSubscription);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("upserts the subscription", async () => {
      setReq({ body: validBody });
      mockedSubscriptionService.upsertSubscription.mockResolvedValueOnce({
        id: "sub-1",
      } as never);

      await run(FinanceController.upsertSubscription);

      expect(mockedSubscriptionService.upsertSubscription).toHaveBeenCalledWith(
        {
          orgId: "org-1",
          planCode: "TEAM",
          provider: "STRIPE",
          providerSubscriptionId: "sub_1",
          quantity: 3,
        },
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 500 on failure", async () => {
      setReq({ body: validBody });
      mockedSubscriptionService.upsertSubscription.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.upsertSubscription);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getUsageSnapshots", () => {
    it("rejects an invalid query with 400", async () => {
      setReq({ query: {} });

      await run(FinanceController.getUsageSnapshots);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("lists snapshots with null defaults when optional filters are omitted", async () => {
      setReq({ query: { organisationId: "org-1" } });
      mockedSubscriptionService.listUsageSnapshots.mockResolvedValueOnce(
        [] as never,
      );

      await run(FinanceController.getUsageSnapshots);

      expect(mockedSubscriptionService.listUsageSnapshots).toHaveBeenCalledWith(
        "org-1",
        { subscriptionId: null, featureKey: null },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("lists snapshots with provided filters", async () => {
      setReq({
        query: {
          organisationId: "org-1",
          subscriptionId: "sub-1",
          featureKey: "seats",
        },
      });
      mockedSubscriptionService.listUsageSnapshots.mockResolvedValueOnce(
        [] as never,
      );

      await run(FinanceController.getUsageSnapshots);

      expect(mockedSubscriptionService.listUsageSnapshots).toHaveBeenCalledWith(
        "org-1",
        { subscriptionId: "sub-1", featureKey: "seats" },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ query: { organisationId: "org-1" } });
      mockedSubscriptionService.listUsageSnapshots.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.getUsageSnapshots);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordSubscriptionCustomer", () => {
    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordSubscriptionCustomer);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("rejects an invalid provider param with 400", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.recordSubscriptionCustomer);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid provider" });
    });

    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { organisationId: "org-1", provider: "paypal" } });

      await run(FinanceController.recordSubscriptionCustomer);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({
        params: { organisationId: "org-1", provider: "stripe" },
        body: {},
      });

      await run(FinanceController.recordSubscriptionCustomer);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("records the subscription customer", async () => {
      setReq({
        params: { organisationId: "org-1", provider: "stripe" },
        body: { externalCustomerId: "cus_1" },
      });
      mockedSubscriptionService.recordBusinessCheckoutCustomer.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionCustomer);

      expect(
        mockedSubscriptionService.recordBusinessCheckoutCustomer,
      ).toHaveBeenCalledWith({ orgId: "org-1", externalCustomerId: "cus_1" });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          organisationId: "org-1",
          provider: "STRIPE",
          externalCustomerId: "cus_1",
        },
        meta: null,
        error: null,
      });
    });

    it("returns 500 on failure", async () => {
      setReq({
        params: { organisationId: "org-1", provider: "stripe" },
        body: { externalCustomerId: "cus_1" },
      });
      mockedSubscriptionService.recordBusinessCheckoutCustomer.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordSubscriptionCustomer);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordVisitMilestone", () => {
    it("rejects a missing visit id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordVisitMilestone);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Visit Id is required",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { visitId: "visit-1" }, body: {} });

      await run(FinanceController.recordVisitMilestone);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 403 when the org is not authorized", async () => {
      setReq({
        params: { visitId: "visit-1" },
        body: { milestone: "CHECKED_IN", organisationId: "org-2" },
        organisationId: "org-1",
      });

      await run(FinanceController.recordVisitMilestone);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation is not authorized",
      });
    });

    it("returns 404 when READY_FOR_BILLING has no invoice", async () => {
      setReq({
        params: { visitId: "visit-1" },
        body: { milestone: "READY_FOR_BILLING", organisationId: "org-1" },
        organisationId: "org-1",
      });
      mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValueOnce(
        null as never,
      );

      await run(FinanceController.recordVisitMilestone);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Invoice not found" });
    });

    it("records a READY_FOR_BILLING milestone and its invoice", async () => {
      setReq({
        params: { visitId: "visit-1" },
        body: {
          milestone: "READY_FOR_BILLING",
          organisationId: "org-1",
          appointmentId: "appt-1",
          patientId: "pat-1",
          metadata: { note: "x" },
        },
        organisationId: "org-1",
      });
      mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValueOnce(
        {
          id: "inv-1",
          visitBillingStage: "READY_FOR_BILLING",
          billingCollectionMode: "DEPOSIT_THEN_SETTLE",
        } as never,
      );
      mockedEventService.recordEvent.mockResolvedValueOnce(undefined as never);

      await run(FinanceController.recordVisitMilestone);

      expect(
        mockedInvoiceService.markAppointmentReadyForBilling,
      ).toHaveBeenCalledWith("appt-1", { organisationId: "org-1" });
      expect(mockedEventService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "VISIT_MILESTONE_RECORDED",
          entityId: "visit-1",
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          visitId: "visit-1",
          appointmentId: "appt-1",
          milestone: "READY_FOR_BILLING",
          billingState: "READY_FOR_BILLING",
          invoiceId: "inv-1",
          collectionMode: "DEPOSIT_THEN_SETTLE",
        },
        meta: null,
        error: null,
      });
    });

    it("records a non-billing milestone without touching the invoice", async () => {
      setReq({
        params: { visitId: "visit-1" },
        body: { milestone: "CHECKED_IN", organisationId: "org-1" },
        organisationId: "org-1",
      });
      mockedEventService.recordEvent.mockResolvedValueOnce(undefined as never);

      await run(FinanceController.recordVisitMilestone);

      expect(
        mockedInvoiceService.markAppointmentReadyForBilling,
      ).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          visitId: "visit-1",
          appointmentId: "visit-1",
          milestone: "CHECKED_IN",
          billingState: null,
          invoiceId: null,
          collectionMode: null,
        },
        meta: null,
        error: null,
      });
    });

    it("returns 500 on failure", async () => {
      setReq({
        params: { visitId: "visit-1" },
        body: { milestone: "CHECKED_IN", organisationId: "org-1" },
        organisationId: "org-1",
      });
      mockedEventService.recordEvent.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordVisitMilestone);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("markAppointmentReadyForBilling", () => {
    it("rejects a missing appointment id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { appointmentId: "appt-1" }, body: { visitId: "" } });

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: { appointmentId: "appt-1" }, body: {} });

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("returns 404 when there is no invoice", async () => {
      setReq({
        params: { appointmentId: "appt-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedResolveUserIdFromRequest.mockReturnValueOnce("user-1");
      mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValueOnce(
        null as never,
      );

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("marks the appointment ready and records the event", async () => {
      setReq({
        params: { appointmentId: "appt-1" },
        body: { visitId: "visit-1", notes: "done" },
        organisationId: "org-1",
      });
      mockedResolveUserIdFromRequest.mockReturnValueOnce("user-1");
      mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValueOnce(
        {
          id: "inv-1",
          visitBillingStage: "READY_FOR_BILLING",
          billingCollectionMode: "SETTLE_LATER",
        } as never,
      );
      mockedResolveActorDisplayName.mockResolvedValueOnce("Dr. Smith" as never);
      mockedEventService.recordEvent.mockResolvedValueOnce(undefined as never);

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(
        mockedInvoiceService.markAppointmentReadyForBilling,
      ).toHaveBeenCalledWith("appt-1", {
        organisationId: "org-1",
        actorUserId: "user-1",
      });
      expect(mockedEventService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "APPOINTMENT_READY_FOR_BILLING",
          payload: expect.objectContaining({
            actorUserId: "user-1",
            actorName: "Dr. Smith",
            invoiceId: "inv-1",
          }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          appointmentId: "appt-1",
          billingState: "READY_FOR_BILLING",
          invoiceId: "inv-1",
          collectionMode: "SETTLE_LATER",
        },
        meta: null,
        error: null,
      });
    });

    it("marks ready with omitted optional fields and a null collection mode", async () => {
      setReq({
        params: { appointmentId: "appt-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedResolveUserIdFromRequest.mockReturnValueOnce(undefined);
      mockedInvoiceService.markAppointmentReadyForBilling.mockResolvedValueOnce(
        {
          id: "inv-1",
          visitBillingStage: "READY_FOR_BILLING",
          billingCollectionMode: null,
        } as never,
      );
      mockedResolveActorDisplayName.mockResolvedValueOnce(null as never);
      mockedEventService.recordEvent.mockResolvedValueOnce(undefined as never);

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(mockedEventService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            visitId: null,
            notes: null,
            actorUserId: null,
            collectionMode: null,
          }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          appointmentId: "appt-1",
          billingState: "READY_FOR_BILLING",
          invoiceId: "inv-1",
          collectionMode: null,
        },
        meta: null,
        error: null,
      });
    });

    it("returns 500 on failure", async () => {
      setReq({
        params: { appointmentId: "appt-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedResolveUserIdFromRequest.mockReturnValueOnce(undefined);
      mockedInvoiceService.markAppointmentReadyForBilling.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.markAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("reverseAppointmentReadyForBilling", () => {
    it("rejects a missing appointment id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.reverseAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: { appointmentId: "appt-1" } });

      await run(FinanceController.reverseAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 404 when there is no invoice", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedResolveUserIdFromRequest.mockReturnValueOnce("user-1");
      mockedInvoiceService.reverseAppointmentReadyForBilling.mockResolvedValueOnce(
        null as never,
      );

      await run(FinanceController.reverseAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("reverses the ready-for-billing state and records the event", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedResolveUserIdFromRequest.mockReturnValueOnce("user-1");
      mockedInvoiceService.reverseAppointmentReadyForBilling.mockResolvedValueOnce(
        {
          id: "inv-1",
          visitBillingStage: "DRAFT",
          billingCollectionMode: null,
        } as never,
      );
      mockedEventService.recordEvent.mockResolvedValueOnce(undefined as never);

      await run(FinanceController.reverseAppointmentReadyForBilling);

      expect(
        mockedInvoiceService.reverseAppointmentReadyForBilling,
      ).toHaveBeenCalledWith("appt-1", {
        organisationId: "org-1",
        actorUserId: "user-1",
      });
      expect(mockedEventService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "APPOINTMENT_READY_FOR_BILLING_REVERSED",
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedResolveUserIdFromRequest.mockReturnValueOnce("user-1");
      mockedInvoiceService.reverseAppointmentReadyForBilling.mockRejectedValueOnce(
        new InvoiceServiceError("cannot reverse", 409) as never,
      );

      await run(FinanceController.reverseAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ message: "cannot reverse" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { appointmentId: "appt-1" }, organisationId: "org-1" });
      mockedResolveUserIdFromRequest.mockReturnValueOnce("user-1");
      mockedInvoiceService.reverseAppointmentReadyForBilling.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.reverseAppointmentReadyForBilling);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordSubscriptionCheckoutCompleted", () => {
    const baseParams = { organisationId: "org-1", provider: "stripe" };
    const validBody = {
      customerId: "cus_1",
      subscriptionId: "sub_1",
      subscriptionItemId: "si_1",
      priceId: "price_1",
    };

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid provider with 400", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid provider" });
    });

    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { organisationId: "org-1", provider: "paypal" } });

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: baseParams, body: {} });

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("records checkout completion with parsed dates", async () => {
      setReq({
        params: baseParams,
        body: {
          ...validBody,
          productId: "prod_1",
          billingInterval: "month",
          subscriptionStatus: "active",
          cancelAtPeriodEnd: false,
          currentPeriodStart: "2026-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
          livemode: true,
          seatQuantity: 5,
        },
      });
      mockedSubscriptionService.recordBusinessCheckoutCompleted.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(
        mockedSubscriptionService.recordBusinessCheckoutCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "cus_1",
          currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
          seatQuantity: 5,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("records checkout completion with nulled optional fields", async () => {
      setReq({ params: baseParams, body: validBody });
      mockedSubscriptionService.recordBusinessCheckoutCompleted.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(
        mockedSubscriptionService.recordBusinessCheckoutCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPeriodStart: null,
          currentPeriodEnd: null,
          productId: null,
          seatQuantity: null,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: baseParams, body: validBody });
      mockedSubscriptionService.recordBusinessCheckoutCompleted.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordSubscriptionCheckoutCompleted);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordSubscriptionUpdated", () => {
    const baseParams = { organisationId: "org-1", provider: "stripe" };

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordSubscriptionUpdated);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid provider with 400", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.recordSubscriptionUpdated);

      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid provider" });
    });

    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { organisationId: "org-1", provider: "paypal" } });

      await run(FinanceController.recordSubscriptionUpdated);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: baseParams, body: {} });

      await run(FinanceController.recordSubscriptionUpdated);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("records the update with parsed dates", async () => {
      setReq({
        params: baseParams,
        body: {
          subscriptionId: "sub_1",
          subscriptionStatus: "past_due",
          cancelAtPeriodEnd: true,
          canceledAt: "2026-03-01T00:00:00.000Z",
          seatQuantity: 2,
          currentPeriodStart: "2026-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
        },
      });
      mockedSubscriptionService.recordSubscriptionUpdated.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionUpdated);

      expect(
        mockedSubscriptionService.recordSubscriptionUpdated,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          canceledAt: new Date("2026-03-01T00:00:00.000Z"),
          currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("records the update with nulled optional fields", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionUpdated.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionUpdated);

      expect(
        mockedSubscriptionService.recordSubscriptionUpdated,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          canceledAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionUpdated.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordSubscriptionUpdated);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordSubscriptionDeleted", () => {
    const baseParams = { organisationId: "org-1", provider: "stripe" };

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordSubscriptionDeleted);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid provider with 400", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.recordSubscriptionDeleted);

      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid provider" });
    });

    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { organisationId: "org-1", provider: "paypal" } });

      await run(FinanceController.recordSubscriptionDeleted);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: baseParams, body: {} });

      await run(FinanceController.recordSubscriptionDeleted);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("records the deletion", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionDeleted.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionDeleted);

      expect(
        mockedSubscriptionService.recordSubscriptionDeleted,
      ).toHaveBeenCalledWith("sub_1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionDeleted.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordSubscriptionDeleted);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordSubscriptionInvoicePaid", () => {
    const baseParams = { organisationId: "org-1", provider: "stripe" };

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid provider with 400", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid provider" });
    });

    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { organisationId: "org-1", provider: "paypal" } });

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: baseParams, body: {} });

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("records the paid invoice with the provided invoice id", async () => {
      setReq({
        params: baseParams,
        body: { subscriptionId: "sub_1", invoiceId: "inv_1" },
      });
      mockedSubscriptionService.recordSubscriptionInvoicePaid.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(
        mockedSubscriptionService.recordSubscriptionInvoicePaid,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_1", invoiceId: "inv_1" });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("defaults the invoice id to null when omitted", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionInvoicePaid.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(
        mockedSubscriptionService.recordSubscriptionInvoicePaid,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_1", invoiceId: null });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionInvoicePaid.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordSubscriptionInvoicePaid);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordSubscriptionInvoiceFailed", () => {
    const baseParams = { organisationId: "org-1", provider: "stripe" };

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid provider with 400", async () => {
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid provider" });
    });

    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { organisationId: "org-1", provider: "paypal" } });

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: baseParams, body: {} });

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("records the failed invoice", async () => {
      setReq({
        params: baseParams,
        body: { subscriptionId: "sub_1", invoiceId: "inv_1" },
      });
      mockedSubscriptionService.recordSubscriptionInvoiceFailed.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(
        mockedSubscriptionService.recordSubscriptionInvoiceFailed,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_1", invoiceId: "inv_1" });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("defaults the invoice id to null when omitted", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionInvoiceFailed.mockResolvedValueOnce(
        undefined as never,
      );

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(
        mockedSubscriptionService.recordSubscriptionInvoiceFailed,
      ).toHaveBeenCalledWith({ subscriptionId: "sub_1", invoiceId: null });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          organisationId: "org-1",
          provider: "STRIPE",
          subscriptionId: "sub_1",
          invoiceId: null,
        },
        meta: null,
        error: null,
      });
    });

    it("returns 500 on failure", async () => {
      setReq({ params: baseParams, body: { subscriptionId: "sub_1" } });
      mockedSubscriptionService.recordSubscriptionInvoiceFailed.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordSubscriptionInvoiceFailed);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordUsageEvent", () => {
    const validBody = {
      usageKey: "appointments",
      quantity: 2,
      source: "system",
    };

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordUsageEvent);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { organisationId: "org-1" }, body: {} });

      await run(FinanceController.recordUsageEvent);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("records a usage event with a parsed occurredAt", async () => {
      setReq({
        params: { organisationId: "org-1" },
        body: {
          ...validBody,
          billableQuantity: 2,
          referenceType: "APPOINTMENT",
          referenceId: "appt-1",
          metadata: { a: 1 },
          occurredAt: "2026-01-01T00:00:00.000Z",
        },
      });
      mockedSubscriptionService.recordUsageEvent.mockResolvedValueOnce({
        id: "evt-1",
      } as never);

      await run(FinanceController.recordUsageEvent);

      expect(mockedSubscriptionService.recordUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          usageKey: "appointments",
          occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("records a usage event with defaulted optional fields", async () => {
      setReq({ params: { organisationId: "org-1" }, body: validBody });
      mockedSubscriptionService.recordUsageEvent.mockResolvedValueOnce({
        id: "evt-1",
      } as never);

      await run(FinanceController.recordUsageEvent);

      expect(mockedSubscriptionService.recordUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceType: null,
          referenceId: null,
          occurredAt: undefined,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: { organisationId: "org-1" }, body: validBody });
      mockedSubscriptionService.recordUsageEvent.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordUsageEvent);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("captureUsageSnapshot", () => {
    it("rejects a missing organisation with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.captureUsageSnapshot);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({
        params: { organisationId: "org-1" },
        body: { seatsActive: -1 },
      });

      await run(FinanceController.captureUsageSnapshot);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("captures a usage snapshot with a parsed snapshotAt", async () => {
      setReq({
        params: { organisationId: "org-1" },
        body: {
          snapshotType: "DAILY",
          seatsActive: 3,
          seatsBillable: 3,
          appointmentsUsed: 10,
          toolsUsed: 4,
          metadata: { a: 1 },
          snapshotAt: "2026-01-01T00:00:00.000Z",
        },
      });
      mockedSubscriptionService.captureUsageSnapshot.mockResolvedValueOnce({
        id: "snap-1",
      } as never);

      await run(FinanceController.captureUsageSnapshot);

      expect(
        mockedSubscriptionService.captureUsageSnapshot,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          snapshotAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("captures a usage snapshot with an undefined snapshotAt", async () => {
      setReq({ params: { organisationId: "org-1" }, body: {} });
      mockedSubscriptionService.captureUsageSnapshot.mockResolvedValueOnce({
        id: "snap-1",
      } as never);

      await run(FinanceController.captureUsageSnapshot);

      expect(
        mockedSubscriptionService.captureUsageSnapshot,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ snapshotAt: undefined }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 500 on failure", async () => {
      setReq({ params: { organisationId: "org-1" }, body: {} });
      mockedSubscriptionService.captureUsageSnapshot.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.captureUsageSnapshot);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("recordInvoicePayment", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.recordInvoicePayment);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });

      await run(FinanceController.recordInvoicePayment);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects a non-manual provider with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { amount: 100 } });

      await run(FinanceController.recordInvoicePayment);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported payment provider",
      });
    });

    it("records a manual payment with the provided settlement channel", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {
          provider: "manual",
          settlementChannel: "BANK_TRANSFER",
          amount: 100,
          currency: "usd",
          reference: "ref-1",
          receivedAt: "2026-01-01T00:00:00.000Z",
        },
      });
      mockedPaymentService.recordInvoicePayment.mockResolvedValueOnce({
        payment: { id: "pay-1", status: "PAID" },
        appliedAmount: 100,
        balanceAfterPayment: 0,
      } as never);

      await run(FinanceController.recordInvoicePayment);

      expect(mockedPaymentService.recordInvoicePayment).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({
          provider: "MANUAL",
          settlementChannel: "BANK_TRANSFER",
          receivedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: {
          paymentId: "pay-1",
          status: "PAID",
          amount: 100,
          balanceAfterPayment: 0,
        },
        meta: null,
        error: null,
      });
    });

    it("defaults the settlement channel to CASH and receivedAt to undefined", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { provider: "manual", amount: 50 },
      });
      mockedPaymentService.recordInvoicePayment.mockResolvedValueOnce({
        payment: { id: "pay-2", status: "PAID" },
        appliedAmount: 50,
        balanceAfterPayment: 0,
      } as never);

      await run(FinanceController.recordInvoicePayment);

      expect(mockedPaymentService.recordInvoicePayment).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({
          settlementChannel: "CASH",
          receivedAt: undefined,
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("returns 409 when the invoice is already settled", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { provider: "manual", amount: 50 },
      });
      mockedPaymentService.recordInvoicePayment.mockResolvedValueOnce({
        payment: null,
      } as never);

      await run(FinanceController.recordInvoicePayment);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice already settled",
      });
    });

    it("maps FinancePaymentError to its status", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { provider: "manual", amount: 50 },
      });
      mockedPaymentService.recordInvoicePayment.mockRejectedValueOnce(
        new FinancePaymentError("declined", 402) as never,
      );

      await run(FinanceController.recordInvoicePayment);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(jsonMock).toHaveBeenCalledWith({ message: "declined" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { provider: "manual", amount: 50 },
      });
      mockedPaymentService.recordInvoicePayment.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.recordInvoicePayment);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("refundPayment", () => {
    it("rejects a missing payment id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.refundPayment);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { paymentId: "pay-1" }, body: {} });

      await run(FinanceController.refundPayment);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("refunds the payment", async () => {
      setReq({
        params: { paymentId: "pay-1" },
        body: { amount: 25, reason: "duplicate" },
      });
      mockedPaymentService.refundPaymentById.mockResolvedValueOnce({
        refund: { id: "ref-1" },
      } as never);

      await run(FinanceController.refundPayment);

      expect(mockedPaymentService.refundPaymentById).toHaveBeenCalledWith(
        "pay-1",
        { amount: 25, reason: "duplicate" },
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: { id: "ref-1" },
        meta: null,
        error: null,
      });
    });

    it("maps FinancePaymentError to its status", async () => {
      setReq({ params: { paymentId: "pay-1" }, body: { amount: 25 } });
      mockedPaymentService.refundPaymentById.mockRejectedValueOnce(
        new FinancePaymentError("too much", 422) as never,
      );

      await run(FinanceController.refundPayment);

      expect(statusMock).toHaveBeenCalledWith(422);
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { paymentId: "pay-1" }, body: { amount: 25 } });
      mockedPaymentService.refundPaymentById.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.refundPayment);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("voidInvoice", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.voidInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { reason: "" } });

      await run(FinanceController.voidInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects a missing organisation with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });

      await run(FinanceController.voidInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("voids the invoice with a default reason", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.handleInvoiceCancellation.mockResolvedValueOnce({
        type: "VOIDED",
      } as never);
      mockedInvoiceService.getById.mockResolvedValueOnce({
        invoice: { id: "inv-1" },
      } as never);

      await run(FinanceController.voidInvoice);

      expect(
        mockedInvoiceService.handleInvoiceCancellation,
      ).toHaveBeenCalledWith("inv-1", "Invoice voided");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("voids the invoice with a provided reason", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { reason: "wrong charge" },
        organisationId: "org-1",
      });
      mockedInvoiceService.handleInvoiceCancellation.mockResolvedValueOnce({
        type: "VOIDED",
      } as never);
      mockedInvoiceService.getById.mockResolvedValueOnce({
        invoice: { id: "inv-1" },
      } as never);

      await run(FinanceController.voidInvoice);

      expect(
        mockedInvoiceService.handleInvoiceCancellation,
      ).toHaveBeenCalledWith("inv-1", "wrong charge");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.handleInvoiceCancellation.mockRejectedValueOnce(
        new InvoiceServiceError("cannot void", 409) as never,
      );

      await run(FinanceController.voidInvoice);

      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it("maps unknown errors to 500", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: {},
        organisationId: "org-1",
      });
      mockedInvoiceService.handleInvoiceCancellation.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.voidInvoice);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("supplementInvoice", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.supplementInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid body with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });

      await run(FinanceController.supplementInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects a missing organisation with 400", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
      });

      await run(FinanceController.supplementInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("returns 400 when the invoice is not linked to an appointment", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
        organisationId: "org-1",
      });
      mockedInvoiceService.getById.mockResolvedValueOnce({
        invoice: { appointmentId: null },
      } as never);

      await run(FinanceController.supplementInvoice);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice is not linked to an appointment",
      });
    });

    it("adds supplemental charges to the linked appointment", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
        organisationId: "org-1",
      });
      mockedInvoiceService.getById.mockResolvedValueOnce({
        invoice: { appointmentId: "appt-1" },
      } as never);
      mockedInvoiceService.addChargesToAppointment.mockResolvedValueOnce({
        id: "inv-1",
      } as never);

      await run(FinanceController.supplementInvoice);

      expect(mockedInvoiceService.addChargesToAppointment).toHaveBeenCalledWith(
        "appt-1",
        [invoiceItem],
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("maps InvoiceServiceError to its status", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
        organisationId: "org-1",
      });
      mockedInvoiceService.getById.mockRejectedValueOnce(
        new InvoiceServiceError("missing", 404) as never,
      );

      await run(FinanceController.supplementInvoice);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("maps unknown errors to 500", async () => {
      setReq({
        params: { invoiceId: "inv-1" },
        body: { items: [invoiceItem] },
        organisationId: "org-1",
      });
      mockedInvoiceService.getById.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.supplementInvoice);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createInvoicePaymentSession", () => {
    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { provider: "paypal" } });

      await run(FinanceController.createInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported payment provider",
      });
    });

    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {}, body: {} });

      await run(FinanceController.createInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invoice Id is required",
      });
    });

    it("creates the checkout session", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedPaymentService.createCheckoutSessionForInvoice.mockResolvedValueOnce(
        {
          url: "https://checkout",
        } as never,
      );

      await run(FinanceController.createInvoicePaymentSession);

      // No deposit in the body means charge the whole balance.
      expect(
        mockedPaymentService.createCheckoutSessionForInvoice,
      ).toHaveBeenCalledWith("inv-1", "STRIPE", null);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: { url: "https://checkout" },
        meta: null,
        error: null,
      });
    });

    it("maps a ZodError to a 400", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: { provider: 123 } });

      await run(FinanceController.createInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid request body",
      });
    });

    it("maps FinancePaymentError to its status", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedPaymentService.createCheckoutSessionForInvoice.mockRejectedValueOnce(
        new FinancePaymentError("no session", 402) as never,
      );

      await run(FinanceController.createInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(jsonMock).toHaveBeenCalledWith({ message: "no session" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { invoiceId: "inv-1" }, body: {} });
      mockedPaymentService.createCheckoutSessionForInvoice.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.createInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("createMobileInvoicePaymentSession", () => {
    it("rejects a missing invoice id with 400", async () => {
      setReq({ params: {} });

      await run(FinanceController.createMobileInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 403 when the mobile parent cannot be resolved", async () => {
      setReq({ params: { invoiceId: "inv-1" } });

      await run(FinanceController.createMobileInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Parent account is not linked to this mobile user",
      });
    });

    it("creates the payment intent for the linked parent", async () => {
      setReq({ params: { invoiceId: "inv-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedPaymentService.createPaymentIntentForInvoice.mockResolvedValueOnce({
        clientSecret: "secret",
      } as never);

      await run(FinanceController.createMobileInvoicePaymentSession);

      expect(
        mockedPaymentService.createPaymentIntentForInvoice,
      ).toHaveBeenCalledWith(
        "inv-1",
        { parentId: "parent-1" },
        { collectionMode: "DEPOSIT_THEN_SETTLE", settlementChannel: "DEPOSIT" },
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        data: { clientSecret: "secret" },
        meta: null,
        error: null,
      });
    });

    it("maps FinancePaymentError to its status", async () => {
      setReq({ params: { invoiceId: "inv-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedPaymentService.createPaymentIntentForInvoice.mockRejectedValueOnce(
        new FinancePaymentError("nope", 402) as never,
      );

      await run(FinanceController.createMobileInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(jsonMock).toHaveBeenCalledWith({ message: "nope" });
    });

    it("maps unknown errors to 500", async () => {
      setReq({ params: { invoiceId: "inv-1" }, userId: "user-1" });
      mockedAuthUserMobileService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-1",
      } as never);
      mockedPaymentService.createPaymentIntentForInvoice.mockRejectedValueOnce(
        new Error("boom") as never,
      );

      await run(FinanceController.createMobileInvoicePaymentSession);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("webhook", () => {
    it("rejects an unsupported provider with 400", async () => {
      setReq({ params: { provider: "paypal" } });

      await run(FinanceController.webhook);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unsupported provider",
      });
      expect(mockedStripeController.webhook).not.toHaveBeenCalled();
    });

    it("delegates a Stripe webhook to the Stripe controller", async () => {
      setReq({ params: { provider: "stripe" } });
      mockedStripeController.webhook.mockReturnValueOnce(undefined as never);

      await run(FinanceController.webhook);

      expect(mockedStripeController.webhook).toHaveBeenCalledTimes(1);
      expect(mockedStripeController.webhook).toHaveBeenCalledWith(
        req as Request,
        res as Response,
      );
    });
  });

  describe("getDiscountSettings", () => {
    it("rejects a request without an organisation id", async () => {
      setReq({ params: {} });

      await run(FinanceController.getDiscountSettings);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation Id is required",
      });
    });

    it("maps a FinanceDiscountSettingsError to its status code", async () => {
      const getForOrganisationSpy = jest
        .spyOn(FinanceDiscountSettingsService, "getForOrganisation")
        .mockRejectedValueOnce(
          new FinanceDiscountSettingsError("Settings unavailable", 404),
        );
      setReq({ params: { organisationId: "org-1" } });

      await run(FinanceController.getDiscountSettings);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Settings unavailable",
      });
      expect(mockedLogger.error).toHaveBeenCalled();

      getForOrganisationSpy.mockRestore();
    });
  });
});
