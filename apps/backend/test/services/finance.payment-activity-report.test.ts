import { PDFDocument, PDFPage } from "pdf-lib";
import { prisma } from "src/config/prisma";
import {
  buildPaymentActivityCsv,
  buildPaymentActivityPdf,
  getPaymentActivityReport,
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
      '"Refund","Completed","Online","25.5","EUR","\'=HYPERLINK(""bad"")"',
    );
    expect(csv).toContain('"25.5","EUR","\'-1+2"');
    expect(csv).toContain('"Needs review","Other"');
  });

  it("creates a readable PDF with an additional page for long reports", async () => {
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
  });

  it("creates an empty report PDF without requiring any rows", async () => {
    const pdf = await buildPaymentActivityPdf(report([]), from, to);

    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(1);
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
    expect(renderedText).toContain("5 EUR");
    expect(renderedText).toContain("-7 EUR");
    drawText.mockRestore();
  });
});
