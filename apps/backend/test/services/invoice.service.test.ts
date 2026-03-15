import { Types } from "mongoose";
import {
  InvoiceService,
  InvoiceServiceError,
} from "../../src/services/invoice.service";
import type { InvoiceDocument } from "../../src/models/invoice";
import InvoiceModel from "../../src/models/invoice";
import AppointmentModel from "../../src/models/appointment";
import { StripeService } from "../../src/services/stripe.service";
import OrganizationModel from "../../src/models/organization";
import { ParentModel } from "../../src/models/parent";
import { NotificationService } from "../../src/services/notification.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { sendEmailTemplate } from "../../src/utils/email";
import { OrgBilling } from "../../src/models/organization.billing";
import logger from "../../src/utils/logger";
import { prisma } from "src/config/prisma";

// --- Global Mocks Setup (TDZ Safe) ---
jest.mock("../../src/models/invoice", () => {
  // Mock InvoiceModel as a callable constructor function that ALSO has static methods attached.
  const mockFn = jest.fn();
  Object.assign(mockFn, {
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  });
  return {
    __esModule: true,
    default: mockFn,
  };
});

jest.mock("../../src/models/appointment", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/services/stripe.service", () => ({
  __esModule: true,
  StripeService: {
    refundPaymentIntent: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
  },
}));

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/parent", () => ({
  __esModule: true,
  ParentModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/organization.billing", () => ({
  __esModule: true,
  OrgBilling: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/services/notification.service", () => ({
  __esModule: true,
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  __esModule: true,
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/utils/email", () => ({
  __esModule: true,
  sendEmailTemplate: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: { findUnique: jest.fn() },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    organizationBilling: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));

// Provide a mock `toObject` function generator for domain mappers
const createMockDoc = (overrides = {}) => {
  const data = {
    _id: new Types.ObjectId(),
    parentId: new Types.ObjectId(),
    companionId: new Types.ObjectId(),
    organisationId: new Types.ObjectId(),
    appointmentId: new Types.ObjectId(),
    items: [] as any[], // Explicit cast to prevent "never[]" errors
    subtotal: 100,
    totalAmount: 110,
    taxPercent: 10,
    currency: "usd",
    taxTotal: 10,
    discountTotal: 0,
    status: "AWAITING_PAYMENT",
    paymentCollectionMethod: "PAYMENT_LINK",
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {} as Record<string, any>, // Explicit cast to allow property access in tests
    ...overrides,
  };
  return {
    ...data,
    toObject: () => data,
    save: jest.fn().mockResolvedValue(true),
  };
};

describe("InvoiceService", () => {
  const validId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("InvoiceServiceError", () => {
    it("should set properties correctly", () => {
      const err = new InvoiceServiceError("Test", 400);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("InvoiceServiceError");
    });
  });

  describe("createDraftForAppointment", () => {
    it("should throw 404 if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId: validId,
          parentId: validId,
          organisationId: validId,
          companionId: validId,
          items: [],
          paymentCollectionMethod: "PAYMENT_LINK",
        }),
      ).rejects.toThrow(new InvoiceServiceError("Appointment not found", 404));
    });

    it("should calculate totals correctly (including discounts) and build invoice", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({ companion: { id: validId } }),
      });
      (OrgBilling.findOne as jest.Mock).mockResolvedValue({ currency: "eur" });

      const mockCreated = createMockDoc({ _id: new Types.ObjectId() });
      (InvoiceModel.create as jest.Mock).mockResolvedValue([mockCreated]);

      const input = {
        appointmentId: validId,
        parentId: validId,
        organisationId: validId,
        companionId: validId,
        paymentCollectionMethod: "PAYMENT_LINK" as const,
        items: [
          {
            description: "Consultation",
            quantity: 1,
            unitPrice: 100,
            discountPercent: 10,
          },
          { description: "Medication", quantity: 2, unitPrice: 25 },
        ],
      };

      await InvoiceService.createDraftForAppointment(input);

      // Calculation assertions:
      // Subtotal: (1*100) + (2*25) = 150
      // Discount: (10% of 100) + 0 = 10
      // Total: 150 - 10 = 140
      expect(InvoiceModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            subtotal: 150,
            discountTotal: 10,
            taxTotal: 0,
            totalAmount: 140,
            currency: "eur",
          }),
        ]),
        expect.any(Object),
      );

      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalled();
    });

    it("should fallback to usd if billing config missing", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({ companion: { id: validId } }),
      });
      (OrgBilling.findOne as jest.Mock).mockResolvedValue(null);
      (InvoiceModel.create as jest.Mock).mockResolvedValue(createMockDoc());

      await InvoiceService.createDraftForAppointment({
        appointmentId: validId,
        parentId: validId,
        organisationId: validId,
        companionId: validId,
        items: [],
        paymentCollectionMethod: "PAYMENT_LINK",
      });

      expect(InvoiceModel.create).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ currency: "usd" })]),
        expect.any(Object),
      );
    });
  });

  describe("createDraftForAppointment (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should create invoice and notify parent", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: validId,
        organisationId: "org_1",
        companion: { id: "comp_1" },
      });
      (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
        currency: "usd",
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: "inv_1",
        organisationId: "org_1",
        companionId: "comp_1",
        status: "AWAITING_PAYMENT",
        totalAmount: 120,
        currency: "usd",
      });

      const result = await InvoiceService.createDraftForAppointment({
        appointmentId: validId,
        parentId: "parent_1",
        organisationId: "org_1",
        companionId: "comp_1",
        items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
        paymentCollectionMethod: "PAYMENT_LINK",
      });

      expect(prisma.invoice.create).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(
        "parent_1",
        expect.anything(),
      );
      expect((result as any).id).toBe("inv_1");
    });

    it("should throw 404 if appointment not found", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId: validId,
          parentId: validId,
          organisationId: validId,
          companionId: validId,
          items: [],
          paymentCollectionMethod: "PAYMENT_LINK",
        }),
      ).rejects.toThrow(new InvoiceServiceError("Appointment not found", 404));
    });

    it("should allow missing companion data and omit companionId", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: validId,
        organisationId: "org_1",
        companion: "invalid",
      });
      (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
        currency: "usd",
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: "inv_2",
        organisationId: "org_1",
        companionId: null,
        status: "AWAITING_PAYMENT",
        totalAmount: 120,
        currency: "usd",
      });

      await InvoiceService.createDraftForAppointment({
        appointmentId: validId,
        parentId: "parent_1",
        organisationId: "org_1",
        companionId: "comp_1",
        items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
        paymentCollectionMethod: "PAYMENT_LINK",
      });

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companionId: undefined,
          }),
        }),
      );
    });
  });

  describe("createExtraInvoiceForAppointment (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should create extra invoice and notify parent", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: "appt_1",
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "parent_1" } },
      });
      (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
        currency: "usd",
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: "inv_extra",
        appointmentId: "appt_1",
        organisationId: "org_1",
        companionId: "comp_1",
        parentId: "parent_1",
        status: "AWAITING_PAYMENT",
        totalAmount: 25,
        currency: "usd",
      });

      const result = await InvoiceService.createExtraInvoiceForAppointment({
        appointmentId: "appt_1",
        items: [
          {
            name: "Add-on",
            description: "Add-on",
            quantity: 1,
            unitPrice: 25,
            total: 25,
          },
        ],
      });

      expect(prisma.invoice.create).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(
        "parent_1",
        expect.anything(),
      );
      expect((result as any).id).toBe("inv_extra");
    });

    it("should skip parent notification when parentId is missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: "appt_2",
        organisationId: "org_1",
        companion: { id: "comp_1", parent: "invalid" },
      });
      (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
        currency: "usd",
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: "inv_extra_2",
        appointmentId: "appt_2",
        organisationId: "org_1",
        companionId: "comp_1",
        parentId: null,
        status: "AWAITING_PAYMENT",
        totalAmount: 25,
        currency: "usd",
        items: [],
        subtotal: 25,
        taxPercent: 0,
        taxTotal: 0,
        discountTotal: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentCollectionMethod: "PAYMENT_LINK",
        stripePaymentIntentId: null,
        stripePaymentLinkId: null,
        stripeInvoiceId: null,
        stripeCustomerId: null,
        stripeChargeId: null,
        stripeReceiptUrl: null,
        stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null,
        metadata: {},
      });

      await InvoiceService.createExtraInvoiceForAppointment({
        appointmentId: "appt_2",
        items: [
          {
            name: "Add-on",
            description: "Add-on",
            quantity: 1,
            unitPrice: 25,
            total: 25,
          },
        ],
      });

      expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe("Postgres Branches", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("attachStripeDetails should update via prisma", async () => {
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        id: "inv_1",
        organisationId: "org_1",
        companionId: "comp_1",
        status: "AWAITING_PAYMENT",
        totalAmount: 10,
        currency: "usd",
      });

      const res = await InvoiceService.attachStripeDetails("inv_1", {
        stripePaymentIntentId: "pi_1",
      });
      expect(prisma.invoice.update).toHaveBeenCalled();
      expect(res.id).toBe("inv_1");
    });

    it("markInvoicePaid should return null when already PAID", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_1",
        status: "PAID",
      });

      const res = await InvoiceService.markInvoicePaid({ invoiceId: "inv_1" });
      expect(res).toBeNull();
    });

    it("markInvoicePaid should update and audit", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_2",
        status: "AWAITING_PAYMENT",
        organisationId: "org_1",
        companionId: "comp_1",
        totalAmount: 50,
        currency: "usd",
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_2",
        status: "PAID",
        organisationId: "org_1",
        companionId: "comp_1",
        totalAmount: 50,
        currency: "usd",
      });

      const res = await InvoiceService.markInvoicePaid({ invoiceId: "inv_2" });
      expect(res).toBeTruthy();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });

    it("markInvoicePaid should resolve audit targets via appointment lookup", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_appt",
        status: "AWAITING_PAYMENT",
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_appt",
        status: "PAID",
        appointmentId: "appt_1",
        organisationId: null,
        companionId: null,
        totalAmount: 20,
        currency: "usd",
      });
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        organisationId: "org_1",
        companion: { id: "comp_1" },
      });

      await InvoiceService.markInvoicePaid({ invoiceId: "inv_appt" });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org_1",
          companionId: "comp_1",
        }),
      );
    });

    it("markInvoicePaid skips audit when appointment lacks companion id", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_no_comp",
        status: "AWAITING_PAYMENT",
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_no_comp",
        status: "PAID",
        appointmentId: "appt_2",
        organisationId: null,
        companionId: null,
        totalAmount: 20,
        currency: "usd",
      });
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        organisationId: "org_1",
        companion: "invalid",
      });

      await InvoiceService.markInvoicePaid({ invoiceId: "inv_no_comp" });
      expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
    });

    it("markInvoicePaidManually should throw on wrong method", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_3",
        paymentCollectionMethod: "PAYMENT_LINK",
        status: "AWAITING_PAYMENT",
      });

      await expect(
        InvoiceService.markInvoicePaidManually("inv_3"),
      ).rejects.toThrow(
        new InvoiceServiceError(
          "Invoice is not marked for in-clinic payment.",
          409,
        ),
      );
    });

    it("updatePaymentCollectionMethod returns same method if unchanged", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_4",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
      });

      const res = await InvoiceService.updatePaymentCollectionMethod(
        "inv_4",
        "PAYMENT_LINK",
      );
      expect(res).toBeDefined();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it("updatePaymentCollectionMethod throws on invalid method", async () => {
      await expect(
        InvoiceService.updatePaymentCollectionMethod("inv_bad", "invalid"),
      ).rejects.toThrow(
        new InvoiceServiceError("Invalid payment collection method.", 400),
      );
    });

    it("updatePaymentCollectionMethod normalizes metadata and items", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_4b",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [
          {
            id: "item_1",
            name: "Test",
            quantity: 1,
            unitPrice: 10,
            total: 10,
            description: null,
          },
        ],
        metadata: { ok: "yes", count: 2, flag: true, bad: { nested: 1 } },
        parentId: null,
        companionId: null,
        organisationId: null,
        appointmentId: null,
        subtotal: 10,
        totalAmount: 10,
        taxPercent: 0,
        taxTotal: 0,
        discountTotal: 0,
        currency: "usd",
        stripePaymentIntentId: null,
        stripePaymentLinkId: null,
        stripeInvoiceId: null,
        stripeCustomerId: null,
        stripeChargeId: null,
        stripeReceiptUrl: null,
        stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await InvoiceService.updatePaymentCollectionMethod(
        "inv_4b",
        "PAYMENT_LINK",
      );

      expect(res).toBeDefined();
    });

    it("markFailed should update and audit", async () => {
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_5",
        status: "FAILED",
        organisationId: "org_1",
        companionId: "comp_1",
        totalAmount: 5,
        currency: "usd",
      });

      await InvoiceService.markFailed("inv_5");
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });

    it("markRefunded should update and audit", async () => {
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_6",
        status: "REFUNDED",
        organisationId: "org_1",
        companionId: "comp_1",
        totalAmount: 5,
        currency: "usd",
      });

      const res = await InvoiceService.markRefunded("inv_6");
      expect(res.id).toBe("inv_6");
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });

    it("updateStatus should update and audit", async () => {
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_7",
        status: "PENDING",
        organisationId: "org_1",
        companionId: "comp_1",
      });

      await InvoiceService.updateStatus("inv_7", "PENDING");
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });

    it("addItemsToInvoice should update totals and clear checkout for payment link", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_8",
        status: "AWAITING_PAYMENT",
        items: [],
        taxPercent: 0,
        paymentCollectionMethod: "PAYMENT_LINK",
        stripeCheckoutSessionId: "sess_1",
        stripeCheckoutUrl: "url",
        organisationId: "org_1",
        companionId: "comp_1",
        totalAmount: 10,
        currency: "usd",
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_8",
        status: "AWAITING_PAYMENT",
        items: [],
        taxPercent: 0,
        totalAmount: 10,
        currency: "usd",
        organisationId: "org_1",
        companionId: "comp_1",
      });

      await InvoiceService.addItemsToInvoice("inv_8", [
        { name: "Item", description: "Desc", quantity: 1, unitPrice: 10 },
      ] as any);
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeCheckoutSessionId: null,
            stripeCheckoutUrl: null,
          }),
        }),
      );
    });

    it("handleAppointmentCancellation should refund paid invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_9",
        status: "PAID",
        stripePaymentIntentId: "pi_9",
        organisationId: "org_1",
        companionId: "comp_1",
        currency: "usd",
        totalAmount: 20,
      });
      (StripeService.refundPaymentIntent as jest.Mock).mockResolvedValue({
        refundId: "r_1",
        amountRefunded: 20,
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_9",
        status: "REFUNDED",
        organisationId: "org_1",
        companionId: "comp_1",
        currency: "usd",
        totalAmount: 20,
      });

      const res = await InvoiceService.handleAppointmentCancellation(
        "appt_1",
        "reason",
      );
      expect(res).toEqual({ action: "REFUNDED", refundId: "r_1" });
    });

    it("handleInvoiceCancellation should cancel unpaid invoice", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_10",
        status: "AWAITING_PAYMENT",
        organisationId: "org_1",
        companionId: "comp_1",
        metadata: {},
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_10",
        status: "CANCELLED",
        organisationId: "org_1",
        companionId: "comp_1",
        metadata: {},
      });

      const res = await InvoiceService.handleInvoiceCancellation(
        "inv_10",
        "reason",
      );
      expect(res).toEqual({ action: "CANCELLED_UNPAID", status: "CANCELLED" });
    });

    it("getByPaymentIntentId should return dto when found", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_11",
        status: "AWAITING_PAYMENT",
        totalAmount: 10,
        currency: "usd",
      });

      const res = await InvoiceService.getByPaymentIntentId("pi_11");
      expect(res?.id).toBe("inv_11");
    });

    it("createCheckoutSessionAndEmailParent should send email (postgres)", async () => {
      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValue({
        url: "http://checkout",
      });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_12",
        parentId: "parent_1",
        organisationId: "org_1",
        totalAmount: 55.5,
        currency: "usd",
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        email: "test@test.com",
        firstName: "John",
        lastName: "Doe",
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        name: "Org",
      });

      const res =
        await InvoiceService.createCheckoutSessionAndEmailParent("inv_12");
      expect(sendEmailTemplate).toHaveBeenCalled();
      expect(res.emailSent).toBe(true);
    });
  });

  describe("createExtraInvoiceForAppointment", () => {
    it("should throw 404 if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        InvoiceService.createExtraInvoiceForAppointment({
          appointmentId: validId,
          items: [],
        }),
      ).rejects.toThrow(new InvoiceServiceError("Appointment not found", 404));
    });

    it("should create and recalculate an extra invoice successfully", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue({
        _id: validId,
        organisationId: validId,
        companion: { id: validId, parent: { id: validId } },
      });
      (OrgBilling.findOne as jest.Mock).mockResolvedValue(null);

      const saveMock = jest.fn().mockResolvedValue(true);
      (InvoiceModel as unknown as jest.Mock).mockImplementation(function (
        this: any,
        data: any,
      ) {
        Object.assign(this, data);
        this._id = new Types.ObjectId();
        this.save = saveMock;
        this.toObject = () => this;
      });

      const res = await InvoiceService.createExtraInvoiceForAppointment({
        appointmentId: validId,
        items: [
          {
            id: "1",
            name: "Extra",
            description: "desc",
            quantity: 1,
            unitPrice: 50,
            discountPercent: 0,
            total: 0,
          },
        ],
      });

      expect(saveMock).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalled();
      expect(res.subtotal).toBe(50); // Tests recalculateTotals helper internally
    });
  });

  describe("attachStripeDetails", () => {
    it("should throw 400 for invalid Object Id (ensureObjectId check)", async () => {
      await expect(
        InvoiceService.attachStripeDetails("invalid", {}),
      ).rejects.toThrow(new InvoiceServiceError("Invalid invoiceId", 400));
    });

    it("should throw 404 if invoice not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(
        InvoiceService.attachStripeDetails(validId, {}),
      ).rejects.toThrow(new InvoiceServiceError("Invoice not found.", 404));
    });

    it("should map metadata cleanly when returning domain object", async () => {
      const mockDoc = createMockDoc({
        metadata: { str: "s", num: 1, bool: true, invalidObj: {} }, // Filters out objects
      });
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockDoc);

      const res = await InvoiceService.attachStripeDetails(validId, {
        stripePaymentIntentId: "pi_123",
      });
      expect(res.metadata).toEqual({ str: "s", num: 1, bool: true }); // Object excluded
    });
  });

  describe("markInvoicePaid & Audit Resolution (resolveAuditTargetsForInvoice)", () => {
    it("should return null/falsy if invoice not found", async () => {
      (InvoiceModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      const res = await InvoiceService.markInvoicePaid({ invoiceId: validId });
      expect(res).toBeNull();
    });

    it("should resolve audit targets directly from invoice if org/comp exist", async () => {
      const mockInvoice = createMockDoc({
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockInvoice,
      );

      await InvoiceService.markInvoicePaid({ invoiceId: validId });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: validId,
          companionId: validId,
        }),
      );
    });

    it("should fetch from appointment if invoice missing org/comp", async () => {
      const mockInvoice = createMockDoc({
        organisationId: null,
        companionId: null,
        appointmentId: validId,
      });
      (InvoiceModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockInvoice,
      );

      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          organisationId: "org_app",
          companion: { id: "comp_app" },
        }),
      });

      await InvoiceService.markInvoicePaid({ invoiceId: validId });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org_app",
          companionId: "comp_app",
        }),
      );
    });

    it("should skip audit when targets are missing", async () => {
      const mockInvoice = createMockDoc({
        organisationId: null,
        companionId: null,
        appointmentId: null,
      });
      (InvoiceModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockInvoice,
      );

      await InvoiceService.markInvoicePaid({ invoiceId: validId });
      expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
    });
  });

  describe("markFailed", () => {
    it("should throw 404 if invoice not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.markFailed(validId)).rejects.toThrow(
        new InvoiceServiceError("Invoice not found.", 404),
      );
    });

    it("should update status to FAILED and audit", async () => {
      const mockDoc = createMockDoc({
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockDoc);

      await InvoiceService.markFailed(validId);
      expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        { $set: { status: "FAILED" } },
        { new: true },
      );
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });
  });

  describe("markRefunded", () => {
    it("should throw 404 if invoice not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.markRefunded(validId)).rejects.toThrow(
        new InvoiceServiceError("Invoice not found.", 404),
      );
    });

    it("should update status to REFUNDED, audit, and return mapped domain object", async () => {
      const mockDoc = createMockDoc({
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockDoc);

      const res = await InvoiceService.markRefunded(validId);
      expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(Types.ObjectId),
        { $set: { status: "REFUNDED" } },
        { new: true },
      );
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(res.id).toBeDefined(); // Maps to domain successfully
    });
  });

  describe("updateStatus", () => {
    it("should throw 404 if invoice not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        InvoiceService.updateStatus(validId, "PAID"),
      ).rejects.toThrow(new InvoiceServiceError("Invoice not found", 404));
    });

    it("should update status, save, and audit", async () => {
      const mockDoc = createMockDoc({
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockDoc);

      await InvoiceService.updateStatus(validId, "PENDING");
      expect(mockDoc.status).toBe("PENDING");
      expect(mockDoc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });
  });

  describe("List and Fetch Methods (getByAppointmentId, getById, listFor...)", () => {
    const mockSort = jest.fn().mockResolvedValue([createMockDoc()]);
    const mockFindChain = { sort: mockSort };

    it("getByAppointmentId: should map and return", async () => {
      (InvoiceModel.find as jest.Mock).mockReturnValue(mockFindChain);
      const res = await InvoiceService.getByAppointmentId(validId);
      expect(res).toHaveLength(1);
    });

    it("getById: should throw 404 if not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.getById(validId)).rejects.toThrow(
        new InvoiceServiceError("Invoice not found.", 404),
      );
    });

    it("getById: should return mapped object and organisation details", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(createMockDoc());
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({
        name: "Org",
        googlePlacesId: "p1",
        address: "Add",
        imageURL: "img",
      });

      const res = await InvoiceService.getById(validId);
      expect(res.organistion.name).toBe("Org");
      expect(res.invoice).toBeDefined();
    });

    it("listForOrganisation, listForParent, listForCompanion should map responses", async () => {
      (InvoiceModel.find as jest.Mock).mockReturnValue(mockFindChain);
      expect(await InvoiceService.listForOrganisation(validId)).toHaveLength(1);
      expect(await InvoiceService.listForParent(validId)).toHaveLength(1);
      expect(await InvoiceService.listForCompanion(validId)).toHaveLength(1);
    });
  });

  describe("addItemsToInvoice", () => {
    it("should throw 404 if not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        InvoiceService.addItemsToInvoice(validId, []),
      ).rejects.toThrow(new InvoiceServiceError("Invoice not found", 404));
    });

    it("should throw 409 if invoice is already paid", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(
        createMockDoc({ status: "PAID" }),
      );
      await expect(
        InvoiceService.addItemsToInvoice(validId, []),
      ).rejects.toThrow(
        new InvoiceServiceError("Cannot modify a paid invoice", 409),
      );
    });

    it("should recalculate totals and push items", async () => {
      const doc = createMockDoc({
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.addItemsToInvoice(validId, [
        {
          id: "1",
          name: "Item",
          description: "Desc",
          quantity: 2,
          unitPrice: 50,
          discountPercent: 10,
          total: 0,
        },
      ]);

      expect(doc.items).toHaveLength(1);
      expect(doc.items[0].total).toBe(90); // (2*50) - 10%
      expect(doc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(res.subtotal).toBe(100);
    });
  });

  describe("addChargesToAppointment & findOpenInvoiceForAppointment", () => {
    it("findOpenInvoiceForAppointment should use correct find syntax", async () => {
      const mockSort = jest.fn().mockResolvedValue("doc");
      (InvoiceModel.findOne as jest.Mock).mockReturnValue({ sort: mockSort });

      const res = await InvoiceService.findOpenInvoiceForAppointment(validId);
      expect(res).toBe("doc");
      expect(InvoiceModel.findOne).toHaveBeenCalledWith({
        appointmentId: validId,
        status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
      });
    });

    it("addChargesToAppointment should create extra invoice if open invoice does not exist", async () => {
      const spyOpen = jest
        .spyOn(InvoiceService, "findOpenInvoiceForAppointment")
        .mockResolvedValue(null);
      const spyExtra = jest
        .spyOn(InvoiceService, "createExtraInvoiceForAppointment")
        .mockResolvedValue("extra" as any);

      const res = await InvoiceService.addChargesToAppointment(validId, []);
      expect(res).toBe("extra");
      expect(spyExtra).toHaveBeenCalled();

      spyOpen.mockRestore();
      spyExtra.mockRestore();
    });

    it("addChargesToAppointment should add to open invoice if it exists", async () => {
      const spyOpen = jest
        .spyOn(InvoiceService, "findOpenInvoiceForAppointment")
        .mockResolvedValue({ _id: validId } as any);
      const spyAdd = jest
        .spyOn(InvoiceService, "addItemsToInvoice")
        .mockResolvedValue("added" as any);

      const res = await InvoiceService.addChargesToAppointment(validId, []);
      expect(res).toBe("added");
      expect(spyAdd).toHaveBeenCalledWith(validId, []);

      spyOpen.mockRestore();
      spyAdd.mockRestore();
    });
  });

  describe("handleAppointmentCancellation", () => {
    it("should return NO_INVOICE if not found", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
      expect(
        await InvoiceService.handleAppointmentCancellation(validId, "reason"),
      ).toEqual({ action: "NO_INVOICE" });
    });

    it("should return ALREADY_HANDLED if cancelled or refunded", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue({
        status: "CANCELLED",
      });
      expect(
        await InvoiceService.handleAppointmentCancellation(validId, "reason"),
      ).toEqual({ action: "ALREADY_HANDLED", status: "CANCELLED" });
    });

    it("should cancel unpaid invoice directly", async () => {
      const doc = createMockDoc({
        status: "AWAITING_PAYMENT",
        metadata: {},
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.handleAppointmentCancellation(
        validId,
        "Changed mind",
      );
      expect(doc.status).toBe("CANCELLED");
      expect(doc.metadata.cancellationReason).toBe("Changed mind");
      expect(doc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(res).toEqual({ action: "CANCELLED_UNPAID" });
    });

    it("should throw 500 if PAID but no stripe intent ID", async () => {
      const doc = createMockDoc({
        status: "PAID",
        stripePaymentIntentId: null,
      });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);

      await expect(
        InvoiceService.handleAppointmentCancellation(validId, "R"),
      ).rejects.toThrow(
        new InvoiceServiceError(
          "Cannot refund: missing Stripe paymentIntentId",
          500,
        ),
      );
    });

    it("should process refund if PAID", async () => {
      const doc = createMockDoc({
        status: "PAID",
        stripePaymentIntentId: "pi_123",
        metadata: {},
        organisationId: validId,
        companionId: validId,
      });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);
      (StripeService.refundPaymentIntent as jest.Mock).mockResolvedValue({
        refundId: "r_123",
        amountRefunded: 100,
      });

      const res = await InvoiceService.handleAppointmentCancellation(
        validId,
        "Refund pls",
      );

      expect(StripeService.refundPaymentIntent).toHaveBeenCalledWith("pi_123");
      expect(doc.status).toBe("REFUNDED");
      expect(doc.metadata.refundId).toBe("r_123");
      expect(doc.save).toHaveBeenCalled();
      expect(res).toEqual({ action: "REFUNDED", refundId: "r_123" });
    });

    it("should return NO_ACTION for unknown statuses", async () => {
      const doc = createMockDoc({ status: "DRAFT" });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);
      expect(
        await InvoiceService.handleAppointmentCancellation(validId, "reason"),
      ).toEqual({ action: "NO_ACTION", status: "DRAFT" });
    });
  });

  describe("getByPaymentIntentId", () => {
    it("should return null if not found", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
      expect(await InvoiceService.getByPaymentIntentId("pi_123")).toBeNull();
    });

    it("should return domain DTO on success", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(createMockDoc());
      expect(await InvoiceService.getByPaymentIntentId("pi_123")).toBeDefined();
    });
  });

  describe("createCheckoutSessionAndEmailParent", () => {
    it("should throw 404 if invoice not found", async () => {
      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValue({ url: "url" });
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        InvoiceService.createCheckoutSessionAndEmailParent(validId),
      ).rejects.toThrow(new InvoiceServiceError("Invoice not found.", 404));
    });

    it("should not send email if url missing or parentId missing", async () => {
      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValue(null); // No URL
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: validId }),
      });

      const res =
        await InvoiceService.createCheckoutSessionAndEmailParent(validId);
      expect(res.emailSent).toBe(false);
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should send email securely and handle fallback optional chains", async () => {
      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValue({ url: "http://checkout.com" });
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: validId,
          parentId: validId,
          organisationId: validId,
          totalAmount: 50.55,
          currency: "usd",
        }),
      });

      // Added the .select() to the chain for ParentModel
      const parentChain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          email: "test@test.com",
          firstName: "John",
          lastName: "Doe",
        }),
      };
      (ParentModel.findById as jest.Mock).mockReturnValue(parentChain);

      // Added the .select() to the chain for OrganizationModel
      const orgChain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ name: "OrgName" }),
      };
      (OrganizationModel.findById as jest.Mock).mockReturnValue(orgChain);

      const res =
        await InvoiceService.createCheckoutSessionAndEmailParent(validId);

      expect(sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@test.com",
          templateData: expect.objectContaining({
            parentName: "John Doe",
            amountText: "USD 50.55",
          }),
        }),
      );
      expect(res.emailSent).toBe(true);
    });

    it("should silently handle email exceptions without throwing", async () => {
      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValue({ url: "http://checkout.com" });
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: validId, parentId: validId }),
      });

      const parentChain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ email: "test@test.com" }),
      };
      (ParentModel.findById as jest.Mock).mockReturnValue(parentChain);

      const orgChain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      };
      (OrganizationModel.findById as jest.Mock).mockReturnValue(orgChain);

      (sendEmailTemplate as jest.Mock).mockRejectedValue(
        new Error("SMTP Down"),
      );

      const res =
        await InvoiceService.createCheckoutSessionAndEmailParent(validId);

      expect(logger.error).toHaveBeenCalled();
      expect(res.emailSent).toBe(false); // Successfully handled the crash internally
    });
  });

  describe("dual write", () => {
    const originalDualWrite = process.env.DUAL_WRITE_ENABLED;

    afterEach(() => {
      process.env.DUAL_WRITE_ENABLED = originalDualWrite;
    });

    it("syncs invoice to postgres when enabled", async () => {
      process.env.DUAL_WRITE_ENABLED = "true";
      jest.resetModules();
      jest.doMock("src/utils/dual-write", () => ({
        ...jest.requireActual("src/utils/dual-write"),
        shouldDualWrite: true,
      }));

      let InvoiceServiceIsolated!: typeof InvoiceService;
      let InvoiceModelIsolated!: typeof InvoiceModel;
      let prismaIsolated!: typeof prisma;

      jest.isolateModules(() => {
        InvoiceServiceIsolated =
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require("../../src/services/invoice.service").InvoiceService;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        InvoiceModelIsolated = require("../../src/models/invoice").default;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        prismaIsolated = require("src/config/prisma").prisma;
      });

      (
        InvoiceModelIsolated.findOneAndUpdate as jest.Mock
      ).mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        organisationId: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        appointmentId: new Types.ObjectId(),
        items: [
          { id: "i1", name: "Item", quantity: 1, unitPrice: 10, total: 10 },
        ],
        subtotal: 10,
        totalAmount: 10,
        taxPercent: 0,
        taxTotal: 0,
        discountTotal: 0,
        currency: "usd",
        status: "PAID",
        paymentCollectionMethod: "PAYMENT_LINK",
        toObject: () => ({
          _id: { toString: () => "inv_1" },
          parentId: { toString: () => "parent_1" },
          companionId: { toString: () => "comp_1" },
          organisationId: { toString: () => "org_1" },
          appointmentId: { toString: () => "appt_1" },
          items: [
            { id: "i1", name: "Item", quantity: 1, unitPrice: 10, total: 10 },
          ],
          subtotal: 10,
          totalAmount: 10,
          taxPercent: 0,
          taxTotal: 0,
          discountTotal: 0,
          currency: "usd",
          status: "PAID",
          paymentCollectionMethod: "PAYMENT_LINK",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-02T00:00:00.000Z"),
        }),
      } as unknown as InvoiceDocument);

      await InvoiceServiceIsolated.markInvoicePaid({ invoiceId: "inv_1" });

      expect(prismaIsolated.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv_1" },
        }),
      );
    });
  });
});
