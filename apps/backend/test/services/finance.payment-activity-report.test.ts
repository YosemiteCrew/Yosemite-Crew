import { PDFDocument, PDFPage } from "pdf-lib";
import { prisma } from "src/config/prisma";
import {
  buildPaymentActivityCsv,
  buildPaymentActivityPdf,
  getPaymentActivityReport,
  MAX_PAYMENT_ACTIVITY_ROWS,
  PaymentActivityReportTooLargeError,
  type PaymentActivityReport,
  type PaymentActivityRow,
} from "src/services/finance/payment-activity-report";

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    payment: { findMany: jest.fn() },
    refund: { findMany: jest.fn() },
  },
}));

const from = new Date("2026-09-01T00:00:00.000Z");
const to = new Date("2026-09-30T23:59:59.999Z");

const row = (
  overrides: Partial<PaymentActivityRow> = {},
): PaymentActivityRow => ({
  id: "payment-1",
  date: new Date("2026-09-12T10:00:00.000Z"),
  type: "Payment",
  status: "SUCCEEDED",
  provider: "STRIPE",
  currency: "EUR",
  amount: 25.5,
  invoiceId: "invoice-1",
  ...overrides,
});

const report = (rows: PaymentActivityRow[]): PaymentActivityReport => ({
  rows,
  totals: [],
});

describe("payment activity report", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.refund.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("normalizes each payment currency once before totaling", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "payment-1",
        amount: 10,
        currency: "eur",
        status: "SUCCEEDED",
        provider: "MANUAL",
        paidAt: new Date("2026-09-10T00:00:00.000Z"),
        createdAt: new Date("2026-09-10T00:00:00.000Z"),
        invoiceId: "invoice-1",
      },
    ]);
    const uppercaseSpy = jest.spyOn(String.prototype, "toUpperCase");

    try {
      const result = await getPaymentActivityReport("org-1", from, to);
      const currencyCalls = uppercaseSpy.mock.contexts
        .map((value) => String(value))
        .filter((value) => value === "eur" || value === "EUR");

      expect(result.totals).toEqual([
        { currency: "EUR", payments: 10, refunds: 0, net: 10 },
      ]);
      expect(currencyCalls.filter((value) => value === "eur")).toHaveLength(1);
      expect(currencyCalls).toHaveLength(3);
    } finally {
      uppercaseSpy.mockRestore();
    }
  });

  it("returns organisation-scoped payments and refunds with currency-specific totals", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "payment-1",
        amount: 0.1,
        currency: "EUR",
        status: "SUCCEEDED",
        provider: "STRIPE",
        paidAt: new Date("2026-09-10T00:00:00.000Z"),
        createdAt: new Date("2026-09-09T00:00:00.000Z"),
        invoiceId: "invoice-1",
      },
      {
        id: "payment-2",
        amount: 0.2,
        currency: "eur",
        status: "REFUNDED",
        provider: "CASH",
        paidAt: null,
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        invoiceId: "invoice-2",
      },
    ]);
    (prisma.refund.findMany as jest.Mock).mockResolvedValue([
      {
        id: "refund-1",
        amount: 30,
        currency: "EUR",
        status: "SUCCEEDED",
        provider: "STRIPE",
        createdAt: new Date("2026-09-11T00:00:00.000Z"),
        payment: { invoiceId: "invoice-1" },
      },
      {
        id: "refund-2",
        amount: 4,
        currency: "Eur",
        status: "PENDING",
        provider: "STRIPE",
        createdAt: new Date("2026-09-12T00:00:00.000Z"),
        payment: { invoiceId: "invoice-1" },
      },
    ]);

    const result = await getPaymentActivityReport("org-1", from, to);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoice: { is: { organisationId: "org-1" } },
        }),
      }),
    );
    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payment: { is: { invoice: { is: { organisationId: "org-1" } } } },
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
    expect(result.rows.map((entry) => entry.type)).toEqual([
      "Refund",
      "Refund",
      "Payment",
      "Payment",
    ]);
    expect(result.rows[2]?.date).toEqual(new Date("2026-09-10T00:00:00.000Z"));
    expect(result.rows[3]?.date).toEqual(new Date("2026-09-08T00:00:00.000Z"));
    expect(result.totals).toEqual([
      { currency: "EUR", payments: 0.3, refunds: 30, net: -29.7 },
    ]);
  });

  it("totals a currency the ledger cannot price at two decimals instead of failing", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "payment-huf",
        amount: 1500.25,
        currency: "huf",
        status: "SUCCEEDED",
        provider: "MANUAL",
        paidAt: new Date("2026-09-10T00:00:00.000Z"),
        createdAt: new Date("2026-09-10T00:00:00.000Z"),
        invoiceId: "invoice-huf",
      },
      {
        id: "payment-jpy",
        amount: 1200,
        currency: "JPY",
        status: "SUCCEEDED",
        provider: "STRIPE",
        paidAt: new Date("2026-09-11T00:00:00.000Z"),
        createdAt: new Date("2026-09-11T00:00:00.000Z"),
        invoiceId: "invoice-jpy",
      },
    ]);

    const result = await getPaymentActivityReport("org-1", from, to);

    expect(result.totals).toEqual([
      { currency: "JPY", payments: 1200, refunds: 0, net: 1200 },
      { currency: "HUF", payments: 1500.25, refunds: 0, net: 1500.25 },
    ]);
    const csv = buildPaymentActivityCsv(result);
    expect(csv).toContain('"1500.25","HUF"');
    expect(csv).toContain('"1200","JPY"');
  });

  it("refuses a currency total beyond exact integer range", async () => {
    const payment = {
      id: "payment-large",
      amount: 50_000_000_000_000,
      currency: "EUR",
      status: "SUCCEEDED",
      provider: "MANUAL",
      paidAt: new Date("2026-09-10T00:00:00.000Z"),
      createdAt: new Date("2026-09-10T00:00:00.000Z"),
      invoiceId: "invoice-1",
    };
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      payment,
      { ...payment, id: "payment-large-2" },
    ]);

    await expect(getPaymentActivityReport("org-1", from, to)).rejects.toThrow(
      RangeError,
    );
  });

  it("refuses a period with more entries than one report returns", async () => {
    const payments = Array.from(
      { length: MAX_PAYMENT_ACTIVITY_ROWS - 1 },
      (_, index) => ({
        id: `payment-${index}`,
        amount: 1,
        currency: "EUR",
        status: "SUCCEEDED",
        provider: "STRIPE",
        paidAt: new Date("2026-09-10T00:00:00.000Z"),
        createdAt: new Date("2026-09-10T00:00:00.000Z"),
        invoiceId: "invoice-1",
      }),
    );
    const refund = {
      id: "refund-1",
      amount: 1,
      currency: "EUR",
      status: "SUCCEEDED",
      provider: "STRIPE",
      createdAt: new Date("2026-09-11T00:00:00.000Z"),
      payment: { invoiceId: "invoice-1" },
    };
    (prisma.payment.findMany as jest.Mock).mockResolvedValue(payments);
    (prisma.refund.findMany as jest.Mock).mockResolvedValue([refund]);

    await expect(
      getPaymentActivityReport("org-1", from, to),
    ).resolves.toHaveProperty("rows.length", MAX_PAYMENT_ACTIVITY_ROWS);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_PAYMENT_ACTIVITY_ROWS + 1 }),
    );
    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_PAYMENT_ACTIVITY_ROWS + 1 }),
    );

    (prisma.refund.findMany as jest.Mock).mockResolvedValue([
      refund,
      { ...refund, id: "refund-2" },
    ]);
    await expect(
      getPaymentActivityReport("org-1", from, to),
    ).rejects.toBeInstanceOf(PaymentActivityReportTooLargeError);
  });

  it("builds a quoted CSV and neutralizes spreadsheet formulas in text cells", () => {
    const csv = buildPaymentActivityCsv(
      report([
        row({ invoiceId: "-1+2" }),
        row({ status: "UNKNOWN", provider: "UNKNOWN" }),
        row({
          status: "SUCCEEDED",
          invoiceId: '=HYPERLINK("bad")',
          type: "Refund",
        }),
      ]),
    );

    expect(csv).toContain(
      '"Date (UTC)","Type","Status","Provider","Amount","Currency","Invoice"',
    );
    expect(csv).toContain(
      '"Refund","Completed","Online","25.50","EUR","\'=HYPERLINK(""bad"")"',
    );
    expect(csv).toContain('"25.50","EUR","\'-1+2"');
    expect(csv).toContain('"Needs review","Other"');
  });

  it("creates a readable PDF with an additional page for long reports", async () => {
    const drawText = jest.spyOn(PDFPage.prototype, "drawText");
    const pdf = await buildPaymentActivityPdf(
      report([
        ...Array.from({ length: 40 }, (_, index) =>
          row({ invoiceId: `invoice-${index}` }),
        ),
        row({ type: "Refund", invoiceId: "invoice-refund" }),
      ]),
      from,
      to,
    );

    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(2);
    expect(
      drawText.mock.calls.every(([, options]) => Number.isFinite(options?.x)),
    ).toBe(true);
    drawText.mockRestore();
  });

  it("creates an empty report PDF without requiring any rows", async () => {
    const pdf = await buildPaymentActivityPdf(report([]), from, to);

    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(1);
  });

  it("ends the PDF with the totals for each currency", async () => {
    const drawText = jest.spyOn(PDFPage.prototype, "drawText");

    await buildPaymentActivityPdf(
      {
        rows: [row()],
        totals: [
          { currency: "EUR", payments: 0.3, refunds: 30, net: -29.7 },
          { currency: "JPY", payments: 1200, refunds: 0, net: 1200 },
        ],
      },
      from,
      to,
    );

    const renderedText = drawText.mock.calls.map(([text]) => text);
    expect(renderedText).toContain(
      "EUR totals: payments 0.30, refunds 30.00, net -29.70",
    );
    expect(renderedText).toContain(
      "JPY totals: payments 1200, refunds 0, net 1200",
    );
    drawText.mockRestore();
  });

  it("shows only completed refunds as debits in the PDF", async () => {
    const drawText = jest.spyOn(PDFPage.prototype, "drawText");

    await buildPaymentActivityPdf(
      report([
        row({ type: "Refund", status: "PENDING", amount: 5 }),
        row({ type: "Refund", status: "SUCCEEDED", amount: 7 }),
      ]),
      from,
      to,
    );

    const renderedText = drawText.mock.calls.map(([text]) => text);
    expect(renderedText).toContain("5.00 EUR");
    expect(renderedText).toContain("-7.00 EUR");
    drawText.mockRestore();
  });
});
