import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  quantizeMoney,
  resolveLedgerExponent,
} from "src/services/finance/currency";

const DAY_MS = 24 * 60 * 60 * 1000;
const INCLUDED_PAYMENT_STATUSES = [
  "SUCCEEDED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type ClientStatementEntry = {
  id: string;
  invoiceId: string;
  occurredAt: string;
  kind: "INVOICE" | "PAYMENT" | "REFUND" | "CREDIT_NOTE" | "DEPOSIT";
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

export type StatementInvoice = {
  id: string;
  currency: string;
  totalAmount: number;
  depositCollectedAmount: number;
  finalizedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  payments: StatementPayment[];
  creditNotes: Array<{ id: string; amount: number; createdAt: Date }>;
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
  quantizeMoney(value, resolveLedgerExponent(currency));

const add = (currency: string, left: number, right: number): number =>
  quantize(currency, left + right);

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
  periodEnd: Date,
): { movements: Movement[]; dueAt: Date } => {
  const currency = currencyKey(invoice.currency);
  const dueAt = invoice.finalizedAt ?? invoice.createdAt;
  const movements: Movement[] = [
    movement({
      id: `invoice:${invoice.id}`,
      invoiceId: invoice.id,
      at: dueAt,
      kind: "INVOICE",
      direction: "DEBIT",
      amount: invoice.totalAmount,
      currency,
    }),
  ];
  let paidAtPeriodEnd = 0;

  for (const payment of invoice.payments) {
    const paymentAt = payment.paidAt ?? payment.createdAt;
    if (paymentAt <= periodEnd) {
      paidAtPeriodEnd = add(currency, paidAtPeriodEnd, payment.amount);
    }
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
      if (refund.createdAt <= periodEnd) {
        paidAtPeriodEnd = add(currency, paidAtPeriodEnd, -refund.amount);
      }
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

  const depositFallback = quantize(
    currency,
    Math.max(0, invoice.depositCollectedAmount - paidAtPeriodEnd),
  );
  if (depositFallback > 0) {
    movements.push(
      movement({
        id: `deposit:${invoice.id}`,
        invoiceId: invoice.id,
        at: invoice.paidAt ?? dueAt,
        kind: "DEPOSIT",
        direction: "CREDIT",
        amount: depositFallback,
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
): void => {
  if (balance <= 0) return;
  const days = Math.max(
    0,
    Math.floor((periodEnd.getTime() - dueAt.getTime()) / DAY_MS),
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
  invoices: readonly StatementInvoice[];
}): ClientStatementSnapshot => {
  const byCurrency = new Map<string, CurrencyAccumulator>();
  for (const invoice of input.invoices) {
    const currency = currencyKey(invoice.currency);
    const invoiceSummary = buildInvoiceMovements(invoice, input.periodEnd);
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
        );
      }

      return {
        currency: bucket.currency,
        openingBalance,
        closingBalance,
        entries: included
          .filter((entry) => entry.at >= input.periodStart)
          .map(({ at: _at, signedAmount: _signedAmount, ...entry }) => entry),
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
      organisationId_parentId_idempotencyKey: input,
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

    const existing = await findIdempotentStatement(input);
    if (existing) {
      return assertSameRequest(existing, input.periodStart, input.periodEnd);
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        organisationId: input.organisationId,
        parentId: input.parentId,
        status: { not: "CANCELLED" },
        OR: [
          { finalizedAt: { lte: input.periodEnd } },
          { finalizedAt: null, createdAt: { lte: input.periodEnd } },
        ],
      },
      select: {
        id: true,
        currency: true,
        totalAmount: true,
        depositCollectedAmount: true,
        finalizedAt: true,
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
          where: { status: "ISSUED" },
          select: { id: true, amount: true, createdAt: true },
        },
      },
    });
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
      invoices,
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
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
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
