import {
  FinancePaymentError,
  FinancePaymentService,
  __setFinanceStripeClientForTests,
} from "../../src/services/finance/payment";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    invoice: {
      findUnique: jest.fn(),
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
  },
}));

describe("FinancePaymentService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValue([]);
    __setFinanceStripeClientForTests({
      checkout: { sessions: { create: jest.fn() } },
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
      checkout: { sessions: { create: jest.fn() } },
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
      checkout: { sessions: { create: jest.fn() } },
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
      checkout: { sessions: { create: jest.fn() } },
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
      checkout: { sessions: { create: jest.fn() } },
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

    const result =
      await FinancePaymentService.createPaymentIntentForInvoice("inv_10");

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
      checkout: { sessions: { create: jest.fn() } },
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
      totalAmount: 80,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_INTENT",
      metadata: {},
      payments: [],
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_1",
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
      totalAmount: 42,
      currency: "usd",
      status: "PENDING",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
      payments: [],
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_webhook_2",
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
      checkout: { sessions: { create: jest.fn() } },
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
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "pa_9",
      invoiceId: "inv_9",
      providerPaymentIntentId: "pi_9",
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

    expect(stripeClient.paymentIntents.retrieve).toHaveBeenCalledWith("pi_9", {
      expand: ["latest_charge"],
    });
    expect(stripeClient.refunds.create).toHaveBeenCalledWith({
      charge: "ch_9",
    });
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
      checkout: { sessions: { create: jest.fn() } },
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

  it("charges the current invoice balance when discounts change the raw item total", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn() } },
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
        // An invoice-level discount makes the item sum differ from the balance, so we
        // charge the tax-inclusive balance as one line with automatic tax disabled.
        automatic_tax: {
          enabled: false,
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
      ),
    ).resolves.toEqual({
      paymentIntentId: "pi_existing",
      clientSecret: "cs_existing",
      connectedAccountId: "acct_existing",
      amount: 100,
      currency: "usd",
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_no_balance"),
    ).rejects.toMatchObject({
      message: "Invoice has no outstanding balance",
      statusCode: 409,
    });

    await expect(
      FinancePaymentService.createPaymentIntentForInvoice("inv_no_stripe"),
    ).rejects.toMatchObject({
      message: "Organisation does not have a Stripe connected account",
      statusCode: 409,
    });
  });

  it("creates a new payment intent for a reopened invoice with prior succeeded payment", async () => {
    const stripeClient = {
      checkout: { sessions: { create: jest.fn() } },
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

    const result =
      await FinancePaymentService.createPaymentIntentForInvoice("inv_reopened");

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
      checkout: { sessions: { create: jest.fn() } },
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
      checkout: { sessions: { create: jest.fn() } },
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

    expect(stripeClient.refunds.create).toHaveBeenCalledWith({
      charge: "ch_stripe_refund",
      amount: 5000,
    });
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
    (prisma.paymentAttempt.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        invoiceId: "inv_pi_lookup",
      })
      .mockResolvedValueOnce({
        invoiceId: "inv_checkout_lookup",
      });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_pi_lookup",
    });
    (prisma.invoice.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_pi_lookup",
        status: "PENDING",
        paymentCollectionMethod: "MANUAL",
      })
      .mockResolvedValueOnce({
        id: "inv_checkout_lookup",
        status: "PENDING",
        paymentCollectionMethod: "MANUAL",
      });
    const refundSpy = jest
      .spyOn(FinancePaymentService, "refundPaymentIntent")
      .mockResolvedValue({
        invoice: { id: "inv_pi_lookup" } as any,
        refund: {
          refundId: "re_lookup",
          status: "SUCCEEDED",
          amountRefunded: 10,
          paymentId: "pay_lookup",
        },
      });

    await expect(
      FinancePaymentService.handleInvoicePaymentIntentSucceeded({
        paymentIntentId: "pi_lookup",
      }),
    ).resolves.toMatchObject({ action: "REFUNDED" });

    await expect(
      FinancePaymentService.handleInvoiceCheckoutSessionCompleted({
        sessionId: "cs_lookup",
        paymentIntentId: "pi_checkout_lookup",
      }),
    ).resolves.toMatchObject({ action: "REFUNDED" });

    refundSpy.mockRestore();
  });
});
