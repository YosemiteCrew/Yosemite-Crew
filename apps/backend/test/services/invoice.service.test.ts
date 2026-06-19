import {
  InvoiceService,
  InvoiceServiceError,
} from "../../src/services/invoice.service";
import { prisma } from "src/config/prisma";
import { CatalogService } from "../../src/services/catalog.service";
import { NotificationService } from "../../src/services/notification.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { FinancePaymentService } from "../../src/services/finance/payment";
import { sendEmailTemplate } from "../../src/utils/email";

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
    financeEvent: {
      create: jest.fn(),
    },
    creditNote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    service: { findUnique: jest.fn() },
    organizationBilling: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
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
}));

jest.mock("../../src/utils/email", () => ({
  __esModule: true,
  sendEmailTemplate: jest.fn(),
}));

describe("InvoiceService", () => {
  const appointmentId = "appt_1";
  const organisationId = "org_1";
  const patientId = "patient_1";
  const parentId = "parent_1";

  beforeEach(() => {
    jest.resetAllMocks();
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue(null);
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
          taxProvider: "STRIPE",
          billingCollectionMode: "PREPAY_AT_BOOKING",
          visitBillingStage: "DRAFT",
          depositTargetAmount: 0,
          depositCollectedAmount: 0,
          invoiceDiscountType: "FIXED_AMOUNT",
          invoiceDiscountValue: 12,
          invoiceDiscountTotal: 12,
          subtotal: 120,
          totalAmount: 108,
          taxSnapshot: expect.objectContaining({
            create: expect.objectContaining({
              provider: "STRIPE",
              taxBehavior: "EXCLUSIVE",
              taxAmount: 0,
            }),
          }),
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
    expect(prisma.organizationBilling.findUnique).not.toHaveBeenCalled();
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
          taxProvider: "STRIPE",
          billingCollectionMode: "STAGED_DURING_VISIT",
          visitBillingStage: "READY_FOR_BILLING",
          depositTargetAmount: 0,
          depositCollectedAmount: 0,
          taxSnapshot: expect.objectContaining({
            create: expect.objectContaining({
              provider: "STRIPE",
              taxBehavior: "EXCLUSIVE",
            }),
          }),
        }),
      }),
    );
    expect((result as { id: string }).id).toBe("inv_extra");
    expect(prisma.organizationBilling.findUnique).not.toHaveBeenCalled();
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
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      totalAmount: 100,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
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
        }),
      }),
    );
    expect(updated?.visitBillingStage).toBe("READY_FOR_BILLING");
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
        }),
      }),
    );
    expect(updated?.depositTargetAmount).toBe(20);
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

  it("finalizes tax snapshots and locks future line edits", async () => {
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

    const finalized = await InvoiceService.finalizeTaxForInvoice("inv_final");

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalizedAt: expect.any(Date),
          taxProvider: "STRIPE",
          taxTotal: 18,
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

    await expect(
      InvoiceService.addItemsToInvoice("inv_final", [
        {
          description: "Lab",
          name: "Lab",
          quantity: 1,
          unitPrice: 50,
          total: 50,
        },
      ]),
    ).rejects.toThrow("Cannot modify a finalized invoice");
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

    const result = await InvoiceService.getById("inv_7");
    expect(result.invoice.id).toBe("inv_7");
    expect(result.organistion.name).toBe("Org");
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
