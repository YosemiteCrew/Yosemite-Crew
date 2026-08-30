import Stripe from "stripe";
import {
  FinancePaymentError,
  FinancePaymentService,
  __setFinanceStripeClientForTests,
  resolveStripeConnectedAccountId,
} from "../../src/services/finance/payment";
import { prisma } from "src/config/prisma";

jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    invoice: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    paymentAttempt: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    refund: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    creditNote: {
      findMany: jest.fn(),
    },
    financeEvent: {
      create: jest.fn(),
    },
    workspaceTreatmentItem: {
      updateMany: jest.fn(),
    },
  },
}));

describe("FinancePaymentService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // recordInvoicePayment now writes the attempt, the Payment and the invoice
    // inside one interactive transaction. Run the callback against the same
    // mocks so these assertions are about the real sequence, not a stub.
    (prisma.$transaction as jest.Mock).mockImplementation(
      (fn: (tx: unknown) => unknown) => fn(prisma),
    );
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.paymentAttempt.findMany as jest.Mock).mockResolvedValue([]);
    __setFinanceStripeClientForTests({
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.APP_URL = "https://app.test";
  });

  it("creates provider-backed payment attempts", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_1",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_1",
      invoiceId: "inv_1",
    });

    const attempt = await FinancePaymentService.createPaymentAttempt("inv_1", {
      provider: "STRIPE",
      status: "REQUIRES_ACTION",
      settlementChannel: "STRIPE",
      providerPaymentIntentId: "pi_1",
      providerCheckoutSessionId: "cs_1",
      providerPaymentLinkId: "pl_1",
      amountRequested: 100,
      amountCaptured: 0,
      amountApplied: 0,
      currency: "usd",
      collectionMode: "PREPAY_AT_BOOKING",
      isOffline: false,
      isPartial: false,
      rawProviderPayload: { mode: "test" },
    });

    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_1",
          provider: "STRIPE",
          status: "REQUIRES_ACTION",
          amountRequested: 100,
        }),
      }),
    );
    expect(attempt.id).toBe("pa_1");
  });

  it("treats a redelivered partial payment as a replay instead of throwing", async () => {
    // The ALREADY_PAID guard upstream only fires once the invoice is PAID, and a
    // deposit or part payment never sets that. So a redelivered partial payment
    // reaches the Payment insert and dies on Payment.paymentAttemptId, uncaught,
    // which answers non-2xx and buys an endless Stripe retry.
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_replay",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 25 }]);
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_replay",
    });
    (prisma.payment.create as jest.Mock).mockRejectedValueOnce({
      code: "P2002",
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_already",
      amount: 25,
      status: "SUCCEEDED",
    });
    (prisma.invoice.findUniqueOrThrow as jest.Mock).mockResolvedValueOnce({
      id: "inv_replay",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });

    const result = await FinancePaymentService.recordInvoicePayment(
      "inv_replay",
      {
        provider: "STRIPE",
        amount: 25,
        settlementChannel: "STRIPE",
        currency: "usd",
        providerPaymentId: "pi_replay",
        paymentAttemptId: "pa_replay",
        receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      },
    );

    expect(result.payment?.id).toBe("pay_already");
    // Nothing new was applied. Re-applying would double-count the money against
    // the invoice, which is why this returns before updateInvoiceAfterPayment.
    expect(result.appliedAmount).toBe(0);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("flags a delivery that arrives after the balance is already closed", async () => {
    // Stripe redelivers whenever it does not receive a 2xx. If the balance is
    // already closed the early return does no work, and without saying so the
    // caller reads it as a fresh success and notifies the pet parent again.
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_closed",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { amount: 100 },
    ]);

    const result = await FinancePaymentService.recordInvoicePayment(
      "inv_closed",
      {
        provider: "STRIPE",
        amount: 100,
        settlementChannel: "STRIPE",
        currency: "usd",
        receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      },
    );

    expect(result.appliedAmount).toBe(0);
    expect(result.replayed).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("writes the attempt, the payment and the invoice in one transaction", async () => {
    // This is what makes the replay guard sound. Without it a delivery can die
    // between the Payment insert and the invoice update, and no later delivery
    // can tell that apart from a clean replay, because nothing records which of
    // the steps ran.
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_atomic",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 100 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_atomic",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_atomic",
      amount: 100,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_atomic",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      depositCollectedAmount: 0,
    });

    await FinancePaymentService.recordInvoicePayment("inv_atomic", {
      provider: "STRIPE",
      amount: 100,
      settlementChannel: "STRIPE",
      currency: "usd",
      receivedAt: new Date("2026-06-18T10:00:00.000Z"),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.payment.create).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID" }),
      }),
    );
  });

  it("rethrows a Payment insert failure that is not a unique violation", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_boom",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 25 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_boom",
    });
    (prisma.payment.create as jest.Mock).mockRejectedValueOnce(
      new Error("connection reset"),
    );

    await expect(
      FinancePaymentService.recordInvoicePayment("inv_boom", {
        provider: "STRIPE",
        amount: 25,
        settlementChannel: "STRIPE",
        currency: "usd",
        receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      }),
    ).rejects.toThrow("connection reset");
  });

  it("records a partial payment without closing the invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_2",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 25 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_2",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_2",
      amount: 25,
      status: "SUCCEEDED",
    });

    const result = await FinancePaymentService.recordInvoicePayment("inv_2", {
      provider: "MANUAL",
      amount: 25,
      settlementChannel: "CASH",
      currency: "usd",
      receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      rawProviderPayload: { source: "front-desk" },
    });

    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountRequested: 25,
          amountApplied: 25,
          isPartial: true,
          isOffline: true,
          provider: "MANUAL",
        }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "PAYMENT_SUCCEEDED",
          entityType: "PAYMENT",
          entityId: "pay_2",
        }),
      }),
    );
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(result.balanceAfterPayment).toBe(75);
    expect(result.appliedAmount).toBe(25);
  });

  it("tracks deposit payments against the invoice without closing it", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_2d",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
      depositTargetAmount: 50,
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 25 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_2d",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_2d",
      amount: 25,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_2d",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "DEPOSIT_THEN_SETTLE",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 50,
      depositCollectedAmount: 25,
    });

    const result = await FinancePaymentService.recordInvoicePayment("inv_2d", {
      provider: "MANUAL",
      amount: 25,
      settlementChannel: "DEPOSIT",
      collectionMode: "DEPOSIT_THEN_SETTLE",
      currency: "usd",
      receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      rawProviderPayload: { source: "front-desk" },
    });

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_2d" },
        data: expect.objectContaining({
          billingCollectionMode: "DEPOSIT_THEN_SETTLE",
          depositCollectedAmount: 25,
        }),
      }),
    );
    const updateArgs = (prisma.invoice.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("visitBillingStage");
    expect(updateArgs.data).not.toHaveProperty("readyForBillingAt");
    expect(updateArgs.data).not.toHaveProperty("readyForBillingActorId");
    expect(result.balanceAfterPayment).toBe(75);
    expect(result.appliedAmount).toBe(25);
  });

  it("finalizes a succeeded booking payment even when the invoice is still payment-link based", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_booking_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_booking_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      metadata: {},
      payments: [],
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 50 }]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_booking_1",
      settlementChannel: "STRIPE",
      collectionMode: null,
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_booking_1",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_booking_1",
      amount: 50,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_booking_1",
      status: "PAID",
      totalAmount: 50,
      currency: "usd",
      parentId: "parent_booking_1",
      payments: [],
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_booking_1",
        paymentIntentId: "pi_booking_1",
        chargeId: "ch_booking_1",
        receiptUrl: "https://receipt",
        currency: "usd",
        amount: 50,
        connectedAccountId: "acct_1",
      });

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pa_booking_1" },
        data: expect.objectContaining({
          providerPaymentIntentId: "pi_booking_1",
          status: "SUCCEEDED",
        }),
      }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiptUrl: "https://receipt",
        }),
      }),
    );
    expect(result.action).toBe("PAID");
  });

  it("marks deposit invoices settled when fully paid", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_2f",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
      depositTargetAmount: 50,
      depositCollectedAmount: 25,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 100 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_2f",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_2f",
      amount: 100,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_2f",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      paidAt: new Date("2026-06-18T10:00:00.000Z"),
      billingCollectionMode: "DEPOSIT_THEN_SETTLE",
      visitBillingStage: "SETTLED",
      depositTargetAmount: 50,
      depositCollectedAmount: 50,
    });

    const result = await FinancePaymentService.recordInvoicePayment("inv_2f", {
      provider: "MANUAL",
      amount: 100,
      settlementChannel: "DEPOSIT",
      collectionMode: "DEPOSIT_THEN_SETTLE",
      currency: "usd",
      receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      rawProviderPayload: { source: "front-desk" },
    });

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_2f" },
        data: expect.objectContaining({
          status: "PAID",
          visitBillingStage: "SETTLED",
          billingCollectionMode: "DEPOSIT_THEN_SETTLE",
          depositCollectedAmount: 50,
        }),
      }),
    );
    expect(result.invoice.status).toBe("PAID");
    expect(result.balanceAfterPayment).toBe(0);
  });

  it("rejects deposit payments once the invoice is ready for billing", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_ready",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "DEPOSIT_THEN_SETTLE",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 50,
      depositCollectedAmount: 25,
    });

    await expect(
      FinancePaymentService.recordInvoicePayment("inv_ready", {
        provider: "MANUAL",
        amount: 25,
        settlementChannel: "DEPOSIT",
        collectionMode: "DEPOSIT_THEN_SETTLE",
        currency: "usd",
        receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      }),
    ).rejects.toThrow(
      "Deposit payments are not allowed after the invoice is ready for billing",
    );

    expect(prisma.paymentAttempt.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("creates a checkout session and payment attempt for payable invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_6",
      totalAmount: 100,
      // Load-bearing: the balance line is only charged tax-free when the balance
      // ALREADY includes tax. Without this the invoice reads as never-taxed and
      // Stripe must calculate tax on the balance instead.
      taxTotal: 10,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      items: [
        {
          name: "Consult",
          description: "Consult",
          unitPrice: 100,
          quantity: 1,
        },
      ],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([
      { amount: 30 },
    ]);
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_1",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_6",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      count: 1,
    });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_6");

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        // A prior credit means we charge the (tax-inclusive) remaining balance as a
        // single line, so automatic tax must be OFF to avoid taxing the balance twice.
        automatic_tax: {
          enabled: false,
        },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 7000,
            }),
          }),
        ],
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({
            invoiceId: "inv_6",
          }),
        }),
      }),
      {
        stripeAccount: "acct_1",
      },
    );
    const checkoutArgs = (stripeClient.checkout.sessions.create as jest.Mock)
      .mock.calls[0][0];
    expect(checkoutArgs).not.toHaveProperty("stripeAccount");
    expect(checkoutArgs.payment_intent_data).not.toHaveProperty(
      "transfer_data",
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_6",
          provider: "STRIPE",
          providerCheckoutSessionId: "cs_1",
          status: "REQUIRES_ACTION",
          amountRequested: 70,
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_6" },
        data: expect.objectContaining({
          paymentCollectionMethod: "PAYMENT_LINK",
        }),
      }),
    );
    expect(result.sessionId).toBe("cs_1");
    expect(result.paymentAttemptId).toBe("pa_6");
  });

  it("uses collected deposit amounts when pricing the remaining checkout balance", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_dep",
      totalAmount: 100,
      // The deposit already carried tax, so the remaining balance is
      // tax-inclusive and Stripe must not tax it again.
      taxTotal: 10,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      depositCollectedAmount: 25,
      items: [
        {
          name: "Consult",
          description: "Consult",
          unitPrice: 100,
          quantity: 1,
        },
      ],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_dep",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_dep",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      count: 1,
    });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_dep");

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: {
          enabled: false,
        },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 7500,
            }),
          }),
        ],
      }),
      {
        stripeAccount: "acct_1",
      },
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountRequested: 75,
        }),
      }),
    );
    expect(result.paymentAttemptId).toBe("pa_dep");
  });

  it("charges only the requested deposit, not the whole balance", async () => {
    // A deposit link used to be built from the full invoice, so asking for a
    // 25 deposit on a 500 invoice produced a 500 checkout labelled "deposit".
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_partial",
      totalAmount: 500,
      taxTotal: 0,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      items: [
        {
          name: "Surgery",
          description: "Surgery",
          unitPrice: 500,
          quantity: 1,
        },
      ],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_partial",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_partial",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({ count: 1 });

    await FinancePaymentService.createCheckoutSessionForInvoice(
      "inv_partial",
      "STRIPE",
      25,
    );

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({ unit_amount: 2500 }),
          }),
        ],
      }),
      { stripeAccount: "acct_1" },
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountRequested: 25,
          isPartial: true,
          collectionMode: "DEPOSIT_THEN_SETTLE",
        }),
      }),
    );
  });

  it("rejects a deposit larger than the outstanding balance", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_over",
      totalAmount: 100,
      taxTotal: 0,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice(
        "inv_over",
        "STRIPE",
        1000,
      ),
    ).rejects.toThrow("Deposit amount exceeds the outstanding balance");
    expect(prisma.paymentAttempt.create).not.toHaveBeenCalled();
  });

  it("itemises every line (discount-adjusted) with automatic tax for a fresh, unsettled invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_multi",
      totalAmount: 190,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      items: [
        {
          name: "Consult",
          description: "Consultation",
          unitPrice: 100,
          quantity: 1,
        },
        {
          name: "Vaccine",
          description: "Vaccine",
          unitPrice: 50,
          quantity: 2,
          discountPercent: 10,
        },
      ],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_multi",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_multi",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({ count: 1 });

    await FinancePaymentService.createCheckoutSessionForInvoice("inv_multi");

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // No prior payment/credit -> itemise every line and let Stripe add tax.
        automatic_tax: { enabled: true },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 10000,
              product_data: expect.objectContaining({ name: "Consult" }),
            }),
          }),
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              unit_amount: 4500,
              product_data: expect.objectContaining({ name: "Vaccine" }),
            }),
          }),
        ],
      }),
      {
        stripeAccount: "acct_1",
      },
    );
  });

  it("creates a payment intent and records a payment attempt for payable invoices", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_10",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        organisationId: "org_1",
        appointmentId: "appt_1",
        parentId: "parent_1",
        items: [],
      })
      .mockResolvedValueOnce({
        id: "inv_10",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        appointmentId: "appt_1",
        parentId: "parent_1",
        items: [],
      });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_10",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_10",
      client_secret: "cs_10",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_10",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_10",
    });

    const result = await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_10",
      {
        organisationId: "org_1",
      },
    );

    expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: "usd",
      }),
      {
        stripeAccount: "acct_10",
      },
    );
    const paymentIntentArgs = (stripeClient.paymentIntents.create as jest.Mock)
      .mock.calls[0][0];
    expect(paymentIntentArgs).not.toHaveProperty("stripeAccount");
    expect(paymentIntentArgs).not.toHaveProperty("transfer_data");
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_10",
          providerPaymentIntentId: "pi_10",
          status: "REQUIRES_ACTION",
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_10" },
        data: expect.objectContaining({
          paymentCollectionMethod: "PAYMENT_INTENT",
        }),
      }),
    );
    expect(result).toEqual({
      paymentIntentId: "pi_10",
      clientSecret: "cs_10",
      connectedAccountId: "acct_10",
      amount: 100,
      currency: "usd",
    });
  });

  it("creates booking deposit payment intents when requested by mobile", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_mobile_deposit",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      patientId: "patient_1",
      items: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_10",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_mobile_deposit",
      client_secret: "cs_mobile_deposit",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_mobile_deposit",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_mobile_deposit",
    });

    await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_mobile_deposit",
      { organisationId: "org_1" },
      {
        collectionMode: "DEPOSIT_THEN_SETTLE",
        settlementChannel: "DEPOSIT",
      },
    );

    expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: "INVOICE_PAYMENT",
          collectionMode: "DEPOSIT_THEN_SETTLE",
          settlementChannel: "DEPOSIT",
        }),
      }),
      { stripeAccount: "acct_10" },
    );
    const paymentIntentArgs = (stripeClient.paymentIntents.create as jest.Mock)
      .mock.calls[0][0];
    expect(paymentIntentArgs).not.toHaveProperty("transfer_data");
    expect(paymentIntentArgs).not.toHaveProperty("on_behalf_of");
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementChannel: "DEPOSIT",
          collectionMode: "DEPOSIT_THEN_SETTLE",
          rawProviderPayload: expect.objectContaining({
            settlementChannel: "DEPOSIT",
            collectionMode: "DEPOSIT_THEN_SETTLE",
          }),
        }),
      }),
    );
  });

  it("returns an existing checkout session without creating a new one", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_7",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      items: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pa_existing",
        amountRequested: 100,
        providerCheckoutSessionId: "cs_existing",
        rawProviderPayload: { url: "https://existing" },
      });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_7");

    expect(
      (prisma.organization.findUnique as jest.Mock).mock.calls,
    ).toHaveLength(0);
    expect((prisma.invoice.update as jest.Mock).mock.calls).toHaveLength(0);
    expect(prisma.paymentAttempt.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      sessionId: "cs_existing",
      url: "https://existing",
      paymentAttemptId: "pa_existing",
    });
  });

  it("rejects checkout session creation for in-clinic invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_8",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      organisationId: "org_1",
      items: [],
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_8"),
    ).rejects.toBeInstanceOf(FinancePaymentError);
  });

  it("records manual settlement for the outstanding balance", async () => {
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_3",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
      })
      .mockResolvedValueOnce({
        id: "inv_3",
        totalAmount: 100,
        currency: "usd",
        status: "PAID",
      });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([{ amount: 40 }])
      .mockResolvedValueOnce([{ amount: 40 }])
      .mockResolvedValueOnce([{ amount: 100 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_3",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_3",
      amount: 60,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_3",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      paidAt: new Date("2026-06-18T10:10:00.000Z"),
    });

    const result = await FinancePaymentService.recordManualPayment("inv_3", {
      settlementChannel: "CASH",
      receivedAt: new Date("2026-06-18T10:10:00.000Z"),
      reference: "receipt-001",
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 60,
          provider: "MANUAL",
          settlementChannel: "CASH",
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
        }),
      }),
    );
    expect(result.balanceAfterPayment).toBe(0);
    expect(result.paidToDate).toBe(100);
  });

  it("rejects payments for cancelled invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_4",
      totalAmount: 100,
      currency: "usd",
      status: "CANCELLED",
    });

    await expect(
      FinancePaymentService.recordInvoicePayment("inv_4", {
        provider: "MANUAL",
        amount: 10,
        settlementChannel: "CASH",
        currency: "usd",
      }),
    ).rejects.toBeInstanceOf(FinancePaymentError);
  });

  it("emits a payment failed event when marking a payment failed", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_failed_1",
      organisationId: "org_1",
      status: "PENDING",
      currency: "usd",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_failed_1",
      organisationId: "org_1",
      status: "FAILED",
      currency: "usd",
    });

    const result = await FinancePaymentService.handleInvoicePaymentFailed({
      invoiceId: "inv_failed_1",
      paymentIntentId: "pi_failed_1",
    });

    expect(result.action).toBe("FAILED");
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "PAYMENT_FAILED",
          entityType: "PAYMENT",
          entityId: "pi_failed_1",
        }),
      }),
    );
  });

  it("normalizes a Stripe payment intent success into invoice payment rows", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_1",
      organisationId: "org_1",
      totalAmount: 80,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_1",
      organisationId: "org_1",
      totalAmount: 80,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_webhook_1",
      settlementChannel: "DEPOSIT",
      collectionMode: "DEPOSIT_THEN_SETTLE",
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_webhook_1",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_webhook_1",
      amount: 80,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_1",
      status: "PAID",
      totalAmount: 80,
      currency: "usd",
      parentId: "parent_1",
      payments: [],
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_webhook_1",
        paymentIntentId: "pi_webhook_1",
        chargeId: "ch_webhook_1",
        receiptUrl: "https://receipt",
        currency: "usd",
        amount: 80,
        connectedAccountId: "acct_1",
      });

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pa_webhook_1" },
        data: expect.objectContaining({
          providerPaymentIntentId: "pi_webhook_1",
          status: "SUCCEEDED",
          settlementChannel: "DEPOSIT",
          collectionMode: "DEPOSIT_THEN_SETTLE",
        }),
      }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiptUrl: "https://receipt",
          settlementChannel: "DEPOSIT",
          collectionMode: "DEPOSIT_THEN_SETTLE",
        }),
      }),
    );
    expect(result.action).toBe("PAID");
  });

  it("normalizes a Stripe checkout session completion into invoice payment rows", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_2",
      organisationId: "org_1",
      totalAmount: 42,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_2",
      organisationId: "org_1",
      totalAmount: 42,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_webhook_2",
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_webhook_2",
    });
    (prisma.invoice.update as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_webhook_2",
        subtotal: 38,
        taxTotal: 4,
        taxPercent: 10.53,
        totalAmount: 42,
        currency: "usd",
        paymentCollectionMethod: "PAYMENT_LINK",
        status: "PENDING",
        parentId: "parent_2",
        payments: [],
      })
      .mockResolvedValueOnce({
        id: "inv_webhook_2",
        status: "PAID",
        totalAmount: 42,
        currency: "usd",
        parentId: "parent_2",
        payments: [],
      });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_webhook_2",
      amount: 42,
      status: "SUCCEEDED",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_webhook_2",
        sessionId: "cs_webhook_2",
        paymentIntentId: "pi_webhook_2",
        connectedAccountId: "acct_1",
        currency: "usd",
        amountSubtotal: 38,
        amountTotal: 42,
        amountTax: 4,
        automaticTaxStatus: "complete",
      });

    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "inv_webhook_2" },
        data: expect.objectContaining({
          taxProvider: "STRIPE",
          subtotal: 38,
          taxTotal: 4,
          taxPercent: 10.53,
          totalAmount: 42,
          taxSnapshot: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({
                provider: "STRIPE",
                providerReferenceId: "cs_webhook_2",
                taxableSubtotal: 38,
                taxAmount: 4,
              }),
            }),
          }),
        }),
      }),
    );
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pa_webhook_2" },
        data: expect.objectContaining({
          status: "SUCCEEDED",
          providerPaymentIntentId: "pi_webhook_2",
        }),
      }),
    );
    expect(result.action).toBe("PAID");
  });

  it("keeps the invoice total when a deposit session completes", async () => {
    // The session was billed for the deposit, so its amount_total describes the
    // deposit and not the invoice. Restating the invoice from it shrinks the
    // total to the deposit, after which the deposit clears the balance and the
    // invoice reads fully paid while most of it is still owed.
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_deposit_1",
      organisationId: "org_1",
      totalAmount: 400,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_deposit_1",
      organisationId: "org_1",
      totalAmount: 400,
      depositCollectedAmount: 0,
      depositTargetAmount: 100,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_deposit_1",
      collectionMode: "DEPOSIT_THEN_SETTLE",
      isPartial: true,
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_deposit_1",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_deposit_1",
      amount: 100,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_deposit_1",
      totalAmount: 400,
      depositCollectedAmount: 100,
      currency: "usd",
      status: "PENDING",
      payments: [],
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_deposit_1",
        sessionId: "cs_deposit_1",
        paymentIntentId: "pi_deposit_1",
        connectedAccountId: "acct_1",
        currency: "usd",
        amountSubtotal: 100,
        amountTotal: 100,
        amountTax: 0,
        automaticTaxStatus: "complete",
      });

    // No call restates the invoice from the session: the only invoice write is
    // the deposit bookkeeping one, and it leaves the total alone.
    const invoiceWrites = (prisma.invoice.update as jest.Mock).mock.calls;
    for (const [call] of invoiceWrites) {
      expect(call.data).not.toHaveProperty("totalAmount");
      expect(call.data).not.toHaveProperty("taxProvider");
      expect(call.data.status).not.toBe("PAID");
    }
    expect(invoiceWrites).toContainEqual([
      expect.objectContaining({
        where: { id: "inv_deposit_1" },
        data: expect.objectContaining({
          depositCollectedAmount: 100,
          billingCollectionMode: "DEPOSIT_THEN_SETTLE",
        }),
      }),
    ]);
    expect(result.action).toBe("PAID");
  });

  it("normalizes a refund webhook into invoice refund rows", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_3",
      status: "PAID",
      metadata: {},
      payments: [],
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pay_webhook_3",
      provider: "STRIPE",
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_webhook_3",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_webhook_3",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_3",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      invoiceId: "inv_webhook_3",
      paymentIntentId: "pi_webhook_3",
      chargeId: "ch_webhook_3",
      amount: 80,
      currency: "usd",
      reason: "requested by owner",
    });

    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: "pay_webhook_3",
          providerRefundId: "ch_webhook_3",
          amount: 80,
        }),
      }),
    );
    expect(result.action).toBe("REFUNDED");
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REFUNDED",
        }),
      }),
    );
  });

  it("refunds a Stripe-backed invoice payment", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_9",
      totalAmount: 90,
      currency: "usd",
      status: "PAID",
      metadata: {},
      payments: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "pa_9",
        invoiceId: "inv_9",
        providerPaymentIntentId: "pi_9",
      })
      .mockResolvedValueOnce({
        invoiceId: "inv_9",
        rawProviderPayload: { connectedAccountId: "acct_9" },
      });
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: { id: "ch_9" },
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_9",
      status: "succeeded",
      amount: 9000,
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_9",
      amount: 90,
      currency: "usd",
      provider: "STRIPE",
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_9",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_9",
      status: "REFUNDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_9",
      status: "REFUNDED",
      currency: "usd",
      payments: [],
    });

    const result = await FinancePaymentService.refundInvoicePayment(
      "inv_9",
      "requested by owner",
    );

    expect(stripeClient.paymentIntents.retrieve).toHaveBeenCalledWith(
      "pi_9",
      { expand: ["latest_charge"] },
      { stripeAccount: "acct_9" },
    );
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_9" },
      { stripeAccount: "acct_9" },
    );
    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: "pay_9",
          provider: "STRIPE",
          providerRefundId: "re_9",
          amount: 90,
        }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_REFUNDED",
          entityType: "INVOICE",
          entityId: "inv_9",
        }),
      }),
    );
    expect(result.refund.refundId).toBe("re_9");
    expect(result.invoice.status).toBe("REFUNDED");
  });

  it("refunds a payment by payment id", async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_10",
      invoiceId: "inv_10",
      provider: "MANUAL",
      providerPaymentId: null,
      amount: 50,
      currency: "usd",
      invoice: {
        organisationId: "org_1",
      },
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_10",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_10",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.refundPaymentById("pay_10", {
      amount: 20,
      reason: "SERVICE_NOT_RENDERED",
    });

    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: "pay_10",
          amount: 20,
          provider: "MANUAL",
        }),
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay_10" },
        data: expect.objectContaining({
          status: "PARTIALLY_REFUNDED",
        }),
      }),
    );
    expect(result.refund.amountRefunded).toBe(20);
  });

  it("lists invoice payments in creation order", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: "pay_1", amount: 20, status: "SUCCEEDED" },
      { id: "pay_2", amount: 30, status: "SUCCEEDED" },
    ]);

    const payments =
      await FinancePaymentService.listPaymentsForInvoice("inv_5");

    expect(payments).toHaveLength(2);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: "inv_5" },
      }),
    );
  });

  it("covers checkout session error branches", async () => {
    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice(
        "inv_unsupported",
        "MANUAL" as any,
      ),
    ).rejects.toMatchObject({
      message: "Unsupported payment provider",
      statusCode: 400,
    });

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_missing"),
    ).rejects.toMatchObject({
      message: "Invoice not found",
      statusCode: 404,
    });

    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_unpayable",
        totalAmount: 100,
        currency: "usd",
        status: "PAID",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: "inv_no_org",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: "inv_no_stripe",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: "inv_no_items",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        items: [],
      });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_unpayable"),
    ).rejects.toMatchObject({
      message: "Invoice is not payable",
      statusCode: 409,
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_no_org"),
    ).rejects.toMatchObject({
      message: "Invoice missing organisation",
      statusCode: 500,
    });

    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: null,
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_no_stripe"),
    ).rejects.toMatchObject({
      message: "Organisation not connected to Stripe",
      statusCode: 409,
    });

    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_no_items"),
    ).rejects.toMatchObject({
      message: "Invoice items are missing",
      statusCode: 400,
    });
  });

  it("handles checkout session reuse without a stored url", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_existing_checkout",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pa_existing",
        amountRequested: 100,
        providerCheckoutSessionId: "cs_existing",
        rawProviderPayload: { url: "" },
      });

    const result = await FinancePaymentService.createCheckoutSessionForInvoice(
      "inv_existing_checkout",
    );

    expect(result).toEqual({
      sessionId: "cs_existing",
      url: null,
      paymentAttemptId: "pa_existing",
    });
  });

  it("cancels a stale checkout session and creates a fresh one for the reduced balance", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_repriced",
      totalAmount: 114,
      taxTotal: 14,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      depositCollectedAmount: 10,
      items: [
        {
          name: "Consult",
          description: "Consult",
          unitPrice: 114,
          quantity: 1,
        },
      ],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pa_stale",
        amountRequested: 114,
        providerCheckoutSessionId: "cs_stale",
        rawProviderPayload: { url: "https://checkout-old" },
      });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_fresh",
      url: "https://checkout-fresh",
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_stale",
      status: "CANCELED",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_fresh",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_repriced",
    });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice(
        "inv_repriced",
      );

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "pa_stale" },
      data: { status: "CANCELED" },
    });
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: { enabled: false },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 10400,
            }),
          }),
        ],
      }),
      {
        stripeAccount: "acct_1",
      },
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountRequested: 104,
        }),
      }),
    );
    expect(result).toEqual({
      sessionId: "cs_fresh",
      url: "https://checkout-fresh",
      paymentAttemptId: "pa_fresh",
    });
  });

  // Stripe takes zero-decimal currencies in their own units, not hundredths, so
  // multiplying by 100 unconditionally submitted a 1,000 JPY invoice as 100,000.
  it("submits a zero-decimal currency without scaling it to hundredths", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_jpy",
      totalAmount: 1000,
      currency: "jpy",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      appointmentId: "",
      parentId: "",
      items: [{ name: "Consult", quantity: 1, unitPrice: 900, total: 900 }],
      taxTotal: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_jpy",
    });
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_jpy",
    });
    stripeClient.checkout.sessions.create.mockResolvedValueOnce({
      id: "cs_jpy",
      url: "https://checkout.test/jpy",
    });

    await FinancePaymentService.createCheckoutSessionForInvoice("inv_jpy");

    const [sessionArgs] = stripeClient.checkout.sessions.create.mock
      .calls[0] as [
      { line_items: Array<{ price_data: { unit_amount: number } }> },
    ];
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(1000);
  });

  it("charges the current invoice balance when discounts change the raw item total", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_discounted",
      totalAmount: 90,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_discounted",
    });
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_discounted",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_discounted",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_discounted",
    });

    await FinancePaymentService.createCheckoutSessionForInvoice(
      "inv_discounted",
    );

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // An invoice-level discount makes the item sum differ from the pre-tax
        // total, so the balance is charged as one line - but this invoice's tax
        // was never calculated (`taxTotal` is absent, so `totalAmount` is the
        // discounted PRE-tax subtotal). Disabling automatic tax here charged the
        // customer a pre-tax amount and then recorded the invoice paid at that
        // under-taxed total, so Stripe keeps calculating tax on the balance.
        automatic_tax: {
          enabled: true,
        },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 9000 }),
            quantity: 1,
          }),
        ],
      }),
      {
        stripeAccount: "acct_discounted",
      },
    );
  });

  it("covers payment intent branches", async () => {
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_existing_intent",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        items: [],
      })
      .mockResolvedValueOnce({
        id: "inv_no_balance",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        items: [],
      })
      .mockResolvedValueOnce({
        id: "inv_no_stripe",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
        organisationId: "org_1",
        items: [],
      });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "pa_existing_intent",
        providerPaymentIntentId: "pi_existing",
        amountRequested: 100,
        rawProviderPayload: {
          clientSecret: "cs_existing",
          connectedAccountId: "acct_existing",
        },
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 100 }])
      .mockResolvedValueOnce([]);
    (prisma.creditNote.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice(
        "inv_existing_intent",
        { organisationId: "org_1" },
      ),
    ).resolves.toEqual({
      paymentIntentId: "pi_existing",
      clientSecret: "cs_existing",
      connectedAccountId: "acct_existing",
      amount: 100,
      currency: "usd",
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_no_balance", {
        organisationId: "org_1",
      }),
    ).rejects.toMatchObject({
      message: "Invoice has no outstanding balance",
      statusCode: 409,
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_no_stripe", {
        organisationId: "org_1",
      }),
    ).rejects.toMatchObject({
      message: "Organisation does not have a Stripe connected account",
      statusCode: 409,
    });
  });

  it("creates a new payment intent for a reopened invoice with prior succeeded payment", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_reopened",
      totalAmount: 125,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      patientId: "patient_1",
      items: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { amount: 100 },
    ]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_10",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_new_balance",
      client_secret: "cs_new_balance",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_new_balance",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_reopened",
    });

    const result = await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_reopened",
      {
        organisationId: "org_1",
      },
    );

    expect(prisma.paymentAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerPaymentIntentId: { not: null },
          status: { notIn: ["SUCCEEDED", "CANCELED"] },
        }),
      }),
    );
    expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: "usd",
      }),
      { stripeAccount: "acct_10" },
    );
    expect(result).toEqual({
      paymentIntentId: "pi_new_balance",
      clientSecret: "cs_new_balance",
      connectedAccountId: "acct_10",
      amount: 25,
      currency: "usd",
    });
  });

  it("covers refund and webhook error branches", async () => {
    await expect(
      FinancePaymentService.refundPaymentIntent("pi_missing"),
    ).rejects.toMatchObject({
      message: "Invoice not found",
      statusCode: 404,
    });

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_refund_missing",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      payments: [],
      metadata: {},
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      FinancePaymentService.refundInvoicePayment("inv_refund_missing"),
    ).rejects.toMatchObject({
      message: "Invoice has no refundable payment",
      statusCode: 409,
    });

    await expect(
      FinancePaymentService.refundPaymentById("pay_missing"),
    ).rejects.toMatchObject({
      message: "Payment not found",
      statusCode: 404,
    });

    await expect(
      FinancePaymentService.handleInvoicePaymentFailed({
        paymentIntentId: "pi_missing",
      }),
    ).resolves.toEqual({ action: "NO_INVOICE" });

    await expect(
      FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        paymentIntentId: "pi_missing",
      }),
    ).resolves.toEqual({ action: "NO_INVOICE" });

    await expect(
      FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        sessionId: "cs_missing",
      }),
    ).resolves.toEqual({ action: "NO_INVOICE" });

    await expect(
      FinancePaymentService.markInvoiceRefundedFromWebhook({
        amount: 10,
        currency: "usd",
      }),
    ).resolves.toEqual({ action: "NO_INVOICE" });
  });

  it("uses invoice line items when no payments or credits exist", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_items",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      items: [
        { name: "Consult", description: "Consult", unitPrice: 60, quantity: 1 },
        { name: "Lab", description: "Lab", unitPrice: 40, quantity: 1 },
      ],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_items",
    });
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_items",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_items",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_items",
    });

    await FinancePaymentService.createCheckoutSessionForInvoice("inv_items");

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: {
          enabled: true,
        },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 6000 }),
          }),
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 4000 }),
          }),
        ],
      }),
      {
        stripeAccount: "acct_items",
      },
    );
  });

  it("refunds a manual invoice payment without calling Stripe", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_manual_refund",
      totalAmount: 80,
      currency: "usd",
      status: "PAID",
      metadata: {},
      payments: [
        {
          id: "pay_manual_refund",
          amount: 80,
          currency: "usd",
          provider: "MANUAL",
          providerPaymentId: null,
        },
      ],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_manual_refund",
      status: "SUCCEEDED",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_manual_refund",
      status: "REFUNDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_manual_refund",
      status: "REFUNDED",
      currency: "usd",
      payments: [],
    });

    const result =
      await FinancePaymentService.refundInvoicePayment("inv_manual_refund");

    expect(result.refund.providerRefundId).toBeNull();
    expect(result.refund.status).toBe("SUCCEEDED");
  });

  it("refunds a Stripe payment by id using a string charge id", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_stripe_refund",
      invoiceId: "inv_stripe_refund",
      provider: "STRIPE",
      providerPaymentId: "pi_stripe_refund",
      amount: 50,
      currency: "usd",
      invoice: {
        organisationId: "org_1",
      },
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_stripe_refund",
      rawProviderPayload: { connectedAccountId: "acct_refund" },
    });
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: "ch_stripe_refund",
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_stripe_refund",
      status: "canceled",
      amount: 5000,
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_stripe_refund",
      status: "CANCELED",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_stripe_refund",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.refundPaymentById(
      "pay_stripe_refund",
      { amount: 50 },
    );

    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_stripe_refund", amount: 5000 },
      { stripeAccount: "acct_refund" },
    );
    expect(result.refund.status).toBe("CANCELED");
  });

  it("refunds all invoice payments when cancelling an invoice with collected money", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "pay_1", amount: 30 },
      { id: "pay_2", amount: 20 },
    ]);
    (prisma.payment.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "pay_1",
        invoiceId: "inv_multi_refund",
        provider: "MANUAL",
        providerPaymentId: null,
        amount: 30,
        currency: "usd",
        invoice: {
          organisationId: "org_1",
        },
      })
      .mockResolvedValueOnce({
        id: "pay_2",
        invoiceId: "inv_multi_refund",
        provider: "MANUAL",
        providerPaymentId: null,
        amount: 20,
        currency: "usd",
        invoice: {
          organisationId: "org_1",
        },
      });
    (prisma.refund.create as jest.Mock)
      .mockResolvedValueOnce({ id: "refund_1", status: "SUCCEEDED" })
      .mockResolvedValueOnce({ id: "refund_2", status: "SUCCEEDED" });
    (prisma.payment.update as jest.Mock)
      .mockResolvedValueOnce({ id: "pay_1", status: "REFUNDED" })
      .mockResolvedValueOnce({ id: "pay_2", status: "REFUNDED" });
    (prisma.invoice.update as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_multi_refund",
        status: "REFUNDED",
        currency: "usd",
        payments: [],
      })
      .mockResolvedValueOnce({
        id: "inv_multi_refund",
        status: "REFUNDED",
        currency: "usd",
        payments: [],
      });

    const result = await FinancePaymentService.refundInvoicePayments(
      "inv_multi_refund",
      "owner request",
    );

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          invoiceId: "inv_multi_refund",
          status: "SUCCEEDED",
        },
      }),
    );
    expect(result.totalRefunded).toBe(50);
    expect(result.refunds).toHaveLength(2);
  });

  it("refunds payment-intent and checkout webhook events when invoice lookups succeed", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValue({
      latest_charge: "ch_lookup",
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValue({
      id: "re_lookup",
      status: "succeeded",
      amount: 1000,
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      stripeAccountId: "acct_lookup",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        invoiceId: "inv_checkout_lookup",
      })
      .mockResolvedValueOnce(null);
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_pi_lookup",
      organisationId: "org_1",
      status: "PENDING",
      paymentCollectionMethod: "MANUAL",
      metadata: {},
      payments: [],
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_checkout_lookup",
      organisationId: "org_1",
      status: "PENDING",
      paymentCollectionMethod: "MANUAL",
    });

    await expect(
      FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_pi_lookup",
        paymentIntentId: "pi_lookup",
        connectedAccountId: "acct_lookup",
        amount: 10,
      }),
    ).resolves.toMatchObject({ action: "REFUNDED" });

    await expect(
      FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        sessionId: "cs_lookup",
        paymentIntentId: "pi_checkout_lookup",
        connectedAccountId: "acct_lookup",
        amountTotal: 10,
      }),
    ).resolves.toMatchObject({ action: "REFUNDED" });

    expect(stripeClient.refunds.create).toHaveBeenCalledTimes(2);
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_lookup" },
      { stripeAccount: "acct_lookup" },
    );
  });
  it("rejects a payment-intent webhook whose event account is not the invoice organisation's", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_evil",
      organisationId: "org_victim",
      totalAmount: 500,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_victim",
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_evil",
        paymentIntentId: "pi_evil",
        amount: 500,
        connectedAccountId: "acct_attacker",
      });

    expect(result.action).toBe("ACCOUNT_MISMATCH");
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.paymentAttempt.update).not.toHaveBeenCalled();
  });

  it("refunds a payment-intent webhook that has no active local attempt", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: "ch_unbound",
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_unbound",
      status: "succeeded",
      amount: 5000,
    });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_unbound",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    // no active attempt binds this payment intent to the invoice
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_unbound",
        paymentIntentId: "pi_unbound",
        amount: 50,
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("REFUNDED");
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_unbound" },
      { stripeAccount: "acct_1" },
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects a payment-intent webhook that reports no captured amount instead of settling the invoice total", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_no_amount",
      organisationId: "org_1",
      totalAmount: 900,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_no_amount",
      settlementChannel: "STRIPE",
      collectionMode: null,
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_no_amount",
        paymentIntentId: "pi_no_amount",
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("MISSING_AMOUNT");
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects a checkout session that no longer has an active attempt without rewriting invoice totals", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: "ch_stale",
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_stale",
      status: "succeeded",
      amount: 1000,
    });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_stale",
      organisationId: "org_1",
      totalAmount: 300,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    // the attempt for this session was CANCELED when the invoice amount changed
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_stale",
        sessionId: "cs_stale",
        paymentIntentId: "pi_stale",
        connectedAccountId: "acct_1",
        amountSubtotal: 10,
        amountTotal: 10,
      });

    expect(result.action).toBe("REFUNDED");
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("expires the stale checkout session at Stripe when the invoice amount changes", async () => {
    const stripeClient = {
      checkout: {
        sessions: { create: jest.fn(), expire: jest.fn() },
      },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_expire",
      organisationId: "org_1",
      totalAmount: 200,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      taxTotal: 0,
      items: [{ name: "Consult", quantity: 1, unitPrice: 200, total: 200 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pa_expire",
        amountRequested: 100,
        providerCheckoutSessionId: "cs_expire",
        rawProviderPayload: { connectedAccountId: "acct_expire" },
      });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_expire",
    });
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_new",
      url: "https://checkout/new",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_new",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_expire",
    });

    await FinancePaymentService.createCheckoutSessionForInvoice("inv_expire");

    expect(stripeClient.checkout.sessions.expire).toHaveBeenCalledWith(
      "cs_expire",
      {},
      { stripeAccount: "acct_expire" },
    );
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "pa_expire" },
      data: { status: "CANCELED" },
    });
  });

  it("expires stale sessions at Stripe when switching a payment-link invoice to a payment intent", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_switch",
      organisationId: "org_1",
      parentId: "parent_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
    });
    (prisma.paymentAttempt.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "pa_link",
        providerCheckoutSessionId: "cs_link",
        rawProviderPayload: { connectedAccountId: "acct_link" },
      },
    ]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_link",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_switch",
      client_secret: "cs_secret",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_switch",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_switch",
    });

    await FinancePaymentService.createPaymentIntentForInvoice("inv_switch", {
      organisationId: "org_1",
    });

    expect(stripeClient.checkout.sessions.expire).toHaveBeenCalledWith(
      "cs_link",
      {},
      { stripeAccount: "acct_link" },
    );
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELED" } }),
    );
  });

  it("does not fail the session refresh when Stripe rejects the expiry call", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.expire as jest.Mock).mockRejectedValueOnce(
      new Error("session already expired"),
    );
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_expire_fail",
      organisationId: "org_1",
      parentId: "parent_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
    });
    (prisma.paymentAttempt.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "pa_link",
        providerCheckoutSessionId: "cs_link",
        rawProviderPayload: { connectedAccountId: "acct_link" },
      },
    ]);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_link",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_ok",
      client_secret: "secret_ok",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_ok",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_expire_fail",
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_expire_fail", {
        organisationId: "org_1",
      }),
    ).resolves.toMatchObject({ paymentIntentId: "pi_ok" });
  });

  it("refuses to create a payment intent for an invoice owned by another parent", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_other_parent",
      organisationId: "org_1",
      parentId: "parent_owner",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_other_parent", {
        parentId: "parent_attacker",
      }),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("refuses to create a payment intent for an invoice owned by another organisation", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_other_org",
      organisationId: "org_owner",
      parentId: "parent_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_other_org", {
        organisationId: "org_attacker",
      }),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("refuses to create a payment intent when the caller is bound to no tenant", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_unscoped",
      organisationId: "org_1",
      parentId: "parent_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_unscoped", {}),
    ).rejects.toMatchObject({
      message: "Invoice scope is required",
      statusCode: 403,
    });
  });

  it("returns null when resolving a connected account with no identifiers", async () => {
    await expect(resolveStripeConnectedAccountId({})).resolves.toBeNull();
    expect(prisma.paymentAttempt.findFirst).not.toHaveBeenCalled();
  });

  it("rejects creating a payment attempt for a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.createPaymentAttempt("inv_missing_attempt", {
        provider: "STRIPE",
        currency: "usd",
      }),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
    expect(prisma.paymentAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects a checkout session when the invoice already has a payment intent", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_has_pi",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_existing_pi",
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_has_pi"),
    ).rejects.toMatchObject({
      message: "Invoice already has a PaymentIntent",
      statusCode: 409,
    });
  });

  it("rejects a checkout session when the invoice has no outstanding balance", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_paid_off",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      depositCollectedAmount: 0,
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { amount: 100 },
    ]);

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_paid_off"),
    ).rejects.toMatchObject({
      message: "Invoice has no outstanding balance",
      statusCode: 409,
    });
  });

  it("settles workspace treatment items when a full payment closes the invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_settle_items",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      appointmentId: "appt_settle",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      items: [
        { id: "row_1", name: "Consult" },
        { id: "row_2", name: "Vaccine" },
        { name: "line-without-id" },
      ],
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 100 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_settle",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_settle",
      amount: 100,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_settle_items",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      depositCollectedAmount: 0,
    });

    const result = await FinancePaymentService.recordInvoicePayment(
      "inv_settle_items",
      {
        provider: "MANUAL",
        amount: 100,
        settlementChannel: "CASH",
        currency: "usd",
        receivedAt: new Date("2026-06-18T10:00:00.000Z"),
      },
    );

    expect(prisma.workspaceTreatmentItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointmentId: "appt_settle",
          invoiceRowId: { in: ["row_1", "row_2"] },
        }),
        data: expect.objectContaining({
          settledInvoiceId: "inv_settle_items",
          settledAt: new Date("2026-06-18T10:00:00.000Z"),
        }),
      }),
    );
    expect(result.invoice.status).toBe("PAID");
    expect(result.balanceAfterPayment).toBe(0);
  });

  it("still reports REFUNDED when the unbound payment intent has no charge to refund", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: null,
    });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_nocharge",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_nocharge",
        paymentIntentId: "pi_nocharge",
        amount: 50,
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("REFUNDED");
    expect(stripeClient.refunds.create).not.toHaveBeenCalled();
  });

  it("still reports REFUNDED when refunding the unbound payment intent throws", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockRejectedValueOnce(
      new Error("stripe unavailable"),
    );
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_boom",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_boom",
        paymentIntentId: "pi_boom",
        amount: 50,
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("REFUNDED");
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("returns ALREADY_PAID after locating the invoice via its payment intent attempt", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_by_pi",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_by_pi",
      status: "PAID",
      organisationId: "org_1",
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        paymentIntentId: "pi_by_attempt",
        amount: 50,
      });

    expect(result.action).toBe("ALREADY_PAID");
    expect(prisma.paymentAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerPaymentIntentId: "pi_by_attempt" },
      }),
    );
  });

  it("locates the invoice via a stored payment when no attempt matches the intent", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_by_payment",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_by_payment",
      status: "PAID",
      organisationId: "org_1",
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        paymentIntentId: "pi_only_payment",
        amount: 50,
      });

    expect(result.action).toBe("ALREADY_PAID");
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerPaymentId: "pi_only_payment" },
      }),
    );
  });

  it("maps failed and pending Stripe refund statuses onto the local refund", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock)
      .mockResolvedValueOnce({ latest_charge: "ch_failed" })
      .mockResolvedValueOnce({ latest_charge: "ch_pending" });
    (stripeClient.refunds.create as jest.Mock)
      .mockResolvedValueOnce({
        id: "re_failed",
        status: "failed",
        amount: 5000,
      })
      .mockResolvedValueOnce({
        id: "re_pending",
        status: "pending",
        amount: 5000,
      });
    (prisma.payment.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "pay_failed",
        invoiceId: "inv_f",
        provider: "STRIPE",
        providerPaymentId: "pi_failed",
        amount: 50,
        currency: "usd",
        invoice: { organisationId: "org_1" },
      })
      .mockResolvedValueOnce({
        id: "pay_pending",
        invoiceId: "inv_p",
        provider: "STRIPE",
        providerPaymentId: "pi_pending",
        amount: 50,
        currency: "usd",
        invoice: { organisationId: "org_1" },
      });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        rawProviderPayload: { connectedAccountId: "acct_f" },
      })
      .mockResolvedValueOnce({
        rawProviderPayload: { connectedAccountId: "acct_p" },
      });
    (prisma.refund.create as jest.Mock)
      .mockResolvedValueOnce({ id: "refund_failed", status: "FAILED" })
      .mockResolvedValueOnce({ id: "refund_pending", status: "PENDING" });
    (prisma.payment.update as jest.Mock)
      .mockResolvedValueOnce({ id: "pay_failed", status: "REFUNDED" })
      .mockResolvedValueOnce({ id: "pay_pending", status: "REFUNDED" });

    await FinancePaymentService.refundPaymentById("pay_failed", { amount: 50 });
    await FinancePaymentService.refundPaymentById("pay_pending", {
      amount: 50,
    });

    expect(prisma.refund.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    expect(prisma.refund.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING" }),
      }),
    );
  });

  it("throws when constructing the Stripe client without a secret key", async () => {
    __setFinanceStripeClientForTests(null);
    const previousKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_nokey",
      invoiceId: "inv_nokey",
      provider: "STRIPE",
      providerPaymentId: "pi_nokey",
      amount: 50,
      currency: "usd",
      invoice: { organisationId: "org_1" },
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.refundPaymentById("pay_nokey", { amount: 50 }),
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured");

    if (previousKey !== undefined) {
      process.env.STRIPE_SECRET_KEY = previousKey;
    }
  });

  it("instantiates a Stripe client from the secret key when none is injected", async () => {
    __setFinanceStripeClientForTests(null);
    process.env.STRIPE_SECRET_KEY = "sk_test_ctor";
    const constructed = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    (Stripe as unknown as jest.Mock).mockImplementation(() => constructed);
    (constructed.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: "ch_new_client",
    });
    (constructed.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_new_client",
      status: "succeeded",
      amount: 5000,
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_new_client",
      invoiceId: "inv_new_client",
      provider: "STRIPE",
      providerPaymentId: "pi_new_client",
      amount: 50,
      currency: "usd",
      invoice: { organisationId: "org_1" },
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_new_client",
      status: "SUCCEEDED",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_new_client",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.refundPaymentById(
      "pay_new_client",
      { amount: 50 },
    );

    expect(Stripe).toHaveBeenCalledWith(
      "sk_test_ctor",
      expect.objectContaining({ apiVersion: expect.any(String) }),
    );
    expect(constructed.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_new_client", amount: 5000 },
      {},
    );
    expect(result.refund.providerRefundId).toBe("re_new_client");
  });

  it("rejects a payment intent for a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_pi_missing", {
        organisationId: "org_1",
      }),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("rejects a payment intent for an invoice that is not payable", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_pi_paid",
      organisationId: "org_1",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_pi_paid", {
        organisationId: "org_1",
      }),
    ).rejects.toMatchObject({
      message: "Invoice is not payable",
      statusCode: 409,
    });
  });

  it("rejects a payment intent for an in-clinic invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_pi_clinic",
      organisationId: "org_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      items: [],
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_pi_clinic", {
        organisationId: "org_1",
      }),
    ).rejects.toMatchObject({
      message: "Invoice is marked for in-clinic payment",
      statusCode: 409,
    });
  });

  it("cancels a mismatched existing payment intent attempt before creating a new one", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_mismatch",
      organisationId: "org_1",
      parentId: "parent_1",
      patientId: "patient_1",
      appointmentId: "appt_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_old_intent",
      providerPaymentIntentId: "pi_old_intent",
      amountRequested: 40,
      rawProviderPayload: {
        clientSecret: "old_secret",
        connectedAccountId: "acct_old",
      },
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_new",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_new_intent",
      client_secret: "secret_new",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_new_intent",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_mismatch",
    });

    const result = await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_mismatch",
      { organisationId: "org_1" },
    );

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "pa_old_intent" },
      data: { status: "CANCELED" },
    });
    expect(result.paymentIntentId).toBe("pi_new_intent");
  });

  it("rejects a payment intent when the invoice has no organisation", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_pi_no_org",
      organisationId: null,
      parentId: "parent_1",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_pi_no_org", {
        parentId: "parent_1",
      }),
    ).rejects.toMatchObject({
      message: "Invoice missing organisation",
      statusCode: 500,
    });
  });

  it("rejects refunding a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.refundInvoicePayment("inv_refund_missing_2"),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("rejects refunding a Stripe invoice payment that has no payment intent", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_stripe_no_pi",
      totalAmount: 90,
      currency: "usd",
      status: "PAID",
      metadata: {},
      payments: [
        {
          id: "pay_stripe_no_pi",
          provider: "STRIPE",
          providerPaymentId: null,
          amount: 90,
          currency: "usd",
        },
      ],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.refundInvoicePayment("inv_stripe_no_pi"),
    ).rejects.toMatchObject({
      message: "Invoice has no Stripe payment intent to refund",
      statusCode: 409,
    });
  });

  it("rejects refunding a Stripe invoice payment when Stripe reports no charge", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: null,
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_no_charge_refund",
      totalAmount: 90,
      currency: "usd",
      status: "PAID",
      metadata: {},
      payments: [
        {
          id: "pay_no_charge",
          provider: "STRIPE",
          providerPaymentId: "pi_no_charge",
          amount: 90,
          currency: "usd",
        },
      ],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        invoiceId: "inv_no_charge_refund",
        rawProviderPayload: { connectedAccountId: "acct_nc" },
      });

    await expect(
      FinancePaymentService.refundInvoicePayment("inv_no_charge_refund"),
    ).rejects.toMatchObject({
      message: "No charge found for refund",
      statusCode: 409,
    });
  });

  it("rejects refunding all payments when the invoice has none", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);

    await expect(
      FinancePaymentService.refundInvoicePayments("inv_no_pays"),
    ).rejects.toMatchObject({
      message: "Invoice has no refundable payment",
      statusCode: 409,
    });
  });

  it("refunds a payment intent by locating its invoice", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce({ invoiceId: "inv_pi_refund" })
      .mockResolvedValueOnce(null);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_pi_refund",
      totalAmount: 60,
      currency: "usd",
      status: "PAID",
      metadata: {},
      payments: [
        {
          id: "pay_pi_refund",
          provider: "MANUAL",
          providerPaymentId: null,
          amount: 60,
          currency: "usd",
        },
      ],
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_pi",
      status: "SUCCEEDED",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_pi_refund",
      status: "REFUNDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_pi_refund",
      status: "REFUNDED",
      currency: "usd",
      payments: [],
    });

    const result = await FinancePaymentService.refundPaymentIntent(
      "pi_refund_lookup",
      "duplicate charge",
    );

    expect(prisma.paymentAttempt.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { providerPaymentIntentId: "pi_refund_lookup" },
      }),
    );
    expect(result.refund.status).toBe("SUCCEEDED");
    expect(result.invoice.status).toBe("REFUNDED");
  });

  it("rejects refunding a payment that is missing its invoice", async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_no_inv",
      invoiceId: "inv_x",
      provider: "MANUAL",
      amount: 50,
      currency: "usd",
      invoice: null,
    });

    await expect(
      FinancePaymentService.refundPaymentById("pay_no_inv"),
    ).rejects.toMatchObject({
      message: "Payment is missing invoice",
      statusCode: 500,
    });
  });

  it("rejects a refund whose amount is not greater than zero", async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_zero",
      invoiceId: "inv_zero",
      provider: "MANUAL",
      amount: 50,
      currency: "usd",
      invoice: { organisationId: "org_1" },
    });

    await expect(
      FinancePaymentService.refundPaymentById("pay_zero", { amount: 0 }),
    ).rejects.toMatchObject({
      message: "Refund amount must be greater than zero",
      statusCode: 400,
    });
  });

  it("rejects a Stripe refund by id when the payment has no payment intent", async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_stripe_no_pi_id",
      invoiceId: "inv_snp",
      provider: "STRIPE",
      providerPaymentId: null,
      amount: 50,
      currency: "usd",
      invoice: { organisationId: "org_1" },
    });

    await expect(
      FinancePaymentService.refundPaymentById("pay_stripe_no_pi_id", {
        amount: 50,
      }),
    ).rejects.toMatchObject({
      message: "Payment has no Stripe payment intent to refund",
      statusCode: 409,
    });
  });

  it("rejects a Stripe refund by id when Stripe reports no charge", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: null,
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_snc",
      invoiceId: "inv_snc",
      provider: "STRIPE",
      providerPaymentId: "pi_snc",
      amount: 50,
      currency: "usd",
      invoice: { organisationId: "org_1" },
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      rawProviderPayload: { connectedAccountId: "acct_snc" },
    });

    await expect(
      FinancePaymentService.refundPaymentById("pay_snc", { amount: 50 }),
    ).rejects.toMatchObject({
      message: "No charge found for refund",
      statusCode: 409,
    });
  });

  it("rejects recording a manual payment for a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.recordManualPayment("inv_manual_missing"),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("rejects recording an invoice payment for a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinancePaymentService.recordInvoicePayment("inv_rip_missing", {
        provider: "MANUAL",
        amount: 10,
        currency: "usd",
      }),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("returns a no-op result when the invoice is already fully paid", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_fully_paid",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { amount: 100 },
    ]);

    const result = await FinancePaymentService.recordInvoicePayment(
      "inv_fully_paid",
      {
        provider: "MANUAL",
        amount: 50,
        currency: "usd",
      },
    );

    expect(result.payment).toBeNull();
    expect(result.paymentAttempt).toBeNull();
    expect(result.balanceAfterPayment).toBe(0);
    expect(result.paidToDate).toBe(100);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects an invoice payment whose amount is not greater than zero", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_amount_zero",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([]);

    await expect(
      FinancePaymentService.recordInvoicePayment("inv_amount_zero", {
        provider: "MANUAL",
        amount: 0,
        currency: "usd",
      }),
    ).rejects.toMatchObject({
      message: "Payment amount must be greater than zero",
      statusCode: 400,
    });
  });

  it("ignores an unbound payment intent for a payment-link invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_link_ignore",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_link_ignore",
        paymentIntentId: "pi_link_ignore",
        amount: 50,
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("IGNORED");
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("returns ALREADY_PAID for a checkout session on a paid invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_cs_paid",
      organisationId: "org_1",
      status: "PAID",
      metadata: {},
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_cs_paid",
        sessionId: "cs_paid",
        amountTotal: 50,
      });

    expect(result.action).toBe("ALREADY_PAID");
  });

  it("rejects a checkout session whose event account does not match the invoice organisation", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_cs_mismatch",
      organisationId: "org_1",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_real",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_cs_mismatch",
        sessionId: "cs_mismatch",
        connectedAccountId: "acct_attacker",
        amountTotal: 50,
      });

    expect(result.action).toBe("ACCOUNT_MISMATCH");
  });

  it("ignores a non-payment-link checkout session that carries no payment intent", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_cs_ignore",
      organisationId: "org_1",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_cs_ignore",
        sessionId: "cs_ignore",
        connectedAccountId: "acct_1",
        amountTotal: 50,
      });

    expect(result.action).toBe("IGNORED");
  });

  it("rejects a checkout session that reports no captured total", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_cs_no_total",
      organisationId: "org_1",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_cs_no_total",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_cs_no_total",
        sessionId: "cs_no_total",
        connectedAccountId: "acct_1",
        amountTotal: 0,
      });

    expect(result.action).toBe("MISSING_AMOUNT");
  });

  it("derives the tax amount from the session totals when Stripe omits the tax figure", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_cs_derivetax",
      organisationId: "org_1",
      totalAmount: 100,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      taxSnapshot: { taxBehavior: "EXCLUSIVE" },
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_cs_derivetax",
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_cs_derivetax",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_cs_derivetax",
      organisationId: "org_1",
      totalAmount: 110,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    (prisma.invoice.update as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_cs_derivetax",
        totalAmount: 110,
        currency: "usd",
        paymentCollectionMethod: "PAYMENT_LINK",
        status: "PENDING",
        depositCollectedAmount: 0,
        payments: [],
      })
      .mockResolvedValueOnce({
        id: "inv_cs_derivetax",
        status: "PAID",
        totalAmount: 110,
        currency: "usd",
        depositCollectedAmount: 0,
        payments: [],
      });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_cs_derivetax",
      amount: 110,
      status: "SUCCEEDED",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_cs_derivetax",
        sessionId: "cs_derivetax",
        connectedAccountId: "acct_1",
        amountSubtotal: 100,
        amountTotal: 110,
      });

    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 100,
          taxTotal: 10,
          totalAmount: 110,
        }),
      }),
    );
    expect(result.action).toBe("PAID");
  });

  it("marks the invoice refunded even when no matching payment exists", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_refund_no_payment",
      status: "PAID",
      metadata: { existing: "value" },
      payments: [],
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_refund_no_payment",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      invoiceId: "inv_refund_no_payment",
      amount: 25,
      currency: "usd",
      reason: "duplicate",
    });

    expect(result.action).toBe("REFUNDED");
    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("returns ALREADY_REFUNDED when the invoice is already refunded", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_already_refunded",
      status: "REFUNDED",
      metadata: {},
    });

    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      invoiceId: "inv_already_refunded",
      amount: 10,
      currency: "usd",
    });

    expect(result.action).toBe("ALREADY_REFUNDED");
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("records the payment for an unbound intent when the booking flow allows it", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_allow_unbound",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_allow_unbound",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      depositCollectedAmount: 0,
      payments: [],
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 50 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_allow_unbound",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_allow_unbound",
      amount: 50,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_allow_unbound",
      status: "PAID",
      totalAmount: 50,
      currency: "usd",
      depositCollectedAmount: 0,
      payments: [],
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_allow_unbound",
        paymentIntentId: "pi_allow_unbound",
        amount: 50,
        connectedAccountId: "acct_1",
        allowUnboundAttempt: true,
      });

    expect(result.action).toBe("PAID");
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementChannel: "STRIPE",
          providerPaymentId: "pi_allow_unbound",
          amount: 50,
        }),
      }),
    );
  });

  it("applies default fields when creating a bare payment attempt", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_bare",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_bare",
    });

    await FinancePaymentService.createPaymentAttempt("inv_bare", {
      provider: "STRIPE",
      currency: "usd",
    });

    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_bare",
          provider: "STRIPE",
          settlementChannel: null,
          status: "REQUIRES_PAYMENT_METHOD",
          amountRequested: 0,
          amountCaptured: 0,
          amountApplied: 0,
          collectionMode: null,
          isOffline: false,
          isPartial: false,
        }),
      }),
    );
  });

  it("defaults settlement channel and currency on the create path", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_def_rec",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 30 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_def_rec",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_def_rec",
      amount: 30,
      status: "SUCCEEDED",
    });

    const result = await FinancePaymentService.recordInvoicePayment(
      "inv_def_rec",
      { provider: "MANUAL", amount: 30 },
    );

    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementChannel: null,
          currency: "usd",
          isOffline: true,
        }),
      }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementChannel: null,
          currency: "usd",
        }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ settlementChannel: null }),
        }),
      }),
    );
    expect(result.appliedAmount).toBe(30);
  });

  it("defaults settlement channel and currency on the attempt-update path", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_upd_rec",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 40 }]);
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_upd_rec",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_upd_rec",
      amount: 40,
      status: "SUCCEEDED",
    });

    await FinancePaymentService.recordInvoicePayment("inv_upd_rec", {
      provider: "STRIPE",
      amount: 40,
      paymentAttemptId: "pa_upd_rec",
    });

    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pa_upd_rec" },
        data: expect.objectContaining({
          settlementChannel: null,
          currency: "usd",
          isOffline: false,
        }),
      }),
    );
  });

  it("defaults manual settlements to cash when no channel is provided", async () => {
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_man_def",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
      })
      .mockResolvedValueOnce({
        id: "inv_man_def",
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
      });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 100 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_man_def",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_man_def",
      amount: 100,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_man_def",
      totalAmount: 100,
      currency: "usd",
      status: "PAID",
      depositCollectedAmount: 0,
    });

    await FinancePaymentService.recordManualPayment("inv_man_def");

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "MANUAL",
          settlementChannel: "CASH",
        }),
      }),
    );
  });

  it("creates a checkout session for an invoice missing optional metadata fields", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_opt",
      totalAmount: 100,
      currency: "",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: null,
      parentId: null,
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_opt",
      url: null,
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_opt",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_opt");

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          appointmentId: "",
          parentId: "",
        }),
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({
            appointmentId: "",
            parentId: "",
          }),
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ currency: "usd" }),
          }),
        ],
      }),
      { stripeAccount: "acct_1" },
    );
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawProviderPayload: expect.objectContaining({ url: null }),
        }),
      }),
    );
    expect(result.url).toBeNull();
  });

  it("rejects a checkout session when invoice items are not an array", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_noarr",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      items: null,
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });

    await expect(
      FinancePaymentService.createCheckoutSessionForInvoice("inv_noarr"),
    ).rejects.toMatchObject({
      message: "Invoice items are missing",
      statusCode: 400,
    });
  });

  it("itemises malformed line items with fallback name, price, and quantity", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_malformed",
      totalAmount: 100,
      taxTotal: 0,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }, {}],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_malformed",
      url: "https://checkout",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_malformed",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({ count: 1 });

    await FinancePaymentService.createCheckoutSessionForInvoice(
      "inv_malformed",
    );

    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: { enabled: true },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 10000,
              product_data: expect.objectContaining({ name: "Consult" }),
            }),
          }),
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 0,
              product_data: expect.objectContaining({ name: "Service" }),
            }),
          }),
        ],
      }),
      { stripeAccount: "acct_1" },
    );
  });

  it("reuses an existing payment intent attempt with no stored secret", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_reuse",
      totalAmount: 50,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      depositCollectedAmount: 0,
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_reuse",
      amountRequested: null,
      providerPaymentIntentId: "pi_reuse",
      rawProviderPayload: null,
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { amount: 50 },
    ]);

    const result = await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_reuse",
      { organisationId: "org_1" },
    );

    expect(result).toEqual({
      paymentIntentId: "pi_reuse",
      clientSecret: null,
      connectedAccountId: null,
      amount: 0,
      currency: "usd",
    });
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("creates a payment intent defaulting the currency and null client secret", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_defcur",
      totalAmount: 100,
      currency: "",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: null,
      depositCollectedAmount: 0,
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_defcur",
      client_secret: null,
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_defcur",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_defcur",
    });

    const result = await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_defcur",
      { organisationId: "org_1" },
    );

    expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: "usd",
        metadata: expect.objectContaining({ parentId: "" }),
      }),
      { stripeAccount: "acct_1" },
    );
    expect(result).toEqual({
      paymentIntentId: "pi_defcur",
      clientSecret: null,
      connectedAccountId: "acct_1",
      amount: 100,
      currency: "usd",
    });
  });

  it("skips stale checkout attempts without a session id when creating a payment intent", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_stale_noid",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      depositCollectedAmount: 0,
    });
    (prisma.paymentAttempt.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "s1", providerCheckoutSessionId: null, rawProviderPayload: null },
    ]);
    (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValueOnce({
      count: 1,
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (stripeClient.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: "pi_stale_noid",
      client_secret: "cs_stale_noid",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_stale_noid",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_stale_noid",
    });

    await FinancePaymentService.createPaymentIntentForInvoice(
      "inv_stale_noid",
      {
        organisationId: "org_1",
      },
    );

    expect(stripeClient.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalled();
  });

  it("applies checkout tax with a null subtotal against a zero-total invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_k_tax",
      organisationId: "org_1",
      totalAmount: 0,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_k_tax",
    });
    (prisma.invoice.update as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_k_tax",
        currency: "usd",
        totalAmount: 40,
      })
      .mockResolvedValueOnce({
        id: "inv_k_tax",
        status: "PAID",
        totalAmount: 40,
        currency: "usd",
        depositCollectedAmount: 0,
        payments: [],
      });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_k_tax",
      totalAmount: 40,
      currency: "usd",
      status: "PENDING",
      depositCollectedAmount: 0,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 40 }]);
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_k_tax",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_k_tax",
      amount: 40,
      status: "SUCCEEDED",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_k_tax",
        sessionId: "cs_k_tax",
        paymentIntentId: "pi_k_tax",
        connectedAccountId: "acct_1",
        amountSubtotal: null,
        amountTotal: 40,
        amountTax: null,
        automaticTaxStatus: null,
      });

    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 0,
          taxTotal: 40,
          taxPercent: 0,
          totalAmount: 40,
        }),
      }),
    );
    expect(result.action).toBe("PAID");
  });

  it("returns ACCOUNT_MISMATCH when a payment intent event omits the connected account", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_l_mismatch",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_l_mismatch",
        paymentIntentId: "pi_l_mismatch",
        amount: 50,
      });

    expect(result.action).toBe("ACCOUNT_MISMATCH");
  });

  it("refunds an unbound payment intent whose charge is returned as an object", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: { id: "ch_obj_unbound" },
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_obj_unbound",
      status: "succeeded",
      amount: 5000,
    });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_obj_unbound",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        invoiceId: "inv_obj_unbound",
        paymentIntentId: "pi_obj_unbound",
        amount: 50,
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("REFUNDED");
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_obj_unbound" },
      { stripeAccount: "acct_1" },
    );
  });

  it("returns ACCOUNT_MISMATCH when a checkout event omits the connected account", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_n_mismatch",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_n_mismatch",
        sessionId: "cs_n_mismatch",
        amountTotal: 50,
      });

    expect(result.action).toBe("ACCOUNT_MISMATCH");
  });

  it("returns MISSING_AMOUNT when a checkout event reports no total", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_o_total",
      organisationId: "org_1",
      totalAmount: 50,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_o_total",
    });

    const result =
      await FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        invoiceId: "inv_o_total",
        sessionId: "cs_o_total",
        connectedAccountId: "acct_1",
      });

    expect(result.action).toBe("MISSING_AMOUNT");
  });

  it("marks an invoice refunded by locating it through the payment intent", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_p1",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_p1",
      status: "PAID",
      metadata: {},
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pay_p1",
      provider: "STRIPE",
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_p1",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_p1",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_p1",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      paymentIntentId: "pi_p1",
      chargeId: "ch_p1",
      amount: 20,
      currency: "usd",
      reason: "duplicate",
    });

    expect(result.action).toBe("REFUNDED");
  });

  it("marks an invoice refunded with null charge, reason, and metadata", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_p2",
      status: "PAID",
      metadata: null,
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pay_p2",
      provider: "MANUAL",
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_p2",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_p2",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_p2",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      invoiceId: "inv_p2",
      amount: 15,
      currency: "usd",
    });

    expect(result.action).toBe("REFUNDED");
    expect(prisma.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerRefundId: null,
          reason: undefined,
        }),
      }),
    );
  });

  it("returns NO_INVOICE when a refund webhook has no identifiers", async () => {
    const result = await FinancePaymentService.markInvoiceRefundedFromWebhook({
      amount: 5,
      currency: "usd",
    });

    expect(result.action).toBe("NO_INVOICE");
  });

  it("fails an invoice located through the payment intent", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_q1",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_q1",
      organisationId: "org_1",
      status: "PENDING",
      currency: "usd",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_q1",
      status: "FAILED",
    });

    const result = await FinancePaymentService.handleInvoicePaymentFailed({
      paymentIntentId: "pi_q1",
    });

    expect(result.action).toBe("FAILED");
  });

  it("fails a payment with defaulted organisation, entity, and appointment fields", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_q2",
      organisationId: null,
      status: "PENDING",
      currency: "usd",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_q2",
      status: "FAILED",
    });

    const result = await FinancePaymentService.handleInvoicePaymentFailed({
      invoiceId: "inv_q2",
    });

    expect(result.action).toBe("FAILED");
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityId: "inv_q2",
          payload: expect.objectContaining({
            appointmentId: null,
            paymentIntentId: null,
          }),
        }),
      }),
    );
  });

  it("returns NO_INVOICE when a payment-failed event has no identifiers", async () => {
    const result = await FinancePaymentService.handleInvoicePaymentFailed({});

    expect(result.action).toBe("NO_INVOICE");
  });

  it("returns NO_INVOICE when a payment intent event has no identifiers", async () => {
    const result =
      await FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        paymentIntentId: "",
      });

    expect(result.action).toBe("NO_INVOICE");
  });

  it("resolves a connected account through the invoice when no id is stored", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_s",
      rawProviderPayload: null,
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      organisationId: "org_s",
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: null,
    });

    await expect(
      resolveStripeConnectedAccountId({ paymentIntentId: "pi_s" }),
    ).resolves.toBeNull();
    expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv_s" } }),
    );
  });

  it("resolves to null when the attempt's invoice cannot be found", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      resolveStripeConnectedAccountId({ invoiceId: "inv_s2" }),
    ).resolves.toBeNull();
  });

  it("resolves to null when only a payment intent id yields no attempt", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      resolveStripeConnectedAccountId({ paymentIntentId: "pi_s3" }),
    ).resolves.toBeNull();
    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
  });

  it("refunds a Stripe invoice payment using a string charge and null metadata", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_t",
      totalAmount: 90,
      currency: "usd",
      status: "PAID",
      paidAt: null,
      metadata: null,
      payments: [],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce({ providerPaymentIntentId: "pi_t" })
      .mockResolvedValueOnce({
        invoiceId: "inv_t",
        rawProviderPayload: { connectedAccountId: "acct_t" },
      });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_t",
      provider: "STRIPE",
      amount: 90,
      currency: "usd",
    });
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: "ch_t_string",
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_t",
      status: "succeeded",
      amount: 9000,
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_t",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_t",
      status: "REFUNDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_t",
      status: "REFUNDED",
      currency: "usd",
      payments: [],
    });

    const result = await FinancePaymentService.refundInvoicePayment("inv_t");

    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_t_string" },
      { stripeAccount: "acct_t" },
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ amount: 90 }),
        }),
      }),
    );
    expect(result.refund.amountRefunded).toBe(90);
    expect(result.invoice.status).toBe("REFUNDED");
  });

  it("refunds a Stripe payment by id with an object charge, defaulted amount, and null org", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "pay_u",
      invoiceId: "inv_u",
      provider: "STRIPE",
      providerPaymentId: "pi_u",
      amount: 70,
      currency: "usd",
      invoice: { organisationId: null },
    });
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_u",
      rawProviderPayload: { connectedAccountId: "acct_u" },
    });
    (stripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
      latest_charge: { id: "ch_u_obj" },
    });
    (stripeClient.refunds.create as jest.Mock).mockResolvedValueOnce({
      id: "re_u",
      status: "succeeded",
      amount: 7000,
    });
    (prisma.refund.create as jest.Mock).mockResolvedValueOnce({
      id: "refund_u",
    });
    (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
      id: "pay_u",
      status: "REFUNDED",
    });

    const result = await FinancePaymentService.refundPaymentById("pay_u");

    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      { charge: "ch_u_obj", amount: 7000 },
      { stripeAccount: "acct_u" },
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REFUNDED" }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "PAYMENT_REFUNDED",
          entityId: "pay_u",
          payload: expect.objectContaining({ amountRefunded: 70 }),
        }),
      }),
    );
    expect(result.refund.amountRefunded).toBe(70);
  });

  it("tracks a deposit when the invoice has no prior collected amount", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_v_dep",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
      depositTargetAmount: 50,
    });
    (prisma.payment.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 25 }]);
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_v_dep",
    });
    (prisma.payment.create as jest.Mock).mockResolvedValueOnce({
      id: "pay_v_dep",
      amount: 25,
      status: "SUCCEEDED",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_v_dep",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "DEPOSIT_THEN_SETTLE",
      depositCollectedAmount: 25,
    });

    await FinancePaymentService.recordInvoicePayment("inv_v_dep", {
      provider: "MANUAL",
      amount: 25,
      settlementChannel: "DEPOSIT",
      collectionMode: "DEPOSIT_THEN_SETTLE",
      currency: "usd",
    });

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          depositCollectedAmount: 25,
          billingCollectionMode: "DEPOSIT_THEN_SETTLE",
        }),
      }),
    );
  });

  it("reprices a stale checkout attempt that has no recorded amount", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
    };
    __setFinanceStripeClientForTests(stripeClient);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_w",
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      organisationId: "org_1",
      appointmentId: "appt_1",
      parentId: "parent_1",
      items: [{ name: "Consult", unitPrice: 100, quantity: 1 }],
    });
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pa_stale_w",
        amountRequested: null,
        providerCheckoutSessionId: "cs_stale_w",
        rawProviderPayload: { connectedAccountId: "acct_1" },
      });
    (stripeClient.checkout.sessions.expire as jest.Mock).mockResolvedValueOnce({
      id: "cs_stale_w",
      status: "expired",
    });
    (prisma.paymentAttempt.update as jest.Mock).mockResolvedValueOnce({
      id: "pa_stale_w",
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_1",
    });
    (stripeClient.checkout.sessions.create as jest.Mock).mockResolvedValueOnce({
      id: "cs_new_w",
      url: "https://new",
    });
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValueOnce({
      id: "pa_new_w",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const result =
      await FinancePaymentService.createCheckoutSessionForInvoice("inv_w");

    expect(stripeClient.checkout.sessions.expire).toHaveBeenCalledWith(
      "cs_stale_w",
      {},
      { stripeAccount: "acct_1" },
    );
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pa_stale_w" },
        data: { status: "CANCELED" },
      }),
    );
    expect(result.sessionId).toBe("cs_new_w");
  });

  it("throws when refunded payments no longer link back to an invoice", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "pay_orphan", amount: 40 },
    ]);
    const refundSpy = jest
      .spyOn(FinancePaymentService, "refundPaymentById")
      .mockResolvedValueOnce({
        payment: { invoice: null },
        refund: {
          refundId: "re_orphan",
          providerRefundId: "re_orphan",
          status: "succeeded",
          amountRefunded: 40,
          paymentId: "pay_orphan",
        },
      } as never);

    await expect(
      FinancePaymentService.refundInvoicePayments("inv_orphan", "cleanup"),
    ).rejects.toMatchObject({
      message: "Invoice has no refundable payment",
      statusCode: 409,
    });

    refundSpy.mockRestore();
  });
});
