import mongoose, { Types } from "mongoose";
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
import { AuditTrailService } from "./audit-trail.service";

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

const resolveAuditTargetsForInvoice = async (invoice: InvoiceDocument) => {
  if (invoice.organisationId && invoice.companionId) {
    return {
      organisationId: invoice.organisationId,
      companionId: invoice.companionId,
    };
  }

  if (invoice.appointmentId) {
    const appointment = await AppointmentModel.findById(
      invoice.appointmentId,
      { organisationId: 1, "companion.id": 1 },
    ).lean();

    if (appointment?.organisationId && appointment?.companion?.id) {
      return {
        organisationId: appointment.organisationId,
        companionId: appointment.companion.id,
      };
    }
  }

  return {
    organisationId: invoice.organisationId,
    companionId: invoice.companionId,
  };
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
    stripeCheckoutSessionId: o.stripeCheckoutSessionId ?? undefined,
    stripeCheckoutUrl: o.stripeCheckoutUrl ?? undefined,
    paymentCollectionMethod: o.paymentCollectionMethod,
    status: o.status as InvoiceStatus,
    metadata,
    paidAt: o.paidAt ?? undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

const recalculateTotals = (invoice: InvoiceDocument) => {
  invoice.subtotal = invoice.items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );

  invoice.discountTotal = invoice.items.reduce(
    (sum, i) =>
      sum +
      (i.discountPercent
        ? (i.discountPercent / 100) * i.unitPrice * i.quantity
        : 0),
    0,
  );

  invoice.taxPercent = invoice.taxPercent ?? 0;
  invoice.taxTotal =
    (invoice.taxPercent / 100) * (invoice.subtotal - invoice.discountTotal);

  invoice.totalAmount =
    invoice.subtotal - invoice.discountTotal + invoice.taxTotal;
};

export const InvoiceService = {
  async createDraftForAppointment(
    input: {
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
      paymentCollectionMethod: "PAYMENT_INTENT" | "PAYMENT_LINK"
    },
    session?: mongoose.ClientSession,
  ) {
    // 1. Validate appointment exists
    const appointment = await AppointmentModel.findById(
      input.appointmentId,
    ).session(session ?? null);

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
    const invoice = await InvoiceModel.create(
      [
        {
          appointmentId: input.appointmentId,
          parentId: input.parentId,
          organisationId: input.organisationId,
          currency: input.currency,

          status: "AWAITING_PAYMENT",
          paymentCollectionMethod: input.paymentCollectionMethod,
          items: itemsDetailed,
          subtotal,
          discountTotal,
          taxTotal,
          totalAmount: totalPayable,

          notes: input.notes,
        },
      ],
      { session },
    );

    const createdInvoice = Array.isArray(invoice) ? invoice[0] : invoice;

    await AuditTrailService.recordSafely({
      organisationId: input.organisationId,
      companionId: appointment.companion.id,
      eventType: "INVOICE_CREATED",
      actorType: "SYSTEM",
      entityType: "INVOICE",
      entityId: createdInvoice._id.toString(),
      metadata: {
        appointmentId: input.appointmentId,
        status: createdInvoice.status,
        totalAmount: createdInvoice.totalAmount,
        currency: createdInvoice.currency,
      },
    });

    const notificationPayload = NotificationTemplates.Payment.PAYMENT_PENDING(
      totalPayable,
      input.currency,
    );
    await NotificationService.sendToUser(input.parentId, notificationPayload);

    return invoice;
  },

  async createExtraInvoiceForAppointment(input: {
    appointmentId: string;
    items: InvoiceItem[];
    metadata?: Record<string, string | number | boolean | undefined>;
    currency: string;
  }) {
    const appointment = await AppointmentModel.findById(input.appointmentId);
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const invoice = new InvoiceModel({
      appointmentId: appointment._id,
      parentId: appointment.companion.parent.id,
      companionId: appointment.companion.id,
      organisationId: appointment.organisationId,
      currency: input.currency,

      purpose: "APPOINTMENT_EXTRA",
      status: "AWAITING_PAYMENT",

      items: input.items.map((item) => ({
        ...item,
        name: item.description,
        total: item.quantity * item.unitPrice,
      })),
      metadata: {
        ...input.metadata,
        source: "EXTRA_CHARGES",
      },
    });

    recalculateTotals(invoice);
    await invoice.save();

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "INVOICE_CREATED",
      actorType: "SYSTEM",
      entityType: "INVOICE",
      entityId: invoice._id.toString(),
      metadata: {
        appointmentId: appointment._id.toString(),
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
    });

    await NotificationService.sendToUser(
      appointment.companion.parent.id,
      NotificationTemplates.Payment.PAYMENT_PENDING(
        invoice.totalAmount,
        invoice.currency,
      ),
    );

    return toDomain(invoice);
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

  async markInvoicePaid(params: {
    invoiceId: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    stripeReceiptUrl?: string;
  }) {
    const invoice = await InvoiceModel.findOneAndUpdate(
      { _id: params.invoiceId, status: { $ne: "PAID" } },
      {
        $set: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentIntentId: params.stripePaymentIntentId,
          stripeChargeId: params.stripeChargeId,
          stripeReceiptUrl: params.stripeReceiptUrl,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (invoice) {
      const targets = await resolveAuditTargetsForInvoice(invoice);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_PAID",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice._id.toString(),
          metadata: {
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
        });
      }
    }

    return invoice;
  },

  async markFailed(invoiceId: string) {
    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "FAILED" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    const targets = await resolveAuditTargetsForInvoice(doc);
    if (targets.organisationId && targets.companionId) {
      await AuditTrailService.recordSafely({
        organisationId: targets.organisationId,
        companionId: targets.companionId,
        eventType: "INVOICE_FAILED",
        actorType: "SYSTEM",
        entityType: "INVOICE",
        entityId: doc._id.toString(),
        metadata: {
          status: doc.status,
          totalAmount: doc.totalAmount,
          currency: doc.currency,
        },
      });
    }

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

    const targets = await resolveAuditTargetsForInvoice(doc);
    if (targets.organisationId && targets.companionId) {
      await AuditTrailService.recordSafely({
        organisationId: targets.organisationId,
        companionId: targets.companionId,
        eventType: "INVOICE_REFUNDED",
        actorType: "SYSTEM",
        entityType: "INVOICE",
        entityId: doc._id.toString(),
        metadata: {
          status: doc.status,
          totalAmount: doc.totalAmount,
          currency: doc.currency,
        },
      });
    }

    return toDomain(doc);
  },

  async updateStatus(invoiceId: string, status: InvoiceMongo["status"]) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    invoice.status = status;
    await invoice.save();

    const targets = await resolveAuditTargetsForInvoice(invoice);
    if (targets.organisationId && targets.companionId) {
      await AuditTrailService.recordSafely({
        organisationId: targets.organisationId,
        companionId: targets.companionId,
        eventType: "INVOICE_UPDATED",
        actorType: "SYSTEM",
        entityType: "INVOICE",
        entityId: invoice._id.toString(),
        metadata: {
          status: invoice.status,
        },
      });
    }
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
      organistion: {
        name: org?.name || "",
        placesId: org?.googlePlacesId || "",
        address: org?.address || "",
        image: org?.imageURL || "",
      },
      invoice: toInvoiceResponseDTO(toDomain(doc)),
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

  async addItemsToInvoice(invoiceId: string, items: InvoiceItem[]) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    if (invoice.status === "PAID") {
      throw new InvoiceServiceError("Cannot modify a paid invoice", 409);
    }

    for (const item of items) {
      invoice.items.push({
        ...item,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      });
    }

    recalculateTotals(invoice);
    invoice.updatedAt = new Date();
    await invoice.save();

    const targets = await resolveAuditTargetsForInvoice(invoice);
    if (targets.organisationId && targets.companionId) {
      await AuditTrailService.recordSafely({
        organisationId: targets.organisationId,
        companionId: targets.companionId,
        eventType: "INVOICE_UPDATED",
        actorType: "SYSTEM",
        entityType: "INVOICE",
        entityId: invoice._id.toString(),
        metadata: {
          status: invoice.status,
          totalAmount: invoice.totalAmount,
          currency: invoice.currency,
          itemsAdded: items.length,
        },
      });
    }

    return toDomain(invoice);
  },

  async addChargesToAppointment(
    appointmentId: string,
    items: InvoiceItem[],
    currency: string,
  ) {
    const invoice = await this.findOpenInvoiceForAppointment(appointmentId);

    // No open invoice → create EXTRA invoice
    if (!invoice) {
      return this.createExtraInvoiceForAppointment({
        appointmentId,
        items,
        currency,
      });
    }

    // Open invoice exists → append
    return this.addItemsToInvoice(invoice._id.toString(), items);
  },

  async findOpenInvoiceForAppointment(appointmentId: string) {
    return InvoiceModel.findOne({
      appointmentId,
      status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
    }).sort({ createdAt: -1 });
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

      const targets = await resolveAuditTargetsForInvoice(invoice);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_CANCELLED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice._id.toString(),
          metadata: {
            status: invoice.status,
            reason,
          },
        });
      }
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

      const targets = await resolveAuditTargetsForInvoice(invoice);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_REFUNDED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice._id.toString(),
          metadata: {
            status: invoice.status,
            reason,
            refundId: refund.refundId,
            amount: refund.amountRefunded,
          },
        });
      }

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
