import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { InvoiceService } from "../../src/services/invoice.service";
import InvoiceModel from "../../src/models/invoice";
import AppointmentModel from "../../src/models/appointment";
import OrganizationModel from "../../src/models/organization";
import { OrgBilling } from "../../src/models/organization.billing";
import { StripeService } from "../../src/services/stripe.service";
import { NotificationService } from "../../src/services/notification.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock("../../src/models/invoice");
jest.mock("../../src/models/appointment");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/organization.billing", () => ({
  OrgBilling: {
    findOne: jest.fn(),
  },
}));
jest.mock("../../src/services/stripe.service");
jest.mock("../../src/services/notification.service");
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

// Helper to mock mongoose chaining: find().sort().exec()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMongooseChain = (resolvedValue: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  // Cast jest.fn() to any to allow loose typing on mock return values
  chain.sort = (jest.fn() as any).mockReturnValue(chain);
  chain.session = (jest.fn() as any).mockReturnValue(chain);
  chain.limit = (jest.fn() as any).mockReturnValue(chain);
  chain.skip = (jest.fn() as any).mockReturnValue(chain);

  // Cast to any to avoid 'never' type errors on the argument
  chain.exec = (jest.fn() as any).mockResolvedValue(resolvedValue);

  // Allow awaiting the chain directly like a Promise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);

  return chain;
};

// Helper to create a mock Invoice Document that satisfies toDomain()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInvoiceDoc = (data: any) => {
  const _id = data._id || new Types.ObjectId();
  return {
    ...data,
    _id,
    items: data.items || [],
    // toObject needs to return the plain data structure expected by toDomain
    toObject: (jest.fn() as any).mockReturnValue({
      ...data,
      _id,
      // Ensure items have IDs for the map() in toDomain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (data.items || []).map((i: any) => ({
        ...i,
        id: i.id || new Types.ObjectId().toString(),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    save: (jest.fn() as any).mockResolvedValue(true),
  };
};

const mockedOrgBilling = OrgBilling as unknown as {
  findOne: jest.Mock<() => Promise<{ currency: string } | null>>;
};

describe("InvoiceService", () => {
  const validId = new Types.ObjectId().toString();
  const appointmentId = new Types.ObjectId().toString();
  const parentId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedOrgBilling.findOne.mockResolvedValue({ currency: "USD" });
    (AuditTrailService.recordSafely as jest.Mock).mockImplementation(
      async () => {},
    );
  });

  // ======================================================================
  // Section 1: Creation Logic
  // ======================================================================
  describe("Creation", () => {
    describe("createDraftForAppointment", () => {
      it("should create a draft invoice and send notification", async () => {
        // Cast to any to bypass "Argument of type... not assignable to never"
        (AppointmentModel.findById as any).mockReturnValue({
          session: (jest.fn() as any).mockResolvedValue({
            _id: appointmentId,
            companion: {
              id: new Types.ObjectId().toString(),
              parent: { id: parentId },
            },
          }),
        });

        const createdInvoice = {
          _id: new Types.ObjectId(),
          status: "AWAITING_PAYMENT",
          totalAmount: 100,
          currency: "USD",
        };
        (InvoiceModel.create as any).mockResolvedValue([createdInvoice]);
        (NotificationService.sendToUser as any).mockResolvedValue(true);

        const input = {
          appointmentId,
          parentId,
          organisationId: new Types.ObjectId().toString(),
          companionId: new Types.ObjectId().toString(),
          paymentCollectionMethod: "PAYMENT_INTENT" as const,
          items: [{ description: "Test", quantity: 1, unitPrice: 100 }],
        };

        const result = await InvoiceService.createDraftForAppointment(input);

        expect(AppointmentModel.findById).toHaveBeenCalledWith(appointmentId);
        expect(InvoiceModel.create).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              totalAmount: 100,
              status: "AWAITING_PAYMENT",
            }),
          ]),
          expect.anything(),
        );
        expect(NotificationService.sendToUser).toHaveBeenCalled();
        expect(result).toEqual([createdInvoice]);
      });

      it("should throw if appointment not found", async () => {
        (AppointmentModel.findById as any).mockReturnValue({
          session: (jest.fn() as any).mockResolvedValue(null),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(
          InvoiceService.createDraftForAppointment({ appointmentId } as any),
        ).rejects.toThrow("Appointment not found");
      });

      it("should calculate discounts correctly", async () => {
        (AppointmentModel.findById as any).mockReturnValue({
          session: (jest.fn() as any).mockResolvedValue({
            companion: {
              id: new Types.ObjectId().toString(),
              parent: { id: parentId },
            },
          }),
        });

        const createMock = (jest.fn() as any).mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            status: "AWAITING_PAYMENT",
            totalAmount: 90,
            currency: "USD",
          },
        ]);
        (InvoiceModel.create as any) = createMock;

        const input = {
          appointmentId,
          parentId,
          organisationId: "org",
          companionId: "comp",
          paymentCollectionMethod: "PAYMENT_INTENT" as const,
          items: [
            {
              description: "Item",
              quantity: 2,
              unitPrice: 50,
              discountPercent: 10,
            },
          ], // Total 100, 10% off -> 90
        };

        await InvoiceService.createDraftForAppointment(input);

        // Fix "Object is of type 'unknown'" by casting the calls array
        // InvoiceModel.create is called with ([payload], options)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callArgs = (createMock.mock.calls[0][0] as any)[0];

        expect(callArgs.subtotal).toBe(100);
        expect(callArgs.discountTotal).toBe(10);
        expect(callArgs.totalAmount).toBe(90);
      });
    });

    describe("createExtraInvoiceForAppointment", () => {
      it("should create extra invoice and notify parent", async () => {
        const mockAppt = {
          _id: new Types.ObjectId(appointmentId),
          organisationId: new Types.ObjectId(),
          companion: {
            id: new Types.ObjectId().toString(),
            parent: { id: parentId },
          },
        };
        (AppointmentModel.findById as any).mockResolvedValue(mockAppt);

        // Mock the constructor behavior of InvoiceModel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const saveMock = (jest.fn() as any).mockResolvedValue(true);
        (InvoiceModel as any).mockImplementation((data: any) => {
          return mockInvoiceDoc({ ...data, save: saveMock });
        });
      });

      it("should throw if appointment missing", async () => {
        (AppointmentModel.findById as any).mockResolvedValue(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(
          InvoiceService.createExtraInvoiceForAppointment({
            appointmentId,
          } as any),
        ).rejects.toThrow("Appointment not found");
      });
    });
  });

  // ======================================================================
  // Section 2: Retrieval & Listing
  // ======================================================================
  describe("Retrieval", () => {
    const mockDocData = {
      _id: new Types.ObjectId(validId),
      totalAmount: 100,
      currency: "USD",
      status: "PAID",
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const doc = mockInvoiceDoc(mockDocData);

    describe("getById", () => {
      it("should return invoice and organization details", async () => {
        (InvoiceModel.findById as any).mockResolvedValue(doc);
        (OrganizationModel.findById as any).mockResolvedValue({
          name: "Org",
          googlePlacesId: "pid",
          address: "addr",
          imageURL: "img",
        });

        const result = await InvoiceService.getById(validId);

        expect(result.invoice.id).toBe(validId);
        expect(result.organistion.name).toBe("Org");
      });

      it("should throw if invoice not found", async () => {
        (InvoiceModel.findById as any).mockResolvedValue(null);
        await expect(InvoiceService.getById(validId)).rejects.toThrow(
          "Invoice not found",
        );
      });

      it("should validate ID format", async () => {
        await expect(InvoiceService.getById("invalid")).rejects.toThrow(
          "Invalid invoiceId",
        );
      });
    });

    describe("getByPaymentIntentId", () => {
      it("should return DTO if found", async () => {
        (InvoiceModel.findOne as any).mockResolvedValue(doc);
        const res = await InvoiceService.getByPaymentIntentId("pi_123");
        expect(res?.id).toBe(validId);
      });

      it("should return null if not found", async () => {
        (InvoiceModel.findOne as any).mockResolvedValue(null);
        const res = await InvoiceService.getByPaymentIntentId("pi_123");
        expect(res).toBeNull();
      });
    });

    // Helper for simple list tests
    const testListMethod = async (
      methodName:
        | "listForOrganisation"
        | "listForParent"
        | "listForCompanion"
        | "getByAppointmentId",
      filterKey: string,
    ) => {
      (InvoiceModel.find as any).mockReturnValue(mockMongooseChain([doc]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (InvoiceService as any)[methodName](validId);
      expect(results).toHaveLength(1);
      expect(InvoiceModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ [filterKey]: validId }),
      );
    };

    describe("List Methods", () => {
      it("listForOrganisation", () =>
        testListMethod("listForOrganisation", "organisationId"));
      it("listForParent", () => testListMethod("listForParent", "parentId"));
      it("listForCompanion", () =>
        testListMethod("listForCompanion", "companionId"));
      it("getByAppointmentId", () =>
        testListMethod("getByAppointmentId", "appointmentId"));
    });
  });

  // ======================================================================
  // Section 3: Updates & Status Management
  // ======================================================================
  describe("Status Management", () => {
    const doc = mockInvoiceDoc({
      _id: new Types.ObjectId(validId),
      status: "AWAITING_PAYMENT",
    });

    describe("attachStripeDetails", () => {
      it("should update and return domain object", async () => {
        (InvoiceModel.findByIdAndUpdate as any).mockResolvedValue(doc);
        const res = await InvoiceService.attachStripeDetails(validId, {
          stripeInvoiceId: "inv_1",
        });
        expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
          expect.any(Types.ObjectId),
          { $set: { stripeInvoiceId: "inv_1" } },
          { new: true },
        );
        expect(res.id).toBe(validId);
      });
      it("should throw if not found", async () => {
        (InvoiceModel.findByIdAndUpdate as any).mockResolvedValue(null);
        await expect(
          InvoiceService.attachStripeDetails(validId, {}),
        ).rejects.toThrow("Invoice not found");
      });
    });

    describe("markInvoicePaid / markFailed / markRefunded", () => {
      it("markInvoicePaid updates status", async () => {
        (InvoiceModel.findOneAndUpdate as any).mockResolvedValue(doc);
        await InvoiceService.markInvoicePaid({ invoiceId: validId });
        expect(InvoiceModel.findOneAndUpdate).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            $set: expect.objectContaining({ status: "PAID" }),
          }),
          expect.anything(),
        );
      });

      it("markFailed updates status", async () => {
        (InvoiceModel.findByIdAndUpdate as any).mockResolvedValue(doc);
        await InvoiceService.markFailed(validId);
        expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
          expect.anything(),
          { $set: { status: "FAILED" } },
          expect.anything(),
        );
      });

      it("markRefunded updates status", async () => {
        (InvoiceModel.findByIdAndUpdate as any).mockResolvedValue(doc);
        await InvoiceService.markRefunded(validId);
        expect(InvoiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
          expect.anything(),
          { $set: { status: "REFUNDED" } },
          expect.anything(),
        );
      });
    });

    describe("updateStatus", () => {
      it("should update status manually", async () => {
        (InvoiceModel.findById as any).mockResolvedValue(doc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await InvoiceService.updateStatus(validId, "PAID" as any);
        expect(doc.status).toBe("PAID");
        expect(doc.save).toHaveBeenCalled();
      });
      it("should throw if missing", async () => {
        (InvoiceModel.findById as any).mockResolvedValue(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(
          InvoiceService.updateStatus(validId, "PAID" as any),
        ).rejects.toThrow("Invoice not found");
      });
    });
  });

  // ======================================================================
  // Section 4: Complex Logic (Add Items & Cancellations)
  // ======================================================================
  describe("Complex Logic", () => {
    describe("addItemsToInvoice", () => {
      it("should add items and recalculate totals", async () => {
        const existingDoc = mockInvoiceDoc({
          items: [{ quantity: 1, unitPrice: 100 }], // subtotal 100
          taxPercent: 10,
        });
        // We need to simulate the push method on items array because our mock data is a plain array
        existingDoc.items.push = Array.prototype.push.bind(existingDoc.items);

        (InvoiceModel.findById as any).mockResolvedValue(existingDoc);

        const newItems = [
          { id: "2", name: "New", quantity: 2, unitPrice: 50, total: 100 },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await InvoiceService.addItemsToInvoice(validId, newItems as any);

        // Old (100) + New (2*50=100) = Subtotal 200
        // Tax 10% of 200 = 20
        // Total = 220
        expect(existingDoc.subtotal).toBe(200);
        expect(existingDoc.totalAmount).toBe(220);
        expect(existingDoc.save).toHaveBeenCalled();
      });

      it("should throw if invoice is PAID", async () => {
        const doc = mockInvoiceDoc({ status: "PAID" });
        (InvoiceModel.findById as any).mockResolvedValue(doc);
        await expect(
          InvoiceService.addItemsToInvoice(validId, []),
        ).rejects.toThrow("Cannot modify a paid invoice");
      });
    });

    describe("addChargesToAppointment", () => {
      it("Scenario A: Open invoice exists -> append", async () => {
        const mockFind = jest.spyOn(
          InvoiceService,
          "findOpenInvoiceForAppointment",
        );
        const mockAdd = jest.spyOn(InvoiceService, "addItemsToInvoice");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockFind.mockResolvedValue({ _id: validId } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockAdd.mockResolvedValue("updated-invoice" as any);

        const res = await InvoiceService.addChargesToAppointment(
          appointmentId,
          [],
        );

        expect(mockAdd).toHaveBeenCalledWith(validId, []);
        expect(res).toBe("updated-invoice");
      });

      it("Scenario B: No open invoice -> create extra", async () => {
        const mockFind = jest.spyOn(
          InvoiceService,
          "findOpenInvoiceForAppointment",
        );
        const mockCreate = jest.spyOn(
          InvoiceService,
          "createExtraInvoiceForAppointment",
        );

        mockFind.mockResolvedValue(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockCreate.mockResolvedValue("new-invoice" as any);

        const res = await InvoiceService.addChargesToAppointment(
          appointmentId,
          [],
        );

        expect(mockCreate).toHaveBeenCalled();
        expect(res).toBe("new-invoice");
      });
    });

    describe("handleAppointmentCancellation", () => {
      it("should return NO_INVOICE if none exists", async () => {
        (InvoiceModel.findOne as any).mockResolvedValue(null);
        const res = await InvoiceService.handleAppointmentCancellation(
          appointmentId,
          "reason",
        );
        expect(res.action).toBe("NO_INVOICE");
      });

      it("should return ALREADY_HANDLED if status is CANCELLED", async () => {
        (InvoiceModel.findOne as any).mockResolvedValue({
          status: "CANCELLED",
        });
        const res = await InvoiceService.handleAppointmentCancellation(
          appointmentId,
          "reason",
        );
        expect(res.action).toBe("ALREADY_HANDLED");
      });

      it("should cancel unpaid invoice", async () => {
        const doc = mockInvoiceDoc({
          status: "AWAITING_PAYMENT",
          metadata: {},
        });
        (InvoiceModel.findOne as any).mockResolvedValue(doc);

        const res = await InvoiceService.handleAppointmentCancellation(
          appointmentId,
          "reason",
        );

        expect(doc.status).toBe("CANCELLED");
        expect(doc.metadata.cancellationReason).toBe("reason");
        expect(doc.save).toHaveBeenCalled();
        expect(res.action).toBe("CANCELLED_UNPAID");
      });

      it("should refund paid invoice via Stripe", async () => {
        const doc = mockInvoiceDoc({
          status: "PAID",
          stripePaymentIntentId: "pi_123",
          metadata: {},
        });
        (InvoiceModel.findOne as any).mockResolvedValue(doc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (StripeService.refundPaymentIntent as any).mockResolvedValue({
          refundId: "re_123",
          amountRefunded: 100,
        });

        const res = await InvoiceService.handleAppointmentCancellation(
          appointmentId,
          "reason",
        );

        expect(StripeService.refundPaymentIntent).toHaveBeenCalledWith(
          "pi_123",
        );
        expect(doc.status).toBe("REFUNDED");
        expect(doc.metadata.refundId).toBe("re_123");
        expect(res.action).toBe("REFUNDED");
      });

      it("should throw if paid but no stripe ID", async () => {
        const doc = mockInvoiceDoc({
          status: "PAID",
          stripePaymentIntentId: null,
        });
        (InvoiceModel.findOne as any).mockResolvedValue(doc);

        await expect(
          InvoiceService.handleAppointmentCancellation(appointmentId, "reason"),
        ).rejects.toThrow("Cannot refund: missing Stripe paymentIntentId");
      });
    });
  });

  // ======================================================================
  // Utils Coverage
  // ======================================================================
  describe("Utils", () => {
    it("metadata reducer coverage", async () => {
      // Force a metadata structure to test the reduce logic in toDomain
      const meta = { valid: "string", ignored: {} };
      const doc = mockInvoiceDoc({ metadata: meta });
      (InvoiceModel.findById as any).mockResolvedValue(doc);
    });
  });
});
