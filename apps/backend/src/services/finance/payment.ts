import { Prisma } from "@prisma/client";
import type {
  BillingCollectionMode as PrismaBillingCollectionMode,
  PaymentAttemptStatus as PrismaPaymentAttemptStatus,
  PaymentProvider as PrismaPaymentProvider,
  PaymentStatus as PrismaPaymentStatus,
  RefundStatus as PrismaRefundStatus,
  SettlementChannel as PrismaSettlementChannel,
  TaxBehavior as PrismaTaxBehavior,
} from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { FinanceEventService } from "./events";
import { roundMoney } from "./pricing";
import { markInvoiceTreatmentItemsSettled } from "./settlement";

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

const EMPTY_METADATA = {} as Record<string, unknown>;

export type StripeRequestOptions = { stripeAccount?: string };

type StripeCheckoutSessionClient = {
  checkout: {
    sessions: {
      create: (
        input: Record<string, unknown>,
        options?: StripeRequestOptions,
      ) => Promise<{
        id: string;
        url?: string | null;
      }>;
      expire: (
        sessionId: string,
        params?: Record<string, unknown>,
        options?: StripeRequestOptions,
      ) => Promise<{ id: string; status?: string | null }>;
    };
  };
  paymentIntents: {
    create: (
      input: Record<string, unknown>,
      options?: StripeRequestOptions,
    ) => Promise<{
      id: string;
      client_secret?: string | null;
    }>;
    retrieve: (
      paymentIntentId: string,
      params?: Record<string, unknown>,
      options?: StripeRequestOptions,
    ) => Promise<{ latest_charge?: { id: string } | string | null }>;
  };
  refunds: {
    create: (
      input: { charge: string; amount?: number },
      options?: StripeRequestOptions,
    ) => Promise<{
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

// Callers must state the tenant they act for: PMS routes bind by organisation,
// mobile routes by pet parent. Passing neither is a programming error, never a
// wildcard.
export type InvoiceAccessScope = {
  organisationId?: string | null;
  parentId?: string | null;
};

export const assertInvoiceInScope = (
  invoice: { organisationId: string | null; parentId: string | null },
  scope: InvoiceAccessScope,
) => {
  if (!scope.organisationId && !scope.parentId) {
    throw new FinancePaymentError("Invoice scope is required", 403);
  }

  if (scope.organisationId && invoice.organisationId !== scope.organisationId) {
    throw new FinancePaymentError("Invoice not found", 404);
  }

  if (scope.parentId && invoice.parentId !== scope.parentId) {
    throw new FinancePaymentError("Invoice not found", 404);
  }
};

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

export type RefundInvoicePaymentsResult = {
  invoice: NonNullable<
    Prisma.PaymentGetPayload<{
      include: { invoice: true };
    }>["invoice"]
  >;
  refunds: RefundInvoiceResult["refund"][];
  totalRefunded: number;
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
  connectedAccountId?: string | null;
  amount: number;
  currency: string;
};

type CreatePaymentIntentForInvoiceOptions = {
  collectionMode?: PrismaBillingCollectionMode | null;
  settlementChannel?: PrismaSettlementChannel | null;
};

export const getInvoiceFinancialSummary = async (
  invoiceId: string,
  totalAmount: number,
  depositCollectedAmount = 0,
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
  const effectivePaid = roundMoney(
    Math.max(paid, roundMoney(depositCollectedAmount)),
  );

  return {
    paid: effectivePaid,
    credited,
    balance: roundMoney(Math.max(0, totalAmount - effectivePaid - credited)),
  };
};

const getOutstandingBalance = async (
  invoiceId: string,
  totalAmount: number,
  depositCollectedAmount = 0,
) => {
  const summary = await getInvoiceFinancialSummary(
    invoiceId,
    totalAmount,
    depositCollectedAmount,
  );
  return {
    paid: summary.paid,
    balance: summary.balance,
  };
};

const applyCheckoutSessionTaxToInvoice = async (
  invoice: {
    id: string;
    currency: string;
    totalAmount: number;
    taxSnapshot?: { taxBehavior?: PrismaTaxBehavior | null } | null;
  },
  input: {
    sessionId: string;
    amountSubtotal?: number | null;
    amountTotal?: number | null;
    amountTax?: number | null;
    automaticTaxStatus?: string | null;
    rawProviderPayload?: Prisma.InputJsonValue | null;
  },
) => {
  const subtotal = roundMoney(input.amountSubtotal ?? invoice.totalAmount);
  const taxAmount = roundMoney(
    input.amountTax ??
      Math.max(
        0,
        roundMoney((input.amountTotal ?? invoice.totalAmount) - subtotal),
      ),
  );
  const totalAmount = roundMoney(input.amountTotal ?? subtotal + taxAmount);
  const taxPercent =
    subtotal > 0 ? roundMoney((taxAmount / subtotal) * 100) : 0;

  const sessionAmounts = {
    sessionId: input.sessionId,
    amountSubtotal: input.amountSubtotal ?? null,
    amountTotal: input.amountTotal ?? null,
    amountTax: input.amountTax ?? null,
    automaticTaxStatus: input.automaticTaxStatus ?? null,
  };

  const buildTaxSnapshotData = () => ({
    provider: "STRIPE" as const,
    providerReferenceId: input.sessionId,
    jurisdictionCountry: null,
    jurisdictionState: null,
    taxBehavior: invoice.taxSnapshot?.taxBehavior ?? null,
    taxableSubtotal: subtotal,
    taxAmount,
    taxBreakdown: {
      subtotal,
      taxableSubtotal: subtotal,
      taxTotal: taxAmount,
      totalAmount,
      ...sessionAmounts,
    },
    rawProviderPayload: input.rawProviderPayload ?? sessionAmounts,
    calculatedAt: new Date(),
  });

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      taxProvider: "STRIPE",
      subtotal,
      taxTotal: taxAmount,
      taxPercent,
      totalAmount,
      taxSnapshot: {
        upsert: {
          create: buildTaxSnapshotData(),
          update: buildTaxSnapshotData(),
        },
      },
    },
  });
};

// The writer half of the client, so a caller inside an interactive transaction
// can pass its `tx` and have these writes commit or roll back with the rest.
type PaymentTxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const createPaymentAttempt = async (
  invoiceId: string,
  input: PaymentAttemptInput,
  client: PaymentTxClient = prisma,
) =>
  client.paymentAttempt.create({
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

const updateInvoiceAfterPayment = async (params: {
  invoice: Prisma.InvoiceGetPayload<{
    include: { payments: { where: { status: "SUCCEEDED" } } };
  }>;
  invoiceId: string;
  appliedAmount: number;
  balance: number;
  receivedAt: Date;
  input: InvoicePaymentInput;
  client?: PaymentTxClient;
}) => {
  const {
    invoice,
    invoiceId,
    appliedAmount,
    balance,
    receivedAt,
    input,
    client = prisma,
  } = params;
  const isDepositPayment =
    input.collectionMode === "DEPOSIT_THEN_SETTLE" ||
    input.settlementChannel === "DEPOSIT" ||
    invoice.billingCollectionMode === "DEPOSIT_THEN_SETTLE";

  let nextDepositCollectedAmount = roundMoney(
    invoice.depositCollectedAmount ?? 0,
  );
  if (isDepositPayment) {
    const collectedWithPayment =
      (invoice.depositCollectedAmount ?? 0) + appliedAmount;
    nextDepositCollectedAmount = roundMoney(
      invoice.depositTargetAmount > 0
        ? Math.min(collectedWithPayment, invoice.depositTargetAmount)
        : collectedWithPayment,
    );
  }

  if (appliedAmount >= balance) {
    const settledInvoice = await client.invoice.update({
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
    });
    await markInvoiceTreatmentItemsSettled(
      invoice,
      invoiceId,
      receivedAt,
      client,
    );
    return settledInvoice;
  }

  if (isDepositPayment) {
    return client.invoice.update({
      where: { id: invoiceId },
      data: {
        depositCollectedAmount: nextDepositCollectedAmount,
        billingCollectionMode: "DEPOSIT_THEN_SETTLE",
      },
    });
  }

  return invoice;
};

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

const readConnectedAccountId = (payload?: Prisma.JsonValue | null) =>
  readString(readJsonRecord(payload).connectedAccountId);

const toStripeAccountOptions = (
  connectedAccountId: string | null,
): StripeRequestOptions =>
  connectedAccountId ? { stripeAccount: connectedAccountId } : {};

const resolveOrganisationStripeAccountId = async (
  organisationId?: string | null,
) => {
  if (!organisationId) return null;

  const organisation = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { stripeAccountId: true },
  });

  return organisation?.stripeAccountId ?? null;
};

// PaymentIntents and Checkout Sessions are created on the organisation's
// connected account, so every later call about them (retrieve/refund/expire)
// must be made against that same account or Stripe reports them as missing.
export const resolveStripeConnectedAccountId = async (params: {
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
}): Promise<string | null> => {
  const attemptFilter: Prisma.PaymentAttemptWhereInput = {
    ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}),
    ...(params.paymentIntentId
      ? { providerPaymentIntentId: params.paymentIntentId }
      : {}),
    ...(params.checkoutSessionId
      ? { providerCheckoutSessionId: params.checkoutSessionId }
      : {}),
  };

  if (Object.keys(attemptFilter).length === 0) {
    return null;
  }

  const attempt = await prisma.paymentAttempt.findFirst({
    where: attemptFilter,
    orderBy: { createdAt: "desc" },
    select: { invoiceId: true, rawProviderPayload: true },
  });

  const storedAccountId = readConnectedAccountId(attempt?.rawProviderPayload);
  if (storedAccountId) {
    return storedAccountId;
  }

  const invoiceId = params.invoiceId ?? attempt?.invoiceId ?? null;
  if (!invoiceId) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { organisationId: true },
  });

  return resolveOrganisationStripeAccountId(invoice?.organisationId);
};

const expireCheckoutSessionAtProvider = async (params: {
  invoiceId: string;
  sessionId: string;
  rawProviderPayload?: Prisma.JsonValue | null;
}) => {
  const connectedAccountId =
    readConnectedAccountId(params.rawProviderPayload) ??
    (await resolveStripeConnectedAccountId({
      invoiceId: params.invoiceId,
      checkoutSessionId: params.sessionId,
    }));

  try {
    await getStripeClient().checkout.sessions.expire(
      params.sessionId,
      {},
      toStripeAccountOptions(connectedAccountId),
    );
  } catch (error) {
    // Stripe rejects expiry for sessions it already expired or completed; the
    // local attempt is cancelled either way and the webhook rejects late pays.
    logger.warn("Failed to expire stale Stripe checkout session", {
      invoiceId: params.invoiceId,
      sessionId: params.sessionId,
      error,
    });
  }
};

const refundUnboundPaymentIntent = async (params: {
  paymentIntentId: string;
  connectedAccountId: string | null;
  invoiceId: string;
  context: Record<string, unknown>;
}) => {
  const requestOptions = toStripeAccountOptions(params.connectedAccountId);

  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(
      params.paymentIntentId,
      { expand: ["latest_charge"] },
      requestOptions,
    );

    const charge = paymentIntent?.latest_charge;
    const chargeId = typeof charge === "string" ? charge : (charge?.id ?? null);
    if (!chargeId) {
      logger.error("Cannot refund unbound payment intent: no charge found", {
        ...params.context,
        invoiceId: params.invoiceId,
        paymentIntentId: params.paymentIntentId,
      });
      return false;
    }

    await stripe.refunds.create({ charge: chargeId }, requestOptions);
    logger.warn("Refunded a captured payment with no active local attempt", {
      ...params.context,
      invoiceId: params.invoiceId,
      paymentIntentId: params.paymentIntentId,
    });
    return true;
  } catch (error) {
    logger.error("Failed to refund unbound payment intent", {
      ...params.context,
      invoiceId: params.invoiceId,
      paymentIntentId: params.paymentIntentId,
      error,
    });
    return false;
  }
};

const invoiceMatchesEventAccount = async (
  invoice: { id: string; organisationId: string | null },
  connectedAccountId: string | null,
) => {
  const expectedAccountId = await resolveOrganisationStripeAccountId(
    invoice.organisationId,
  );

  if (!expectedAccountId || expectedAccountId !== connectedAccountId) {
    logger.error(
      "Stripe event account does not match the invoice organisation",
      {
        invoiceId: invoice.id,
        organisationId: invoice.organisationId,
        expectedAccountId,
        eventAccountId: connectedAccountId,
      },
    );
    return false;
  }

  return true;
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

// Webhook payloads may name the invoice directly or only carry the provider's
// payment-intent reference; resolve whichever identifier is present.
const findInvoiceForPaymentEvent = async (input: {
  invoiceId?: string | null;
  paymentIntentId?: string | null;
}) => {
  if (input.invoiceId) {
    return prisma.invoice.findFirst({ where: { id: input.invoiceId } });
  }

  if (input.paymentIntentId) {
    return findInvoiceByPaymentIntentId(input.paymentIntentId);
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

type CheckoutLineItemSource = {
  name?: string;
  description?: string;
  total?: number;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
};

/**
 * Currencies Stripe treats as ZERO-DECIMAL: the API takes the amount in the
 * currency's own units, not in hundredths.
 *
 * Multiplying by 100 unconditionally overcharges every one of them by 100x -
 * a 1,000 JPY invoice would be submitted as 100,000 JPY. The currency became
 * configurable per invoice, so this is no longer hypothetical.
 *
 * https://docs.stripe.com/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** An amount in the smallest unit Stripe accepts for `currency`. */
const toStripeMinorUnits = (amount: number, currency: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency.trim().toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);

// Charge the full bill as itemised, pre-tax lines (letting Stripe apply tax)
// UNLESS we must charge a remaining/adjusted balance instead: when a prior
// payment or credit has been applied, or when an invoice-level adjustment makes
// the (discount-adjusted) item sum differ from the invoice's pre-tax total. In
// those cases we charge a single, tax-inclusive balance line with automatic tax
// disabled so the balance is never taxed twice. Comparing against the PRE-TAX
// total (not the balance) is what stops a plain tax line from dropping itemisation.
const buildCheckoutSessionLineItems = (params: {
  invoice: { id: string; totalAmount: number; taxTotal: number | null };
  items: unknown[];
  summary: InvoiceFinancialSummary;
  invoiceCurrency: string;
}) => {
  const { invoice, items, summary, invoiceCurrency } = params;

  const discountedItemSum = roundMoney(
    items.reduce((sum: number, item) => {
      const typed = item as CheckoutLineItemSource;
      if (typeof typed.total === "number") {
        return sum + typed.total;
      }
      const unitPrice =
        typeof typed.unitPrice === "number" ? typed.unitPrice : 0;
      const quantity = typeof typed.quantity === "number" ? typed.quantity : 0;
      const discountPercent =
        typeof typed.discountPercent === "number" ? typed.discountPercent : 0;
      return sum + unitPrice * quantity * (1 - discountPercent / 100);
    }, 0),
  );
  const preTaxInvoiceTotal = roundMoney(
    invoice.totalAmount -
      (typeof invoice.taxTotal === "number" ? invoice.taxTotal : 0),
  );
  const useBalanceLine =
    summary.paid > 0 ||
    summary.credited > 0 ||
    discountedItemSum !== preTaxInvoiceTotal;

  // Disabling automatic tax is only safe when the balance we are about to charge
  // ALREADY includes tax. An invoice whose tax was never calculated - drafts are
  // created with `skipTaxCalculation`, leaving `taxTotal` at 0 and `totalAmount`
  // at the discounted PRE-tax subtotal - takes the balance-line path as soon as
  // an invoice-level discount exists, and switching tax off there charges the
  // customer a pre-tax amount and then records the invoice paid at that
  // under-taxed total. So the balance line stays (it is what is actually owed),
  // but Stripe keeps calculating tax on it unless the invoice carries some.
  const balanceIncludesTax =
    typeof invoice.taxTotal === "number" && invoice.taxTotal > 0;
  const disableAutomaticTax = useBalanceLine && balanceIncludesTax;

  if (useBalanceLine) {
    return {
      useBalanceLine,
      disableAutomaticTax,
      lineItems: [
        {
          price_data: {
            currency: invoiceCurrency,
            product_data: {
              name: `Outstanding balance for invoice ${invoice.id}`,
            },
            unit_amount: toStripeMinorUnits(summary.balance, invoiceCurrency),
          },
          quantity: 1,
        },
      ],
    };
  }

  return {
    useBalanceLine,
    disableAutomaticTax,
    lineItems: items.map((item) => {
      const typed = item as CheckoutLineItemSource;
      const unitPrice =
        typeof typed.unitPrice === "number" ? typed.unitPrice : 0;
      const discountPercent =
        typeof typed.discountPercent === "number" ? typed.discountPercent : 0;
      const effectiveUnitAmount = toStripeMinorUnits(
        roundMoney(unitPrice * (1 - discountPercent / 100)),
        invoiceCurrency,
      );
      return {
        price_data: {
          currency: invoiceCurrency,
          product_data: {
            name: typed.name ?? typed.description ?? "Service",
            description: typed.description ?? undefined,
          },
          unit_amount: effectiveUnitAmount,
        },
        quantity:
          typeof typed.quantity === "number" && typed.quantity > 0
            ? typed.quantity
            : 1,
      };
    }),
  };
};

/**
 * Normalizes a caller-supplied deposit amount against the invoice balance.
 * Returns null when no deposit was asked for (charge the full balance), and
 * rejects an amount that is not a positive number or exceeds what is owed --
 * a "deposit" larger than the balance is a mistake, not a deposit.
 */
const resolveRequestedDepositAmount = (
  requested: number | null | undefined,
  balance: number,
): number | null => {
  if (requested === null || requested === undefined) return null;
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    throw new FinancePaymentError("Invalid deposit amount", 400);
  }
  const rounded = roundMoney(requested);
  if (rounded <= 0) {
    throw new FinancePaymentError("Deposit amount must be positive", 400);
  }
  if (rounded > balance) {
    throw new FinancePaymentError(
      "Deposit amount exceeds the outstanding balance",
      400,
    );
  }
  return rounded;
};

/**
 * A deposit is a part payment towards the invoice, not a sale of the invoice's
 * line items, so it is charged as a single line for the requested amount. Tax
 * stays with the final settlement, where the full taxable total is known --
 * calculating it again on the deposit would tax the same money twice.
 */
const buildDepositLineItem = (params: {
  invoice: { id: string };
  depositAmount: number;
  invoiceCurrency: string;
}) => ({
  useBalanceLine: true,
  disableAutomaticTax: true,
  lineItems: [
    {
      price_data: {
        currency: params.invoiceCurrency,
        product_data: {
          name: `Deposit for invoice ${params.invoice.id}`,
        },
        unit_amount: toStripeMinorUnits(
          params.depositAmount,
          params.invoiceCurrency,
        ),
      },
      quantity: 1,
    },
  ],
});

// A PAYMENT_LINK invoice switching to an in-app PaymentIntent must first
// retire its open Checkout Sessions so the same balance cannot be paid twice.
/**
 * Expire every open Stripe checkout session for an invoice at the provider,
 * then cancel the local attempts.
 *
 * Exported because cancelling the local row alone is not enough: a link already
 * in the client's hands keeps resolving at Stripe and still charges the old
 * amount, and the local attempt is by then CANCELED so the webhook has no open
 * attempt to reconcile against. Provider expiry failures are logged and
 * swallowed - Stripe rejects expiry for sessions it has already expired or
 * completed, and the local cancel stands either way.
 */
export const cancelOpenCheckoutSessionAttempts = async (invoiceId: string) => {
  const staleSessionAttempts = await prisma.paymentAttempt.findMany({
    where: {
      invoiceId,
      provider: "STRIPE",
      providerCheckoutSessionId: { not: null },
      status: { notIn: ["CANCELED", "FAILED", "SUCCEEDED"] },
    },
    select: {
      id: true,
      providerCheckoutSessionId: true,
      rawProviderPayload: true,
    },
  });

  for (const staleAttempt of staleSessionAttempts) {
    if (!staleAttempt.providerCheckoutSessionId) continue;
    await expireCheckoutSessionAtProvider({
      invoiceId,
      sessionId: staleAttempt.providerCheckoutSessionId,
      rawProviderPayload: staleAttempt.rawProviderPayload,
    });
  }

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
};

// Reuse the latest open PaymentIntent attempt when it still matches the
// outstanding balance; otherwise cancel it so a fresh intent can be issued.
// Same shape as the helpers in stripe.service.ts and invoice.service.ts.
const isUniqueConstraintViolation = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

const reuseOrCancelExistingPaymentIntentAttempt = async (
  invoiceId: string,
  invoice: {
    totalAmount: number;
    depositCollectedAmount: number | null;
    currency: string;
  },
): Promise<PaymentIntentResult | null> => {
  const existingPaymentIntentAttempt = await prisma.paymentAttempt.findFirst({
    where: {
      invoiceId,
      provider: "STRIPE",
      providerPaymentIntentId: { not: null },
      status: { notIn: ["SUCCEEDED", "CANCELED"] },
    },
    select: {
      id: true,
      amountRequested: true,
      providerPaymentIntentId: true,
      rawProviderPayload: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existingPaymentIntentAttempt?.providerPaymentIntentId) {
    return null;
  }

  const summary = await getInvoiceFinancialSummary(
    invoiceId,
    invoice.totalAmount,
    invoice.depositCollectedAmount ?? 0,
  );
  if (
    roundMoney(existingPaymentIntentAttempt.amountRequested ?? 0) ===
    summary.balance
  ) {
    const rawProviderPayload = readJsonRecord(
      existingPaymentIntentAttempt.rawProviderPayload,
    );
    return {
      paymentIntentId: existingPaymentIntentAttempt.providerPaymentIntentId,
      clientSecret:
        typeof rawProviderPayload.clientSecret === "string"
          ? rawProviderPayload.clientSecret
          : null,
      connectedAccountId:
        typeof rawProviderPayload.connectedAccountId === "string"
          ? rawProviderPayload.connectedAccountId
          : null,
      amount: summary.balance,
      currency: invoice.currency,
    };
  }

  await prisma.paymentAttempt.update({
    where: { id: existingPaymentIntentAttempt.id },
    data: { status: "CANCELED" },
  });
  return null;
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

/**
 * Load the invoice a checkout session is being opened for, rejecting every state
 * in which one must not be created. Split out so the session builder itself
 * reads as the sequence of steps it is, rather than guards interleaved with work.
 */
const loadCheckoutEligibleInvoice = async (
  invoiceId: string,
  provider?: PrismaPaymentProvider | null,
) => {
  if (provider && provider !== "STRIPE") {
    throw new FinancePaymentError("Unsupported payment provider", 400);
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
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
      status: { not: "CANCELED" },
    },
    select: { id: true },
  });
  if (existingPaymentIntentAttempt) {
    throw new FinancePaymentError("Invoice already has a PaymentIntent", 409);
  }

  return invoice;
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
    /**
     * Deposit amount in major units. When supplied, the session charges this
     * amount instead of the full outstanding balance. Without it a "collect a
     * deposit" flow produced a link for the whole invoice while the UI called
     * it a deposit link.
     */
    requestedDepositAmount?: number | null,
  ): Promise<CheckoutSessionResult> {
    const invoice = await loadCheckoutEligibleInvoice(invoiceId, provider);

    const existingCheckoutAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId,
        provider: "STRIPE",
        providerCheckoutSessionId: { not: null },
        status: { not: "CANCELED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountRequested: true,
        providerCheckoutSessionId: true,
        rawProviderPayload: true,
      },
    });

    if (!invoice.organisationId) {
      throw new FinancePaymentError("Invoice missing organisation", 500);
    }

    const summary = await getInvoiceFinancialSummary(
      invoiceId,
      invoice.totalAmount,
      invoice.depositCollectedAmount ?? 0,
    );
    if (summary.balance <= 0) {
      throw new FinancePaymentError("Invoice has no outstanding balance", 409);
    }

    const depositAmount = resolveRequestedDepositAmount(
      requestedDepositAmount,
      summary.balance,
    );
    // What this session will actually charge: the deposit when one was asked
    // for, the whole balance otherwise.
    const amountToCharge = depositAmount ?? summary.balance;

    if (existingCheckoutAttempt?.providerCheckoutSessionId) {
      const requestedAmount = roundMoney(
        existingCheckoutAttempt.amountRequested ?? 0,
      );
      if (requestedAmount === amountToCharge) {
        return {
          sessionId: existingCheckoutAttempt.providerCheckoutSessionId,
          url: getCheckoutSessionUrl(existingCheckoutAttempt),
          paymentAttemptId: existingCheckoutAttempt.id,
        };
      }

      await expireCheckoutSessionAtProvider({
        invoiceId,
        sessionId: existingCheckoutAttempt.providerCheckoutSessionId,
        rawProviderPayload: existingCheckoutAttempt.rawProviderPayload,
      });

      await prisma.paymentAttempt.update({
        where: { id: existingCheckoutAttempt.id },
        data: {
          status: "CANCELED",
        },
      });
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

    const { disableAutomaticTax, lineItems } =
      depositAmount === null
        ? buildCheckoutSessionLineItems({
            invoice,
            items,
            summary,
            invoiceCurrency,
          })
        : buildDepositLineItem({
            invoice,
            depositAmount,
            invoiceCurrency,
          });

    const stripe = getStripeClient();
    const expiresAt = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        automatic_tax: {
          enabled: !disableAutomaticTax,
        },
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
        },
        success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        expires_at: expiresAt,
      },
      {
        stripeAccount: organisation.stripeAccountId,
      },
    );

    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        invoiceId,
        provider: "STRIPE",
        settlementChannel: "STRIPE",
        providerCheckoutSessionId: session.id,
        status: "REQUIRES_ACTION",
        amountRequested: amountToCharge,
        amountCaptured: 0,
        amountApplied: 0,
        currency: invoiceCurrency,
        collectionMode: depositAmount === null ? null : "DEPOSIT_THEN_SETTLE",
        isOffline: false,
        isPartial: depositAmount !== null && depositAmount < summary.balance,
        rawProviderPayload: {
          sessionId: session.id,
          url: session.url ?? null,
          connectedAccountId: organisation.stripeAccountId,
        },
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
    scope: InvoiceAccessScope,
    options: CreatePaymentIntentForInvoiceOptions = {},
  ): Promise<PaymentIntentResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new FinancePaymentError("Invoice not found", 404);
    }

    assertInvoiceInScope(invoice, scope);

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
      await cancelOpenCheckoutSessionAttempts(invoiceId);
    }

    const reusedPaymentIntent = await reuseOrCancelExistingPaymentIntentAttempt(
      invoiceId,
      invoice,
    );
    if (reusedPaymentIntent) {
      return reusedPaymentIntent;
    }

    const summary = await getInvoiceFinancialSummary(
      invoiceId,
      invoice.totalAmount,
      invoice.depositCollectedAmount ?? 0,
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
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: toStripeMinorUnits(summary.balance, invoice.currency || "usd"),
        currency: invoice.currency || "usd",
        metadata: {
          type: "INVOICE_PAYMENT",
          invoiceId,
          appointmentId: invoice.appointmentId || "",
          organisationId: invoice.organisationId ?? "",
          parentId: invoice.parentId ?? "",
          patientId: invoice.patientId ?? "",
          collectionMode: options.collectionMode ?? "",
          settlementChannel: options.settlementChannel ?? "",
        },
        description: `Payment for Invoice ${invoiceId}`,
      },
      {
        stripeAccount: organisation.stripeAccountId,
      },
    );

    await createPaymentAttempt(invoiceId, {
      provider: "STRIPE",
      status: "REQUIRES_ACTION",
      settlementChannel: options.settlementChannel ?? "STRIPE",
      providerPaymentIntentId: paymentIntent.id,
      amountRequested: summary.balance,
      amountCaptured: 0,
      amountApplied: 0,
      currency: invoice.currency || "usd",
      collectionMode: options.collectionMode ?? null,
      isOffline: false,
      isPartial: false,
      rawProviderPayload: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret ?? null,
        connectedAccountId: organisation.stripeAccountId,
        collectionMode: options.collectionMode ?? null,
        settlementChannel: options.settlementChannel ?? null,
      },
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
      connectedAccountId: organisation.stripeAccountId,
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
          },
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

      const connectedAccountId = await resolveStripeConnectedAccountId({
        invoiceId,
        paymentIntentId,
      });
      const requestOptions = toStripeAccountOptions(connectedAccountId);

      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
        requestOptions,
      );

      const charge = paymentIntent?.latest_charge;
      const chargeId =
        typeof charge === "string" ? charge : (charge?.id ?? null);
      if (!chargeId) {
        throw new FinancePaymentError("No charge found for refund", 409);
      }

      const refund = await stripe.refunds.create(
        { charge: chargeId },
        requestOptions,
      );

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
        },
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
        },
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
          ...((invoice.metadata as Record<string, unknown> | null) ??
            EMPTY_METADATA),
          cancellationReason: reason ?? undefined,
          refundId: providerRefundId ?? refund.id,
          amount: amountRefunded,
          refundDate: new Date().toISOString(),
        },
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

  async refundInvoicePayments(
    invoiceId: string,
    reason?: string,
  ): Promise<RefundInvoicePaymentsResult> {
    const payments = await prisma.payment.findMany({
      where: {
        invoiceId,
        status: "SUCCEEDED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true },
    });

    if (!payments.length) {
      throw new FinancePaymentError("Invoice has no refundable payment", 409);
    }

    const refunds: RefundInvoiceResult["refund"][] = [];
    let invoice: RefundInvoicePaymentsResult["invoice"] | null = null;

    for (const payment of payments) {
      const result = await this.refundPaymentById(payment.id, {
        reason,
        amount: payment.amount,
      });
      refunds.push(result.refund);
      invoice = result.payment.invoice;
    }

    if (!invoice) {
      throw new FinancePaymentError("Invoice has no refundable payment", 409);
    }

    return {
      invoice,
      refunds,
      totalRefunded: roundMoney(
        refunds.reduce((sum, refund) => sum + refund.amountRefunded, 0),
      ),
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

      const connectedAccountId = await resolveStripeConnectedAccountId({
        invoiceId: payment.invoiceId,
        paymentIntentId,
      });
      const requestOptions = toStripeAccountOptions(connectedAccountId);

      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
        requestOptions,
      );
      const charge = paymentIntent?.latest_charge;
      const chargeId =
        typeof charge === "string" ? charge : (charge?.id ?? null);
      if (!chargeId) {
        throw new FinancePaymentError("No charge found for refund", 409);
      }

      const refund = await stripe.refunds.create(
        {
          charge: chargeId,
          amount: toStripeMinorUnits(
            refundAmount,
            payment.currency ?? payment.invoice.currency ?? "usd",
          ),
        },
        requestOptions,
      );

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
        },
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
      invoice.depositCollectedAmount ?? 0,
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

    const isDepositPayment =
      input.collectionMode === "DEPOSIT_THEN_SETTLE" ||
      input.settlementChannel === "DEPOSIT" ||
      invoice.billingCollectionMode === "DEPOSIT_THEN_SETTLE";

    if (isDepositPayment && invoice.visitBillingStage === "READY_FOR_BILLING") {
      throw new FinancePaymentError(
        "Deposit payments are not allowed after the invoice is ready for billing",
        409,
      );
    }

    const { paid, balance } = await getOutstandingBalance(
      invoiceId,
      invoice.totalAmount,
      invoice.depositCollectedAmount ?? 0,
    );

    if (balance <= 0) {
      return {
        invoice,
        paymentAttempt: null,
        payment: null,
        balanceAfterPayment: 0,
        paidToDate: paid,
        appliedAmount: 0,
        // Nothing was applied, so this is not a fresh success either. A caller
        // that notifies the pet parent must not fire for a redelivery that
        // arrives after the balance is already closed.
        replayed: true,
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

    // The attempt write, the Payment insert and the invoice update move
    // together or not at all.
    //
    // They used to be three sequential awaits, which is what made every replay
    // guard here unsound: a P2002 on Payment.paymentAttemptId proved the payment
    // row existed and nothing else, so a delivery that died between the insert
    // and the invoice update left a covered invoice that was never marked PAID,
    // and a deposit whose collected amount never moved. No amount of reasoning
    // on the recovery path can distinguish that from a clean replay, because the
    // database does not record which of the three steps ran.
    //
    // FinanceEventService.recordEvent stays outside deliberately: it closes over
    // the module-level client, so calling it in here would run on a second
    // connection against rows this transaction still holds.
    let settled;
    try {
      settled = await prisma.$transaction(async (tx) => {
        const paymentAttempt = input.paymentAttemptId
          ? await tx.paymentAttempt.update({
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
          : await createPaymentAttempt(
              invoiceId,
              {
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
              },
              tx,
            );

        const payment = await tx.payment.create({
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

        const updatedInvoice = await updateInvoiceAfterPayment({
          invoice,
          invoiceId,
          appliedAmount,
          balance,
          receivedAt,
          input,
          client: tx,
        });

        return { paymentAttempt, payment, updatedInvoice };
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error) || !input.paymentAttemptId) {
        throw error;
      }

      // A Payment already exists for this attempt, so the event is a redelivery.
      // Because the block above is atomic, that row existing now genuinely does
      // imply the invoice moved with it, which is what makes simply returning
      // what is recorded a safe answer rather than an assumption.
      const existingPayment = await prisma.payment.findUnique({
        where: { paymentAttemptId: input.paymentAttemptId },
      });
      if (!existingPayment) throw error;

      const currentInvoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      const replaySummary = await getOutstandingBalance(
        invoiceId,
        currentInvoice.totalAmount,
        currentInvoice.depositCollectedAmount ?? 0,
      );

      logger.info(
        `Payment for attempt ${input.paymentAttemptId.replace(/[\n\r]+/g, " ")} was already recorded; treating this delivery as a replay`,
      );

      return {
        invoice: currentInvoice,
        paymentAttempt: null,
        payment: existingPayment,
        balanceAfterPayment: replaySummary.balance,
        paidToDate: replaySummary.paid,
        // Nothing new was applied, so a caller accumulating this must not count
        // the same money twice, and one that notifies the pet parent must not
        // tell them twice that the same payment succeeded.
        appliedAmount: 0,
        replayed: true,
      };
    }

    const { paymentAttempt, payment, updatedInvoice } = settled;

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
      updatedInvoice.depositCollectedAmount ?? 0,
    );

    return {
      invoice: updatedInvoice,
      paymentAttempt,
      payment,
      balanceAfterPayment: summary.balance,
      paidToDate: summary.paid,
      appliedAmount,
      replayed: false,
    };
  },

  async handleInvoicePaymentIntentSucceeded(input: {
    invoiceId?: string | null;
    paymentIntentId: string;
    chargeId?: string | null;
    receiptUrl?: string | null;
    currency?: string | null;
    amount?: number | null;
    connectedAccountId?: string | null;
    // The appointment-booking webhook creates the invoice itself, so no local
    // attempt can exist before the event arrives; that flow binds on the
    // connected account and the captured amount instead.
    allowUnboundAttempt?: boolean;
    rawProviderPayload?: Prisma.InputJsonValue | null;
  }) {
    const invoice = await findInvoiceForPaymentEvent(input);

    if (!invoice) {
      return { action: "NO_INVOICE" as const };
    }

    if (invoice.status === "PAID") {
      return { action: "ALREADY_PAID" as const, invoice };
    }

    if (
      !(await invoiceMatchesEventAccount(
        invoice,
        input.connectedAccountId ?? null,
      ))
    ) {
      return { action: "ACCOUNT_MISMATCH" as const, invoice };
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        providerPaymentIntentId: input.paymentIntentId,
        status: { notIn: ["CANCELED", "FAILED"] },
      },
      select: { id: true, collectionMode: true, settlementChannel: true },
    });

    if (!paymentAttempt && !input.allowUnboundAttempt) {
      // A checkout-session invoice settles from the session event; the twin
      // payment_intent event carries no attempt of its own.
      if (invoice.paymentCollectionMethod === "PAYMENT_LINK") {
        return { action: "IGNORED" as const, invoice };
      }

      await refundUnboundPaymentIntent({
        paymentIntentId: input.paymentIntentId,
        connectedAccountId: input.connectedAccountId ?? null,
        invoiceId: invoice.id,
        context: { source: "handleInvoicePaymentIntentSucceeded" },
      });
      return { action: "REFUNDED" as const, invoice };
    }

    const capturedAmount = roundMoney(input.amount ?? 0);
    if (capturedAmount <= 0) {
      logger.error("Stripe payment intent reported no captured amount", {
        invoiceId: invoice.id,
        paymentIntentId: input.paymentIntentId,
      });
      return { action: "MISSING_AMOUNT" as const, invoice };
    }

    const applied = await this.recordInvoicePayment(invoice.id, {
      provider: "STRIPE",
      amount: capturedAmount,
      currency: input.currency ?? invoice.currency,
      settlementChannel: paymentAttempt?.settlementChannel ?? "STRIPE",
      collectionMode: paymentAttempt?.collectionMode ?? null,
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
    amountSubtotal?: number | null;
    amountTotal?: number | null;
    amountTax?: number | null;
    automaticTaxStatus?: string | null;
    connectedAccountId?: string | null;
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

    if (
      !(await invoiceMatchesEventAccount(
        invoice,
        input.connectedAccountId ?? null,
      ))
    ) {
      return { action: "ACCOUNT_MISMATCH" as const, invoice };
    }

    const refundUnbound = async (context: string) => {
      if (!input.paymentIntentId) {
        return { action: "IGNORED" as const, invoice };
      }

      await refundUnboundPaymentIntent({
        paymentIntentId: input.paymentIntentId,
        connectedAccountId: input.connectedAccountId ?? null,
        invoiceId: invoice.id,
        context: { source: context, sessionId: input.sessionId },
      });
      return { action: "REFUNDED" as const, invoice };
    };

    if (invoice.paymentCollectionMethod !== "PAYMENT_LINK") {
      return refundUnbound(
        "handleInvoiceCheckoutSessionCompleted.notPaymentLink",
      );
    }

    const paymentAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        providerCheckoutSessionId: input.sessionId,
        status: { notIn: ["CANCELED", "FAILED"] },
      },
      select: { id: true, collectionMode: true, isPartial: true },
    });

    // Guards the tax overwrite below: a stale session must never rewrite the
    // totals of an invoice that was edited after the session was issued.
    if (!paymentAttempt) {
      return refundUnbound(
        "handleInvoiceCheckoutSessionCompleted.staleSession",
      );
    }

    const capturedAmount = roundMoney(input.amountTotal ?? 0);
    if (capturedAmount <= 0) {
      logger.error("Stripe checkout session reported no captured total", {
        invoiceId: invoice.id,
        sessionId: input.sessionId,
      });
      return { action: "MISSING_AMOUNT" as const, invoice };
    }

    // A deposit session is billed for part of the invoice, so its totals
    // describe the deposit and not the invoice. Writing them over the invoice
    // would shrink the invoice total to the deposit, and the deposit would then
    // settle it in full. The invoice keeps the tax it was raised with; only a
    // session billed for the whole balance may restate it.
    const isDepositAttempt =
      paymentAttempt.collectionMode === "DEPOSIT_THEN_SETTLE" ||
      paymentAttempt.isPartial;

    const invoiceWithTax = isDepositAttempt
      ? invoice
      : await applyCheckoutSessionTaxToInvoice(invoice, {
          sessionId: input.sessionId,
          amountSubtotal: input.amountSubtotal,
          amountTotal: input.amountTotal,
          amountTax: input.amountTax,
          automaticTaxStatus: input.automaticTaxStatus,
          rawProviderPayload: input.rawProviderPayload ?? undefined,
        });

    const applied = await this.recordInvoicePayment(invoice.id, {
      provider: "STRIPE",
      amount: capturedAmount,
      currency: input.currency ?? invoiceWithTax.currency,
      settlementChannel: "STRIPE",
      // Without this the deposit is booked as an ordinary payment, so it never
      // lands in depositCollectedAmount and the invoice loses the fact that a
      // balance is still owed after it.
      collectionMode: isDepositAttempt ? "DEPOSIT_THEN_SETTLE" : null,
      providerPaymentId: input.paymentIntentId ?? null,
      paymentAttemptId: paymentAttempt?.id ?? null,
      reference: input.receiptUrl ?? undefined,
      rawProviderPayload: input.rawProviderPayload ?? {
        sessionId: input.sessionId,
        amountSubtotal: input.amountSubtotal ?? null,
        amountTotal: input.amountTotal ?? null,
        amountTax: input.amountTax ?? null,
        automaticTaxStatus: input.automaticTaxStatus ?? null,
      },
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
    const invoice = await findInvoiceForPaymentEvent(input);

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
          },
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
          ...((invoice.metadata as Record<string, unknown> | null) ??
            EMPTY_METADATA),
          refundId: input.chargeId ?? undefined,
          amount: input.amount,
          refundDate: new Date().toISOString(),
          cancellationReason: input.reason ?? undefined,
        },
      },
    });

    return { action: "REFUNDED" as const, invoice: updated };
  },

  async handleInvoicePaymentFailed(input: {
    invoiceId?: string | null;
    appointmentId?: string | null;
    paymentIntentId?: string | null;
  }) {
    const invoice = await findInvoiceForPaymentEvent(input);

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
