import { Prisma } from "@prisma/client";
import type {
  BillingCollectionMode as PrismaBillingCollectionMode,
  PaymentAttemptStatus as PrismaPaymentAttemptStatus,
  PaymentProvider as PrismaPaymentProvider,
  PaymentStatus as PrismaPaymentStatus,
  RefundStatus as PrismaRefundStatus,
  SettlementChannel as PrismaSettlementChannel,
} from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "src/config/prisma";
import { FinanceEventService } from "./events";
import { roundMoney } from "./pricing";

type PaymentLineSummary = {
  id: string;
  amount: number;
  status: PrismaPaymentStatus;
};

type InvoiceFinancialSummary = {
  paid: number;
  credited: number;
  balance: number;
};

type StripeCheckoutSessionClient = {
  checkout: {
    sessions: {
      create: (input: Record<string, unknown>) => Promise<{
        id: string;
        url?: string | null;
      }>;
    };
  };
  paymentIntents: {
    create: (input: Record<string, unknown>) => Promise<{
      id: string;
      client_secret?: string | null;
    }>;
    retrieve: (
      paymentIntentId: string,
      options?: Record<string, unknown>,
    ) => Promise<{ latest_charge?: { id: string } | string | null }>;
  };
  refunds: {
    create: (input: { charge: string; amount?: number }) => Promise<{
      id: string;
      status: string;
      amount: number;
    }>;
  };
};

type CheckoutSessionResult = {
  sessionId: string;
  url?: string | null;
  paymentAttemptId?: string | null;
};

export class FinancePaymentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FinancePaymentError";
  }
}

export type PaymentAttemptInput = {
  provider: PrismaPaymentProvider;
  status?: PrismaPaymentAttemptStatus;
  settlementChannel?: PrismaSettlementChannel | null;
  providerPaymentIntentId?: string | null;
  providerCheckoutSessionId?: string | null;
  providerPaymentLinkId?: string | null;
  amountRequested?: number;
  amountCaptured?: number;
  amountApplied?: number;
  currency: string;
  collectionMode?: PrismaBillingCollectionMode | null;
  isOffline?: boolean;
  isPartial?: boolean;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type ManualPaymentInput = {
  settlementChannel?: PrismaSettlementChannel;
  receivedAt?: Date;
  reference?: string;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type InvoicePaymentInput = {
  provider: PrismaPaymentProvider;
  amount: number;
  currency?: string;
  settlementChannel?: PrismaSettlementChannel | null;
  receivedAt?: Date;
  reference?: string;
  providerPaymentId?: string | null;
  paymentAttemptId?: string | null;
  collectionMode?: PrismaBillingCollectionMode | null;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type RefundInvoiceResult = {
  invoice: Prisma.InvoiceGetPayload<{
    include: { payments: true };
  }>;
  refund: {
    refundId: string;
    providerRefundId?: string | null;
    status: string;
    amountRefunded: number;
    paymentId: string;
  };
};

export type RefundPaymentResult = {
  payment: Prisma.PaymentGetPayload<{
    include: { invoice: true };
  }>;
  refund: {
    refundId: string;
    providerRefundId?: string | null;
    status: string;
    amountRefunded: number;
    paymentId: string;
  };
};

export type PaymentIntentResult = {
  paymentIntentId: string;
  clientSecret?: string | null;
  amount: number;
  currency: string;
};

export const getInvoiceFinancialSummary = async (
  invoiceId: string,
  totalAmount: number,
): Promise<InvoiceFinancialSummary> => {
  const [payments, creditNotes] = await Promise.all([
    prisma.payment.findMany({
      where: { invoiceId, status: "SUCCEEDED" },
      select: { amount: true },
    }),
    prisma.creditNote.findMany({
      where: { invoiceId, status: "ISSUED" },
      select: { amount: true },
    }),
  ]);

  const paid = roundMoney(
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  const credited = roundMoney(
    creditNotes.reduce((sum, creditNote) => sum + creditNote.amount, 0),
  );

  return {
    paid,
    credited,
    balance: roundMoney(Math.max(0, totalAmount - paid - credited)),
  };
};

const getOutstandingBalance = async (
  invoiceId: string,
  totalAmount: number,
) => {
  const summary = await getInvoiceFinancialSummary(invoiceId, totalAmount);
  return {
    paid: summary.paid,
    balance: summary.balance,
  };
};

const createPaymentAttempt = async (
  invoiceId: string,
  input: PaymentAttemptInput,
) =>
  prisma.paymentAttempt.create({
    data: {
      invoiceId,
      provider: input.provider,
      settlementChannel: input.settlementChannel ?? null,
      providerPaymentIntentId: input.providerPaymentIntentId ?? null,
      providerCheckoutSessionId: input.providerCheckoutSessionId ?? null,
      providerPaymentLinkId: input.providerPaymentLinkId ?? null,
      status: input.status ?? "REQUIRES_PAYMENT_METHOD",
      amountRequested: input.amountRequested ?? 0,
      amountCaptured: input.amountCaptured ?? 0,
      amountApplied: input.amountApplied ?? 0,
      currency: input.currency,
      collectionMode: input.collectionMode ?? null,
      isOffline: input.isOffline ?? false,
      isPartial: input.isPartial ?? false,
      rawProviderPayload: input.rawProviderPayload ?? undefined,
    },
  });

const readJsonRecord = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const getCheckoutSessionUrl = (attempt: {
  rawProviderPayload?: Prisma.JsonValue | null;
}) => {
  const payload = readJsonRecord(attempt.rawProviderPayload);
  return readString(payload.url);
};

const findInvoiceByPaymentIntentId = async (paymentIntentId: string) => {
  const paymentAttempt = await prisma.paymentAttempt.findFirst({
    where: { providerPaymentIntentId: paymentIntentId },
    select: { invoiceId: true },
  });

  if (paymentAttempt) {
    return prisma.invoice.findUnique({
      where: { id: paymentAttempt.invoiceId },
    });
  }

  const payment = await prisma.payment.findFirst({
    where: { providerPaymentId: paymentIntentId },
    select: { invoiceId: true },
  });

  if (payment) {
    return prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
    });
  }

  return null;
};

const findInvoiceByCheckoutSessionId = async (sessionId: string) => {
  const paymentAttempt = await prisma.paymentAttempt.findFirst({
    where: { providerCheckoutSessionId: sessionId },
    select: { invoiceId: true },
  });

  if (paymentAttempt) {
    return prisma.invoice.findUnique({
      where: { id: paymentAttempt.invoiceId },
    });
  }

  return null;
};

const mapRefundStatus = (status: string): PrismaRefundStatus => {
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";
    case "canceled":
      return "CANCELED";
    case "failed":
      return "FAILED";
    case "pending":
    default:
      return "PENDING";
  }
};

let stripeClient: StripeCheckoutSessionClient | null = null;

export const __setFinanceStripeClientForTests = (
  client: StripeCheckoutSessionClient | null,
) => {
  stripeClient = client;
};

const getStripeClient = (): StripeCheckoutSessionClient => {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(apiKey, {
    apiVersion: "2026-01-28.clover",
  }) as unknown as StripeCheckoutSessionClient;

  return stripeClient;
};

export const FinancePaymentService = {
  async createPaymentAttempt(invoiceId: string, input: PaymentAttemptInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    return createPaymentAttempt(invoiceId, input);
  },

  async createCheckoutSessionForInvoice(
    invoiceId: string,
    provider?: PrismaPaymentProvider | null,
  ): Promise<CheckoutSessionResult> {
    if (provider && provider !== "STRIPE") {
      throw new FinancePaymentError("Unsupported payment provider", 400);
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      throw new FinancePaymentError("Invoice is not payable", 409);
    }

    if (invoice.paymentCollectionMethod === "PAYMENT_AT_CLINIC") {
      throw new FinancePaymentError(
        "Invoice is marked for in-clinic payment",
        409,
      );
    }

    const existingPaymentIntentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId,
        provider: "STRIPE",
        providerPaymentIntentId: { not: null },
      },
      select: { id: true },
    });
    if (existingPaymentIntentAttempt) {
      throw new FinancePaymentError("Invoice already has a PaymentIntent", 409);
    }

    const existingCheckoutAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId,
        provider: "STRIPE",
        providerCheckoutSessionId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        providerCheckoutSessionId: true,
        rawProviderPayload: true,
      },
    });

    if (existingCheckoutAttempt?.providerCheckoutSessionId) {
      return {
        sessionId: existingCheckoutAttempt.providerCheckoutSessionId,
        url: getCheckoutSessionUrl(existingCheckoutAttempt),
        paymentAttemptId: existingCheckoutAttempt.id,
      };
    }

    if (!invoice.organisationId) {
      throw new FinancePaymentError("Invoice missing organisation", 500);
    }

    const summary = await getInvoiceFinancialSummary(
      invoiceId,
      invoice.totalAmount,
    );
    if (summary.balance <= 0) {
      throw new FinancePaymentError("Invoice has no outstanding balance", 409);
    }

    const organisation = await prisma.organization.findUnique({
      where: { id: invoice.organisationId },
      select: { stripeAccountId: true },
    });
    if (!organisation?.stripeAccountId) {
      throw new FinancePaymentError(
        "Organisation not connected to Stripe",
        409,
      );
    }

    const invoiceCurrency = invoice.currency || "usd";

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length === 0) {
      throw new FinancePaymentError("Invoice items are missing", 400);
    }

    const rawItemTotal = roundMoney(
      items.reduce((sum: number, item) => {
        const unitPrice =
          typeof (item as { unitPrice?: unknown }).unitPrice === "number"
            ? (item as { unitPrice: number }).unitPrice
            : 0;
        const quantity =
          typeof (item as { quantity?: unknown }).quantity === "number"
            ? (item as { quantity: number }).quantity
            : 0;
        return sum + unitPrice * quantity;
      }, 0),
    );
    const useBalanceLineItem =
      rawItemTotal !== roundMoney(summary.balance) ||
      summary.paid > 0 ||
      summary.credited > 0;
    const lineItems = useBalanceLineItem
      ? [
          {
            price_data: {
              currency: invoiceCurrency,
              product_data: {
                name: `Outstanding balance for invoice ${invoice.id}`,
              },
              unit_amount: Math.round(summary.balance * 100),
            },
            quantity: 1,
          },
        ]
      : items.map((item) => ({
          price_data: {
            currency: invoiceCurrency,
            product_data: {
              name: (item as { name?: string }).name ?? "Service",
              description:
                (item as { description?: string }).description ?? undefined,
            },
            unit_amount: Math.round(
              (item as { unitPrice: number }).unitPrice * 100,
            ),
          },
          quantity: (item as { quantity: number }).quantity,
        }));

    const stripe = getStripeClient();
    const expiresAt = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      metadata: {
        type: "INVOICE_PAYMENT",
        invoiceId: invoice.id,
        appointmentId: invoice.appointmentId ?? "",
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
      },
      payment_intent_data: {
        metadata: {
          type: "INVOICE_PAYMENT",
          invoiceId: invoice.id,
          appointmentId: invoice.appointmentId ?? "",
          organisationId: invoice.organisationId ?? "",
          parentId: invoice.parentId ?? "",
        },
        transfer_data: { destination: organisation.stripeAccountId },
      },
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`,
      cancel_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`,
      expires_at: expiresAt,
    });

    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        invoiceId,
        provider: "STRIPE",
        settlementChannel: "STRIPE",
        providerCheckoutSessionId: session.id,
        status: "REQUIRES_ACTION",
        amountRequested: summary.balance,
        amountCaptured: 0,
        amountApplied: 0,
        currency: invoiceCurrency,
        collectionMode: null,
        isOffline: false,
        isPartial: false,
        rawProviderPayload: {
          sessionId: session.id,
          url: session.url ?? null,
          destinationAccountId: organisation.stripeAccountId,
        } as Prisma.InputJsonValue,
      },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentCollectionMethod: "PAYMENT_LINK",
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
      paymentAttemptId: paymentAttempt.id,
    };
  },

  async createPaymentIntentForInvoice(
    invoiceId: string,
  ): Promise<PaymentIntentResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      throw new FinancePaymentError("Invoice is not payable", 409);
    }

    if (invoice.paymentCollectionMethod === "PAYMENT_AT_CLINIC") {
      throw new FinancePaymentError(
        "Invoice is marked for in-clinic payment",
        409,
      );
    }

    if (invoice.paymentCollectionMethod === "PAYMENT_LINK") {
      await prisma.paymentAttempt.updateMany({
        where: {
          invoiceId,
          provider: "STRIPE",
          providerCheckoutSessionId: { not: null },
        },
        data: {
          status: "CANCELED",
        },
      });
    }

    const existingPaymentIntentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId,
        provider: "STRIPE",
        providerPaymentIntentId: { not: null },
      },
      select: {
        providerPaymentIntentId: true,
      },
    });

    if (existingPaymentIntentAttempt?.providerPaymentIntentId) {
      const summary = await getInvoiceFinancialSummary(
        invoiceId,
        invoice.totalAmount,
      );
      return {
        paymentIntentId: existingPaymentIntentAttempt.providerPaymentIntentId,
        clientSecret: null,
        amount: summary.balance,
        currency: invoice.currency,
      };
    }

    const summary = await getInvoiceFinancialSummary(
      invoiceId,
      invoice.totalAmount,
    );
    if (summary.balance <= 0) {
      throw new FinancePaymentError("Invoice has no outstanding balance", 409);
    }

    if (!invoice.organisationId) {
      throw new FinancePaymentError("Invoice missing organisation", 500);
    }

    const organisation = await prisma.organization.findUnique({
      where: { id: invoice.organisationId },
      select: { stripeAccountId: true },
    });
    if (!organisation?.stripeAccountId) {
      throw new FinancePaymentError(
        "Organisation does not have a Stripe connected account",
        409,
      );
    }

    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(summary.balance * 100),
      currency: invoice.currency || "usd",
      metadata: {
        type: "INVOICE_PAYMENT",
        invoiceId,
        appointmentId: invoice.appointmentId || "",
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
        patientId: invoice.patientId ?? "",
      },
      description: `Payment for Invoice ${invoiceId}`,
      transfer_data: { destination: organisation.stripeAccountId },
    });

    await createPaymentAttempt(invoiceId, {
      provider: "STRIPE",
      status: "REQUIRES_ACTION",
      settlementChannel: "STRIPE",
      providerPaymentIntentId: paymentIntent.id,
      amountRequested: summary.balance,
      amountCaptured: 0,
      amountApplied: 0,
      currency: invoice.currency || "usd",
      collectionMode: null,
      isOffline: false,
      isPartial: false,
      rawProviderPayload: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret ?? null,
        destinationAccountId: organisation.stripeAccountId,
      } as Prisma.InputJsonValue,
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentCollectionMethod: "PAYMENT_INTENT",
      },
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: summary.balance,
      currency: invoice.currency || "usd",
    };
  },

  async refundInvoicePayment(
    invoiceId: string,
    reason?: string,
  ): Promise<RefundInvoiceResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    const latestPaymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId,
        provider: "STRIPE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        providerPaymentIntentId: true,
      },
    });

    if (
      !invoice.payments.length &&
      !latestPaymentAttempt?.providerPaymentIntentId
    ) {
      throw new FinancePaymentError("Invoice has no refundable payment", 409);
    }

    const existingPayment = invoice.payments[0];
    const paymentIntentId =
      existingPayment?.providerPaymentId ??
      latestPaymentAttempt?.providerPaymentIntentId ??
      null;

    let payment = existingPayment ?? null;
    if (!payment) {
      if (!paymentIntentId) {
        throw new FinancePaymentError(
          "Invoice has no refundable payment intent",
          409,
        );
      }

      payment = await prisma.payment.create({
        data: {
          invoiceId,
          provider: "STRIPE",
          settlementChannel: "STRIPE",
          providerPaymentId: paymentIntentId,
          amount: invoice.totalAmount,
          currency: invoice.currency,
          status: "SUCCEEDED",
          paidAt: invoice.paidAt ?? new Date(),
          rawProviderPayload: {
            source: "finance.refundInvoicePayment",
            invoiceId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    let providerRefundId: string | null = null;
    let refundStatus = "succeeded";
    let amountRefunded = payment.amount;

    if (payment.provider === "STRIPE") {
      if (!paymentIntentId) {
        throw new FinancePaymentError(
          "Invoice has no Stripe payment intent to refund",
          409,
        );
      }

      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
      );

      const charge = paymentIntent?.latest_charge;
      const chargeId =
        typeof charge === "string" ? charge : (charge?.id ?? null);
      if (!chargeId) {
        throw new FinancePaymentError("No charge found for refund", 409);
      }

      const refund = await stripe.refunds.create({ charge: chargeId });

      providerRefundId = refund.id;
      refundStatus = refund.status;
      amountRefunded = roundMoney(refund.amount / 100);
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        provider: payment.provider,
        providerRefundId,
        amount: amountRefunded,
        currency: payment.currency,
        status: mapRefundStatus(refundStatus),
        reason: reason ?? undefined,
        rawProviderPayload: {
          source: "finance.refundInvoicePayment",
          invoiceId,
          paymentId: payment.id,
          providerRefundId,
          refundStatus,
        } as Prisma.InputJsonValue,
      },
    });

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        rawProviderPayload: {
          source: "finance.refundInvoicePayment",
          invoiceId,
          refundId: refund.id,
          providerRefundId,
        } as Prisma.InputJsonValue,
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: invoice.organisationId ?? null,
      eventType: "INVOICE_REFUNDED",
      entityType: "INVOICE",
      entityId: invoiceId,
      payload: {
        paymentId: payment.id,
        refundId: refund.id,
        providerRefundId,
        refundStatus,
        amountRefunded,
        reason: reason ?? null,
      },
      occurredAt: new Date(),
    });

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "REFUNDED",
        metadata: {
          ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
          cancellationReason: reason ?? undefined,
          refundId: providerRefundId ?? refund.id,
          amount: amountRefunded,
          refundDate: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
      include: { payments: true },
    });

    return {
      invoice: updatedInvoice,
      refund: {
        refundId: providerRefundId ?? refund.id,
        providerRefundId,
        status: refund.status,
        amountRefunded,
        paymentId: updatedPayment.id,
      },
    };
  },

  async refundPaymentIntent(
    paymentIntentId: string,
    reason?: string,
  ): Promise<RefundInvoiceResult> {
    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: { providerPaymentIntentId: paymentIntentId },
      select: { invoiceId: true },
    });

    if (!paymentAttempt) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    return this.refundInvoicePayment(paymentAttempt.invoiceId, reason);
  },

  async refundPaymentById(
    paymentId: string,
    input: { reason?: string; amount?: number } = {},
  ): Promise<RefundPaymentResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new FinancePaymentError("Payment not found", 404);
    }

    if (!payment.invoice) {
      throw new FinancePaymentError("Payment is missing invoice", 500);
    }

    const refundAmount = roundMoney(
      Math.min(input.amount ?? payment.amount, payment.amount),
    );

    if (refundAmount <= 0) {
      throw new FinancePaymentError(
        "Refund amount must be greater than zero",
        400,
      );
    }

    let providerRefundId: string | null = null;
    let refundStatus = "succeeded";

    if (payment.provider === "STRIPE") {
      const paymentIntentId = payment.providerPaymentId;
      if (!paymentIntentId) {
        throw new FinancePaymentError(
          "Payment has no Stripe payment intent to refund",
          409,
        );
      }

      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
      );
      const charge = paymentIntent?.latest_charge;
      const chargeId =
        typeof charge === "string" ? charge : (charge?.id ?? null);
      if (!chargeId) {
        throw new FinancePaymentError("No charge found for refund", 409);
      }

      const refund = await stripe.refunds.create({
        charge: chargeId,
        amount: Math.round(refundAmount * 100),
      });

      providerRefundId = refund.id;
      refundStatus = refund.status;
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        provider: payment.provider,
        providerRefundId,
        amount: refundAmount,
        currency: payment.currency,
        status: mapRefundStatus(refundStatus),
        reason: input.reason ?? undefined,
        rawProviderPayload: {
          source: "finance.refundPaymentById",
          paymentId: payment.id,
          providerRefundId,
          refundStatus,
          amount: refundAmount,
        } as Prisma.InputJsonValue,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:
          refundAmount >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: payment.invoice.organisationId ?? null,
      eventType: "PAYMENT_REFUNDED",
      entityType: "PAYMENT",
      entityId: payment.id,
      payload: {
        paymentId: payment.id,
        refundId: refund.id,
        providerRefundId,
        refundStatus,
        amountRefunded: refundAmount,
        reason: input.reason ?? null,
      },
      occurredAt: new Date(),
    });

    return {
      payment,
      refund: {
        refundId: providerRefundId ?? refund.id,
        providerRefundId,
        status: refund.status,
        amountRefunded: refundAmount,
        paymentId: payment.id,
      },
    };
  },

  async recordManualPayment(invoiceId: string, input: ManualPaymentInput = {}) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { status: "SUCCEEDED" } } },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    const { balance } = await getOutstandingBalance(
      invoiceId,
      invoice.totalAmount,
    );
    const amount = balance;
    return this.recordInvoicePayment(invoiceId, {
      provider: "MANUAL",
      amount,
      settlementChannel: input.settlementChannel ?? "CASH",
      receivedAt: input.receivedAt,
      reference: input.reference,
      rawProviderPayload: input.rawProviderPayload ?? undefined,
    });
  },

  async recordInvoicePayment(invoiceId: string, input: InvoicePaymentInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { status: "SUCCEEDED" } } },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    if (["CANCELLED", "REFUNDED"].includes(invoice.status)) {
      throw new FinancePaymentError("Invoice cannot accept payment", 409);
    }

    const { paid, balance } = await getOutstandingBalance(
      invoiceId,
      invoice.totalAmount,
    );

    if (balance <= 0) {
      return {
        invoice,
        paymentAttempt: null,
        payment: null,
        balanceAfterPayment: 0,
        paidToDate: paid,
        appliedAmount: 0,
      };
    }

    const requestedAmount = roundMoney(input.amount);
    if (requestedAmount <= 0) {
      throw new FinancePaymentError(
        "Payment amount must be greater than zero",
        400,
      );
    }

    const appliedAmount = roundMoney(Math.min(requestedAmount, balance));
    const receivedAt = input.receivedAt ?? new Date();
    const isPartial = appliedAmount < balance || paid > 0;

    const paymentAttempt = input.paymentAttemptId
      ? await prisma.paymentAttempt.update({
          where: { id: input.paymentAttemptId },
          data: {
            provider: input.provider,
            settlementChannel: input.settlementChannel ?? null,
            providerPaymentIntentId: input.providerPaymentId ?? null,
            status: "SUCCEEDED",
            amountRequested: requestedAmount,
            amountCaptured: appliedAmount,
            amountApplied: appliedAmount,
            currency: input.currency ?? invoice.currency,
            collectionMode: input.collectionMode ?? null,
            isOffline: input.provider === "MANUAL",
            isPartial,
            rawProviderPayload: input.rawProviderPayload ?? undefined,
          },
        })
      : await createPaymentAttempt(invoiceId, {
          provider: input.provider,
          status: "SUCCEEDED",
          settlementChannel: input.settlementChannel ?? null,
          amountRequested: requestedAmount,
          amountCaptured: appliedAmount,
          amountApplied: appliedAmount,
          currency: input.currency ?? invoice.currency,
          collectionMode: input.collectionMode ?? null,
          providerPaymentIntentId: input.providerPaymentId ?? null,
          isOffline: input.provider === "MANUAL",
          isPartial,
          rawProviderPayload: input.rawProviderPayload ?? null,
        });

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        paymentAttemptId: paymentAttempt.id,
        provider: input.provider,
        settlementChannel: input.settlementChannel ?? null,
        collectionMode: input.collectionMode ?? null,
        providerPaymentId: input.providerPaymentId ?? null,
        amount: appliedAmount,
        currency: input.currency ?? invoice.currency,
        status: "SUCCEEDED",
        paidAt: receivedAt,
        receiptUrl: input.reference ?? undefined,
        rawProviderPayload: input.rawProviderPayload ?? undefined,
      },
    });

    const isDepositPayment =
      input.collectionMode === "DEPOSIT_THEN_SETTLE" ||
      input.settlementChannel === "DEPOSIT" ||
      invoice.billingCollectionMode === "DEPOSIT_THEN_SETTLE";
    const nextDepositCollectedAmount = isDepositPayment
      ? roundMoney(
          invoice.depositTargetAmount > 0
            ? Math.min(
                (invoice.depositCollectedAmount ?? 0) + appliedAmount,
                invoice.depositTargetAmount,
              )
            : (invoice.depositCollectedAmount ?? 0) + appliedAmount,
        )
      : roundMoney(invoice.depositCollectedAmount ?? 0);

    const updatedInvoice =
      appliedAmount >= balance
        ? await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: "PAID",
              paidAt: receivedAt,
              visitBillingStage: "SETTLED",
              depositCollectedAmount: nextDepositCollectedAmount,
              ...(isDepositPayment
                ? {
                    billingCollectionMode: "DEPOSIT_THEN_SETTLE",
                  }
                : {}),
            },
          })
        : isDepositPayment
          ? await prisma.invoice.update({
              where: { id: invoiceId },
              data: {
                depositCollectedAmount: nextDepositCollectedAmount,
                billingCollectionMode: "DEPOSIT_THEN_SETTLE",
                visitBillingStage:
                  invoice.visitBillingStage === "SETTLED"
                    ? "SETTLED"
                    : "READY_FOR_BILLING",
              },
            })
          : invoice;

    await FinanceEventService.recordEvent({
      organisationId: invoice.organisationId ?? null,
      eventType: "PAYMENT_SUCCEEDED",
      entityType: "PAYMENT",
      entityId: payment.id,
      payload: {
        invoiceId,
        paymentId: payment.id,
        provider: input.provider,
        amount: appliedAmount,
        currency: input.currency ?? invoice.currency,
        settlementChannel: input.settlementChannel ?? null,
        collectionMode: input.collectionMode ?? null,
        isPartial,
      },
      occurredAt: receivedAt,
    });

    const summary = await getOutstandingBalance(
      invoiceId,
      updatedInvoice.totalAmount,
    );

    return {
      invoice: updatedInvoice,
      paymentAttempt,
      payment,
      balanceAfterPayment: summary.balance,
      paidToDate: summary.paid,
      appliedAmount,
    };
  },

  async handleInvoicePaymentIntentSucceeded(input: {
    invoiceId?: string | null;
    paymentIntentId: string;
    chargeId?: string | null;
    receiptUrl?: string | null;
    currency?: string | null;
    amount?: number | null;
    rawProviderPayload?: Prisma.InputJsonValue | null;
  }) {
    const invoice = input.invoiceId
      ? await prisma.invoice.findFirst({
          where: { id: input.invoiceId },
        })
      : input.paymentIntentId
        ? await findInvoiceByPaymentIntentId(input.paymentIntentId)
        : null;

    if (!invoice) {
      return { action: "NO_INVOICE" as const };
    }

    if (invoice.status === "PAID") {
      return { action: "ALREADY_PAID" as const, invoice };
    }

    if (invoice.paymentCollectionMethod === "PAYMENT_LINK") {
      return { action: "IGNORED" as const, invoice };
    }

    if (invoice.paymentCollectionMethod !== "PAYMENT_INTENT") {
      await this.refundPaymentIntent(input.paymentIntentId);
      return { action: "REFUNDED" as const, invoice };
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        providerPaymentIntentId: input.paymentIntentId,
      },
      select: { id: true },
    });

    const applied = await this.recordInvoicePayment(invoice.id, {
      provider: "STRIPE",
      amount: input.amount ?? invoice.totalAmount,
      currency: input.currency ?? invoice.currency,
      settlementChannel: "STRIPE",
      providerPaymentId: input.paymentIntentId,
      paymentAttemptId: paymentAttempt?.id ?? null,
      reference: input.receiptUrl ?? undefined,
      rawProviderPayload: input.rawProviderPayload ?? undefined,
    });

    return { action: "PAID" as const, ...applied };
  },

  async handleInvoiceCheckoutSessionCompleted(input: {
    invoiceId?: string | null;
    sessionId: string;
    paymentIntentId?: string | null;
    chargeId?: string | null;
    receiptUrl?: string | null;
    currency?: string | null;
    rawProviderPayload?: Prisma.InputJsonValue | null;
  }) {
    const invoice = input.invoiceId
      ? await prisma.invoice.findFirst({
          where: { id: input.invoiceId },
        })
      : await findInvoiceByCheckoutSessionId(input.sessionId);

    if (!invoice) {
      return { action: "NO_INVOICE" as const };
    }

    if (invoice.status === "PAID") {
      return { action: "ALREADY_PAID" as const, invoice };
    }

    if (invoice.paymentCollectionMethod !== "PAYMENT_LINK") {
      if (input.paymentIntentId) {
        await this.refundPaymentIntent(input.paymentIntentId);
        return { action: "REFUNDED" as const, invoice };
      }

      return { action: "IGNORED" as const, invoice };
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        providerCheckoutSessionId: input.sessionId,
      },
      select: { id: true },
    });

    const applied = await this.recordInvoicePayment(invoice.id, {
      provider: "STRIPE",
      amount: invoice.totalAmount,
      currency: input.currency ?? invoice.currency,
      settlementChannel: "STRIPE",
      providerPaymentId: input.paymentIntentId ?? null,
      paymentAttemptId: paymentAttempt?.id ?? null,
      reference: input.receiptUrl ?? undefined,
      rawProviderPayload: input.rawProviderPayload ?? undefined,
    });

    return { action: "PAID" as const, ...applied };
  },

  async markInvoiceRefundedFromWebhook(input: {
    invoiceId?: string | null;
    paymentIntentId?: string | null;
    chargeId?: string | null;
    amount: number;
    currency: string;
    reason?: string;
  }) {
    const invoice = input.invoiceId
      ? await prisma.invoice.findFirst({
          where: { id: input.invoiceId },
        })
      : input.paymentIntentId
        ? await findInvoiceByPaymentIntentId(input.paymentIntentId)
        : null;

    if (!invoice) {
      return { action: "NO_INVOICE" as const };
    }

    if (invoice.status === "REFUNDED") {
      return { action: "ALREADY_REFUNDED" as const, invoice };
    }

    const payment = await prisma.payment.findFirst({
      where: {
        invoiceId: invoice.id,
        ...(input.paymentIntentId
          ? { providerPaymentId: input.paymentIntentId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (payment) {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          provider: payment.provider,
          providerRefundId: input.chargeId ?? null,
          amount: input.amount,
          currency: input.currency,
          status: "SUCCEEDED",
          reason: input.reason ?? undefined,
          rawProviderPayload: {
            source: "finance.markInvoiceRefundedFromWebhook",
            invoiceId: invoice.id,
            paymentIntentId: input.paymentIntentId ?? null,
            chargeId: input.chargeId ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "REFUNDED",
        metadata: {
          ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
          refundId: input.chargeId ?? undefined,
          amount: input.amount,
          refundDate: new Date().toISOString(),
          cancellationReason: input.reason ?? undefined,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { action: "REFUNDED" as const, invoice: updated };
  },

  async handleInvoicePaymentFailed(input: {
    invoiceId?: string | null;
    appointmentId?: string | null;
    paymentIntentId?: string | null;
  }) {
    const invoice = input.invoiceId
      ? await prisma.invoice.findFirst({
          where: { id: input.invoiceId },
        })
      : input.paymentIntentId
        ? await findInvoiceByPaymentIntentId(input.paymentIntentId)
        : null;

    if (!invoice) {
      return { action: "NO_INVOICE" as const };
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "FAILED" },
    });

    await FinanceEventService.recordEvent({
      organisationId: invoice.organisationId ?? null,
      eventType: "PAYMENT_FAILED",
      entityType: "PAYMENT",
      entityId: input.paymentIntentId ?? invoice.id,
      payload: {
        invoiceId: invoice.id,
        appointmentId: input.appointmentId ?? null,
        paymentIntentId: input.paymentIntentId ?? null,
      },
    });

    return { action: "FAILED" as const, invoice };
  },

  async listPaymentsForInvoice(
    invoiceId: string,
  ): Promise<PaymentLineSummary[]> {
    const payments = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true, status: true },
    });

    return payments;
  },
};
