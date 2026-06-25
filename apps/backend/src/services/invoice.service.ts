import {
  Prisma,
  Invoice as PrismaInvoice,
  Payment as PrismaPayment,
  BillingCollectionMode as PrismaBillingCollectionMode,
  InvoiceStatus as PrismaInvoiceStatus,
  PaymentCollectionMethod,
  TaxBehavior as PrismaTaxBehavior,
} from "@prisma/client";
import {
  CreditNote as FinanceCreditNote,
  Invoice,
  InvoiceItem,
} from "@yosemite-crew/types";
import {
  calculateInvoicePricing,
  roundMoney,
  type InvoiceDiscountInput as PricingInvoiceDiscountInput,
} from "./finance/pricing";
import {
  DEFAULT_TAX_BEHAVIOR,
  getInvoiceTaxProviderAdapter,
} from "./finance/tax";
import {
  FinancePaymentService,
  getInvoiceFinancialSummary,
} from "./finance/payment";
import { FinanceEventService } from "./finance/events";
import { createRenderedDocumentRecord } from "./rendered-document.service";
import { prisma } from "src/config/prisma";
import { CatalogService, CatalogServiceError } from "./catalog.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";
import { AuditTrailService } from "./audit-trail.service";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import type { AuditEventType } from "src/models/audit-trail";
import { resolvePaymentCollectionMethod } from "src/utils/payment";
import { getOrgBillingCurrency } from "src/utils/billing";
import { assertSafeString } from "src/utils/sanitize";
import type Stripe from "stripe";

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

type InvoiceVisitBillingStage = "DRAFT" | "READY_FOR_BILLING" | "SETTLED";

type AppointmentLink = {
  patientId?: string;
  parentId?: string;
};

type InvoiceMetadata = Record<string, string | number | boolean>;

type CreditNoteMetadata = Record<string, string | number | boolean>;

type PrismaCreditNote = {
  id: string;
  invoiceId: string;
  creditNoteNumber: string;
  reason: string | null;
  amount: number;
  status: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceWithCreditNotes = PrismaInvoice & {
  creditNotes?: PrismaCreditNote[];
};

type PrismaPaymentRefund = {
  id: string;
  paymentId: string;
  provider: string;
  providerRefundId: string | null;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  rawProviderPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaPaymentWithRefunds = PrismaPayment & {
  refunds?: PrismaPaymentRefund[];
};

const invoiceCreditNotesInclude = {
  creditNotes: {
    orderBy: { createdAt: "desc" as const },
  },
};

type DraftInvoiceItemInput = {
  id?: string;
  name?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  total?: number;
};

type CreateInvoiceInput = {
  appointmentId: string;
  parentId: string;
  organisationId: string;
  patientId: string;
  items: DraftInvoiceItemInput[];
  notes?: string;
  invoiceDiscount?: PricingInvoiceDiscountInput;
  paymentCollectionMethod:
    | "PAYMENT_INTENT"
    | "PAYMENT_LINK"
    | "PAYMENT_AT_CLINIC";
};

type IssueCreditNoteInput = {
  amount: number;
  reason?: string;
  metadata?: CreditNoteMetadata;
};

const resolveBillingCollectionMode = (
  paymentCollectionMethod: CreateInvoiceInput["paymentCollectionMethod"],
): PrismaBillingCollectionMode =>
  paymentCollectionMethod === "PAYMENT_AT_CLINIC"
    ? "PAY_AT_VISIT_END"
    : "PREPAY_AT_BOOKING";

const resolveInvoiceDepositTargetAmount = (depositTargetAmount: number) => {
  if (depositTargetAmount < 0) {
    throw new InvoiceServiceError(
      "Deposit target amount must be greater than or equal to zero",
      400,
    );
  }

  return roundMoney(depositTargetAmount);
};

const resolveInvoiceDepositCollectedAmount = (
  invoice: Pick<PrismaInvoice, "depositCollectedAmount">,
  depositTargetAmount: number,
) =>
  roundMoney(
    Math.min(invoice.depositCollectedAmount ?? 0, depositTargetAmount),
  );

const findInvoiceByIdOrThrow = async (invoiceId: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new InvoiceServiceError("Invoice not found", 404);
  }

  return invoice;
};

const normalizeInvoiceMetadata = (
  value: Prisma.JsonValue | null | undefined,
): InvoiceMetadata | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(
    value as Record<string, unknown>,
  ).reduce<InvoiceMetadata>((acc, [key, raw]) => {
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

const normalizeCreditNoteMetadata = (
  value: Prisma.JsonValue | null | undefined,
): CreditNoteMetadata | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(
    value as Record<string, unknown>,
  ).reduce<CreditNoteMetadata>((acc, [key, raw]) => {
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

const toCreditNoteRecord = (row: PrismaCreditNote): FinanceCreditNote => ({
  id: row.id,
  invoiceId: row.invoiceId,
  creditNoteNumber: row.creditNoteNumber,
  reason: row.reason ?? undefined,
  amount: row.amount,
  status: row.status as FinanceCreditNote["status"],
  metadata: normalizeCreditNoteMetadata(row.metadata),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPaymentRefundRecord = (row: PrismaPaymentRefund) => ({
  id: row.id,
  paymentId: row.paymentId,
  provider: row.provider,
  providerRefundId: row.providerRefundId ?? undefined,
  amount: row.amount,
  currency: row.currency,
  status: row.status,
  reason: row.reason ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPaymentRecord = (row: PrismaPaymentWithRefunds) => ({
  id: row.id,
  invoiceId: row.invoiceId,
  paymentAttemptId: row.paymentAttemptId ?? undefined,
  provider: row.provider,
  settlementChannel: row.settlementChannel ?? undefined,
  collectionMode: row.collectionMode ?? undefined,
  providerPaymentId: row.providerPaymentId ?? undefined,
  amount: row.amount,
  currency: row.currency,
  status: row.status,
  paidAt: row.paidAt ?? undefined,
  receiptUrl: row.receiptUrl ?? undefined,
  refunds: Array.isArray(row.refunds)
    ? row.refunds.map((refund) => toPaymentRefundRecord(refund))
    : undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toInvoiceRecord = (row: InvoiceWithCreditNotes): Invoice => {
  const items = Array.isArray(row.items)
    ? (row.items as InvoiceItem[]).map((item) => ({
        ...item,
        description: item.description ?? undefined,
      }))
    : [];
  const creditNotes = Array.isArray(row.creditNotes)
    ? row.creditNotes.map((creditNote) => toCreditNoteRecord(creditNote))
    : undefined;

  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    patientId: row.patientId ?? undefined,
    organisationId: row.organisationId ?? undefined,
    appointmentId: row.appointmentId ?? undefined,
    items,
    subtotal: row.subtotal,
    totalAmount: row.totalAmount,
    taxPercent: row.taxPercent,
    currency: row.currency,
    taxTotal: row.taxTotal,
    discountTotal: row.discountTotal,
    billingCollectionMode: row.billingCollectionMode ?? undefined,
    visitBillingStage: row.visitBillingStage as InvoiceVisitBillingStage,
    readyForBillingAt: row.readyForBillingAt ?? undefined,
    readyForBillingActorId: row.readyForBillingActorId ?? undefined,
    depositTargetAmount: row.depositTargetAmount,
    depositCollectedAmount: row.depositCollectedAmount,
    paymentCollectionMethod: row.paymentCollectionMethod,
    status: row.status as Invoice["status"],
    creditNotes,
    metadata: normalizeInvoiceMetadata(row.metadata),
    paidAt: row.paidAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const buildInvoiceLineSnapshots = (items: DraftInvoiceItemInput[]) =>
  items.map((item) => {
    const total =
      item.total ??
      item.quantity * item.unitPrice -
        (item.discountPercent
          ? (item.discountPercent / 100) * item.unitPrice * item.quantity
          : 0);

    return {
      ...(item.id ? { id: item.id } : {}),
      name: item.name ?? item.description,
      description: item.description ?? item.name ?? undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      total,
    };
  });

const normalizeInvoiceLineItem = (
  item: InvoiceItem,
): DraftInvoiceItemInput => ({
  id: item.id,
  name: item.name,
  description: item.description ?? item.name,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  discountPercent: item.discountPercent ?? undefined,
  total: item.total,
});

const invoiceLineContentKey = (item: DraftInvoiceItemInput) =>
  [
    (item.description ?? item.name ?? "").trim().toLowerCase(),
    item.quantity,
    item.unitPrice,
    item.discountPercent ?? "",
  ].join("|");

const mergeInvoiceLineItems = (
  existingItems: DraftInvoiceItemInput[],
  newItems: DraftInvoiceItemInput[],
) => {
  const merged = [...existingItems];

  for (const item of newItems) {
    const lineId = item.id?.trim();
    let index = -1;
    if (lineId) {
      index = merged.findIndex((existing) => existing.id?.trim() === lineId);
    }
    if (index === -1) {
      const contentKey = invoiceLineContentKey(item);
      index = merged.findIndex(
        (existing) => invoiceLineContentKey(existing) === contentKey,
      );
    }

    if (index === -1) {
      merged.push(item);
    } else {
      merged[index] = item;
    }
  }

  return merged;
};

const loadInvoiceFinancialDetails = async (invoiceId: string) => {
  const payments = (await prisma.payment.findMany({
    where: { invoiceId },
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    include: {
      refunds: {
        orderBy: { createdAt: "desc" },
      },
    },
  })) as PrismaPaymentWithRefunds[];

  const receipts = payments
    .filter((payment) => Boolean(payment.receiptUrl))
    .map((payment) => ({
      id: payment.id,
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      provider: payment.provider,
      settlementChannel: payment.settlementChannel ?? undefined,
      amount: payment.amount,
      currency: payment.currency,
      receiptUrl: payment.receiptUrl ?? undefined,
      paidAt: payment.paidAt ?? undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));

  return {
    payments: payments.map((payment) => toPaymentRecord(payment)),
    receipts,
  };
};

const toTaxLineItems = (items: DraftInvoiceItemInput[]) =>
  items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent: item.discountPercent,
  }));

const resolveInvoiceTotals = async (
  items: DraftInvoiceItemInput[],
  taxPercent = 0,
  invoiceDiscount?: PricingInvoiceDiscountInput,
  taxBehavior: PrismaTaxBehavior = DEFAULT_TAX_BEHAVIOR,
  currency = "usd",
  provider?: string | null,
  mode: "preview" | "finalize" = "preview",
  taxContext?: {
    customerAddress?: Stripe.AddressParam | null;
    liabilityAccountId?: string | null;
  },
  options?: { skipTaxCalculation?: boolean },
) => {
  const pricing = calculateInvoicePricing({
    lines: items.map((item) => ({
      quantity: item.quantity,
      unitAmount: item.unitPrice,
      discountType: item.discountPercent == null ? undefined : "PERCENTAGE",
      discountValue: item.discountPercent ?? undefined,
      taxBehavior,
    })),
    taxRatePercent: taxPercent,
    invoiceDiscount,
  });

  if (options?.skipTaxCalculation) {
    return {
      subtotal: pricing.subtotal,
      discountTotal: pricing.lineDiscountTotal,
      invoiceDiscountTotal: pricing.invoiceDiscountTotal,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: roundMoney(
        pricing.subtotal -
          pricing.lineDiscountTotal -
          pricing.invoiceDiscountTotal,
      ),
      taxSnapshot: null,
    };
  }

  const adapter = getInvoiceTaxProviderAdapter(provider);
  const taxSnapshot =
    mode === "finalize"
      ? await adapter.finalize({
          provider: adapter.provider,
          taxBehavior,
          taxRatePercent: taxPercent,
          currency,
          invoiceDiscount,
          pricing,
          lineItems: toTaxLineItems(items),
          customerAddress: taxContext?.customerAddress ?? null,
          liabilityAccountId: taxContext?.liabilityAccountId ?? null,
        })
      : await adapter.preview({
          provider: adapter.provider,
          taxBehavior,
          taxRatePercent: taxPercent,
          currency,
          invoiceDiscount,
          pricing,
          lineItems: toTaxLineItems(items),
          customerAddress: taxContext?.customerAddress ?? null,
          liabilityAccountId: taxContext?.liabilityAccountId ?? null,
        });

  return {
    subtotal: pricing.subtotal,
    discountTotal: pricing.lineDiscountTotal,
    invoiceDiscountTotal: pricing.invoiceDiscountTotal,
    taxTotal: taxSnapshot.taxAmount,
    taxPercent:
      taxSnapshot.taxableSubtotal > 0
        ? roundMoney(
            (taxSnapshot.taxAmount / taxSnapshot.taxableSubtotal) * 100,
          )
        : (taxPercent ?? 0),
    totalAmount: roundMoney(
      pricing.totalAmount - pricing.taxTotal + taxSnapshot.taxAmount,
    ),
    taxSnapshot,
  };
};

const getAppointmentLinks = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}): AppointmentLink => {
  const value = appointment.patient ?? appointment.companion ?? null;
  if (!value || typeof value !== "object") {
    return {};
  }

  const companion = value as Record<string, unknown>;
  const patientId = typeof companion.id === "string" ? companion.id : undefined;
  const parent = companion.parent as Record<string, unknown> | undefined;
  const parentId =
    parent && typeof parent.id === "string" ? parent.id : undefined;
  return { patientId, parentId };
};

const getAppointmentPatientIdOrThrow = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) => {
  const { patientId } = getAppointmentLinks(appointment);
  if (!patientId) {
    throw new InvoiceServiceError("Appointment patient links are missing", 500);
  }
  return patientId;
};

const getAppointmentParentIdOrThrow = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) => {
  const { parentId } = getAppointmentLinks(appointment);
  if (!parentId) {
    throw new InvoiceServiceError(
      "Appointment missing parent or patient links",
      500,
    );
  }
  return parentId;
};

const assertAppointmentInOrganisation = async (
  appointmentId: string,
  organisationId: string,
) => {
  assertSafeString(organisationId, "organisationId");
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organisationId },
    select: { id: true },
  });

  if (!appointment) {
    throw new InvoiceServiceError(
      "Appointment not found for organisation",
      404,
    );
  }
};

const resolveAuditTargetsForInvoiceRow = async (row: {
  organisationId: string | null;
  patientId: string | null;
  appointmentId: string | null;
}) => {
  if (row.organisationId && row.patientId) {
    return { organisationId: row.organisationId, patientId: row.patientId };
  }

  if (row.appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: row.appointmentId },
      select: { organisationId: true, patient: true },
    });
    if (appointment?.organisationId) {
      const { patientId } = getAppointmentLinks(appointment);
      if (patientId) {
        return {
          organisationId: appointment.organisationId,
          patientId,
        };
      }
    }
  }

  return {
    organisationId: row.organisationId ?? undefined,
    patientId: row.patientId ?? undefined,
  };
};

const buildReadyForBillingFields = (actorUserId?: string | null) => ({
  readyForBillingAt: new Date(),
  readyForBillingActorId: actorUserId?.trim() || "SYSTEM",
});

const recordInvoiceAuditEvent = async (
  targets: { organisationId?: string | null; patientId?: string | null },
  payload: {
    eventType: AuditEventType;
    entityId: string;
    metadata: Record<string, unknown>;
  },
) => {
  if (!targets.organisationId || !targets.patientId) {
    return;
  }

  await AuditTrailService.recordSafely({
    organisationId: targets.organisationId,
    patientId: targets.patientId,
    eventType: payload.eventType,
    actorType: "SYSTEM",
    entityType: "INVOICE",
    entityId: payload.entityId,
    metadata: payload.metadata,
  });
};

const recordInvoiceAuditForRow = async (
  row: {
    organisationId: string | null;
    patientId: string | null;
    appointmentId: string | null;
  },
  eventType: AuditEventType,
  entityId: string,
  metadata: Record<string, unknown>,
) => {
  const targets = await resolveAuditTargetsForInvoiceRow(row);
  await recordInvoiceAuditEvent(targets, { eventType, entityId, metadata });
};

const mapCatalogSelectionToDraftItems = (selection: {
  productKind: string;
  name: string;
  billingItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    defaultDiscountPercent?: number | null;
  }>;
  finalAmount: number;
}): DraftInvoiceItemInput[] =>
  selection.productKind === "PACKAGE"
    ? [
        {
          description: selection.name,
          quantity: 1,
          unitPrice: selection.finalAmount,
        },
      ]
    : selection.billingItems.map((item) => ({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.defaultDiscountPercent ?? undefined,
      }));

const resolveCatalogSelectionSafe = async (
  selectionId: string,
  organisationId: string,
) => {
  try {
    return await CatalogService.resolveSelection(selectionId, organisationId);
  } catch (error) {
    if (error instanceof CatalogServiceError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

const buildBootstrapInvoiceItems = async (params: {
  appointment: {
    appointmentType: Prisma.JsonValue | null;
    organisationId: string;
  };
  serviceId?: string;
  productItemId?: string | null;
}) => {
  const { appointment, serviceId, productItemId } = params;

  const catalogSelection = productItemId
    ? await resolveCatalogSelectionSafe(
        productItemId,
        appointment.organisationId,
      )
    : null;

  if (catalogSelection) {
    return mapCatalogSelectionToDraftItems(catalogSelection);
  }

  const service = serviceId
    ? await prisma.service.findUnique({ where: { id: serviceId } })
    : null;
  if (!service) {
    throw new InvoiceServiceError("Service not found", 404);
  }

  const description =
    typeof appointment.appointmentType === "object" &&
    appointment.appointmentType &&
    typeof (appointment.appointmentType as Record<string, unknown>).name ===
      "string"
      ? ((appointment.appointmentType as Record<string, unknown>).name as
          | string
          | undefined)
      : undefined;

  return [
    {
      description: description ?? service.name ?? "Consultation",
      quantity: 1,
      unitPrice: service.cost,
      discountPercent: service.maxDiscount ?? undefined,
    },
  ] satisfies DraftInvoiceItemInput[];
};

const resolveOrganisationCurrency = (organisationId: string): Promise<string> =>
  getOrgBillingCurrency(organisationId);

const toStripeAddress = (
  address?: {
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null,
): Stripe.AddressParam | undefined => {
  if (!address?.country) {
    return undefined;
  }

  return {
    line1: address.addressLine ?? undefined,
    city: address.city ?? undefined,
    state: address.state ?? undefined,
    postal_code: address.postalCode ?? undefined,
    country: address.country,
  };
};

const resolveInvoiceTaxContext = async (
  organisationId: string,
  parentId?: string | null,
) => {
  const [organisation, parent] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organisationId },
      select: { stripeAccountId: true },
    }),
    parentId
      ? prisma.parent.findUnique({
          where: { id: parentId },
          select: { address: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    customerAddress: toStripeAddress(parent?.address ?? null),
    liabilityAccountId: organisation?.stripeAccountId ?? null,
  };
};

const cancelUnpaidInvoice = async (invoice: PrismaInvoice, reason: string) =>
  prisma.invoice
    .update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        metadata: {
          ...(normalizeInvoiceMetadata(invoice.metadata) ?? {}),
          cancellationReason: reason,
        } as unknown as Prisma.InputJsonValue,
      },
    })
    .then(async (updated) => {
      await FinanceEventService.recordEvent({
        organisationId: updated.organisationId ?? null,
        eventType: "INVOICE_CANCELLED",
        entityType: "INVOICE",
        entityId: updated.id,
        payload: {
          status: updated.status,
          reason,
        },
        occurredAt: new Date(),
      });

      return updated;
    });

const generateCreditNoteNumber = (invoiceId: string) =>
  `CN-${invoiceId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

const normalizeCreateInput = async (
  input: CreateInvoiceInput,
  patientId: string,
  parentId: string,
  currency: string,
  taxBehavior: PrismaTaxBehavior = DEFAULT_TAX_BEHAVIOR,
  taxContext?: {
    customerAddress?: Stripe.AddressParam | null;
    liabilityAccountId?: string | null;
  },
  options?: { skipTaxCalculation?: boolean },
) => {
  const items = buildInvoiceLineSnapshots(input.items);
  const totals = await resolveInvoiceTotals(
    input.items,
    0,
    input.invoiceDiscount,
    taxBehavior,
    currency,
    undefined,
    "preview",
    taxContext,
    options,
  );

  return {
    items,
    totals,
    data: {
      appointmentId: input.appointmentId,
      parentId,
      organisationId: input.organisationId,
      patientId,
      currency,
      status: "AWAITING_PAYMENT" as const,
      paymentCollectionMethod: input.paymentCollectionMethod,
      billingCollectionMode: resolveBillingCollectionMode(
        input.paymentCollectionMethod,
      ),
      visitBillingStage: "DRAFT" as const,
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      taxProvider: totals.taxSnapshot?.provider ?? null,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      invoiceDiscountTotal: totals.invoiceDiscountTotal,
      invoiceDiscountType: input.invoiceDiscount?.type ?? null,
      invoiceDiscountValue: input.invoiceDiscount?.value ?? null,
      taxTotal: totals.taxTotal,
      taxPercent: totals.taxPercent,
      totalAmount: totals.totalAmount,
      metadata: {
        ...(input.notes ? { notes: input.notes } : {}),
      } as unknown as Prisma.InputJsonValue,
    },
    taxSnapshot: totals.taxSnapshot,
  };
};

const applyInvoiceTerminalStatus = async (
  invoiceId: string,
  status: PrismaInvoiceStatus,
  eventType: AuditEventType,
) => {
  const doc = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
  });

  await FinanceEventService.recordEvent({
    organisationId: doc.organisationId ?? null,
    eventType,
    entityType: "INVOICE",
    entityId: doc.id,
    payload: {
      status: doc.status,
      totalAmount: doc.totalAmount,
      currency: doc.currency,
    },
    occurredAt: new Date(),
  });

  await recordInvoiceAuditForRow(doc, eventType, doc.id, {
    status: doc.status,
    totalAmount: doc.totalAmount,
    currency: doc.currency,
  });

  return doc;
};

const recordInvoicePaidState = async (invoice: PrismaInvoice, paidAt: Date) => {
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      paidAt,
      visitBillingStage: "SETTLED",
    },
  });

  await recordInvoiceAuditForRow(updated, "INVOICE_PAID", updated.id, {
    status: updated.status,
    totalAmount: updated.totalAmount,
    currency: updated.currency,
  });

  await FinanceEventService.recordEvent({
    organisationId: updated.organisationId ?? null,
    eventType: "INVOICE_PAID",
    entityType: "INVOICE",
    entityId: updated.id,
    payload: {
      status: updated.status,
      totalAmount: updated.totalAmount,
      currency: updated.currency,
      paidAt: updated.paidAt?.toISOString() ?? null,
    },
    occurredAt: updated.paidAt ?? paidAt,
  });

  return updated;
};

const ensureFinalizedInvoiceRenderedDocument = async (
  invoice: PrismaInvoice,
) => {
  if (!invoice.organisationId) {
    return;
  }

  const existing = await prisma.renderedDocument.findFirst({
    where: {
      organisationId: invoice.organisationId,
      sourceKind: "INVOICE" as never,
      sourceId: invoice.id,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return createRenderedDocumentRecord({
    title: "Final Invoice",
    source: {
      sourceKind: "INVOICE",
      sourceId: invoice.id,
      organisationId: invoice.organisationId,
      templateKind: "INVOICE",
    },
  });
};

const computeInvoiceTaxTotals = async (
  invoice: Prisma.InvoiceGetPayload<{ include: { taxSnapshot: true } }>,
  mode: "preview" | "finalize",
  taxProvider?: string | null,
) => {
  const items = Array.isArray(invoice.items)
    ? (invoice.items as unknown as DraftInvoiceItemInput[])
    : [];
  const invoiceDiscount =
    invoice.invoiceDiscountType && invoice.invoiceDiscountValue != null
      ? {
          type: invoice.invoiceDiscountType as PricingInvoiceDiscountInput["type"],
          value: invoice.invoiceDiscountValue,
        }
      : undefined;
  const taxContext = await resolveInvoiceTaxContext(
    invoice.organisationId ?? "",
    invoice.parentId ?? null,
  );
  return resolveInvoiceTotals(
    items,
    invoice.taxPercent,
    invoiceDiscount,
    invoice.taxSnapshot?.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
    invoice.currency,
    taxProvider ?? invoice.taxSnapshot?.provider,
    mode,
    taxContext,
  );
};

export const InvoiceService = {
  async createDraftForAppointment(input: CreateInvoiceInput) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, organisationId: true, patient: true },
    });
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const patientId = getAppointmentPatientIdOrThrow(appointment);
    const parentId = getAppointmentParentIdOrThrow(appointment);
    if (input.patientId && input.patientId !== patientId) {
      throw new InvoiceServiceError(
        "Appointment patient links are missing",
        500,
      );
    }

    const currency = await resolveOrganisationCurrency(
      appointment.organisationId,
    );
    const { data, taxSnapshot } = await normalizeCreateInput(
      input,
      patientId,
      parentId,
      currency,
      DEFAULT_TAX_BEHAVIOR,
      undefined,
      { skipTaxCalculation: true },
    );
    const createdInvoice = await prisma.invoice.create({
      data: {
        ...data,
        ...(taxSnapshot
          ? {
              taxSnapshot: {
                create: taxSnapshot,
              },
            }
          : {}),
      },
    });

    const targets = await resolveAuditTargetsForInvoiceRow(createdInvoice);
    await recordInvoiceAuditEvent(targets, {
      eventType: "INVOICE_CREATED",
      entityId: createdInvoice.id,
      metadata: {
        appointmentId: input.appointmentId,
        status: createdInvoice.status,
        totalAmount: createdInvoice.totalAmount,
        currency: createdInvoice.currency,
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: createdInvoice.organisationId ?? null,
      eventType: "INVOICE_CREATED",
      entityType: "INVOICE",
      entityId: createdInvoice.id,
      payload: {
        appointmentId: input.appointmentId,
        status: createdInvoice.status,
        totalAmount: createdInvoice.totalAmount,
        currency: createdInvoice.currency,
      },
      occurredAt: createdInvoice.createdAt,
    });

    await NotificationService.sendToUser(
      parentId,
      NotificationTemplates.Payment.PAYMENT_PENDING(
        createdInvoice.totalAmount,
        createdInvoice.currency,
      ),
    );

    return toInvoiceRecord(createdInvoice);
  },

  async getOrCreateDraftForAppointment(input: CreateInvoiceInput) {
    const existing = await this.findOpenInvoiceForAppointment(
      input.appointmentId,
    );
    if (existing) {
      return existing;
    }
    return this.createDraftForAppointment(input);
  },

  async createExtraInvoiceForAppointment(input: {
    appointmentId: string;
    items: InvoiceItem[];
    invoiceDiscount?: PricingInvoiceDiscountInput;
    metadata?: Record<string, string | number | boolean | undefined>;
  }) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { id: true, organisationId: true, patient: true },
    });
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const currency = await resolveOrganisationCurrency(
      appointment.organisationId,
    );
    const { patientId, parentId } = getAppointmentLinks(appointment);
    if (!patientId || !parentId) {
      throw new InvoiceServiceError(
        "Appointment missing parent or patient links",
        500,
      );
    }

    const items = input.items.map((item) => ({
      description: item.description ?? item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent ?? undefined,
    }));
    const totals = await resolveInvoiceTotals(
      items,
      0,
      input.invoiceDiscount,
      DEFAULT_TAX_BEHAVIOR,
      currency,
      undefined,
      "preview",
      undefined,
      { skipTaxCalculation: true },
    );

    const invoice = await prisma.invoice.create({
      data: {
        appointmentId: appointment.id,
        parentId,
        patientId,
        organisationId: appointment.organisationId,
        currency,
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        billingCollectionMode: "STAGED_DURING_VISIT",
        visitBillingStage: "READY_FOR_BILLING" as const,
        ...buildReadyForBillingFields("SYSTEM"),
        depositTargetAmount: 0,
        depositCollectedAmount: 0,
        taxProvider: totals.taxSnapshot?.provider ?? null,
        items: buildInvoiceLineSnapshots(
          items,
        ) as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        invoiceDiscountTotal: totals.invoiceDiscountTotal,
        invoiceDiscountType: input.invoiceDiscount?.type ?? null,
        invoiceDiscountValue: input.invoiceDiscount?.value ?? null,
        taxTotal: totals.taxTotal,
        taxPercent: totals.taxPercent,
        totalAmount: totals.totalAmount,
        metadata: {
          ...input.metadata,
          source: "EXTRA_CHARGES",
        } as unknown as Prisma.InputJsonValue,
        ...(totals.taxSnapshot
          ? {
              taxSnapshot: {
                create: totals.taxSnapshot,
              },
            }
          : {}),
      },
    });

    const targets = await resolveAuditTargetsForInvoiceRow(invoice);
    await recordInvoiceAuditEvent(targets, {
      eventType: "INVOICE_CREATED",
      entityId: invoice.id,
      metadata: {
        appointmentId: appointment.id,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: invoice.organisationId ?? null,
      eventType: "INVOICE_CREATED",
      entityType: "INVOICE",
      entityId: invoice.id,
      payload: {
        appointmentId: appointment.id,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
      occurredAt: invoice.createdAt,
    });

    await NotificationService.sendToUser(
      parentId,
      NotificationTemplates.Payment.PAYMENT_PENDING(
        invoice.totalAmount,
        invoice.currency,
      ),
    );

    return toInvoiceRecord(invoice);
  },

  async markInvoicePaid(params: { invoiceId: string }) {
    const existing = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
    });
    if (!existing || existing.status === "PAID") {
      return null;
    }

    return recordInvoicePaidState(existing, new Date());
  },

  async markInvoicePaidManually(invoiceId: string, organisationId: string) {
    const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!doc || doc.organisationId !== organisationId) {
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

    const result = await FinancePaymentService.recordManualPayment(doc.id, {
      settlementChannel: "CASH",
    });
    return toInvoiceRecord(result.invoice);
  },

  async settleInvoiceAtCloseout(
    invoiceId: string,
    organisationId: string,
    input: {
      settlementChannel?:
        | "CASH"
        | "BANK_TRANSFER"
        | "CARD_PRESENT"
        | "DEPOSIT"
        | "OTHER";
      reference?: string;
      receivedAt?: Date;
    } = {},
  ) {
    const doc = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!doc || doc.organisationId !== organisationId) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(doc.status)) {
      throw new InvoiceServiceError("Invoice cannot be settled.", 409);
    }

    if (doc.status === "PAID") {
      return toInvoiceRecord(doc);
    }

    const summary = await getInvoiceFinancialSummary(
      doc.id,
      doc.totalAmount,
      doc.depositCollectedAmount ?? 0,
    );
    if (summary.balance <= 0) {
      const settled = await recordInvoicePaidState(
        doc,
        input.receivedAt ?? new Date(),
      );
      return toInvoiceRecord(settled);
    }

    const result = await FinancePaymentService.recordManualPayment(doc.id, {
      settlementChannel: input.settlementChannel ?? "CASH",
      receivedAt: input.receivedAt,
      reference: input.reference,
    });

    return toInvoiceRecord(result.invoice);
  },

  async updatePaymentCollectionMethod(
    invoiceId: string,
    organisationId: string,
    paymentCollectionMethod: string,
  ) {
    const resolvedPaymentCollectionMethod = resolvePaymentCollectionMethod(
      paymentCollectionMethod,
      (message) => new InvoiceServiceError(message, 400),
    ) as PaymentCollectionMethod;

    const doc = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (doc?.organisationId !== organisationId) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (["PAID", "CANCELLED", "REFUNDED"].includes(doc.status)) {
      throw new InvoiceServiceError("Invoice cannot be updated.", 409);
    }

    if (doc.paymentCollectionMethod === resolvedPaymentCollectionMethod) {
      return toInvoiceRecord(doc);
    }

    const updated = await prisma.invoice.update({
      where: { id: doc.id },
      data: { paymentCollectionMethod: resolvedPaymentCollectionMethod },
    });

    return updated;
  },

  async markFailed(invoiceId: string) {
    const doc = await applyInvoiceTerminalStatus(
      invoiceId,
      "FAILED",
      "INVOICE_FAILED",
    );

    return doc;
  },

  async markRefunded(invoiceId: string): Promise<Invoice> {
    const doc = await applyInvoiceTerminalStatus(
      invoiceId,
      "REFUNDED",
      "INVOICE_REFUNDED",
    );

    return toInvoiceRecord(doc);
  },

  async issueCreditNote(invoiceId: string, input: IssueCreditNoteInput) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new InvoiceServiceError(
        "Credit note amount must be greater than zero",
        400,
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        creditNotes: {
          where: { status: "ISSUED" },
        },
      },
    });

    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      throw new InvoiceServiceError("Invoice cannot accept credit notes.", 409);
    }

    const issuedCreditTotal = roundMoney(
      (invoice.creditNotes ?? []).reduce(
        (sum, creditNote) => sum + creditNote.amount,
        0,
      ),
    );
    const remainingCreditable = roundMoney(
      Math.max(0, invoice.totalAmount - issuedCreditTotal),
    );
    const creditAmount = roundMoney(input.amount);

    if (creditAmount > remainingCreditable) {
      throw new InvoiceServiceError(
        "Credit note amount exceeds invoice remaining amount",
        409,
      );
    }

    const creditNote = await prisma.creditNote.create({
      data: {
        invoiceId: invoice.id,
        creditNoteNumber: generateCreditNoteNumber(invoice.id),
        reason: input.reason ?? undefined,
        amount: creditAmount,
        status: "ISSUED",
        metadata: input.metadata
          ? (input.metadata as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: invoice.organisationId ?? null,
      eventType: "CREDIT_NOTE_ISSUED",
      entityType: "CREDIT_NOTE",
      entityId: creditNote.id,
      payload: {
        invoiceId: invoice.id,
        creditNoteNumber: creditNote.creditNoteNumber,
        amount: creditNote.amount,
        reason: creditNote.reason ?? null,
        status: creditNote.status,
      },
      occurredAt: creditNote.createdAt,
    });

    return toCreditNoteRecord(creditNote);
  },

  async voidCreditNote(
    invoiceId: string,
    creditNoteId: string,
    reason?: string,
  ) {
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: creditNoteId },
      include: {
        invoice: {
          select: {
            id: true,
            organisationId: true,
          },
        },
      },
    });

    if (creditNote?.invoiceId !== invoiceId) {
      throw new InvoiceServiceError("Credit note not found.", 404);
    }

    if (creditNote.status === "VOIDED") {
      return toCreditNoteRecord(creditNote);
    }

    if (creditNote.status !== "ISSUED") {
      throw new InvoiceServiceError("Credit note cannot be voided.", 409);
    }

    const updated = await prisma.creditNote.update({
      where: { id: creditNote.id },
      data: {
        status: "VOIDED",
        metadata: {
          ...((normalizeCreditNoteMetadata(creditNote.metadata) ??
            {}) as Record<string, string | number | boolean>),
          voidReason: reason ?? undefined,
          voidedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: creditNote.invoice.organisationId ?? null,
      eventType: "CREDIT_NOTE_VOIDED",
      entityType: "CREDIT_NOTE",
      entityId: updated.id,
      payload: {
        invoiceId: creditNote.invoiceId,
        creditNoteNumber: updated.creditNoteNumber,
        amount: updated.amount,
        reason: reason ?? null,
        status: updated.status,
      },
      occurredAt: new Date(),
    });

    return toCreditNoteRecord(updated);
  },

  async updateStatus(invoiceId: string, status: PrismaInvoiceStatus) {
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        visitBillingStage: status === "PAID" ? "SETTLED" : undefined,
      },
    });

    await recordInvoiceAuditForRow(invoice, "INVOICE_UPDATED", invoice.id, {
      status: invoice.status,
    });

    await FinanceEventService.recordEvent({
      organisationId: invoice.organisationId ?? null,
      eventType: "INVOICE_STATUS_CHANGED",
      entityType: "INVOICE",
      entityId: invoice.id,
      payload: {
        status,
      },
      occurredAt: new Date(),
    });

    return invoice;
  },

  async markAppointmentReadyForBilling(
    appointmentId: string,
    actorUserId?: string,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        appointmentId,
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
      include: { taxSnapshot: true },
    });

    if (!invoice) {
      return null;
    }

    if (
      invoice.billingCollectionMode === "PREPAY_AT_BOOKING" ||
      invoice.visitBillingStage === "READY_FOR_BILLING" ||
      invoice.visitBillingStage === "SETTLED"
    ) {
      return toInvoiceRecord(invoice);
    }

    if (!invoice.finalizedAt) {
      await this.finalizeTaxForInvoice(
        invoice.id,
        invoice.taxSnapshot?.provider ?? undefined,
      );
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        billingCollectionMode:
          invoice.billingCollectionMode ?? "PAY_AT_VISIT_END",
        visitBillingStage: "READY_FOR_BILLING",
        ...buildReadyForBillingFields(actorUserId),
      },
    });

    await FinanceEventService.recordReadinessEvent({
      organisationId: updated.organisationId,
      eventType: "INVOICE_READY_FOR_BILLING",
      entityType: "INVOICE",
      entityId: updated.id,
      actorUserId,
    });

    return toInvoiceRecord(updated);
  },

  async reverseAppointmentReadyForBilling(
    appointmentId: string,
    actorUserId?: string,
  ) {
    const readyInvoice = await prisma.invoice.findFirst({
      where: {
        appointmentId,
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
        visitBillingStage: "READY_FOR_BILLING",
      },
      orderBy: { createdAt: "desc" },
      include: { taxSnapshot: true },
    });

    if (!readyInvoice) {
      return null;
    }

    const summary = await getInvoiceFinancialSummary(
      readyInvoice.id,
      readyInvoice.totalAmount,
      readyInvoice.depositCollectedAmount ?? 0,
    );
    if (summary.paid > 0 || summary.credited > 0) {
      throw new InvoiceServiceError(
        "Invoice already has payments applied and cannot be reverted",
        409,
      );
    }

    const updated = await prisma.invoice.update({
      where: { id: readyInvoice.id },
      data: {
        visitBillingStage: "DRAFT",
        readyForBillingAt: null,
        readyForBillingActorId: null,
      },
    });

    await FinanceEventService.recordReadinessEvent({
      organisationId: updated.organisationId,
      eventType: "INVOICE_READY_FOR_BILLING_REVERSED",
      entityType: "INVOICE",
      entityId: updated.id,
      actorUserId,
    });

    return toInvoiceRecord(updated);
  },

  async setInvoiceDepositTarget(
    invoiceId: string,
    depositTargetAmount: number,
  ) {
    const targetAmount = resolveInvoiceDepositTargetAmount(depositTargetAmount);
    const invoice = await findInvoiceByIdOrThrow(invoiceId);

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        billingCollectionMode: "DEPOSIT_THEN_SETTLE",
        depositTargetAmount: targetAmount,
        depositCollectedAmount: resolveInvoiceDepositCollectedAmount(
          invoice,
          targetAmount,
        ),
      },
    });

    return toInvoiceRecord(updated);
  },

  async getByAppointmentId(appId: string, organisationId?: string) {
    const docs = await prisma.invoice.findMany({
      where: {
        appointmentId: appId,
        ...(organisationId ? { organisationId } : {}),
      },
      include: invoiceCreditNotesInclude,
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      docs.map(async (doc) => ({
        ...toInvoiceRecord(doc),
        ...(await loadInvoiceFinancialDetails(doc.id)),
      })),
    );
  },

  async bootstrapForAppointment(
    appointmentId: string,
    paymentCollectionMethod: CreateInvoiceInput["paymentCollectionMethod"] = "PAYMENT_LINK",
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        organisationId: true,
        patient: true,
        appointmentType: true,
        productItemId: true,
        concern: true,
      },
    });
    if (!appointment) {
      throw new InvoiceServiceError("Appointment not found", 404);
    }

    const openInvoice = await prisma.invoice.findFirst({
      where: {
        appointmentId,
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (openInvoice) {
      return openInvoice;
    }

    const latestInvoice = await prisma.invoice.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: "desc" },
    });
    if (latestInvoice && ["PAID", "REFUNDED"].includes(latestInvoice.status)) {
      return latestInvoice;
    }

    const serviceId =
      typeof appointment.appointmentType === "object" &&
      appointment.appointmentType &&
      typeof (appointment.appointmentType as Record<string, unknown>).id ===
        "string"
        ? ((appointment.appointmentType as Record<string, unknown>)
            .id as string)
        : undefined;
    const productItemId = appointment.productItemId ?? serviceId;
    if (!serviceId && !productItemId) {
      throw new InvoiceServiceError("Service or product not found", 404);
    }

    const { patientId, parentId } = getAppointmentLinks(appointment);
    if (!patientId || !parentId) {
      throw new InvoiceServiceError(
        "Appointment missing parent or companion",
        400,
      );
    }

    const items = await buildBootstrapInvoiceItems({
      appointment,
      serviceId,
      productItemId,
    });

    return this.createDraftForAppointment({
      appointmentId,
      parentId,
      patientId,
      organisationId: appointment.organisationId,
      items,
      notes: appointment.concern ?? undefined,
      paymentCollectionMethod,
    });
  },

  async getById(id: string) {
    const doc = await prisma.invoice.findUnique({
      where: { id },
      include: invoiceCreditNotesInclude,
    });
    if (!doc) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    const org = doc.organisationId
      ? await prisma.organization.findUnique({
          where: { id: doc.organisationId },
          include: { address: true },
        })
      : null;
    const financialDetails = await loadInvoiceFinancialDetails(id);

    return {
      organistion: {
        name: org?.name ?? "",
        placesId: org?.googlePlacesId ?? "",
        address: org?.address ?? "",
        image: org?.imageUrl ?? "",
      },
      invoice: {
        ...toInvoiceRecord(doc),
        ...financialDetails,
      },
    };
  },

  async listForOrganisation(organisationId: string) {
    const docs = await prisma.invoice.findMany({
      where: { organisationId },
      include: invoiceCreditNotesInclude,
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => toInvoiceRecord(d));
  },

  async listForParent(parentId: string) {
    const docs = await prisma.invoice.findMany({
      where: { parentId },
      include: invoiceCreditNotesInclude,
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => toInvoiceRecord(d));
  },

  async listForCompanion(patientId: string) {
    const docs = await prisma.invoice.findMany({
      where: { patientId },
      include: invoiceCreditNotesInclude,
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => toInvoiceRecord(d));
  },

  async addItemsToInvoice(invoiceId: string, items: InvoiceItem[]) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { taxSnapshot: true },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (invoice.status === "PAID") {
      throw new InvoiceServiceError("Cannot modify a paid invoice", 409);
    }

    // A finalized but UNPAID invoice can still be edited (e.g. to add line items
    // and re-issue the payment link); only PAID invoices are locked (checked above).
    // We re-open it below so it can be re-priced and a fresh payment link generated.
    const wasFinalized = Boolean(invoice.finalizedAt);

    const existingItems = Array.isArray(invoice.items)
      ? (invoice.items as unknown as DraftInvoiceItemInput[])
      : [];
    const newItems = items.map(normalizeInvoiceLineItem);
    const mergedItems = mergeInvoiceLineItems(existingItems, newItems);
    const taxContext = await resolveInvoiceTaxContext(
      invoice.organisationId ?? "",
      invoice.parentId ?? null,
    );
    const totals = await resolveInvoiceTotals(
      mergedItems,
      invoice.taxPercent,
      invoice.invoiceDiscountType && invoice.invoiceDiscountValue != null
        ? {
            type: invoice.invoiceDiscountType as PricingInvoiceDiscountInput["type"],
            value: invoice.invoiceDiscountValue,
          }
        : undefined,
      invoice.taxSnapshot?.taxBehavior ?? DEFAULT_TAX_BEHAVIOR,
      invoice.currency,
      invoice.taxSnapshot?.provider,
      "preview",
      taxContext,
    );

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        taxProvider: totals.taxSnapshot!.provider,
        items: buildInvoiceLineSnapshots(
          mergedItems,
        ) as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        invoiceDiscountTotal: totals.invoiceDiscountTotal,
        taxTotal: totals.taxTotal,
        taxPercent: totals.taxPercent,
        totalAmount: totals.totalAmount,
        finalizedAt: wasFinalized ? null : undefined,
        taxSnapshot: {
          upsert: {
            create: totals.taxSnapshot!,
            update: totals.taxSnapshot!,
          },
        },
      },
    });

    // Re-opening a finalized-but-unpaid invoice invalidates any in-flight Stripe
    // payment attempt so a fresh checkout link is generated for the new total.
    if (wasFinalized) {
      await prisma.paymentAttempt.updateMany({
        where: { invoiceId, status: { notIn: ["SUCCEEDED", "CANCELED"] } },
        data: { status: "CANCELED" },
      });
    }

    const targets = await resolveAuditTargetsForInvoiceRow(updated);
    await recordInvoiceAuditEvent(targets, {
      eventType: "INVOICE_UPDATED",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        totalAmount: updated.totalAmount,
        currency: updated.currency,
        itemsAdded: items.length,
      },
    });

    return toInvoiceRecord(updated);
  },

  async finalizeTaxForInvoice(invoiceId: string, taxProvider?: string | null) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { taxSnapshot: true },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (["PAID", "CANCELLED", "REFUNDED"].includes(invoice.status)) {
      throw new InvoiceServiceError("Invoice cannot be finalized", 409);
    }

    if (invoice.finalizedAt) {
      await ensureFinalizedInvoiceRenderedDocument(invoice);
      return toInvoiceRecord(invoice);
    }

    const totals = await computeInvoiceTaxTotals(
      invoice,
      "finalize",
      taxProvider,
    );

    const finalizedAt = new Date();
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        finalizedAt,
        taxProvider: totals.taxSnapshot!.provider,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        invoiceDiscountTotal: totals.invoiceDiscountTotal,
        taxTotal: totals.taxTotal,
        taxPercent: totals.taxPercent,
        totalAmount: totals.totalAmount,
        taxSnapshot: {
          upsert: {
            create: {
              ...totals.taxSnapshot!,
              calculatedAt: finalizedAt,
            },
            update: {
              ...totals.taxSnapshot,
              calculatedAt: finalizedAt,
            },
          },
        },
      },
    });

    await recordInvoiceAuditForRow(updated, "INVOICE_UPDATED", updated.id, {
      status: updated.status,
      totalAmount: updated.totalAmount,
      currency: updated.currency,
      taxFinalizedAt: finalizedAt.toISOString(),
    });

    await FinanceEventService.recordEvent({
      organisationId: updated.organisationId ?? null,
      eventType: "INVOICE_FINALIZED",
      entityType: "INVOICE",
      entityId: updated.id,
      payload: {
        status: updated.status,
        totalAmount: updated.totalAmount,
        currency: updated.currency,
        taxProvider: updated.taxProvider ?? null,
        taxFinalizedAt: finalizedAt.toISOString(),
      },
      occurredAt: finalizedAt,
    });

    await ensureFinalizedInvoiceRenderedDocument(updated);

    return toInvoiceRecord(updated);
  },

  async previewTaxForInvoice(invoiceId: string, taxProvider?: string | null) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { taxSnapshot: true },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    const totals = await computeInvoiceTaxTotals(
      invoice,
      "preview",
      taxProvider,
    );

    return {
      invoice: toInvoiceRecord(invoice),
      taxProvider: totals.taxSnapshot!.provider,
      taxSnapshot: totals.taxSnapshot,
      taxTotal: totals.taxTotal,
      totalAmount: totals.totalAmount,
    };
  },

  async addChargesToAppointment(
    appointmentId: string,
    items: InvoiceItem[],
    organisationId?: string,
  ) {
    if (organisationId) {
      await assertAppointmentInOrganisation(appointmentId, organisationId);
    }

    const invoice = await this.findOpenInvoiceForAppointment(
      appointmentId,
      organisationId,
    );
    if (!invoice) {
      const bootstrappedInvoice =
        await this.bootstrapForAppointment(appointmentId);

      if (
        !bootstrappedInvoice.id ||
        !["AWAITING_PAYMENT", "PENDING"].includes(bootstrappedInvoice.status)
      ) {
        throw new InvoiceServiceError(
          "Invoice is not open for appointment",
          409,
        );
      }

      return this.addItemsToInvoice(bootstrappedInvoice.id, items);
    }

    return this.addItemsToInvoice(invoice.id, items);
  },

  async findOpenInvoiceForAppointment(
    appointmentId: string,
    organisationId?: string,
  ) {
    return prisma.invoice.findFirst({
      where: {
        appointmentId,
        ...(organisationId ? { organisationId } : {}),
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async handleAppointmentCancellation(appointmentId: string, reason: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { appointmentId },
      orderBy: { createdAt: "desc" },
    });

    if (!invoice) {
      return { action: "NO_INVOICE" };
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    if (["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      const updated = await cancelUnpaidInvoice(invoice, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_CANCELLED", updated.id, {
        status: updated.status,
        reason,
      });
      return { action: "CANCELLED_UNPAID" };
    }

    if (invoice.status === "PAID") {
      const { invoice: updated, refund } =
        await FinancePaymentService.refundInvoicePayment(invoice.id, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_REFUNDED", updated.id, {
        status: updated.status,
        reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
      });
      return { action: "REFUNDED", refundId: refund.refundId };
    }

    return { action: "NO_ACTION", status: invoice.status };
  },

  async handleInvoiceCancellation(invoiceId: string, reason: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      return { action: "ALREADY_HANDLED", status: invoice.status };
    }

    if (["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      const updated = await cancelUnpaidInvoice(invoice, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_CANCELLED", updated.id, {
        status: updated.status,
        reason,
      });
      return { action: "CANCELLED_UNPAID", status: updated.status };
    }

    if (invoice.status === "PAID") {
      const { invoice: updated, refund } =
        await FinancePaymentService.refundInvoicePayment(invoice.id, reason);
      await recordInvoiceAuditForRow(updated, "INVOICE_REFUNDED", updated.id, {
        status: updated.status,
        reason,
        refundId: refund.refundId,
        amount: refund.amountRefunded,
        currency: updated.currency,
      });
      return { action: "REFUNDED", status: updated.status };
    }

    return { action: "NO_ACTION", status: invoice.status };
  },

  async getByPaymentIntentId(paymentIntentId: string, organisationId?: string) {
    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        providerPaymentIntentId: paymentIntentId,
      },
      select: {
        invoiceId: true,
      },
    });

    const payment = paymentAttempt
      ? null
      : await prisma.payment.findFirst({
          where: {
            providerPaymentId: paymentIntentId,
            ...(organisationId
              ? {
                  invoice: {
                    organisationId,
                  },
                }
              : {}),
          },
          select: {
            invoiceId: true,
          },
        });

    const doc = paymentAttempt
      ? await prisma.invoice.findUnique({
          where: { id: paymentAttempt.invoiceId },
        })
      : payment
        ? await prisma.invoice.findUnique({
            where: { id: payment.invoiceId },
          })
        : null;

    if (!doc) {
      return null;
    }
    if (organisationId && doc.organisationId !== organisationId) {
      return null;
    }

    const financialDetails = await loadInvoiceFinancialDetails(doc.id);
    return {
      ...toInvoiceRecord(doc),
      ...financialDetails,
    };
  },

  async createCheckoutSessionAndEmailParent(invoiceId: string) {
    const checkout =
      await FinancePaymentService.createCheckoutSessionForInvoice(invoiceId);
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new InvoiceServiceError("Invoice not found.", 404);
    }

    let emailSent = false;
    if (checkout?.url && invoice.parentId) {
      const summary = await getInvoiceFinancialSummary(
        invoice.id,
        invoice.totalAmount,
        invoice.depositCollectedAmount ?? 0,
      );
      const parent = await prisma.parent.findUnique({
        where: { id: invoice.parentId },
        select: { email: true, firstName: true, lastName: true },
      });
      const organisation = invoice.organisationId
        ? await prisma.organization.findUnique({
            where: { id: invoice.organisationId },
            select: { name: true },
          })
        : null;
      const parentName = parent
        ? [parent.firstName, parent.lastName].filter(Boolean).join(" ")
        : undefined;
      const amountText =
        typeof summary.balance === "number" && invoice.currency
          ? `${invoice.currency.toUpperCase()} ${summary.balance.toFixed(2)}`
          : undefined;

      if (parent?.email) {
        try {
          await sendEmailTemplate({
            to: parent.email,
            templateId: "invoicePaymentCheckout",
            templateData: {
              parentName,
              organisationName: organisation?.name ?? undefined,
              invoiceId: invoice.id,
              amountText,
              checkoutUrl: checkout.url,
              ctaUrl: checkout.url,
              supportEmail: SUPPORT_EMAIL_ADDRESS,
            },
          });
          emailSent = true;
        } catch (error) {
          logger.error("Failed to send invoice checkout email", error);
        }
      }
    }

    return {
      checkout,
      emailSent,
    };
  },
};
