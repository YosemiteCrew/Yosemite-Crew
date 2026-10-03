import { Prisma } from "@prisma/client";
import moment from "moment-timezone";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import { roundMoney } from "src/services/finance/pricing";
import { resolvePracticeTimeZone } from "src/services/finance/client-collections";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STATEMENT_ROWS = 10_000;
const INCLUDED_PAYMENT_STATUSES = [
  "SUCCEEDED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type ClientStatementEntry = {
  id: string;
  invoiceId: string;
  occurredAt: string;
  kind:
    | "INVOICE"
    | "PAYMENT"
    | "REFUND"
    | "CREDIT_NOTE"
    | "CREDIT_NOTE_VOID"
    | "RECEIPT"
    | "RECEIPT_REFUND"
    | "CREDIT_ALLOCATION"
    | "CREDIT_ALLOCATION_REFUND"
    | "DEPOSIT";
  direction: "DEBIT" | "CREDIT";
  amount: number;
};

export type ClientStatementAging = {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days91Plus: number;
  totalOutstanding: number;
};

export type ClientStatementCurrency = {
  currency: string;
  openingBalance: number;
  closingBalance: number;
  entries: ClientStatementEntry[];
  aging: ClientStatementAging;
};

export type ClientStatementSnapshot = {
  version: 1;
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
  period: { start: string; end: string };
  generatedAt: string;
  currencies: ClientStatementCurrency[];
};

type StatementPayment = {
  id: string;
  provider?: string;
  providerPaymentId?: string | null;
  receiptId?: string;
  amount: number;
  currency?: string;
  paidAt: Date | null;
  createdAt: Date;
  refunds: Array<{
    id: string;
    amount: number;
    currency?: string;
    createdAt: Date;
  }>;
};

type StatementDeposit = { id: string; amount: number; occurredAt: Date };

export type StatementReceipt = {
  id: string;
  invoiceId: string;
  currency: string;
  amount: number;
  allocatedAmount: number;
  refundedAmount: number;
  undatedRefundAmount?: number;
  capturedAt: Date;
  refunds: Array<{
    id: string;
    cumulativeAmount: number;
    amount?: number | null;
    currency: string;
    occurredAt: Date;
  }>;
};

export type StatementInvoice = {
  id: string;
  currency: string;
  totalAmount: number;
  depositCollectedAmount: number;
  finalizedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  payments: StatementPayment[];
  deposits?: StatementDeposit[];
  revisions?: Array<{
    id: bigint;
    totalAmount: number;
    currency: string;
    status: string;
    dueAt: Date | null;
    recordedAt: Date;
    baseline: boolean;
  }>;
  creditNotes: Array<{
    id: string;
    amount: number;
    createdAt: Date;
    voidedAt?: Date | null;
  }>;
};

type Movement = ClientStatementEntry & {
  at: Date;
  currency: string;
  openingOnly: boolean;
  signedAmount: number;
};

type CurrencyAccumulator = {
  currency: string;
  movements: Movement[];
  invoices: Array<{ dueAt: Date; balance: number }>;
};

export class ClientStatementError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClientStatementError";
  }
}

const currencyKey = (currency: string): string => currency.trim().toLowerCase();

const invoiceCurrencyAt = (invoice: StatementInvoice, at: Date): string => {
  const revision = invoice.revisions
    ?.filter((version) => version.recordedAt <= at)
    .sort((left, right) => (left.id > right.id ? -1 : 1))[0];
  return currencyKey(revision?.currency ?? invoice.currency);
};

const quantize = (currency: string, value: number): number =>
  roundMoney(value, currency);

const add = (currency: string, left: number, right: number): number =>
  quantize(currency, left + right);

const toEntry = (entry: Movement): ClientStatementEntry => ({
  id: entry.id,
  invoiceId: entry.invoiceId,
  occurredAt: entry.occurredAt,
  kind: entry.kind,
  direction: entry.direction,
  amount: entry.amount,
});

const movement = (input: {
  id: string;
  invoiceId: string;
  at: Date;
  kind: ClientStatementEntry["kind"];
  direction: ClientStatementEntry["direction"];
  amount: number;
  currency: string;
  openingOnly?: boolean;
}): Movement => {
  const amount = quantize(input.currency, input.amount);
  return {
    id: input.id,
    invoiceId: input.invoiceId,
    occurredAt: input.at.toISOString(),
    kind: input.kind,
    direction: input.direction,
    amount,
    at: input.at,
    currency: currencyKey(input.currency),
    openingOnly: input.openingOnly ?? false,
    signedAmount: input.direction === "DEBIT" ? amount : -amount,
  };
};

const incompleteInvoiceHistory = () =>
  new ClientStatementError(
    "An invoice is missing its dated charge history.",
    409,
  );

const invoiceRevisionsThrough = (
  versions: NonNullable<StatementInvoice["revisions"]>,
  createdAt: Date,
  periodStart: Date,
  periodEnd: Date,
) => {
  const revisions = [...versions].sort((left, right) =>
    left.id < right.id ? -1 : 1,
  );
  const first = revisions[0];
  if (
    !first ||
    (first.baseline && periodStart < first.recordedAt) ||
    (createdAt <= periodEnd && first.recordedAt > periodEnd)
  ) {
    throw incompleteInvoiceHistory();
  }
  return revisions.filter((revision) => revision.recordedAt <= periodEnd);
};

const buildInvoiceCharges = (
  invoice: StatementInvoice,
  periodStart: Date,
  periodEnd: Date,
): { movements: Movement[]; dueDates: Map<string, Date> } => {
  const currency = currencyKey(invoice.currency);
  const chargedAt = invoice.finalizedAt ?? invoice.createdAt;
  if (!invoice.revisions) {
    return {
      movements: [
        movement({
          id: `invoice:${invoice.id}`,
          invoiceId: invoice.id,
          at: chargedAt,
          kind: "INVOICE",
          direction: "DEBIT",
          amount: invoice.totalAmount,
          currency,
        }),
      ],
      dueDates: new Map([[currency, invoice.dueAt ?? chargedAt]]),
    };
  }
  const revisions = invoiceRevisionsThrough(
    invoice.revisions,
    invoice.createdAt,
    periodStart,
    periodEnd,
  );
  const movements: Movement[] = [];
  const dueDates = new Map<string, Date>();
  let previousCurrency = currency;
  let previousAmount = 0;
  for (const revision of revisions) {
    const nextCurrency = currencyKey(revision.currency);
    if (nextCurrency !== previousCurrency && previousAmount !== 0) {
      movements.push(
        movement({
          id: `invoice:${invoice.id}:revision:${revision.id}:previous`,
          invoiceId: invoice.id,
          at: revision.recordedAt,
          kind: "INVOICE",
          direction: "CREDIT",
          amount: previousAmount,
          currency: previousCurrency,
        }),
      );
      previousAmount = 0;
    }
    const amount =
      revision.status === "CANCELLED"
        ? 0
        : quantize(nextCurrency, revision.totalAmount);
    const difference = add(nextCurrency, amount, -previousAmount);
    if (difference !== 0) {
      movements.push(
        movement({
          id: `invoice:${invoice.id}:revision:${revision.id}`,
          invoiceId: invoice.id,
          at: revision.recordedAt,
          kind: "INVOICE",
          direction: difference < 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(difference),
          currency: nextCurrency,
          openingOnly: revision.baseline,
        }),
      );
    }
    dueDates.set(nextCurrency, revision.dueAt ?? revision.recordedAt);
    previousAmount = amount;
    previousCurrency = nextCurrency;
  }
  return { movements, dueDates };
};

const buildInvoiceMovements = (
  invoice: StatementInvoice,
  periodStart: Date,
  periodEnd: Date,
): { movements: Movement[]; dueDates: Map<string, Date> } => {
  const currency = currencyKey(invoice.currency);
  const { movements, dueDates } = buildInvoiceCharges(
    invoice,
    periodStart,
    periodEnd,
  );
  for (const payment of invoice.payments) {
    const paymentAt = payment.paidAt ?? payment.createdAt;
    const paymentCurrency = payment.currency ?? currency;
    movements.push(
      movement({
        id: `payment:${payment.id}`,
        invoiceId: invoice.id,
        at: paymentAt,
        kind: "PAYMENT",
        direction: "CREDIT",
        amount: payment.amount,
        currency: paymentCurrency,
      }),
    );
    for (const refund of payment.refunds) {
      movements.push(
        movement({
          id: `refund:${refund.id}`,
          invoiceId: invoice.id,
          at: refund.createdAt,
          kind: "REFUND",
          direction: "DEBIT",
          amount: refund.amount,
          currency: refund.currency ?? paymentCurrency,
        }),
      );
    }
  }

  const deposits = invoice.deposits ?? [];
  const recordedTotal = [...invoice.payments, ...deposits].reduce(
    (total, payment) => add(currency, total, payment.amount),
    0,
  );
  if (quantize(currency, invoice.depositCollectedAmount - recordedTotal) > 0) {
    throw incompleteDepositHistory();
  }
  for (const deposit of deposits) {
    movements.push(
      movement({
        id: `payment:${deposit.id}`,
        invoiceId: invoice.id,
        at: deposit.occurredAt,
        kind: "PAYMENT",
        direction: "CREDIT",
        amount: deposit.amount,
        currency: invoiceCurrencyAt(invoice, deposit.occurredAt),
      }),
    );
  }

  for (const note of invoice.creditNotes) {
    const noteCurrency = invoiceCurrencyAt(invoice, note.createdAt);
    movements.push(
      movement({
        id: `credit-note:${note.id}`,
        invoiceId: invoice.id,
        at: note.createdAt,
        kind: "CREDIT_NOTE",
        direction: "CREDIT",
        amount: note.amount,
        currency: noteCurrency,
      }),
    );
    if (note.voidedAt) {
      movements.push(
        movement({
          id: `credit-note-void:${note.id}`,
          invoiceId: invoice.id,
          at: note.voidedAt,
          kind: "CREDIT_NOTE_VOID",
          direction: "DEBIT",
          amount: note.amount,
          currency: noteCurrency,
        }),
      );
    }
  }

  return {
    movements,
    dueDates,
  };
};

const emptyAging = (): ClientStatementAging => ({
  current: 0,
  days1To30: 0,
  days31To60: 0,
  days61To90: 0,
  days91Plus: 0,
  totalOutstanding: 0,
});

const incompleteReceiptHistory = () =>
  new ClientStatementError(
    "A receipt is missing its dated payment history.",
    409,
  );

const receiptRefundMovements = (receipt: StatementReceipt): Movement[] => {
  const currency = currencyKey(receipt.currency);
  const entries: Movement[] = [];
  let refunded = 0;
  for (const refund of [...receipt.refunds].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.cumulativeAmount - b.cumulativeAmount,
  )) {
    if (refund.amount == null) continue;
    if (
      currencyKey(refund.currency) !== currency ||
      refund.occurredAt < receipt.capturedAt ||
      !Number.isFinite(refund.amount) ||
      refund.amount <= 0
    )
      throw incompleteReceiptHistory();
    const amount = quantize(currency, refund.amount);
    if (amount > 0)
      entries.push(
        movement({
          id: `receipt-refund:${refund.id}`,
          invoiceId: receipt.invoiceId,
          at: refund.occurredAt,
          kind: "RECEIPT_REFUND",
          direction: "DEBIT",
          amount,
          currency,
        }),
      );
    refunded = add(currency, refunded, amount);
  }
  if (
    refunded > receipt.amount ||
    quantize(currency, refunded) !== quantize(currency, receipt.refundedAmount)
  )
    throw incompleteReceiptHistory();
  return entries;
};

const receiptMovements = (
  receipt: StatementReceipt,
  payments: readonly {
    invoiceId: string;
    currency: string;
    payment: StatementPayment;
  }[],
): Movement[] => {
  const currency = currencyKey(receipt.currency);
  const entries = [
    movement({
      id: `receipt:${receipt.id}`,
      invoiceId: receipt.invoiceId,
      at: receipt.capturedAt,
      kind: "RECEIPT",
      direction: "CREDIT",
      amount: receipt.amount,
      currency,
    }),
    ...receiptRefundMovements(receipt),
  ];
  let allocated = 0;
  for (const { invoiceId, currency: invoiceCurrency, payment } of payments) {
    const at = payment.paidAt ?? payment.createdAt;
    if (
      currencyKey(payment.currency ?? invoiceCurrency) !== currency ||
      at < receipt.capturedAt
    )
      throw incompleteReceiptHistory();
    allocated = add(currency, allocated, payment.amount);
    entries.push(
      movement({
        id: `credit-allocation:${payment.id}`,
        invoiceId,
        at,
        kind: "CREDIT_ALLOCATION",
        direction: "DEBIT",
        amount: payment.amount,
        currency,
      }),
    );
    for (const refund of payment.refunds) {
      if (currencyKey(refund.currency ?? currency) !== currency)
        throw incompleteReceiptHistory();
      entries.push(
        movement({
          id: `credit-allocation-refund:${refund.id}`,
          invoiceId,
          at: refund.createdAt,
          kind: "CREDIT_ALLOCATION_REFUND",
          direction: "CREDIT",
          amount: refund.amount,
          currency,
        }),
      );
    }
  }
  if (allocated !== quantize(currency, receipt.allocatedAmount))
    throw incompleteReceiptHistory();
  return entries;
};

const addAgedBalance = (
  aging: ClientStatementAging,
  currency: string,
  dueAt: Date,
  periodEnd: Date,
  balance: number,
  timeZone: string,
): void => {
  if (balance <= 0) return;
  const days = Math.max(
    0,
    moment
      .tz(periodEnd, timeZone)
      .startOf("day")
      .diff(moment.tz(dueAt, timeZone).startOf("day"), "days"),
  );
  if (days === 0) aging.current = add(currency, aging.current, balance);
  else if (days <= 30)
    aging.days1To30 = add(currency, aging.days1To30, balance);
  else if (days <= 60)
    aging.days31To60 = add(currency, aging.days31To60, balance);
  else if (days <= 90)
    aging.days61To90 = add(currency, aging.days61To90, balance);
  else aging.days91Plus = add(currency, aging.days91Plus, balance);
  aging.totalOutstanding = add(currency, aging.totalOutstanding, balance);
};

export const buildClientStatementSnapshot = (input: {
  client: ClientStatementSnapshot["client"];
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  timeZone?: string;
  invoices: readonly StatementInvoice[];
  receipts?: readonly StatementReceipt[];
}): ClientStatementSnapshot => {
  const byCurrency = new Map<string, CurrencyAccumulator>();
  for (const invoice of input.invoices) {
    const invoiceSummary = buildInvoiceMovements(
      invoice,
      input.periodStart,
      input.periodEnd,
    );
    const currencies = new Set([
      ...invoiceSummary.dueDates.keys(),
      ...invoiceSummary.movements.map((entry) => entry.currency),
    ]);
    for (const currency of currencies) {
      const movements = invoiceSummary.movements.filter(
        (entry) => entry.currency === currency,
      );
      const bucket = byCurrency.get(currency) ?? {
        currency,
        movements: [],
        invoices: [],
      };
      bucket.movements.push(...movements);
      const balanceAtPeriodEnd = movements
        .filter((entry) => entry.at <= input.periodEnd)
        .reduce(
          (balance, entry) => add(currency, balance, entry.signedAmount),
          0,
        );
      bucket.invoices.push({
        dueAt: invoiceSummary.dueDates.get(currency) ?? input.periodEnd,
        balance: Math.max(0, balanceAtPeriodEnd),
      });
      byCurrency.set(currency, bucket);
    }
  }

  const receiptPayments = new Map<
    string,
    Array<{ invoiceId: string; currency: string; payment: StatementPayment }>
  >();
  for (const invoice of input.invoices) {
    for (const payment of invoice.payments) {
      if (!payment.receiptId) continue;
      const payments = receiptPayments.get(payment.receiptId) ?? [];
      payments.push({
        invoiceId: invoice.id,
        currency: invoice.currency,
        payment,
      });
      receiptPayments.set(payment.receiptId, payments);
    }
  }
  for (const receipt of input.receipts ?? []) {
    const currency = currencyKey(receipt.currency);
    const bucket = byCurrency.get(currency) ?? {
      currency,
      movements: [],
      invoices: [],
    };
    bucket.movements.push(
      ...receiptMovements(receipt, receiptPayments.get(receipt.id) ?? []),
    );
    byCurrency.set(currency, bucket);
  }

  const currencies = [...byCurrency.values()]
    .map((bucket): ClientStatementCurrency => {
      const included = bucket.movements
        .filter((entry) => entry.at <= input.periodEnd)
        .sort(
          (left, right) =>
            left.at.getTime() - right.at.getTime() ||
            left.id.localeCompare(right.id),
        );
      let openingBalance = 0;
      let closingBalance = 0;
      for (const entry of included) {
        closingBalance = add(
          bucket.currency,
          closingBalance,
          entry.signedAmount,
        );
        if (entry.at < input.periodStart || entry.openingOnly) {
          openingBalance = add(
            bucket.currency,
            openingBalance,
            entry.signedAmount,
          );
        }
      }

      const aging = emptyAging();
      for (const invoice of bucket.invoices) {
        addAgedBalance(
          aging,
          bucket.currency,
          invoice.dueAt,
          input.periodEnd,
          invoice.balance,
          input.timeZone ?? "UTC",
        );
      }

      return {
        currency: bucket.currency,
        openingBalance,
        closingBalance,
        entries: included
          .filter(
            (entry) => entry.at >= input.periodStart && !entry.openingOnly,
          )
          .map(toEntry),
        aging,
      };
    })
    .sort((left, right) => left.currency.localeCompare(right.currency));

  return {
    version: 1,
    client: input.client,
    period: {
      start: input.periodStart.toISOString(),
      end: input.periodEnd.toISOString(),
    },
    generatedAt: input.generatedAt.toISOString(),
    currencies,
  };
};

type StoredStatement = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  snapshot: Prisma.JsonValue;
  createdAt: Date;
};

export type ClientStatementRecord = {
  id: string;
  createdAt: Date;
  snapshot: ClientStatementSnapshot;
};

const toRecord = (statement: StoredStatement): ClientStatementRecord => ({
  id: statement.id,
  createdAt: statement.createdAt,
  snapshot: statement.snapshot as unknown as ClientStatementSnapshot,
});

const samePeriod = (
  statement: Pick<StoredStatement, "periodStart" | "periodEnd">,
  periodStart: Date,
  periodEnd: Date,
): boolean =>
  statement.periodStart.getTime() === periodStart.getTime() &&
  statement.periodEnd.getTime() === periodEnd.getTime();

const isUniqueConflict = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "P2002";

const findIdempotentStatement = (input: {
  organisationId: string;
  parentId: string;
  idempotencyKey: string;
}) =>
  prisma.clientStatement.findUnique({
    where: {
      organisationId_parentId_idempotencyKey: {
        organisationId: input.organisationId,
        parentId: input.parentId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

const assertSameRequest = (
  statement: StoredStatement,
  periodStart: Date,
  periodEnd: Date,
): ClientStatementRecord => {
  if (!samePeriod(statement, periodStart, periodEnd)) {
    throw new ClientStatementError(
      "This idempotency key was already used for a different statement period.",
      409,
    );
  }
  return toRecord(statement);
};

const creditNoteVoidDate = (note: {
  status: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): Date | null => {
  if (note.status !== "VOIDED") return null;
  const value =
    note.metadata &&
    typeof note.metadata === "object" &&
    !Array.isArray(note.metadata)
      ? note.metadata.voidedAt
      : null;
  const date =
    typeof value === "string" ? new Date(value) : new Date(Number.NaN);
  if (!Number.isFinite(date.getTime()) || date < note.createdAt) {
    throw new ClientStatementError(
      "A credit note is missing its reversal date.",
      409,
    );
  }
  return date;
};

const incompleteDepositHistory = () =>
  new ClientStatementError(
    "A deposit is missing its dated payment history.",
    409,
  );

const paymentEventSchema = z.object({
  entityId: z.string().min(1),
  occurredAt: z.date(),
  payload: z.object({
    invoiceId: z.string().min(1),
    paymentId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().trim().min(1),
  }),
});

const loadDepositHistory = async (
  tx: Prisma.TransactionClient,
  organisationId: string,
  invoices: readonly StatementInvoice[],
  rowCount: number,
): Promise<Map<string, StatementDeposit[]>> => {
  const missing = new Map(
    invoices
      .filter((invoice) => invoice.depositCollectedAmount > 0)
      .map((invoice) => [
        invoice.id,
        {
          invoice,
          paymentIds: new Set(invoice.payments.map((payment) => payment.id)),
          deposits: new Map<string, StatementDeposit>(),
        },
      ]),
  );
  if (missing.size === 0) return new Map();
  const where: Prisma.FinanceEventWhereInput = {
    organisationId,
    eventType: "PAYMENT_SUCCEEDED",
    entityType: "PAYMENT",
    OR: [...missing.keys()].map((id) => ({
      payload: { path: ["invoiceId"], equals: id },
    })),
  };
  if (
    rowCount + (await tx.financeEvent.count({ where })) >
    MAX_STATEMENT_ROWS
  ) {
    throw new ClientStatementError(
      "This client account exceeds the supported statement size.",
      422,
    );
  }
  const events = await tx.financeEvent.findMany({
    where,
    select: { entityId: true, occurredAt: true, payload: true },
  });
  for (const event of events) {
    const parsed = paymentEventSchema.safeParse(event);
    if (!parsed.success) throw incompleteDepositHistory();
    const { entityId, occurredAt, payload } = parsed.data;
    const account = missing.get(payload.invoiceId);
    if (
      !account ||
      entityId !== payload.paymentId ||
      currencyKey(payload.currency) !==
        invoiceCurrencyAt(account.invoice, occurredAt)
    ) {
      throw incompleteDepositHistory();
    }
    if (account.paymentIds.has(entityId)) continue;
    const deposit = { id: entityId, amount: payload.amount, occurredAt };
    const previous = account.deposits.get(entityId);
    if (
      previous &&
      (previous.amount !== deposit.amount ||
        previous.occurredAt.getTime() !== occurredAt.getTime())
    ) {
      throw incompleteDepositHistory();
    }
    account.deposits.set(entityId, deposit);
  }
  return new Map(
    [...missing].map(([id, account]) => [id, [...account.deposits.values()]]),
  );
};

const matchReceiptPayments = (
  receipts: readonly {
    id: string;
    invoiceId: string | null;
    provider: string;
    paymentRef: string;
  }[],
  invoices: readonly StatementInvoice[],
  allocations: readonly { paymentId: string | null; receiptId: string }[],
) => {
  const matched = new Map<string, string>();
  const receiptIds = new Set(receipts.map((receipt) => receipt.id));
  const references = new Map<string, string[]>();
  for (const receipt of receipts) {
    const key = JSON.stringify([
      receipt.invoiceId,
      receipt.provider,
      receipt.paymentRef,
    ]);
    const ids = references.get(key) ?? [];
    ids.push(receipt.id);
    references.set(key, ids);
  }
  const allocated = new Map<string, string>();
  for (const allocation of allocations) {
    if (allocation.paymentId && receiptIds.has(allocation.receiptId))
      allocated.set(allocation.paymentId, allocation.receiptId);
  }
  const payments = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({ invoiceId: invoice.id, payment })),
  );
  for (const { invoiceId, payment } of payments) {
    const candidates = new Set(
      references.get(
        JSON.stringify([
          invoiceId,
          payment.provider,
          payment.providerPaymentId,
        ]),
      ) ?? [],
    );
    const appliedReceipt = allocated.get(payment.id);
    if (appliedReceipt) candidates.add(appliedReceipt);
    if (candidates.size > 1)
      throw new ClientStatementError(
        "A payment matches more than one receipt.",
        409,
      );
    for (const id of candidates) matched.set(payment.id, id);
  }
  return matched;
};

export const ClientStatementService = {
  async generate(input: {
    organisationId: string;
    parentId: string;
    generatedById: string;
    idempotencyKey: string;
    periodStart: Date;
    periodEnd: Date;
    now?: Date;
  }): Promise<ClientStatementRecord> {
    const now = input.now ?? new Date();
    if (
      !Number.isFinite(input.periodStart.getTime()) ||
      !Number.isFinite(input.periodEnd.getTime())
    ) {
      throw new ClientStatementError(
        "Statement period must contain valid dates.",
        400,
      );
    }
    if (input.periodStart >= input.periodEnd) {
      throw new ClientStatementError(
        "Statement period start must be before its end.",
        400,
      );
    }
    if (input.periodEnd > now) {
      throw new ClientStatementError(
        "Statement period cannot end in the future.",
        400,
      );
    }
    if (
      input.periodEnd.getTime() - input.periodStart.getTime() >=
      366 * DAY_MS
    ) {
      throw new ClientStatementError(
        "Statement period must be 366 days or less.",
        400,
      );
    }

    const existing = await findIdempotentStatement(input);
    if (existing) {
      return assertSameRequest(existing, input.periodStart, input.periodEnd);
    }

    const account = await prisma.$transaction(
      async (tx) => {
        const where: Prisma.InvoiceWhereInput = {
          organisationId: input.organisationId,
          parentId: input.parentId,
          createdAt: { lte: input.periodEnd },
        };
        const paymentWhere: Prisma.PaymentWhereInput = {
          invoice: where,
          status: { in: [...INCLUDED_PAYMENT_STATUSES] },
        };
        const rowCounts = await Promise.all([
          tx.invoice.count({ where }),
          tx.payment.count({ where: paymentWhere }),
          tx.refund.count({
            where: { payment: paymentWhere, status: "SUCCEEDED" },
          }),
          tx.creditNote.count({
            where: { invoice: where, status: { in: ["ISSUED", "VOIDED"] } },
          }),
        ]);
        if (
          rowCounts.reduce((total, count) => total + count, 0) >
          MAX_STATEMENT_ROWS
        ) {
          throw new ClientStatementError(
            "This client account exceeds the supported statement size.",
            422,
          );
        }
        const rows = await tx.invoice.findMany({
          where,
          select: {
            id: true,
            currency: true,
            totalAmount: true,
            depositCollectedAmount: true,
            finalizedAt: true,
            dueAt: true,
            paidAt: true,
            createdAt: true,
            payments: {
              where: { status: { in: [...INCLUDED_PAYMENT_STATUSES] } },
              select: {
                id: true,
                provider: true,
                providerPaymentId: true,
                amount: true,
                currency: true,
                paidAt: true,
                createdAt: true,
                refunds: {
                  where: { status: "SUCCEEDED" },
                  select: {
                    id: true,
                    amount: true,
                    currency: true,
                    createdAt: true,
                  },
                },
              },
            },
            creditNotes: {
              where: { status: { in: ["ISSUED", "VOIDED"] } },
              select: {
                id: true,
                amount: true,
                createdAt: true,
                status: true,
                metadata: true,
              },
            },
          },
        });
        const revisionWhere: Prisma.InvoiceRevisionWhereInput = {
          organisationId: input.organisationId,
          parentId: input.parentId,
          invoiceId: { in: rows.map((invoice) => invoice.id) },
        };
        const allocationWhere: Prisma.ProviderReceiptAllocationWhereInput = {
          receipt: { organisationId: input.organisationId },
          invoiceId: { in: rows.map((invoice) => invoice.id) },
          paymentId: {
            in: rows.flatMap((invoice) =>
              invoice.payments.map((payment) => payment.id),
            ),
          },
        };
        const receiptWhere: Prisma.ProviderReceiptWhereInput = {
          organisationId: input.organisationId,
          invoiceId: { in: rows.map((invoice) => invoice.id) },
          capturedAt: { lte: input.periodEnd },
        };
        let rowCount =
          rowCounts.reduce((total, count) => total + count, 0) +
          (await tx.invoiceRevision.count({ where: revisionWhere })) +
          (await tx.providerReceiptAllocation.count({
            where: allocationWhere,
          })) +
          (await tx.providerReceipt.count({ where: receiptWhere }));
        if (rowCount > MAX_STATEMENT_ROWS) {
          throw new ClientStatementError(
            "This client account exceeds the supported statement size.",
            422,
          );
        }
        const history = await tx.invoiceRevision.findMany({
          where: revisionWhere,
          orderBy: { id: "asc" },
        });
        const revisions = new Map<string, typeof history>();
        for (const revision of history) {
          const versions = revisions.get(revision.invoiceId) ?? [];
          versions.push(revision);
          revisions.set(revision.invoiceId, versions);
        }
        const receiptRows = await tx.providerReceipt.findMany({
          where: receiptWhere,
          select: {
            id: true,
            invoiceId: true,
            provider: true,
            paymentRef: true,
            amount: true,
            currency: true,
            capturedAt: true,
            allocatedAmount: true,
            refundedAmount: true,
            undatedRefundAmount: true,
          },
        });
        const refundWhere = {
          receiptId: { in: receiptRows.map((receipt) => receipt.id) },
        };
        rowCount += await tx.providerReceiptRefund.count({
          where: refundWhere,
        });
        if (rowCount > MAX_STATEMENT_ROWS)
          throw new ClientStatementError(
            "This client account exceeds the supported statement size.",
            422,
          );
        const receiptRefunds = await tx.providerReceiptRefund.findMany({
          where: refundWhere,
        });
        const deposits = await loadDepositHistory(
          tx,
          input.organisationId,
          rows.map((invoice) => ({
            ...invoice,
            revisions: revisions.get(invoice.id),
          })),
          rowCount,
        );
        const allocations = await tx.providerReceiptAllocation.findMany({
          where: allocationWhere,
          select: {
            paymentId: true,
            receiptId: true,
            invoiceId: true,
            amount: true,
            appliedAt: true,
          },
        });
        const appliedPayments = new Map<string, Date>();
        const invoicePayments = new Map(
          rows.flatMap((invoice) =>
            invoice.payments.map(
              (payment) =>
                [JSON.stringify([invoice.id, payment.id]), payment] as const,
            ),
          ),
        );
        for (const allocation of allocations) {
          const payment = invoicePayments.get(
            JSON.stringify([allocation.invoiceId, allocation.paymentId]),
          );
          if (
            !payment ||
            !allocation.appliedAt ||
            allocation.amount !== payment.amount ||
            appliedPayments.has(payment.id)
          ) {
            throw new ClientStatementError(
              "A payment is missing its dated allocation history.",
              409,
            );
          }
          appliedPayments.set(payment.id, allocation.appliedAt);
        }
        const paymentReceipts = matchReceiptPayments(
          receiptRows,
          rows,
          allocations,
        );
        const invoices = rows.map((invoice) => ({
          ...invoice,
          payments: invoice.payments.map((payment) => ({
            ...payment,
            paidAt: appliedPayments.get(payment.id) ?? payment.paidAt,
            receiptId: paymentReceipts.get(payment.id),
          })),
          deposits: deposits.get(invoice.id),
          revisions: revisions.get(invoice.id) ?? [],
        }));
        const refundsByReceipt = new Map<string, typeof receiptRefunds>();
        for (const refund of receiptRefunds) {
          const refunds = refundsByReceipt.get(refund.receiptId) ?? [];
          refunds.push(refund);
          refundsByReceipt.set(refund.receiptId, refunds);
        }
        const receipts = receiptRows.map((receipt) => {
          if (!receipt.invoiceId) throw incompleteReceiptHistory();
          return {
            ...receipt,
            invoiceId: receipt.invoiceId,
            refunds: refundsByReceipt.get(receipt.id) ?? [],
          };
        });
        return { invoices, receipts };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10_000,
      },
    );
    if (account.invoices.length === 0) {
      throw new ClientStatementError("Client account not found.", 404);
    }

    const client = await prisma.parent.findUnique({
      where: { id: input.parentId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!client) {
      throw new ClientStatementError("Client account not found.", 404);
    }

    const snapshot = buildClientStatementSnapshot({
      client,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      generatedAt: now,
      timeZone: await resolvePracticeTimeZone(input.organisationId),
      receipts: account.receipts,
      invoices: account.invoices.map((invoice) => ({
        ...invoice,
        creditNotes: invoice.creditNotes.map((note) => ({
          ...note,
          voidedAt: creditNoteVoidDate(note),
        })),
      })),
    });

    try {
      const created = await prisma.clientStatement.create({
        data: {
          organisationId: input.organisationId,
          parentId: input.parentId,
          generatedById: input.generatedById,
          idempotencyKey: input.idempotencyKey,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          snapshot,
        },
      });
      return toRecord(created);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const raced = await findIdempotentStatement(input);
      if (!raced) throw error;
      return assertSameRequest(raced, input.periodStart, input.periodEnd);
    }
  },

  async getById(input: {
    organisationId: string;
    parentId: string;
    statementId: string;
  }): Promise<ClientStatementRecord | null> {
    const statement = await prisma.clientStatement.findFirst({
      where: {
        id: input.statementId,
        organisationId: input.organisationId,
        parentId: input.parentId,
      },
    });
    return statement ? toRecord(statement) : null;
  },
};
