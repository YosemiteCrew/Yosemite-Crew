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
import { ParentModel } from "src/models/parent";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";
import { AuditTrailService } from "./audit-trail.service";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import { OrgBilling } from "src/models/organization.billing";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";
import {
  InvoiceStatus as PrismaInvoiceStatus,
  PaymentCollectionMethod,
  Prisma,
  type Invoice as PrismaInvoice,
} from "@prisma/client";

export class InvoiceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "InvoiceServiceError";
  }
}

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL_ADDRESS ?? "support@yosemitecrew.com";

const ensureObjectId = (val: unknown, field: string): Types.ObjectId => {
  if (val instanceof Types.ObjectId) return val;

  if (typeof val === "string" && Types.ObjectId.isValid(val)) {
    return new Types.ObjectId(val);
  }

  throw new InvoiceServiceError(`Invalid ${field}`, 400);
};

const getOrgBillingCurrency = async (
  organisationId?: string | Types.ObjectId,
) => {
  if (!organisationId) return "usd";
  if (isReadFromPostgres()) {
    const orgId =
      typeof organisationId === "string"
        ? organisationId
        : organisationId.toString();
    const billing = await prisma.organizationBilling.findUnique({
      where: { orgId },
      select: { currency: true },
    });
    return billing?.currency ?? "usd";
  }
  const billing = await OrgBilling.findOne({ orgId: organisationId });
  return billing?.currency ?? "usd";
};

const resolveAuditTargetsForInvoice = async (invoice: InvoiceDocument) => {
  if (invoice.organisationId && invoice.companionId) {
    return {
      organisationId: invoice.organisationId,
      companionId: invoice.companionId,
    };
  }

  if (invoice.appointmentId) {
    const appointment = await AppointmentModel.findById(invoice.appointmentId, {
      organisationId: 1,
      "companion.id": 1,
    }).lean();

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

const normalizeInvoiceMetadata = (
  value: Prisma.JsonValue | null | undefined,
): Record<string, string | number | boolean> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, string | number | boolean>
  >((acc, [key, raw]) => {
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      acc[key] = raw;
    }
    return acc;
  }, {});
};

const toDomainFromPrisma = (row: {
  id: string;
  parentId: string | null;
  companionId: string | null;
  organisationId: string | null;
  appointmentId: string | null;
  items: Prisma.JsonValue;
  subtotal: number;
  totalAmount: number;
  taxPercent: number;
  taxTotal: number;
  discountTotal: number;
  currency: string;
  paymentCollectionMethod: PaymentCollectionMethod;
  stripePaymentIntentId: string | null;
  stripePaymentLinkId: string | null;
  stripeInvoiceId: string | null;
  stripeCustomerId: string | null;
  stripeChargeId: string | null;
  stripeReceiptUrl: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCheckoutUrl: string | null;
  status: PrismaInvoiceStatus;
  metadata: Prisma.JsonValue | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Invoice => {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = (rawItems as InvoiceItem[]).map((item) => ({
    ...item,
    description: item.description ?? undefined,
  }));

  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    companionId: row.companionId ?? undefined,
    organisationId: row.organisationId ?? undefined,
    appointmentId: row.appointmentId ?? undefined,
    items,
    subtotal: row.subtotal,
    totalAmount: row.totalAmount,
    taxPercent: row.taxPercent,
    currency: row.currency as Currency,
    taxTotal: row.taxTotal,
    discountTotal: row.discountTotal,
    stripePaymentIntentId: row.stripePaymentIntentId ?? undefined,
    stripePaymentLinkId: row.stripePaymentLinkId ?? undefined,
    stripeInvoiceId: row.stripeInvoiceId ?? undefined,
    stripeCustomerId: row.stripeCustomerId ?? undefined,
    stripeChargeId: row.stripeChargeId ?? undefined,
    stripeReceiptUrl: row.stripeReceiptUrl ?? undefined,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? undefined,
    stripeCheckoutUrl: row.stripeCheckoutUrl ?? undefined,
    paymentCollectionMethod: row.paymentCollectionMethod,
    status: row.status as InvoiceStatus,
    metadata: normalizeInvoiceMetadata(row.metadata),
    paidAt: row.paidAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const resolveInvoiceTotals = (items: InvoiceItem[], taxPercent = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discountTotal = items.reduce(
    (sum, item) =>
      sum +
      (item.discountPercent
        ? (item.discountPercent / 100) * item.unitPrice * item.quantity
        : 0),
    0,
  );
  const normalizedTaxPercent = taxPercent ?? 0;
  const taxTotal = (normalizedTaxPercent / 100) * (subtotal - discountTotal);
  const totalAmount = subtotal - discountTotal + taxTotal;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    taxPercent: normalizedTaxPercent,
    totalAmount,
  };
};

const coerceMetadataRecord = (
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
};

const coerceAppointmentCompanionId = (appointment: {
  companion: Prisma.JsonValue | null;
}): string | undefined => {
  if (!appointment.companion || typeof appointment.companion !== "object") {
    return undefined;
  }
  const companion = appointment.companion as Record<string, unknown>;
  return typeof companion.id === "string" ? companion.id : undefined;
};

const coerceAppointmentParentId = (appointment: {
  companion: Prisma.JsonValue | null;
}): string | undefined => {
  if (!appointment.companion || typeof appointment.companion !== "object") {
    return undefined;
  }
  const companion = appointment.companion as Record<string, unknown>;
  if (!companion.parent || typeof companion.parent !== "object") {
    return undefined;
  }
  const parent = companion.parent as Record<string, unknown>;
  return typeof parent.id === "string" ? parent.id : undefined;
};

const resolveAuditTargetsForInvoiceRow = async (row: {
  organisationId: string | null;
  companionId: string | null;
  appointmentId: string | null;
}) => {
  if (row.organisationId && row.companionId) {
    return {
      organisationId: row.organisationId,
      companionId: row.companionId,
    };
  }

  if (row.appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: row.appointmentId },
      select: { organisationId: true, companion: true },
    });

    if (appointment?.organisationId) {
      const companionId = coerceAppointmentCompanionId(appointment);
      if (companionId) {
        return {
          organisationId: appointment.organisationId,
          companionId,
        };
      }
    }
  }

  return {
    organisationId: row.organisationId ?? undefined,
    companionId: row.companionId ?? undefined,
  };
};

const toPrismaInvoiceData = (doc: InvoiceDocument) => {
  const obj = doc.toObject() as InvoiceMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    parentId: obj.parentId?.toString() ?? undefined,
    companionId: obj.companionId?.toString() ?? undefined,
    organisationId: obj.organisationId?.toString() ?? undefined,
    appointmentId: obj.appointmentId?.toString() ?? undefined,
    items: obj.items as unknown as Prisma.InputJsonValue,
    subtotal: obj.subtotal,
    discountTotal: obj.discountTotal ?? 0,
    taxTotal: obj.taxTotal ?? 0,
    taxPercent: obj.taxPercent ?? 0,
    totalAmount: obj.totalAmount,
    currency: obj.currency,
    paymentCollectionMethod:
      obj.paymentCollectionMethod as PaymentCollectionMethod,
    stripePaymentIntentId: obj.stripePaymentIntentId ?? undefined,
    stripePaymentLinkId: obj.stripePaymentLinkId ?? undefined,
    stripeInvoiceId: obj.stripeInvoiceId ?? undefined,
    stripeCustomerId: obj.stripeCustomerId ?? undefined,
    stripeChargeId: obj.stripeChargeId ?? undefined,
    stripeReceiptUrl: obj.stripeReceiptUrl ?? undefined,
    stripeCheckoutSessionId: obj.stripeCheckoutSessionId ?? undefined,
    stripeCheckoutUrl: obj.stripeCheckoutUrl ?? undefined,
    status: obj.status as PrismaInvoiceStatus,
    metadata: (obj.metadata ?? undefined) as unknown as Prisma.InputJsonValue,
    paidAt: obj.paidAt ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncInvoiceToPostgres = async (doc: InvoiceDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaInvoiceData(doc);
    await prisma.invoice.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("Invoice", err);
  }
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
      items: {
        description: string;
        quantity: number;
        unitPrice: number;
        discountPercent?: number;
      }[];
      notes?: string;
      paymentCollectionMethod:
        | "PAYMENT_INTENT"
        | "PAYMENT_LINK"
        | "PAYMENT_AT_CLINIC";
    },
    session?: mongoose.ClientSession,
  ) {
    if (isReadFromPostgres()) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { id: true, organisationId: true, companion: true },
      });

      if (!appointment) {
        throw new InvoiceServiceError("Appointment not found", 404);
      }

      const itemsDetailed = input.items.map((item) => ({
        ...item,
        name: item.description,
        total: item.quantity * item.unitPrice,
      }));

      const totals = resolveInvoiceTotals(itemsDetailed, 0);
      const currency = await getOrgBillingCurrency(input.organisationId);
      const companionId = coerceAppointmentCompanionId(appointment);

      const createdInvoice = await prisma.invoice.create({
        data: {
          appointmentId: input.appointmentId,
          parentId: input.parentId,
          organisationId: input.organisationId,
          companionId: companionId ?? undefined,
          currency,
          status: "AWAITING_PAYMENT",
          paymentCollectionMethod: input.paymentCollectionMethod,
          items: itemsDetailed as unknown as Prisma.InputJsonValue,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxPercent: totals.taxPercent,
          totalAmount: totals.totalAmount,
        },
      });

      const auditTargets =
        await resolveAuditTargetsForInvoiceRow(createdInvoice);
      if (auditTargets.organisationId && auditTargets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: auditTargets.organisationId,
          companionId: auditTargets.companionId,
          eventType: "INVOICE_CREATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: createdInvoice.id,
          metadata: {
            appointmentId: input.appointmentId,
            status: createdInvoice.status,
            totalAmount: createdInvoice.totalAmount,
            currency: createdInvoice.currency,
          },
        });
      }

      const notificationPayload = NotificationTemplates.Payment.PAYMENT_PENDING(
        createdInvoice.totalAmount,
        createdInvoice.currency,
      );
      await NotificationService.sendToUser(input.parentId, notificationPayload);

      return createdInvoice;
    }

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
    const currency = await getOrgBillingCurrency(input.organisationId);

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
          currency,

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
    await syncInvoiceToPostgres(createdInvoice);

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
      currency,
    );
    await NotificationService.sendToUser(input.parentId, notificationPayload);

    return createdInvoice;
  },

  async createExtraInvoiceForAppointment(input: {
    appointmentId: string;
    items: InvoiceItem[];
    metadata?: Record<string, string | number | boolean | undefined>;
  }) {
    if (isReadFromPostgres()) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { id: true, organisationId: true, companion: true },
      });
      if (!appointment) {
        throw new InvoiceServiceError("Appointment not found", 404);
      }

      const currency = await getOrgBillingCurrency(appointment.organisationId);
      const itemsDetailed = input.items.map((item) => ({
        ...item,
        name: item.description ?? item.name,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      }));

      const totals = resolveInvoiceTotals(itemsDetailed, 0);
      const companionId = coerceAppointmentCompanionId(appointment);
      const parentId = coerceAppointmentParentId(appointment);

      const invoice = await prisma.invoice.create({
        data: {
          appointmentId: appointment.id,
          parentId: parentId ?? undefined,
          companionId: companionId ?? undefined,
          organisationId: appointment.organisationId,
          currency,
          status: "AWAITING_PAYMENT",
          items: itemsDetailed as unknown as Prisma.InputJsonValue,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxPercent: totals.taxPercent,
          totalAmount: totals.totalAmount,
          metadata: {
            ...input.metadata,
            source: "EXTRA_CHARGES",
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const auditTargets = await resolveAuditTargetsForInvoiceRow(invoice);
      if (auditTargets.organisationId && auditTargets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: auditTargets.organisationId,
          companionId: auditTargets.companionId,
          eventType: "INVOICE_CREATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            appointmentId: appointment.id,
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
        });
      }

      if (parentId) {
        await NotificationService.sendToUser(
          parentId,
          NotificationTemplates.Payment.PAYMENT_PENDING(
            invoice.totalAmount,
            invoice.currency,
          ),
        );
      }

      return toDomainFromPrisma(invoice);
    }

    const appointment = await AppointmentModel.findById(input.appointmentId);
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const currency = await getOrgBillingCurrency(appointment.organisationId);
    const invoice = new InvoiceModel({
      appointmentId: appointment._id,
      parentId: appointment.companion.parent.id,
      companionId: appointment.companion.id,
      organisationId: appointment.organisationId,
      currency,

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
    await syncInvoiceToPostgres(invoice);

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
    if (isReadFromPostgres()) {
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          stripePaymentIntentId: updates.stripePaymentIntentId ?? undefined,
          stripePaymentLinkId: updates.stripePaymentLinkId ?? undefined,
          stripeInvoiceId: updates.stripeInvoiceId ?? undefined,
          stripeCustomerId: updates.stripeCustomerId ?? undefined,
          stripeChargeId: updates.stripeChargeId ?? undefined,
          stripeReceiptUrl: updates.stripeReceiptUrl ?? undefined,
          stripeCheckoutSessionId: updates.stripeCheckoutSessionId ?? undefined,
          stripeCheckoutUrl: updates.stripeCheckoutUrl ?? undefined,
          status: updates.status as PrismaInvoiceStatus | undefined,
          paymentCollectionMethod: updates.paymentCollectionMethod as
            | PaymentCollectionMethod
            | undefined,
          paidAt: updates.paidAt ?? undefined,
          metadata: updates.metadata as unknown as Prisma.InputJsonValue,
        },
      });

      return toDomainFromPrisma(updated);
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: updates },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    await syncInvoiceToPostgres(doc);

    await syncInvoiceToPostgres(doc);

    return toDomain(doc);
  },

  async markInvoicePaid(params: {
    invoiceId: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    stripeReceiptUrl?: string;
  }) {
    if (isReadFromPostgres()) {
      const existing = await prisma.invoice.findUnique({
        where: { id: params.invoiceId },
      });
      if (!existing) {
        return null;
      }
      if (existing.status === "PAID") {
        return null;
      }
      const invoice = await prisma.invoice.update({
        where: { id: params.invoiceId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          stripePaymentIntentId: params.stripePaymentIntentId ?? undefined,
          stripeChargeId: params.stripeChargeId ?? undefined,
          stripeReceiptUrl: params.stripeReceiptUrl ?? undefined,
        },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(invoice);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_PAID",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
        });
      }

      return invoice;
    }

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
      await syncInvoiceToPostgres(invoice);
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

  async markInvoicePaidManually(invoiceId: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!doc) {
        throw new InvoiceServiceError("Invoice not found.", 404);
      }

      if (doc.paymentCollectionMethod !== "PAYMENT_AT_CLINIC") {
        throw new InvoiceServiceError(
          "Invoice is not marked for in-clinic payment.",
          409,
        );
      }

      if (["CANCELLED", "REFUNDED"].includes(doc.status)) {
        throw new InvoiceServiceError("Invoice cannot be marked paid.", 409);
      }

      const updated = await this.markInvoicePaid({
        invoiceId: doc.id,
      });

      return updated
        ? toInvoiceResponseDTO(
            toDomainFromPrisma(updated as unknown as PrismaInvoice),
          )
        : null;
    }

    const doc = await InvoiceModel.findById(invoiceId);
    if (!doc) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (doc.paymentCollectionMethod !== "PAYMENT_AT_CLINIC") {
      throw new InvoiceServiceError(
        "Invoice is not marked for in-clinic payment.",
        409,
      );
    }

    if (["CANCELLED", "REFUNDED"].includes(doc.status)) {
      throw new InvoiceServiceError("Invoice cannot be marked paid.", 409);
    }

    const updated = await this.markInvoicePaid({
      invoiceId: doc._id.toString(),
    });

    return updated
      ? toInvoiceResponseDTO(toDomain(updated as InvoiceDocument))
      : null;
  },

  async markFailed(invoiceId: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "FAILED" },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(doc);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_FAILED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: doc.id,
          metadata: {
            status: doc.status,
            totalAmount: doc.totalAmount,
            currency: doc.currency,
          },
        });
      }

      return doc;
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const doc = await InvoiceModel.findByIdAndUpdate(
      _id,
      { $set: { status: "FAILED" } },
      { new: true },
    );

    if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

    await syncInvoiceToPostgres(doc);

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
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "REFUNDED" },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(doc);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_REFUNDED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: doc.id,
          metadata: {
            status: doc.status,
            totalAmount: doc.totalAmount,
            currency: doc.currency,
          },
        });
      }

      return toDomainFromPrisma(doc);
    }

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
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: status as PrismaInvoiceStatus },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(invoice);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_UPDATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            status: invoice.status,
          },
        });
      }

      return invoice;
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

    invoice.status = status;
    await invoice.save();
    await syncInvoiceToPostgres(invoice);

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
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { appointmentId: appId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      appointmentId: appId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async getById(id: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findUnique({ where: { id } });
      if (!doc) throw new InvoiceServiceError("Invoice not found.", 404);

      const org = doc.organisationId
        ? await prisma.organization.findUnique({
            where: { id: doc.organisationId },
            include: { address: true },
          })
        : null;

      return {
        organistion: {
          name: org?.name ?? "",
          placesId: org?.googlePlacesId ?? "",
          address: org?.address ?? "",
          image: org?.imageUrl ?? "",
        },
        invoice: toInvoiceResponseDTO(toDomainFromPrisma(doc)),
      };
    }

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
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { organisationId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      organisationId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async listForParent(parentId: string) {
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { parentId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      parentId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async listForCompanion(companionId: string) {
    if (isReadFromPostgres()) {
      const docs = await prisma.invoice.findMany({
        where: { companionId },
        orderBy: { createdAt: "desc" },
      });
      return docs.map((d) => toInvoiceResponseDTO(toDomainFromPrisma(d)));
    }

    const docs = await InvoiceModel.find({
      companionId,
    }).sort({ createdAt: -1 });

    return docs.map((d) => toInvoiceResponseDTO(toDomain(d)));
  },

  async addItemsToInvoice(invoiceId: string, items: InvoiceItem[]) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) throw new InvoiceServiceError("Invoice not found", 404);

      if (invoice.status === "PAID") {
        throw new InvoiceServiceError("Cannot modify a paid invoice", 409);
      }

      const existingItems = Array.isArray(invoice.items)
        ? (invoice.items as InvoiceItem[])
        : [];
      const newItems = items.map((item) => ({
        ...item,
        total:
          item.unitPrice * item.quantity -
          (item.discountPercent
            ? (item.discountPercent / 100) * item.unitPrice * item.quantity
            : 0),
      }));
      const mergedItems = [...existingItems, ...newItems];
      const totals = resolveInvoiceTotals(mergedItems, invoice.taxPercent);

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          items: mergedItems as unknown as Prisma.InputJsonValue,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxPercent: totals.taxPercent,
          totalAmount: totals.totalAmount,
          stripeCheckoutSessionId:
            invoice.paymentCollectionMethod === "PAYMENT_LINK" &&
            invoice.stripeCheckoutSessionId
              ? null
              : invoice.stripeCheckoutSessionId,
          stripeCheckoutUrl:
            invoice.paymentCollectionMethod === "PAYMENT_LINK" &&
            invoice.stripeCheckoutSessionId
              ? null
              : invoice.stripeCheckoutUrl,
        },
      });

      const targets = await resolveAuditTargetsForInvoiceRow(updated);
      if (targets.organisationId && targets.companionId) {
        await AuditTrailService.recordSafely({
          organisationId: targets.organisationId,
          companionId: targets.companionId,
          eventType: "INVOICE_UPDATED",
          actorType: "SYSTEM",
          entityType: "INVOICE",
          entityId: updated.id,
          metadata: {
            status: updated.status,
            totalAmount: updated.totalAmount,
            currency: updated.currency,
            itemsAdded: items.length,
          },
        });
      }

      return toDomainFromPrisma(updated);
    }

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

    // If a Checkout Session already exists, its amount cannot be updated.
    // Clear it so the next checkout uses fresh totals.
    if (
      invoice.paymentCollectionMethod === "PAYMENT_LINK" &&
      invoice.stripeCheckoutSessionId
    ) {
      invoice.stripeCheckoutSessionId = undefined;
      invoice.stripeCheckoutUrl = null;
    }

    await invoice.save();
    await syncInvoiceToPostgres(invoice);

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

  async addChargesToAppointment(appointmentId: string, items: InvoiceItem[]) {
    if (isReadFromPostgres()) {
      const invoice = await this.findOpenInvoiceForAppointment(appointmentId);
      if (!invoice) {
        return this.createExtraInvoiceForAppointment({
          appointmentId,
          items,
        });
      }
      const invoiceId =
        typeof (invoice as { id?: string }).id === "string"
          ? (invoice as { id: string }).id
          : undefined;
      if (!invoiceId) {
        throw new InvoiceServiceError("Invoice not found.", 404);
      }
      return this.addItemsToInvoice(invoiceId, items);
    }

    const invoice = await this.findOpenInvoiceForAppointment(appointmentId);

    // No open invoice → create EXTRA invoice
    if (!invoice) {
      return this.createExtraInvoiceForAppointment({
        appointmentId,
        items,
      });
    }

    // Open invoice exists → append
    return this.addItemsToInvoice(
      (invoice as { _id: { toString(): string } })._id.toString(),
      items,
    );
  },

  async findOpenInvoiceForAppointment(appointmentId: string) {
    if (isReadFromPostgres()) {
      return prisma.invoice.findFirst({
        where: {
          appointmentId,
          status: { in: ["AWAITING_PAYMENT", "PENDING"] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return InvoiceModel.findOne({
      appointmentId,
      status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
    }).sort({ createdAt: -1 });
  },

  async handleAppointmentCancellation(appointmentId: string, reason: string) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findFirst({
        where: { appointmentId },
      });

      if (!invoice) {
        return { action: "NO_INVOICE" };
      }

      if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
        return { action: "ALREADY_HANDLED", status: invoice.status };
      }

      if (
        invoice.status === "AWAITING_PAYMENT" ||
        invoice.status === "PENDING"
      ) {
        const metadata = {
          ...coerceMetadataRecord(invoice.metadata),
          cancellationReason: reason,
        };
        const updated = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "CANCELLED",
            metadata: metadata as unknown as Prisma.InputJsonValue,
          },
        });

        const targets = await resolveAuditTargetsForInvoiceRow(updated);
        if (targets.organisationId && targets.companionId) {
          await AuditTrailService.recordSafely({
            organisationId: targets.organisationId,
            companionId: targets.companionId,
            eventType: "INVOICE_CANCELLED",
            actorType: "SYSTEM",
            entityType: "INVOICE",
            entityId: updated.id,
            metadata: {
              status: updated.status,
              reason,
            },
          });
        }
        return { action: "CANCELLED_UNPAID" };
      }

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

        const metadata = {
          ...coerceMetadataRecord(invoice.metadata),
          cancellationReason: reason,
          refundId: refund.refundId,
          amount: refund.amountRefunded,
          refundDate: new Date().toISOString(),
        };

        const updated = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "REFUNDED",
            metadata: metadata as unknown as Prisma.InputJsonValue,
          },
        });

        const targets = await resolveAuditTargetsForInvoiceRow(updated);
        if (targets.organisationId && targets.companionId) {
          await AuditTrailService.recordSafely({
            organisationId: targets.organisationId,
            companionId: targets.companionId,
            eventType: "INVOICE_REFUNDED",
            actorType: "SYSTEM",
            entityType: "INVOICE",
            entityId: updated.id,
            metadata: {
              status: updated.status,
              reason,
              refundId: refund.refundId,
              amount: refund.amountRefunded,
            },
          });
        }

        return { action: "REFUNDED", refundId: refund.refundId };
      }

      return { action: "NO_ACTION", status: invoice.status };
    }

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
      await syncInvoiceToPostgres(invoice);

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
      await syncInvoiceToPostgres(invoice);

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

  async handleInvoiceCancellation(invoiceId: string, reason: string) {
    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) {
        throw new InvoiceServiceError("Invoice not found", 404);
      }

      if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
        return { action: "ALREADY_HANDLED", status: invoice.status };
      }

      if (
        invoice.status === "AWAITING_PAYMENT" ||
        invoice.status === "PENDING"
      ) {
        const metadata = {
          ...coerceMetadataRecord(invoice.metadata),
          cancellationReason: reason,
        };
        const updated = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "CANCELLED",
            metadata: metadata as unknown as Prisma.InputJsonValue,
          },
        });

        const targets = await resolveAuditTargetsForInvoiceRow(updated);
        if (targets.organisationId && targets.companionId) {
          await AuditTrailService.recordSafely({
            organisationId: targets.organisationId,
            companionId: targets.companionId,
            eventType: "INVOICE_CANCELLED",
            actorType: "SYSTEM",
            entityType: "INVOICE",
            entityId: updated.id,
            metadata: {
              status: updated.status,
              reason,
            },
          });
        }

        return { action: "CANCELLED_UNPAID", status: updated.status };
      }

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

        const metadata = {
          ...coerceMetadataRecord(invoice.metadata),
          cancellationReason: reason,
          refundId: refund.refundId,
          amount: refund.amountRefunded,
          refundDate: new Date().toISOString(),
        };

        const updated = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "REFUNDED",
            metadata: metadata as unknown as Prisma.InputJsonValue,
          },
        });

        const targets = await resolveAuditTargetsForInvoiceRow(updated);
        if (targets.organisationId && targets.companionId) {
          await AuditTrailService.recordSafely({
            organisationId: targets.organisationId,
            companionId: targets.companionId,
            eventType: "INVOICE_REFUNDED",
            actorType: "SYSTEM",
            entityType: "INVOICE",
            entityId: updated.id,
            metadata: {
              status: updated.status,
              refundId: refund.refundId,
              amount: refund.amountRefunded,
              currency: updated.currency,
            },
          });
        }

        return { action: "REFUNDED", status: updated.status };
      }

      return { action: "NO_ACTION", status: invoice.status };
    }

    const _id = ensureObjectId(invoiceId, "invoiceId");

    const invoice = await InvoiceModel.findById(_id);
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    if (invoice.status === "AWAITING_PAYMENT" || invoice.status === "PENDING") {
      invoice.status = "CANCELLED";
      invoice.metadata = {
        ...invoice.metadata,
        cancellationReason: reason,
      };
      await invoice.save();
      await syncInvoiceToPostgres(invoice);

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

      return { action: "CANCELLED_UNPAID", status: invoice.status };
    }

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

      invoice.status = "REFUNDED";
      invoice.metadata = {
        ...invoice.metadata,
        cancellationReason: reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
        refundDate: new Date().toISOString(),
      };

      await invoice.save();
      await syncInvoiceToPostgres(invoice);

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
            refundId: refund.refundId,
            amount: refund.amountRefunded,
            currency: invoice.currency,
          },
        });
      }

      return { action: "REFUNDED", status: invoice.status };
    }

    return { action: "NO_ACTION", status: invoice.status };
  },

  async getByPaymentIntentId(paymentIntentId: string) {
    if (isReadFromPostgres()) {
      const doc = await prisma.invoice.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      if (!doc) {
        return null;
      }
      return toInvoiceResponseDTO(toDomainFromPrisma(doc));
    }

    const doc = await InvoiceModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });

    if (!doc) {
      return null;
    }

    return toInvoiceResponseDTO(toDomain(doc));
  },

  async createCheckoutSessionAndEmailParent(invoiceId: string) {
    const checkout =
      await StripeService.createCheckoutSessionForInvoice(invoiceId);

    const invoice = isReadFromPostgres()
      ? await prisma.invoice.findUnique({ where: { id: invoiceId } })
      : await InvoiceModel.findById(invoiceId).lean();
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    let emailSent = false;
    if (checkout?.url && invoice.parentId) {
      const parent = isReadFromPostgres()
        ? await prisma.parent.findUnique({
            where: { id: invoice.parentId },
            select: { email: true, firstName: true, lastName: true },
          })
        : await ParentModel.findById(invoice.parentId)
            .select("email firstName lastName")
            .lean();
      const organisation = invoice.organisationId
        ? isReadFromPostgres()
          ? await prisma.organization.findUnique({
              where: { id: invoice.organisationId },
              select: { name: true },
            })
          : await OrganizationModel.findById(invoice.organisationId)
              .select("name")
              .lean()
        : null;
      const parentName = parent
        ? [parent.firstName, parent.lastName].filter(Boolean).join(" ")
        : undefined;
      const amountText =
        typeof invoice.totalAmount === "number" && invoice.currency
          ? `${invoice.currency.toUpperCase()} ${invoice.totalAmount.toFixed(2)}`
          : undefined;

      if (parent?.email) {
        try {
          await sendEmailTemplate({
            to: parent.email,
            templateId: "invoicePaymentCheckout",
            templateData: {
              parentName,
              organisationName: organisation?.name ?? undefined,
              invoiceId: isReadFromPostgres()
                ? (invoice as { id: string }).id
                : (invoice as { _id: Types.ObjectId })._id.toString(),
              amountText,
              checkoutUrl: checkout.url,
              ctaUrl: checkout.url,
              ctaLabel: "Pay Invoice",
              supportEmail: SUPPORT_EMAIL_ADDRESS,
            },
          });
          emailSent = true;
        } catch (error) {
          logger.error("Failed to send invoice checkout email.", error);
        }
      }
    }

    return { checkout, emailSent };
  },
};
