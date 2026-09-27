import { PDFDocument, StandardFonts } from "pdf-lib";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  fromLedgerMinorUnits,
  resolveLedgerExponent,
  toLedgerMinorUnits,
} from "src/services/finance/currency";
import { toWinAnsiSafe } from "src/services/passport-record-pdf";

export type PaymentActivityRow = {
  id: string;
  date: Date;
  type: "Payment" | "Refund";
  status: string;
  provider: string;
  currency: string;
  amount: number;
  invoiceId: string;
};

export type PaymentActivityReport = {
  rows: PaymentActivityRow[];
  totals: Array<{
    currency: string;
    payments: number;
    refunds: number;
    net: number;
  }>;
};

const CAPTURED_PAYMENT_STATUSES = [
  "SUCCEEDED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
const REPORT_COLUMNS = [
  "Date (UTC)",
  "Type",
  "Status",
  "Provider",
  "Amount",
  "Currency",
  "Invoice",
];
const PDF_COLUMNS = [
  "Date (UTC)",
  "Type",
  "Status",
  "Provider",
  "Amount",
  "Invoice",
];
const statusLabel = (status: string): string =>
  ({
    SUCCEEDED: "Completed",
    PARTIALLY_REFUNDED: "Partially refunded",
    REFUNDED: "Refunded",
    PENDING: "Pending",
    FAILED: "Failed",
    CANCELED: "Canceled",
  })[status] ?? "Needs review";
const providerLabel = (provider: string): string =>
  ({ STRIPE: "Online", MANUAL: "Manual" })[provider] ?? "Other";
const normalizeCurrency = (currency: string): string =>
  currency.trim().toUpperCase();
const addMinorUnits = (total: number, amount: number): number => {
  const sum = total + amount;
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError("Payment activity total exceeds exact integer range");
  }
  return sum;
};

export const getPaymentActivityReport = async (
  organisationId: string,
  from: Date,
  to: Date,
): Promise<PaymentActivityReport> => {
  const [payments, refunds] = await prisma.$transaction(
    async (tx) =>
      Promise.all([
        tx.payment.findMany({
          where: {
            status: { in: [...CAPTURED_PAYMENT_STATUSES] },
            invoice: { is: { organisationId } },
            OR: [
              { paidAt: { gte: from, lte: to } },
              { paidAt: null, createdAt: { gte: from, lte: to } },
            ],
          },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            provider: true,
            paidAt: true,
            createdAt: true,
            invoiceId: true,
          },
        }),
        tx.refund.findMany({
          where: {
            createdAt: { gte: from, lte: to },
            payment: { is: { invoice: { is: { organisationId } } } },
          },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            provider: true,
            createdAt: true,
            payment: { select: { invoiceId: true } },
          },
        }),
      ]),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  const rows: PaymentActivityRow[] = [
    ...payments.map((payment) => ({
      id: payment.id,
      date: payment.paidAt ?? payment.createdAt,
      type: "Payment" as const,
      status: payment.status,
      provider: payment.provider,
      currency: normalizeCurrency(payment.currency),
      amount: payment.amount,
      invoiceId: payment.invoiceId,
    })),
    ...refunds.map((refund) => ({
      id: refund.id,
      date: refund.createdAt,
      type: "Refund" as const,
      status: refund.status,
      provider: refund.provider,
      currency: normalizeCurrency(refund.currency),
      amount: refund.amount,
      invoiceId: refund.payment.invoiceId,
    })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime());

  const totalsByCurrency = new Map<
    string,
    { exponent: number; payments: number; refunds: number }
  >();
  for (const row of rows) {
    const currency = normalizeCurrency(row.currency);
    const exponent = resolveLedgerExponent(currency);
    const totals = totalsByCurrency.get(currency) ?? {
      exponent,
      payments: 0,
      refunds: 0,
    };
    if (row.type === "Payment") {
      totals.payments = addMinorUnits(
        totals.payments,
        toLedgerMinorUnits(row.amount, exponent),
      );
    } else if (row.status === "SUCCEEDED") {
      totals.refunds = addMinorUnits(
        totals.refunds,
        toLedgerMinorUnits(row.amount, exponent),
      );
    }
    totalsByCurrency.set(currency, totals);
  }

  return {
    rows,
    totals: [...totalsByCurrency].map(([currency, totals]) => ({
      currency,
      payments: fromLedgerMinorUnits(totals.payments, totals.exponent),
      refunds: fromLedgerMinorUnits(totals.refunds, totals.exponent),
      net: fromLedgerMinorUnits(
        totals.payments - totals.refunds,
        totals.exponent,
      ),
    })),
  };
};

const csvCell = (value: string): string => {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
};

export const buildPaymentActivityCsv = (
  report: PaymentActivityReport,
): string =>
  [
    REPORT_COLUMNS,
    ...report.rows.map((row) => [
      row.date.toISOString(),
      row.type,
      statusLabel(row.status),
      providerLabel(row.provider),
      String(row.amount),
      normalizeCurrency(row.currency),
      row.invoiceId,
    ]),
  ]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");

export const buildPaymentActivityPdf = async (
  report: PaymentActivityReport,
  from: Date,
  to: Date,
): Promise<Buffer> => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [841.89, 595.28];
  const columns = [28, 140, 222, 310, 405, 505];
  const lineHeight = 14;
  let page = document.addPage(pageSize);
  let y = 550;

  const drawHeader = () => {
    page.drawText("Payments and refunds", { x: 28, y, size: 16, font: bold });
    y -= 20;
    page.drawText(`${from.toISOString()} to ${to.toISOString()} (UTC)`, {
      x: 28,
      y,
      size: 8,
      font,
    });
    y -= 24;
    PDF_COLUMNS.forEach((label, index) => {
      page.drawText(label, { x: columns[index], y, size: 8, font: bold });
    });
    y -= lineHeight;
  };

  drawHeader();
  for (const row of report.rows) {
    if (y < 36) {
      page = document.addPage(pageSize);
      y = 550;
      drawHeader();
    }
    const values = [
      row.date.toISOString().slice(0, 10),
      row.type,
      statusLabel(row.status),
      providerLabel(row.provider),
      `${row.type === "Refund" && row.status === "SUCCEEDED" ? "-" : ""}${row.amount.toString()} ${normalizeCurrency(row.currency)}`,
      row.invoiceId,
    ];
    values.forEach((value, index) => {
      page.drawText(toWinAnsiSafe(value), {
        x: columns[index],
        y,
        size: 7,
        font,
        maxWidth: index === values.length - 1 ? 300 : 100,
      });
    });
    y -= lineHeight;
  }

  const bytes = await document.save();
  return Buffer.from(bytes);
};
