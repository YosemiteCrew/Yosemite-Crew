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
  amount: number;
  paidAt: Date | null;
  createdAt: Date;
  refunds: Array<{ id: string; amount: number; createdAt: Date }>;
};

type StatementDeposit = { id: string; amount: number; occurredAt: Date };

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
  creditNotes: Array<{
    id: string;
    amount: number;
    createdAt: Date;
    voidedAt?: Date | null;
  }>;
};

type Movement = ClientStatementEntry & {
  at: Date;
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
    signedAmount: input.direction === "DEBIT" ? amount : -amount,
  };
};

const buildInvoiceMovements = (
  invoice: StatementInvoice,
): { movements: Movement[]; dueAt: Date } => {
  const currency = currencyKey(invoice.currency);
  const chargedAt = invoice.finalizedAt ?? invoice.createdAt;
  const dueAt = invoice.dueAt ?? chargedAt;
  const movements: Movement[] = [
    movement({
      id: `invoice:${invoice.id}`,
      invoiceId: invoice.id,
      at: chargedAt,
      kind: "INVOICE",
      direction: "DEBIT",
      amount: invoice.totalAmount,
      currency,
    }),
  ];
  for (const payment of invoice.payments) {
    const paymentAt = payment.paidAt ?? payment.createdAt;
    movements.push(
      movement({
        id: `payment:${payment.id}`,
        invoiceId: invoice.id,
        at: paymentAt,
        kind: "PAYMENT",
        direction: "CREDIT",
        amount: payment.amount,
        currency,
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
          currency,
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
        currency,
      }),
    );
  }

  for (const note of invoice.creditNotes) {
    movements.push(
      movement({
        id: `credit-note:${note.id}`,
        invoiceId: invoice.id,
        at: note.createdAt,
        kind: "CREDIT_NOTE",
        direction: "CREDIT",
        amount: note.amount,
        currency,
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
          currency,
        }),
      );
    }
  }

  return {
    movements,
    dueAt,
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
}): ClientStatementSnapshot => {
  const byCurrency = new Map<string, CurrencyAccumulator>();
  for (const invoice of input.invoices) {
    const currency = currencyKey(invoice.currency);
    const invoiceSummary = buildInvoiceMovements(invoice);
    const bucket = byCurrency.get(currency) ?? {
      currency,
      movements: [],
      invoices: [],
    };
    bucket.movements.push(...invoiceSummary.movements);
    const balanceAtPeriodEnd = invoiceSummary.movements
      .filter((entry) => entry.at <= input.periodEnd)
      .reduce(
        (balance, entry) => add(currency, balance, entry.signedAmount),
        0,
      );
    bucket.invoices.push({
      dueAt: invoiceSummary.dueAt,
      balance: Math.max(0, balanceAtPeriodEnd),
    });
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
        if (entry.at < input.periodStart) {
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
          .filter((entry) => entry.at >= input.periodStart)
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
      currencyKey(payload.currency) !== currencyKey(account.invoice.currency)
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

    const invoices = await prisma.$transaction(
      async (tx) => {
        const where: Prisma.InvoiceWhereInput = {
          organisationId: input.organisationId,
          parentId: input.parentId,
          status: { not: "CANCELLED" },
          OR: [
            { finalizedAt: { lte: input.periodEnd } },
            { finalizedAt: null, createdAt: { lte: input.periodEnd } },
          ],
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
                amount: true,
                paidAt: true,
                createdAt: true,
                refunds: {
                  where: { status: "SUCCEEDED" },
                  select: { id: true, amount: true, createdAt: true },
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
        const deposits = await loadDepositHistory(
          tx,
          input.organisationId,
          rows,
          rowCounts.reduce((total, count) => total + count, 0),
        );
        return rows.map((invoice) => ({
          ...invoice,
          deposits: deposits.get(invoice.id),
        }));
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10_000,
      },
    );
    if (invoices.length === 0) {
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
      invoices: invoices.map((invoice) => ({
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
