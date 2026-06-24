import {
  InvoiceService,
  InvoiceServiceError,
} from "../../src/services/invoice.service";
import { prisma } from "src/config/prisma";
import { CatalogService } from "../../src/services/catalog.service";
import { NotificationService } from "../../src/services/notification.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import {
  FinancePaymentService,
  getInvoiceFinancialSummary,
} from "../../src/services/finance/payment";
import { sendEmailTemplate } from "../../src/utils/email";
import { getOrgBillingCurrency } from "src/utils/billing";

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointment: { findUnique: jest.fn(), findFirst: jest.fn() },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    financeEvent: {
      create: jest.fn(),
    },
    creditNote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    renderedDocument: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    service: { findUnique: jest.fn() },
    organizationBilling: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
    paymentAttempt: { updateMany: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock("../../src/services/catalog.service", () => ({
  __esModule: true,
  CatalogServiceError: class CatalogServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "CatalogServiceError";
    }
  },
  CatalogService: {
    resolveSelection: jest.fn(),
  },
}));

jest.mock("../../src/services/notification.service", () => ({
  __esModule: true,
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  __esModule: true,
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/services/finance/payment", () => ({
  __esModule: true,
  FinancePaymentService: {
    recordManualPayment: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
    refundInvoicePayment: jest.fn(),
  },
  getInvoiceFinancialSummary: jest.fn(),
}));

jest.mock("../../src/utils/email", () => ({
  __esModule: true,
  sendEmailTemplate: jest.fn(),
}));

jest.mock("src/utils/billing", () => ({
  __esModule: true,
  getOrgBillingCurrency: jest.fn(),
}));

describe("InvoiceService", () => {
  const appointmentId = "appt_1";
  const organisationId = "org_1";
  const patientId = "patient_1";
  const parentId = "parent_1";

  beforeEach(() => {
    jest.resetAllMocks();
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue(null);
    (getOrgBillingCurrency as jest.Mock).mockResolvedValue("usd");
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("creates a draft invoice and persists invoice-level discounts", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_1",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 120,
      discountTotal: 0,
      invoiceDiscountType: "FIXED_AMOUNT",
      invoiceDiscountValue: 12,
      invoiceDiscountTotal: 12,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 108,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.createDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
      invoiceDiscount: { type: "FIXED_AMOUNT", value: 12 },
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxProvider: null,
          billingCollectionMode: "PREPAY_AT_BOOKING",
          visitBillingStage: "DRAFT",
          depositTargetAmount: 0,
          depositCollectedAmount: 0,
          invoiceDiscountType: "FIXED_AMOUNT",
          invoiceDiscountValue: 12,
          invoiceDiscountTotal: 12,
          subtotal: 120,
          totalAmount: 108,
          taxTotal: 0,
          taxPercent: 0,
        }),
      }),
    );
    expect(NotificationService.sendToUser).toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_1");
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_CREATED",
          entityType: "INVOICE",
          entityId: "inv_1",
        }),
      }),
    );
    expect(getOrgBillingCurrency).toHaveBeenCalledWith(organisationId);
  });

  it("uses the organisation currency (not a hardcoded usd) for a non-US org", async () => {
    (getOrgBillingCurrency as jest.Mock).mockResolvedValue("gbp");
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_gbp",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "gbp",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 120,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 120,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await InvoiceService.createDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(getOrgBillingCurrency).toHaveBeenCalledWith(organisationId);
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "gbp" }),
      }),
    );
    // Guard against a regression to a hardcoded USD default.
    expect(prisma.invoice.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "usd" }),
      }),
    );
  });

  it("threads the organisation currency through extra invoices", async () => {
    (getOrgBillingCurrency as jest.Mock).mockResolvedValue("gbp");
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_extra_gbp",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "gbp",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 40,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 40,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await InvoiceService.createExtraInvoiceForAppointment({
      appointmentId,
      items: [
        {
          name: "Medication",
          description: "Medication",
          quantity: 2,
          unitPrice: 20,
          total: 40,
        },
      ],
    });

    expect(getOrgBillingCurrency).toHaveBeenCalledWith(organisationId);
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "gbp" }),
      }),
    );
  });

  it("creates extra invoices with a frozen tax snapshot", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_extra",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 40,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 40,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.createExtraInvoiceForAppointment({
      appointmentId,
      items: [
        {
          name: "Medication",
          description: "Medication",
          quantity: 2,
          unitPrice: 20,
          total: 40,
        },
      ],
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxProvider: null,
          billingCollectionMode: "STAGED_DURING_VISIT",
          visitBillingStage: "READY_FOR_BILLING",
          depositTargetAmount: 0,
          depositCollectedAmount: 0,
          taxTotal: 0,
          taxPercent: 0,
        }),
      }),
    );
    expect((result as { id: string }).id).toBe("inv_extra");
    expect(getOrgBillingCurrency).toHaveBeenCalledWith(organisationId);
  });

  it("marks visit-based invoices ready for billing and leaves prepay invoices alone", async () => {
    (prisma.invoice.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "inv_visit",
        appointmentId,
        status: "AWAITING_PAYMENT",
        billingCollectionMode: "PAY_AT_VISIT_END",
        visitBillingStage: "DRAFT",
        depositTargetAmount: 0,
        depositCollectedAmount: 0,
        totalAmount: 100,
        currency: "usd",
        paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      })
      .mockResolvedValueOnce({
        id: "inv_prepay",
        appointmentId,
        status: "AWAITING_PAYMENT",
        billingCollectionMode: "PREPAY_AT_BOOKING",
        visitBillingStage: "DRAFT",
        depositTargetAmount: 0,
        depositCollectedAmount: 0,
        totalAmount: 100,
        currency: "usd",
        paymentCollectionMethod: "PAYMENT_LINK",
      });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      totalAmount: 100,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      items: [
        {
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      totalAmount: 118,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxProvider: "STRIPE",
      finalizedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      totalAmount: 118,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxProvider: "STRIPE",
      finalizedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updated =
      await InvoiceService.markAppointmentReadyForBilling(appointmentId);
    const skipped =
      await InvoiceService.markAppointmentReadyForBilling(appointmentId);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_visit" },
        data: expect.objectContaining({
          billingCollectionMode: "PAY_AT_VISIT_END",
          visitBillingStage: "READY_FOR_BILLING",
          readyForBillingActorId: "SYSTEM",
          readyForBillingAt: expect.any(Date),
        }),
      }),
    );
    expect(updated?.visitBillingStage).toBe("READY_FOR_BILLING");
    expect(updated?.totalAmount).toBe(118);
    expect(skipped?.billingCollectionMode).toBe("PREPAY_AT_BOOKING");
  });

  it("sets deposit targets explicitly on invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_deposit",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
      depositTargetAmount: 0,
      depositCollectedAmount: 12,
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_deposit",
      billingCollectionMode: "DEPOSIT_THEN_SETTLE",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 20,
      depositCollectedAmount: 12,
      totalAmount: 100,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updated = await InvoiceService.setInvoiceDepositTarget(
      "inv_deposit",
      20,
    );

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_deposit" },
        data: expect.objectContaining({
          billingCollectionMode: "DEPOSIT_THEN_SETTLE",
          visitBillingStage: "READY_FOR_BILLING",
          depositTargetAmount: 20,
          depositCollectedAmount: 12,
          readyForBillingActorId: "SYSTEM",
          readyForBillingAt: expect.any(Date),
        }),
      }),
    );
    expect(updated?.depositTargetAmount).toBe(20);
  });

  it("rejects negative deposit targets", async () => {
    await expect(
      InvoiceService.setInvoiceDepositTarget("inv_deposit", -1),
    ).rejects.toMatchObject({
      message: "Deposit target amount must be greater than or equal to zero",
      statusCode: 400,
    });

    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects missing invoices when setting deposit targets", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      InvoiceService.setInvoiceDepositTarget("inv_missing", 20),
    ).rejects.toMatchObject({
      message: "Invoice not found",
      statusCode: 404,
    });

    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("issues a credit note and records a finance event", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_credit_1",
      organisationId,
      totalAmount: 100,
      status: "PAID",
      metadata: {},
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      updatedAt: new Date("2026-06-18T00:00:00.000Z"),
      creditNotes: [],
    });
    (prisma.creditNote.create as jest.Mock).mockResolvedValueOnce({
      id: "cn_1",
      invoiceId: "inv_credit_1",
      creditNoteNumber: "CN-INV_CRED-ABC",
      reason: "Pricing correction",
      amount: 25,
      status: "ISSUED",
      metadata: { source: "manual" },
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      updatedAt: new Date("2026-06-18T00:00:00.000Z"),
    });

    const result = await InvoiceService.issueCreditNote("inv_credit_1", {
      amount: 25,
      reason: "Pricing correction",
      metadata: { source: "manual" },
    });

    expect(prisma.creditNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: "inv_credit_1",
          amount: 25,
          status: "ISSUED",
          reason: "Pricing correction",
        }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "CREDIT_NOTE_ISSUED",
          entityType: "CREDIT_NOTE",
          entityId: "cn_1",
        }),
      }),
    );
    expect(result.creditNoteNumber).toBe("CN-INV_CRED-ABC");
  });

  it("voids a credit note and records a finance event", async () => {
    (prisma.creditNote.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "cn_void_1",
      invoiceId: "inv_void_1",
      creditNoteNumber: "CN-VOID-1",
      reason: "Pricing correction",
      amount: 25,
      status: "ISSUED",
      metadata: { source: "manual" },
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      updatedAt: new Date("2026-06-18T00:00:00.000Z"),
      invoice: {
        id: "inv_void_1",
        organisationId,
      },
    });
    (prisma.creditNote.update as jest.Mock).mockResolvedValueOnce({
      id: "cn_void_1",
      invoiceId: "inv_void_1",
      creditNoteNumber: "CN-VOID-1",
      reason: "Pricing correction",
      amount: 25,
      status: "VOIDED",
      metadata: {
        source: "manual",
        voidReason: "entered in error",
        voidedAt: "2026-06-18T00:00:00.000Z",
      },
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      updatedAt: new Date("2026-06-18T00:00:00.000Z"),
    });

    const result = await InvoiceService.voidCreditNote(
      "inv_void_1",
      "cn_void_1",
      "entered in error",
    );

    expect(prisma.creditNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cn_void_1" },
        data: expect.objectContaining({
          status: "VOIDED",
        }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "CREDIT_NOTE_VOIDED",
          entityType: "CREDIT_NOTE",
          entityId: "cn_void_1",
        }),
      }),
    );
    expect(result.status).toBe("VOIDED");
  });

  it("updates invoice totals when adding items", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv_2",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: "PERCENTAGE",
      invoiceDiscountValue: 10,
      invoiceDiscountTotal: 10,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 90,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({
      id: "inv_2",
      totalAmount: 135,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 150,
      discountTotal: 15,
      invoiceDiscountType: "PERCENTAGE",
      invoiceDiscountValue: 10,
      invoiceDiscountTotal: 15,
      taxTotal: 0,
      taxPercent: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.addItemsToInvoice("inv_2", [
      {
        description: "Lab",
        name: "Lab",
        quantity: 1,
        unitPrice: 50,
        total: 50,
      },
    ]);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxProvider: "STRIPE",
          invoiceDiscountTotal: 15,
          totalAmount: 135,
          taxSnapshot: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
              update: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
            }),
          }),
        }),
      }),
    );
    expect(result.totalAmount).toBe(135);
  });

  it("does not duplicate a line item that already exists on the invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_dedup",
      currency: "usd",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          name: "Sample testing package",
          description: "Sample testing package",
          quantity: 1,
          unitPrice: 272,
          total: 272,
        },
      ],
      subtotal: 272,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_dedup",
      currency: "usd",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      items: [],
      subtotal: 272,
      totalAmount: 272,
      taxTotal: 0,
      taxPercent: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // The finance step re-sends the same package when regenerating the link.
    await InvoiceService.addItemsToInvoice("inv_dedup", [
      {
        description: "Sample testing package",
        name: "Sample testing package",
        quantity: 1,
        unitPrice: 272,
        total: 272,
      },
    ]);

    const updateCall = (prisma.invoice.update as jest.Mock).mock.calls[0][0];
    const persistedItems = updateCall.data.items as Array<{ name?: string }>;
    expect(persistedItems).toHaveLength(1);
  });

  it("finalizes tax snapshots and re-opens a finalized-but-unpaid invoice when edited", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxProvider: "STRIPE",
      finalizedAt: new Date(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.renderedDocument.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prisma.renderedDocument.create as jest.Mock).mockResolvedValueOnce({
      id: "rendered-invoice-1",
    });

    const finalized = await InvoiceService.finalizeTaxForInvoice("inv_final");

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalizedAt: expect.any(Date),
          taxProvider: "STRIPE",
          subtotal: 100,
          totalAmount: 118,
          taxTotal: 18,
          taxPercent: 18,
          taxSnapshot: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
              update: expect.objectContaining({
                provider: "STRIPE",
                taxBehavior: "EXCLUSIVE",
              }),
            }),
          }),
        }),
      }),
    );
    expect(finalized.id).toBe("inv_final");
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_FINALIZED",
          entityType: "INVOICE",
          entityId: "inv_final",
        }),
      }),
    );
    expect(prisma.renderedDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId,
          sourceKind: "INVOICE",
          sourceId: "inv_final",
        }),
      }),
    );
    expect(prisma.renderedDocument.create).toHaveBeenCalledWith(
      expect.any(Object),
    );
    const renderedDocumentCreateArgs = (
      prisma.renderedDocument.create as jest.Mock
    ).mock.calls[0][0];
    expect(renderedDocumentCreateArgs.data.title).toBe("Final Invoice");
    expect(renderedDocumentCreateArgs.data.sourceKind).toBe("INVOICE");
    expect(renderedDocumentCreateArgs.data.sourceId).toBe("inv_final");
    expect(renderedDocumentCreateArgs.data.organisationId).toBe(organisationId);
    expect(renderedDocumentCreateArgs.data.pdf).toEqual(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceKind: "INVOICE",
          sourceId: "inv_final",
          organisationId,
          templateKind: "INVOICE",
        }),
      }),
    );

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: new Date(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_final",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      items: [],
      subtotal: 50,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 50,
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValueOnce({
      count: 1,
    });

    // Editing a finalized but UNPAID invoice re-opens it (clears finalizedAt) and
    // cancels in-flight payment attempts so a fresh payment link can be generated.
    const reopened = await InvoiceService.addItemsToInvoice("inv_final", [
      {
        description: "Lab",
        name: "Lab",
        quantity: 1,
        unitPrice: 50,
        total: 50,
      },
    ]);

    expect(reopened.id).toBe("inv_final");
    expect(prisma.invoice.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "inv_final" },
        data: expect.objectContaining({ finalizedAt: null }),
      }),
    );
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ invoiceId: "inv_final" }),
        data: { status: "CANCELED" },
      }),
    );
  });

  it("upserts invoice lines by stable id so treatment sync can update the same row", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_sync",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          id: "ti_1",
          name: "Medication",
          description: "Medication",
          quantity: 1,
          unitPrice: 25,
          total: 25,
        },
      ],
      subtotal: 25,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 25,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      taxSnapshot: { taxBehavior: "EXCLUSIVE" },
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_sync",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          id: "ti_1",
          name: "Medication",
          description: "Medication",
          quantity: 2,
          unitPrice: 25,
          total: 50,
        },
      ],
      subtotal: 50,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 50,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      taxSnapshot: { taxBehavior: "EXCLUSIVE" },
    });

    const result = await InvoiceService.addItemsToInvoice("inv_sync", [
      {
        id: "ti_1",
        name: "Medication",
        description: "Medication",
        quantity: 2,
        unitPrice: 25,
        total: 50,
      },
    ]);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_sync" },
        data: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "ti_1",
              quantity: 2,
              total: 50,
            }),
          ]),
        }),
      }),
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ti_1",
          quantity: 2,
          total: 50,
        }),
      ]),
    );
  });

  it("previews invoice tax snapshots without mutating the invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_preview",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [
        {
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 18,
      taxPercent: 18,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const preview = await InvoiceService.previewTaxForInvoice("inv_preview");

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(preview.invoice.id).toBe("inv_preview");
    expect(preview.taxProvider).toBe("STRIPE");
    expect(preview.taxTotal).toBe(18);
  });

  it("marks paid invoices and supports manual settlement", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_3",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_3",
      status: "PAID",
      organisationId,
      patientId,
      parentId,
      totalAmount: 90,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      metadata: {},
      items: [],
      subtotal: 90,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const paid = await InvoiceService.markInvoicePaid({ invoiceId: "inv_3" });
    expect(paid).toBeTruthy();
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_PAID",
          entityType: "INVOICE",
          entityId: "inv_3",
        }),
      }),
    );

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_4",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_4",
      status: "PAID",
      organisationId,
      patientId,
      parentId,
      totalAmount: 90,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      metadata: {},
      items: [],
      subtotal: 90,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (FinancePaymentService.recordManualPayment as jest.Mock).mockResolvedValue({
      invoice: {
        id: "inv_4",
        status: "PAID",
      },
    });

    const result = await InvoiceService.markInvoicePaidManually(
      "inv_4",
      organisationId,
    );
    expect(FinancePaymentService.recordManualPayment).toHaveBeenCalledWith(
      "inv_4",
      expect.objectContaining({ settlementChannel: "CASH" }),
    );
    expect(result.id).toBe("inv_4");
  });

  it("settles only the remaining balance at visit closeout", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_closeout",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      totalAmount: 100,
      currency: "usd",
    });
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 30,
      credited: 0,
      balance: 70,
    });
    (
      FinancePaymentService.recordManualPayment as jest.Mock
    ).mockResolvedValueOnce({
      invoice: {
        id: "inv_closeout",
        status: "PAID",
      },
    });

    const result = await InvoiceService.settleInvoiceAtCloseout(
      "inv_closeout",
      organisationId,
      {
        settlementChannel: "CARD_PRESENT",
        reference: "front-desk",
        receivedAt: new Date("2026-06-24T10:15:00.000Z"),
      },
    );

    expect(FinancePaymentService.recordManualPayment).toHaveBeenCalledWith(
      "inv_closeout",
      expect.objectContaining({
        settlementChannel: "CARD_PRESENT",
        reference: "front-desk",
        receivedAt: new Date("2026-06-24T10:15:00.000Z"),
      }),
    );
    expect(result.id).toBe("inv_closeout");
  });

  it("marks a fully covered invoice paid at closeout without charging again", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_closeout_zero",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      totalAmount: 100,
      currency: "usd",
    });
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 100,
      credited: 0,
      balance: 0,
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_closeout_zero",
      status: "PAID",
      organisationId,
      patientId,
      parentId,
      totalAmount: 100,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      metadata: {},
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      paidAt: new Date(),
    });

    const result = await InvoiceService.settleInvoiceAtCloseout(
      "inv_closeout_zero",
      organisationId,
    );

    expect(FinancePaymentService.recordManualPayment).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
          visitBillingStage: "SETTLED",
        }),
      }),
    );
    expect(result.id).toBe("inv_closeout_zero");
  });

  it("cancels or refunds invoices using Postgres only", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_5",
      status: "PAID",
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      metadata: {},
    });
    (FinancePaymentService.refundInvoicePayment as jest.Mock).mockResolvedValue(
      {
        invoice: {
          id: "inv_5",
          status: "REFUNDED",
          currency: "usd",
        },
        refund: {
          refundId: "re_123",
          amountRefunded: 90,
        },
      },
    );

    const result = await InvoiceService.handleInvoiceCancellation(
      "inv_5",
      "reason",
    );

    expect(result).toEqual({ action: "REFUNDED", status: "REFUNDED" });
    expect(FinancePaymentService.refundInvoicePayment).toHaveBeenCalledWith(
      "inv_5",
      "reason",
    );
  });

  it("emits finance events when cancelling unpaid invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_5c",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      metadata: {},
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_5c",
      status: "CANCELLED",
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      totalAmount: 75,
      metadata: {},
    });

    const result = await InvoiceService.handleInvoiceCancellation(
      "inv_5c",
      "owner request",
    );

    expect(result).toEqual({ action: "CANCELLED_UNPAID", status: "CANCELLED" });
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_CANCELLED",
          entityType: "INVOICE",
          entityId: "inv_5c",
        }),
      }),
    );
  });

  it("bootsraps from Postgres appointment context", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
      appointmentType: { id: "svc_1", name: "Consult" },
      productItemId: null,
      concern: "checkup",
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      currency: "usd",
    });
    (prisma.invoice.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.service.findUnique as jest.Mock).mockResolvedValue({
      id: "svc_1",
      name: "Consult",
      cost: 100,
      maxDiscount: 10,
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_6",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 100,
      discountTotal: 10,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 90,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.bootstrapForAppointment(appointmentId);
    expect((result as { id: string }).id).toBe("inv_6");
  });

  it("uses the package final amount as the invoice line item total even with multiple billing items", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
      appointmentType: { id: "pkg_1", name: "Wellness Package" },
      productItemId: "pkg_1",
      concern: "package booking",
    });
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValueOnce({
      productItemId: "pkg_1",
      productKind: "PACKAGE",
      name: "Wellness Package",
      code: "PKG-1",
      currency: "usd",
      isBookable: false,
      appointmentKinds: ["OUTPATIENT"],
      grossAmount: 400,
      itemDiscountAmount: 50,
      additionalDiscountAmount: 25,
      finalAmount: 325,
      templateKinds: [],
      templateBindings: [],
      billingItems: [
        {
          productItemId: "child_1",
          code: "CH-1",
          name: "Child item",
          kind: "CONSULTATION",
          quantity: 1,
          currency: "usd",
          unitPrice: 250,
          discountPercent: 0,
          grossAmount: 250,
          discountAmount: 0,
          finalAmount: 250,
          isPackageComponent: true,
          packageProductItemId: "pkg_1",
        },
        {
          productItemId: "child_2",
          code: "CH-2",
          name: "Additional item",
          kind: "LAB",
          quantity: 1,
          currency: "usd",
          unitPrice: 150,
          discountPercent: 0,
          grossAmount: 150,
          discountAmount: 0,
          finalAmount: 150,
          isPackageComponent: true,
          packageProductItemId: "pkg_1",
        },
      ],
      includedItems: [],
    });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({
      id: "inv_pkg_1",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 325,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 325,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await InvoiceService.bootstrapForAppointment(appointmentId);

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: [
            expect.objectContaining({
              description: "Wellness Package",
              quantity: 1,
              unitPrice: 325,
              total: 325,
            }),
          ],
          subtotal: 325,
          totalAmount: 325,
        }),
      }),
    );
  });

  it("returns invoice lookup data", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv_7",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 0,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: "Org",
      googlePlacesId: "place_1",
      address: { city: "Mumbai" },
      imageUrl: "img",
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "pay_1",
        invoiceId: "inv_7",
        paymentAttemptId: "pa_1",
        provider: "STRIPE",
        settlementChannel: "STRIPE",
        collectionMode: null,
        providerPaymentId: "pi_1",
        amount: 50,
        currency: "usd",
        status: "SUCCEEDED",
        paidAt: new Date("2026-06-18T10:00:00.000Z"),
        receiptUrl: "https://receipt",
        refunds: [
          {
            id: "refund_1",
            paymentId: "pay_1",
            provider: "STRIPE",
            providerRefundId: "re_1",
            amount: 10,
            currency: "usd",
            status: "SUCCEEDED",
            reason: "Adjustment",
            rawProviderPayload: null,
            createdAt: new Date("2026-06-18T11:00:00.000Z"),
            updatedAt: new Date("2026-06-18T11:00:00.000Z"),
          },
        ],
        createdAt: new Date("2026-06-18T09:00:00.000Z"),
        updatedAt: new Date("2026-06-18T10:00:00.000Z"),
      },
    ]);

    const result = await InvoiceService.getById("inv_7");
    expect(result.invoice.id).toBe("inv_7");
    expect(result.organistion.name).toBe("Org");
    expect(result.invoice.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pay_1",
          receiptUrl: "https://receipt",
          refunds: expect.arrayContaining([
            expect.objectContaining({
              id: "refund_1",
              providerRefundId: "re_1",
            }),
          ]),
        }),
      ]),
    );
    expect(result.invoice.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentId: "pay_1",
          receiptUrl: "https://receipt",
        }),
      ]),
    );
  });

  it("returns richer invoice details when looked up by payment intent", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
      invoiceId: "inv_lookup",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_lookup",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      items: [],
      subtotal: 0,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      creditNotes: [],
    });
    (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "pay_lookup",
        invoiceId: "inv_lookup",
        paymentAttemptId: null,
        provider: "STRIPE",
        settlementChannel: "STRIPE",
        collectionMode: null,
        providerPaymentId: "pi_lookup",
        amount: 12,
        currency: "usd",
        status: "SUCCEEDED",
        paidAt: new Date("2026-06-18T12:00:00.000Z"),
        receiptUrl: "https://receipt-lookup",
        refunds: [],
        createdAt: new Date("2026-06-18T11:00:00.000Z"),
        updatedAt: new Date("2026-06-18T12:00:00.000Z"),
      },
    ]);

    const result = await InvoiceService.getByPaymentIntentId("pi_lookup");

    expect(result).toEqual(
      expect.objectContaining({
        id: "inv_lookup",
        payments: expect.arrayContaining([
          expect.objectContaining({
            id: "pay_lookup",
            receiptUrl: "https://receipt-lookup",
          }),
        ]),
        receipts: expect.arrayContaining([
          expect.objectContaining({
            paymentId: "pay_lookup",
            receiptUrl: "https://receipt-lookup",
          }),
        ]),
      }),
    );
  });

  it("creates checkout sessions and emails the parent", async () => {
    (
      FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
    ).mockResolvedValue({
      url: "https://checkout",
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: "inv_8",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      totalAmount: 90,
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      metadata: {},
    });
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      email: "parent@example.com",
      firstName: "Pat",
      lastName: "Owner",
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: "Org",
    });

    const result =
      await InvoiceService.createCheckoutSessionAndEmailParent("inv_8");

    expect(
      FinancePaymentService.createCheckoutSessionForInvoice,
    ).toHaveBeenCalledWith("inv_8");
    expect(result.emailSent).toBe(true);
    expect(sendEmailTemplate).toHaveBeenCalled();
  });
});
