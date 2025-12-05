import { Types } from "mongoose";
import InvoiceModel, { InvoiceDocument, InvoiceMongo } from "../models/invoice";
import AppointmentModel from "src/models/appointment";
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  toInvoiceResponseDTO,
} from "@yosemite-crew/types";
import { Currency } from "@yosemite-crew/fhirtypes";
import { StripeService } from "./stripe.service";
import OrganizationModel from "src/models/organization";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";

export class InvoiceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "InvoiceServiceError";
  }
}

const ensureObjectId = (val: unknown, field: string): Types.ObjectId => {
  if (val instanceof Types.ObjectId) return val;

  if (typeof val === "string" && Types.ObjectId.isValid(val)) {
    return new Types.ObjectId(val);
  }

  throw new InvoiceServiceError(`Invalid ${field}`, 400);
};

const toDomain = (doc: InvoiceDocument): Invoice => {
  const o = doc.toObject() as InvoiceMongo & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

  const items: InvoiceItem[] = o.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent: item.discountPercent ?? undefined,
    total: item.total,
  }));

  const metadata =
    o.metadata && typeof o.metadata === "object"
      ? Object.entries(o.metadata).reduce<
          Record<string, string | number | boolean>
        >((acc, [key, value]) => {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            acc[key] = value;
          }
          return acc;
        }, {})
      : undefined;

  return {
    id: o._id.toString(),
    parentId: o.parentId?.toString(),
    companionId: o.companionId?.toString(),
    organisationId: o.organisationId?.toString(),
    appointmentId: o.appointmentId?.toString(),
    items,
    subtotal: o.subtotal,
    totalAmount: o.totalAmount,
    taxPercent: o.taxPercent,
    currency: o.currency as Currency,
    taxTotal: o.taxTotal,
    discountTotal: o.discountTotal,
    stripePaymentIntentId: o.stripePaymentIntentId ?? undefined,
    stripePaymentLinkId: o.stripePaymentLinkId ?? undefined,
    stripeInvoiceId: o.stripeInvoiceId ?? undefined,
    stripeCustomerId: o.stripeCustomerId ?? undefined,
    stripeChargeId: o.stripeChargeId ?? undefined,
    stripeReceiptUrl: o.stripeReceiptUrl ?? undefined,
    status: o.status as InvoiceStatus,
    metadata,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

export const InvoiceService = {
  async createDraftForAppointment(input: {
    appointmentId: string;
    parentId: string;
    organisationId: string;
    companionId: string;
    currency: string;
    items: {
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
    }[];
    notes?: string;
  }) {
    // 1. Validate appointment exists
    const appointment = await AppointmentModel.findById(input.appointmentId);
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    // 2. Build amounts
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const discountTotal = input.items.reduce(
      (sum, item) =>
        sum +
        (item.discountPercent
          ? (item.discountPercent / 100) * (item.unitPrice * item.quantity)
          : 0),
      0,
    );

    const taxTotal = 0; // add GST/VAT logic later
    const totalPayable = subtotal - discountTotal + taxTotal;

    const itemsDetailed = input.items.map((item) => ({
      ...item,
      name: item.description,
      total: item.quantity * item.unitPrice,
    }));

    // 3. Create invoice
    const invoice = await InvoiceModel.create({
      appointmentId: input.appointmentId,
      parentId: input.parentId,
      organisationId: input.organisationId,
      currency: input.currency,

      status: "AWAITING_PAYMENT",

      items: itemsDetailed,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount: totalPayable,

      notes: input.notes,
    });

    const notificationPayload = NotificationTemplates.Payment.PAYMENT_PENDING(
      totalPayable,
    )
    await NotificationService.sendToUser(
      input.parentId,
      notificationPayload
    )

    return invoice;
  },

  async attachStripeDetails(invoiceId: string, updates: Partial<Invoice>) {
    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: updates },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    return toDomain(doc);
  },

  async markPaid(invoiceId: string) {
    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "PAID" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    return doc;
  },

  async markFailed(invoiceId: string) {
    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "FAILED" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    return doc;
  },

  async markRefunded(invoiceId: string): Promise<Invoice> {
    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "REFUNDED" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    return toDomain(doc);
  },

  async updateStatus(invoiceId: string, status: InvoiceMongo["status"]) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    invoice.status = status;
    await invoice.save();
    return invoice;
  },

  async getByAppointmentId(appId: string) {
    const docs = await InvoiceModel.find({
      appointmentId: appId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async getById(id: string) {
    const _id = ensureObjectId(id, "invoiceId");

    const doc = await InvoiceModel.findById(_id);
    const org = await OrganizationModel.findById(doc?.organisationId);

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404); 

    return {
      organistion :{
        name: org?.name || '',
        placesId: org?.googlePlacesId || '',
        address: org?.address || '',
        image: org?.imageURL || ''
      },
      invoice: toInvoiceResponseDTO(toDomain(doc))
    };
  },

  async listForOrganisation(organisationId: string) {
    const docs = await InvoiceModel.find({
      organisationId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async listForParent(parentId: string) {
    const docs = await InvoiceModel.find({
      parentId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async listForCompanion(companionId: string) {
    const docs = await InvoiceModel.find({
      companionId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async addItemsToInvoice(invoiceId: string, newItems: InvoiceItem[]) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    if (invoice.status === "PAID") {
      throw new InvoiceServiceError("Cannot modify a paid invoice.", 409);
    }

    // 1. Add each item
    for (const item of newItems) {
      invoice.items.push({
        ...item,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      });
    }

    // 2. Recalculate totals
    invoice.subtotal = invoice.items.reduce((sum, it) => sum + it.total, 0);
    invoice.taxPercent = invoice.taxPercent ?? 0;
    invoice.totalAmount =
      invoice.subtotal + (invoice.taxPercent / 100) * invoice.subtotal;

    invoice.updatedAt = new Date();
    await invoice.save();

    return invoice;
  },

  async handleAppointmentCancellation(appointmentId: string, reason: string) {
    // 1. Load invoice (if exists)
    const invoice = await InvoiceModel.findOne({ appointmentId });

    if (!invoice) {
      // No invoice created → safe to return
      return { action: "NO_INVOICE" };
    }

    // If already cancelled or refunded — idempotent
    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    // If invoice not yet paid, simply cancel it
    if (invoice.status === "AWAITING_PAYMENT" || invoice.status === "PENDING") {
      invoice.status = "CANCELLED";
      invoice.metadata = {
        ...invoice.metadata,
        cancellationReason: reason,
      };
      await invoice.save();
      return { action: "CANCELLED_UNPAID" };
    }

    // -----------------------------
    // PAID invoice → refund required
    // -----------------------------
    if (invoice.status === "PAID") {
      if (!invoice.stripePaymentIntentId) {
        throw new InvoiceServiceError(
          "Cannot refund: missing Stripe paymentIntentId",
          500,
        );
      }

      const refund = await StripeService.refundPaymentIntent(
        invoice.stripePaymentIntentId,
      );

      // Update invoice
      invoice.status = "REFUNDED";
      invoice.metadata = {
        ...invoice.metadata,
        cancellationReason: reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
        refundDate: new Date().toISOString(),
      };

      await invoice.save();

      return { action: "REFUNDED", refundId: refund.refundId };
    }

    // Fallback — unknown (should not happen)
    return { action: "NO_ACTION", status: invoice.status };
  },

  async getByPaymentIntentId(paymentIntentId: string) {
    const doc = await InvoiceModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });

    if (!doc) {
      return null;
    }

    return toInvoiceResponseDTO(toDomain(doc));
  },
};
