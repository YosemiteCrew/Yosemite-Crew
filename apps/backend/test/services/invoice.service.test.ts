import { Types } from "mongoose";
import { InvoiceService, InvoiceServiceError } from "../../src/services/invoice.service";
import InvoiceModel from "../../src/models/invoice";
import AppointmentModel from "../../src/models/appointment";
import OrganizationModel from "../../src/models/organization";
import { StripeService } from "../../src/services/stripe.service";
import { NotificationService } from "../../src/services/notification.service";
import { NotificationTemplates } from "../../src/utils/notificationTemplates";

// --- MOCKS ---
jest.mock("../../src/models/invoice", () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../../src/models/appointment", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/models/organization", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/services/stripe.service", () => ({
  StripeService: {
    refundPaymentIntent: jest.fn(),
  },
}));

jest.mock("../../src/services/notification.service", () => ({
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

jest.mock("../../src/utils/notificationTemplates", () => ({
  NotificationTemplates: {
    Payment: {
      PAYMENT_PENDING: jest.fn().mockReturnValue({ title: "Mock", body: "Mock" }),
    },
  },
}));

jest.mock("@yosemite-crew/types", () => ({
  toInvoiceResponseDTO: jest.fn((data) => ({ ...data, isDTO: true })),
}));

// --- TEST UTILS ---
const validObjectId = new Types.ObjectId().toString();

const mockInvoiceMongoObj = (overrides = {}) => ({
  _id: new Types.ObjectId(validObjectId),
  parentId: new Types.ObjectId(),
  companionId: new Types.ObjectId(),
  organisationId: new Types.ObjectId(),
  appointmentId: new Types.ObjectId(),
  currency: "INR",
  status: "AWAITING_PAYMENT",
  subtotal: 100,
  totalAmount: 100,
  taxPercent: 0,
  taxTotal: 0,
  discountTotal: 0,
  items: [
    {
      id: "item-1",
      name: "Consultation",
      description: "General checkup",
      quantity: 1,
      unitPrice: 100,
      discountPercent: 10,
      total: 90,
    },
    {
      id: "item-2",
      name: "Meds",
      // No description and no discount
      quantity: 2,
      unitPrice: 50,
      total: 100,
    },
  ],
  metadata: {
    validStr: "text",
    validNum: 42,
    validBool: true,
    invalidObj: { nested: true },
    invalidArr: [1, 2],
  } as Record<string, any>, // Allows dynamically added keys during tests (e.g. cancellationReason)
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockInvoiceDocument = (overrides = {}) => {
  const obj = mockInvoiceMongoObj(overrides);
  return {
    ...obj,
    toObject: jest.fn().mockReturnValue(obj),
    save: jest.fn(),
  };
};

const mockSortChain = {
  sort: jest.fn().mockResolvedValue([mockInvoiceDocument()]),
};

describe("InvoiceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (InvoiceModel.find as jest.Mock).mockReturnValue(mockSortChain);
  });

  describe("InvoiceServiceError", () => {
    it("should correctly assign message and status code", () => {
      const error = new InvoiceServiceError("Test error", 400);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("InvoiceServiceError");
    });
  });

  describe("Internal Helpers (ensureObjectId & toDomain via getById)", () => {
    it("should accept an existing Types.ObjectId instance", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);

      // Bypassing string type signature to explicitly test the `val instanceof Types.ObjectId` branch
      const res = await (InvoiceService.getById as any)(new Types.ObjectId(validObjectId));
      expect(res).toBeDefined();
    });

    it("should throw if the ObjectId is totally invalid format", async () => {
      await expect(InvoiceService.getById("invalid-format")).rejects.toThrow("Invalid invoiceId");
    });

    it("toDomain should correctly map items (with/without optionals) and prune bad metadata", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);

      const res = await InvoiceService.getById(validObjectId);

      const mappedInvoice = res.invoice as any;
      expect(mappedInvoice.items[0].description).toBe("General checkup");
      expect(mappedInvoice.items[0].discountPercent).toBe(10);
      expect(mappedInvoice.items[1].description).toBeUndefined();
      expect(mappedInvoice.items[1].discountPercent).toBeUndefined();

      // Check metadata pruning
      expect(mappedInvoice.metadata).toEqual({
        validStr: "text",
        validNum: 42,
        validBool: true,
      });
      expect(mappedInvoice.metadata.invalidObj).toBeUndefined();
      expect(mappedInvoice.metadata.invalidArr).toBeUndefined();
    });

    it("toDomain should fallback metadata to undefined if it is a primitive or null", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoiceDocument({ metadata: "Not an object" }));
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);

      const res = await InvoiceService.getById(validObjectId);
      expect((res.invoice as any).metadata).toBeUndefined();
    });
  });

  describe("createDraftForAppointment", () => {
    const validInput = {
      appointmentId: validObjectId,
      parentId: validObjectId,
      organisationId: validObjectId,
      companionId: validObjectId,
      currency: "INR",
      items: [
        { description: "Vaccine", quantity: 2, unitPrice: 100, discountPercent: 10 }, // Total: 200, Discount: 20 -> 180
        { description: "Checkup", quantity: 1, unitPrice: 50 }, // Total: 50 -> 50
      ],
      notes: "Test Note",
    };

    it("should throw if appointment is not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.createDraftForAppointment(validInput)).rejects.toThrow("Appointment not found");
    });

    it("should calculate totals, save invoice, and send notification", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue({});
      (InvoiceModel.create as jest.Mock).mockResolvedValue({ _id: "new-invoice" });

      const res = await InvoiceService.createDraftForAppointment(validInput);

      expect(InvoiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 250, // (2*100) + (1*50)
          discountTotal: 20, // 10% of 200
          taxTotal: 0,
          totalAmount: 230, // 250 - 20
          notes: "Test Note",
        })
      );

      expect(NotificationTemplates.Payment.PAYMENT_PENDING).toHaveBeenCalledWith(230);
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(validObjectId, { title: "Mock", body: "Mock" });
      expect(res).toEqual({ _id: "new-invoice" });
    });
  });

  describe("Single Update Operations (attachStripeDetails, markPaid, markFailed, markRefunded, updateStatus)", () => {
    it("attachStripeDetails should throw 404 if not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.attachStripeDetails(validObjectId, {})).rejects.toThrow("Invoice not found.");
    });

    it("attachStripeDetails should update and return domain model", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      const res = await InvoiceService.attachStripeDetails(validObjectId, { stripePaymentIntentId: "pi_123" });
      expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(expect.any(Types.ObjectId), { $set: { stripePaymentIntentId: "pi_123" } }, { new: true });
      expect(res).toBeDefined(); // Maps to domain
    });

    it("markPaid should update status and return raw doc", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: validObjectId });
      const res = await InvoiceService.markPaid(validObjectId);
      expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(expect.any(Types.ObjectId), { $set: { status: "PAID" } }, { new: true });
      expect(res).toEqual({ _id: validObjectId });
    });
    it("markPaid should throw 404 if not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.markPaid(validObjectId)).rejects.toThrow("Invoice not found.");
    });

    it("markFailed should update status and return raw doc", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: validObjectId });
      const res = await InvoiceService.markFailed(validObjectId);
      expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(expect.any(Types.ObjectId), { $set: { status: "FAILED" } }, { new: true });
      expect(res).toEqual({ _id: validObjectId });
    });
    it("markFailed should throw 404 if not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.markFailed(validObjectId)).rejects.toThrow("Invoice not found.");
    });

    it("markRefunded should update status and return mapped domain", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      const res = await InvoiceService.markRefunded(validObjectId);
      expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(expect.any(Types.ObjectId), { $set: { status: "REFUNDED" } }, { new: true });
      expect(res).toBeDefined();
    });
    it("markRefunded should throw 404 if not found", async () => {
      (InvoiceModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.markRefunded(validObjectId)).rejects.toThrow("Invoice not found.");
    });

    it("updateStatus should save and return updated doc", async () => {
      const doc = mockInvoiceDocument();
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.updateStatus(validObjectId, "CANCELLED");
      expect(doc.status).toBe("CANCELLED");
      expect(doc.save).toHaveBeenCalled();
      expect(res).toBe(doc);
    });
    it("updateStatus should throw 404 if not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.updateStatus(validObjectId, "CANCELLED")).rejects.toThrow("Invoice not found");
    });
  });

  describe("Retrieval operations (getters & lists)", () => {
    it("getById should handle missing organization gracefully", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      (OrganizationModel.findById as jest.Mock).mockResolvedValue(null);

      const res = await InvoiceService.getById(validObjectId);
      expect(res.organistion).toEqual({ name: "", placesId: "", address: "", image: "" });
      expect((res.invoice as any).isDTO).toBe(true);
    });

    it("getById should populate organization details if present", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      (OrganizationModel.findById as jest.Mock).mockResolvedValue({
        name: "Test Org", googlePlacesId: "place123", address: "123 St", imageURL: "url.jpg"
      });

      const res = await InvoiceService.getById(validObjectId);
      expect(res.organistion.name).toBe("Test Org");
    });

    it("getById should throw 404 if not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.getById(validObjectId)).rejects.toThrow("Invoice not found.");
    });

    it("getByAppointmentId should find, sort, and map", async () => {
      const res = await InvoiceService.getByAppointmentId(validObjectId);
      expect(mockSortChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.length).toBe(1);
    });

    it("listForOrganisation should find, sort, and map", async () => {
      const res = await InvoiceService.listForOrganisation(validObjectId);
      expect(InvoiceModel.find).toHaveBeenCalledWith({ organisationId: validObjectId });
      expect(res.length).toBe(1);
    });

    it("listForParent should find, sort, and map", async () => {
      const res = await InvoiceService.listForParent(validObjectId);
      expect(InvoiceModel.find).toHaveBeenCalledWith({ parentId: validObjectId });
      expect(res.length).toBe(1);
    });

    it("listForCompanion should find, sort, and map", async () => {
      const res = await InvoiceService.listForCompanion(validObjectId);
      expect(InvoiceModel.find).toHaveBeenCalledWith({ companionId: validObjectId });
      expect(res.length).toBe(1);
    });

    it("getByPaymentIntentId should return null if not found", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
      const res = await InvoiceService.getByPaymentIntentId("pi_123");
      expect(res).toBeNull();
    });

    it("getByPaymentIntentId should map and return if found", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(mockInvoiceDocument());
      const res = await InvoiceService.getByPaymentIntentId("pi_123");
      expect(res).toBeDefined();
    });
  });

  describe("addItemsToInvoice", () => {
    it("should throw 404 if invoice not found", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(InvoiceService.addItemsToInvoice(validObjectId, [])).rejects.toThrow("Invoice not found");
    });

    it("should throw 409 if invoice is already PAID", async () => {
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(mockInvoiceDocument({ status: "PAID" }));
      await expect(InvoiceService.addItemsToInvoice(validObjectId, [])).rejects.toThrow("Cannot modify a paid invoice.");
    });

    it("should append items and recalculate totals properly", async () => {
      // Create a base invoice without taxPercent
      const doc = mockInvoiceDocument({ items: [], subtotal: 0, taxPercent: undefined });
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(doc);

      const newItems: any[] = [
        { unitPrice: 100, quantity: 2, discountPercent: 10 }, // total: 180
        { unitPrice: 50, quantity: 1 } // total: 50
      ];

      const res = await InvoiceService.addItemsToInvoice(validObjectId, newItems);

      expect(res.items.length).toBe(2);
      expect(res.items[0].total).toBe(180);
      expect(res.items[1].total).toBe(50);
      expect(res.subtotal).toBe(230);
      expect(res.taxPercent).toBe(0); // Coerced from undefined
      expect(res.totalAmount).toBe(230);
      expect(doc.save).toHaveBeenCalled();
    });

    it("should apply existing taxPercent properly", async () => {
      const doc = mockInvoiceDocument({ items: [], subtotal: 0, taxPercent: 10 });
      (InvoiceModel.findById as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.addItemsToInvoice(validObjectId, [{ unitPrice: 100, quantity: 1 } as any]);

      expect(res.subtotal).toBe(100);
      expect(res.totalAmount).toBe(110); // 100 + 10%
    });
  });

  describe("handleAppointmentCancellation", () => {
    it("should return NO_INVOICE if it doesn't exist", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(null);
      const res = await InvoiceService.handleAppointmentCancellation(validObjectId, "reason");
      expect(res).toEqual({ action: "NO_INVOICE" });
    });

    it("should return ALREADY_HANDLED for CANCELLED or REFUNDED status", async () => {
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(mockInvoiceDocument({ status: "CANCELLED" }));
      const res = await InvoiceService.handleAppointmentCancellation(validObjectId, "reason");
      expect(res).toEqual({ action: "ALREADY_HANDLED", status: "CANCELLED" });

      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(mockInvoiceDocument({ status: "REFUNDED" }));
      const res2 = await InvoiceService.handleAppointmentCancellation(validObjectId, "reason");
      expect(res2).toEqual({ action: "ALREADY_HANDLED", status: "REFUNDED" });
    });

    it("should cancel unpaid invoices (AWAITING_PAYMENT)", async () => {
      const doc = mockInvoiceDocument({ status: "AWAITING_PAYMENT" });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.handleAppointmentCancellation(validObjectId, "Client asked");

      expect(doc.status).toBe("CANCELLED");
      expect(doc.metadata.cancellationReason).toBe("Client asked");
      expect(doc.save).toHaveBeenCalled();
      expect(res).toEqual({ action: "CANCELLED_UNPAID" });
    });

    it("should cancel unpaid invoices (PENDING)", async () => {
      const doc = mockInvoiceDocument({ status: "PENDING" });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.handleAppointmentCancellation(validObjectId, "reason");
      expect(res).toEqual({ action: "CANCELLED_UNPAID" });
    });

    it("should throw 500 if invoice is PAID but missing Stripe ID", async () => {
      const doc = mockInvoiceDocument({ status: "PAID", stripePaymentIntentId: null });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);

      await expect(InvoiceService.handleAppointmentCancellation(validObjectId, "reason"))
        .rejects.toThrow("Cannot refund: missing Stripe paymentIntentId");
    });

    it("should refund Stripe Intent and mark REFUNDED if PAID and valid", async () => {
      const doc = mockInvoiceDocument({ status: "PAID", stripePaymentIntentId: "pi_123" });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);
      (StripeService.refundPaymentIntent as jest.Mock).mockResolvedValue({ refundId: "ref_123", amountRefunded: 500 });

      const res = await InvoiceService.handleAppointmentCancellation(validObjectId, "Refund reason");

      expect(StripeService.refundPaymentIntent).toHaveBeenCalledWith("pi_123");
      expect(doc.status).toBe("REFUNDED");
      expect(doc.metadata.refundId).toBe("ref_123");
      expect(doc.metadata.amount).toBe(500);
      expect(doc.save).toHaveBeenCalled();
      expect(res).toEqual({ action: "REFUNDED", refundId: "ref_123" });
    });

    it("should return NO_ACTION for an unknown status", async () => {
      const doc = mockInvoiceDocument({ status: "PROCESSING_UNKNOWN" });
      (InvoiceModel.findOne as jest.Mock).mockResolvedValue(doc);

      const res = await InvoiceService.handleAppointmentCancellation(validObjectId, "reason");
      expect(res).toEqual({ action: "NO_ACTION", status: "PROCESSING_UNKNOWN" });
    });
  });
});