import type Stripe from "stripe";
import {
  InvoiceService,
  InvoiceServiceError,
} from "../../src/services/invoice.service";
import { prisma } from "src/config/prisma";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";
import { NotificationService } from "../../src/services/notification.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import {
  FinancePaymentService,
  getInvoiceFinancialSummary,
} from "../../src/services/finance/payment";
import { sendEmailTemplate } from "../../src/utils/email";
import { getOrgBillingCurrency } from "src/utils/billing";
import { __setFinanceTaxStripeClientForTests } from "../../src/services/finance/tax";
import logger from "src/utils/logger";

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
    user: {
      findUnique: jest.fn(),
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
    workspaceTreatmentItem: { updateMany: jest.fn() },
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
    refundInvoicePayments: jest.fn(),
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

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
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
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue({
      id: appointmentId,
    });
  });

  afterEach(() => {
    __setFinanceTaxStripeClientForTests(null);
  });

  describe("overall invoice discount cap", () => {
    // 1 x 200 line, no line discount -> the invoice discount base is 200.
    const capItems = [{ description: "Consult", quantity: 1, unitPrice: 200 }];

    const mockAppointment = () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        companion: { id: patientId, parent: { id: parentId } },
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        id: "inv_capped",
        appointmentId,
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [],
        subtotal: 200,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 200,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    };

    const setCap = (maxOverallDiscountPercent: number | null) => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: organisationId,
        maxOverallDiscountPercent,
      });
    };

    const createWithDiscount = (invoiceDiscount: {
      type: "PERCENTAGE" | "FIXED_AMOUNT";
      value: number;
    }) =>
      InvoiceService.createDraftForAppointment({
        appointmentId,
        parentId,
        organisationId,
        patientId,
        items: capItems,
        invoiceDiscount,
        paymentCollectionMethod: "PAYMENT_LINK",
      });

    beforeEach(() => {
      mockAppointment();
    });

    it("rejects a percentage discount above the organisation cap", async () => {
      setCap(20);

      await expect(
        createWithDiscount({ type: "PERCENTAGE", value: 50 }),
      ).rejects.toThrow(
        "Overall invoice discount of 50% exceeds the organisation's maximum of 20%.",
      );
      await expect(
        createWithDiscount({ type: "PERCENTAGE", value: 50 }),
      ).rejects.toBeInstanceOf(InvoiceServiceError);
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects a fixed-amount discount whose effective percent exceeds the cap", async () => {
      // 100 off a 200 base is 50 percent, over a 20 percent cap. Without this
      // the FIXED_AMOUNT type would be a trivial bypass of a percentage cap.
      setCap(20);

      await expect(
        createWithDiscount({ type: "FIXED_AMOUNT", value: 100 }),
      ).rejects.toThrow(
        "Overall invoice discount of 50% exceeds the organisation's maximum of 20%.",
      );
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("accepts a discount exactly at the cap", async () => {
      setCap(20);

      await expect(
        createWithDiscount({ type: "PERCENTAGE", value: 20 }),
      ).resolves.toBeDefined();
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it("accepts a discount below the cap", async () => {
      setCap(20);

      await expect(
        createWithDiscount({ type: "PERCENTAGE", value: 5 }),
      ).resolves.toBeDefined();
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it("allows any discount when no cap is configured", async () => {
      setCap(null);

      await expect(
        createWithDiscount({ type: "PERCENTAGE", value: 100 }),
      ).resolves.toBeDefined();
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it("does not consult the cap when no invoice discount is applied", async () => {
      setCap(0);

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          organisationId,
          patientId,
          items: capItems,
          paymentCollectionMethod: "PAYMENT_LINK",
        }),
      ).resolves.toBeDefined();
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it("rejects any discount when the cap is zero", async () => {
      setCap(0);

      await expect(
        createWithDiscount({ type: "PERCENTAGE", value: 1 }),
      ).rejects.toThrow(
        "Overall invoice discount of 1% exceeds the organisation's maximum of 0%.",
      );
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });
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

  it("returns the existing open invoice instead of creating a duplicate draft", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_existing",
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
    const result = await InvoiceService.createDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_existing");
  });

  it("reuses the existing appointment invoice when draft creation races a unique constraint", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      id: appointmentId,
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
      companion: { id: patientId, parent: { id: parentId } },
    });
    (prisma.invoice.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "inv_raced",
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
    (prisma.invoice.create as jest.Mock).mockRejectedValueOnce({
      code: "P2002",
    });

    const result = await InvoiceService.createDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 120 }],
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(prisma.invoice.create).toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_raced");
  });

  it("threads supplemental charges through the canonical appointment invoice", async () => {
    const canonicalInvoice = {
      id: "inv_canonical",
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
    };
    const addChargesSpy = jest
      .spyOn(InvoiceService, "addChargesToAppointment")
      .mockResolvedValueOnce(canonicalInvoice as never);

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

    expect(addChargesSpy).toHaveBeenCalledWith(appointmentId, [
      {
        name: "Medication",
        description: "Medication",
        quantity: 2,
        unitPrice: 20,
        total: 40,
      },
    ]);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_canonical");
    addChargesSpy.mockRestore();
  });

  it("bootstraps the canonical invoice instead of creating a second invoice when adding charges", async () => {
    const draftInvoice = {
      id: "inv_draft",
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
    };
    const addItemsSpy = jest
      .spyOn(InvoiceService, "addItemsToInvoice")
      .mockResolvedValueOnce(draftInvoice as never);
    const bootstrapSpy = jest
      .spyOn(InvoiceService, "bootstrapForAppointment")
      .mockResolvedValueOnce(draftInvoice as never);
    const extraSpy = jest.spyOn(
      InvoiceService,
      "createExtraInvoiceForAppointment",
    );
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await InvoiceService.addChargesToAppointment(appointmentId, [
      {
        name: "Medication",
        description: "Medication",
        quantity: 1,
        unitPrice: 25,
        total: 25,
      },
    ]);

    expect(bootstrapSpy).toHaveBeenCalledWith(appointmentId);
    expect(addItemsSpy).toHaveBeenCalledWith("inv_draft", [
      {
        name: "Medication",
        description: "Medication",
        quantity: 1,
        unitPrice: 25,
        total: 25,
      },
    ]);
    expect(extraSpy).not.toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_draft");

    bootstrapSpy.mockRestore();
    addItemsSpy.mockRestore();
    extraSpy.mockRestore();
  });

  it("reopens a paid appointment invoice when adding new charges", async () => {
    const paidInvoice = {
      id: "inv_paid",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "PAID",
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
    };
    const bootstrapSpy = jest
      .spyOn(InvoiceService, "bootstrapForAppointment")
      .mockResolvedValueOnce(paidInvoice as never);
    const addItemsSpy = jest
      .spyOn(InvoiceService, "addItemsToInvoice")
      .mockResolvedValueOnce({
        ...paidInvoice,
        status: "AWAITING_PAYMENT",
        totalAmount: 25,
      } as never);
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const items = [
      {
        name: "Medication",
        description: "Medication",
        quantity: 1,
        unitPrice: 25,
        total: 25,
      },
    ];
    const result = await InvoiceService.addChargesToAppointment(
      appointmentId,
      items,
    );

    expect(bootstrapSpy).toHaveBeenCalledWith(appointmentId);
    expect(addItemsSpy).toHaveBeenCalledWith("inv_paid", items);
    expect(result.status).toBe("AWAITING_PAYMENT");

    bootstrapSpy.mockRestore();
    addItemsSpy.mockRestore();
  });

  it("marks appointment invoices ready for billing regardless of collection mode", async () => {
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
        finalizedAt: new Date(),
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
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_prepay",
      appointmentId,
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PREPAY_AT_BOOKING",
      visitBillingStage: "READY_FOR_BILLING",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      totalAmount: 100,
      currency: "usd",
      paymentCollectionMethod: "PAYMENT_LINK",
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      finalizedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updated = await InvoiceService.markAppointmentReadyForBilling(
      appointmentId,
      { organisationId },
    );
    const prepay = await InvoiceService.markAppointmentReadyForBilling(
      appointmentId,
      { organisationId },
    );

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
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_prepay" },
        data: expect.objectContaining({
          billingCollectionMode: "PREPAY_AT_BOOKING",
          visitBillingStage: "READY_FOR_BILLING",
          readyForBillingActorId: "SYSTEM",
          readyForBillingAt: expect.any(Date),
        }),
      }),
    );
    expect(updated?.visitBillingStage).toBe("READY_FOR_BILLING");
    expect(updated?.totalAmount).toBe(118);
    expect(prepay?.visitBillingStage).toBe("READY_FOR_BILLING");
    expect(prepay?.billingCollectionMode).toBe("PREPAY_AT_BOOKING");
  });

  it("reverses ready-for-billing back to draft when no payments were applied", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      organisationId,
      patientId,
      parentId,
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
      taxSnapshot: { provider: "STRIPE" },
    });
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 0,
      credited: 0,
      balance: 118,
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      status: "AWAITING_PAYMENT",
      billingCollectionMode: "PAY_AT_VISIT_END",
      visitBillingStage: "DRAFT",
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
      readyForBillingAt: null,
      readyForBillingActorId: null,
    });

    const updated = await InvoiceService.reverseAppointmentReadyForBilling(
      appointmentId,
      { organisationId, actorUserId: "user-1" },
    );

    expect(getInvoiceFinancialSummary).toHaveBeenCalledWith(
      "inv_visit",
      118,
      0,
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_visit" },
        data: expect.objectContaining({
          visitBillingStage: "DRAFT",
          readyForBillingAt: null,
          readyForBillingActorId: null,
        }),
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_READY_FOR_BILLING_REVERSED",
          entityType: "INVOICE",
          entityId: "inv_visit",
        }),
      }),
    );
    expect(updated?.visitBillingStage).toBe("DRAFT");
  });

  it("returns null when the appointment invoice is not marked ready for billing", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const updated = await InvoiceService.reverseAppointmentReadyForBilling(
      appointmentId,
      { organisationId },
    );

    expect(updated).toBeNull();
    expect(getInvoiceFinancialSummary).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.financeEvent.create).not.toHaveBeenCalled();
  });

  it("rejects reversing ready-for-billing when payments already exist", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_visit",
      appointmentId,
      organisationId,
      patientId,
      parentId,
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
      taxSnapshot: { provider: "STRIPE" },
    });
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 10,
      credited: 0,
      balance: 108,
    });

    await expect(
      InvoiceService.reverseAppointmentReadyForBilling(appointmentId, {
        organisationId,
      }),
    ).rejects.toMatchObject({
      message: "Invoice already has payments applied and cannot be reverted",
      statusCode: 409,
    });

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.financeEvent.create).not.toHaveBeenCalled();
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
          depositTargetAmount: 20,
          depositCollectedAmount: 12,
        }),
      }),
    );
    const updateArgs = (prisma.invoice.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("visitBillingStage");
    expect(updateArgs.data).not.toHaveProperty("readyForBillingAt");
    expect(updateArgs.data).not.toHaveProperty("readyForBillingActorId");
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

  it("moves paid invoices back to awaiting payment when new items are added", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_paid_extra",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "PAID",
      paymentCollectionMethod: "PAYMENT_INTENT",
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
      taxTotal: 0,
      taxPercent: 0,
      taxSnapshot: {
        provider: "STRIPE",
        taxBehavior: "EXCLUSIVE",
      },
      finalizedAt: null,
      paidAt: new Date("2026-06-26T06:30:00.000Z"),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_paid_extra",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      currency: "usd",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
      items: [],
      subtotal: 125,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 125,
      finalizedAt: null,
      paidAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.addItemsToInvoice("inv_paid_extra", [
      {
        description: "Lab",
        name: "Lab",
        quantity: 1,
        unitPrice: 25,
        total: 25,
      },
    ]);

    expect(result.status).toBe("AWAITING_PAYMENT");
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_paid_extra" },
        data: expect.objectContaining({
          status: "AWAITING_PAYMENT",
          paidAt: null,
          visitBillingStage: "DRAFT",
          finalizedAt: null,
          totalAmount: 125,
        }),
      }),
    );
  });

  it("keeps cancelled and refunded invoices closed when adding new items", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_closed",
      status: "CANCELLED",
      items: [],
      taxSnapshot: null,
    });

    await expect(
      InvoiceService.addItemsToInvoice("inv_closed", [
        {
          description: "Lab",
          name: "Lab",
          quantity: 1,
          unitPrice: 25,
          total: 25,
        },
      ]),
    ).rejects.toMatchObject({
      message: "Cannot modify a closed invoice",
      statusCode: 409,
    });
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
      appointmentId,
      patientId,
      parentId,
      items: [{ id: "treatment-line-1" }],
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
    expect(prisma.workspaceTreatmentItem.updateMany).toHaveBeenCalledWith({
      where: {
        appointmentId,
        invoiceRowId: { in: ["treatment-line-1"] },
      },
      data: {
        settledInvoiceId: "inv_3",
        settledAt: expect.any(Date),
      },
    });
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

  it("refunds unpaid invoices with collected money instead of cancelling them", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_5_partial",
      status: "AWAITING_PAYMENT",
      organisationId,
      patientId,
      parentId,
      totalAmount: 100,
      depositCollectedAmount: 20,
      currency: "usd",
      metadata: {},
    });
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 20,
      credited: 0,
      balance: 80,
    });
    (
      FinancePaymentService.refundInvoicePayments as jest.Mock
    ).mockResolvedValueOnce({
      invoice: {
        id: "inv_5_partial",
        status: "REFUNDED",
        currency: "usd",
      },
      refunds: [
        {
          refundId: "re_partial",
          amountRefunded: 20,
        },
      ],
      totalRefunded: 20,
    });

    const result = await InvoiceService.handleInvoiceCancellation(
      "inv_5_partial",
      "reason",
    );

    expect(result).toEqual({ action: "REFUNDED", status: "REFUNDED" });
    expect(FinancePaymentService.refundInvoicePayments).toHaveBeenCalledWith(
      "inv_5_partial",
      "reason",
    );
    expect(prisma.invoice.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
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
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 0,
      credited: 0,
      balance: 75,
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
      items: [
        {
          id: "line_1",
          name: "Consult",
          description: "Consult",
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      subtotal: 0,
      discountTotal: 0,
      invoiceDiscountType: null,
      invoiceDiscountValue: null,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 100,
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
    (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "credit_1", amount: 10 },
    ]);

    const result = await InvoiceService.getById("inv_7", { organisationId });
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
    expect(result.invoice.settlementSummary).toEqual(
      expect.objectContaining({
        invoiceTotal: 100,
        cashPaid: 50,
        credited: 10,
        effectivePaid: 50,
        balance: 40,
      }),
    );
    expect(result.invoice.settlementSummary.lineAllocations).toEqual([
      expect.objectContaining({
        id: "line_1",
        cashApplied: 50,
        creditApplied: 10,
        remaining: 40,
      }),
    ]);
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

    const result = await InvoiceService.getByPaymentIntentId("pi_lookup", {
      organisationId,
    });

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
    (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
      paid: 30,
      credited: 0,
      balance: 60,
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
  it("refuses to re-mark an already paid invoice as paid at the clinic", async () => {
    // At-clinic invoices settled before the Payment backfill have no Payment
    // rows, so a second mark-paid would recompute the full total as owed.
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_already_paid",
      organisationId,
      status: "PAID",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      totalAmount: 250,
      currency: "usd",
    });

    await expect(
      InvoiceService.markInvoicePaidManually(
        "inv_already_paid",
        organisationId,
      ),
    ).rejects.toMatchObject({
      message: "Invoice is already paid.",
      statusCode: 409,
    });
    expect(FinancePaymentService.recordManualPayment).not.toHaveBeenCalled();
  });

  it("refuses to mark an invoice paid from another organisation", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_other_org",
      organisationId: "org_owner",
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      totalAmount: 100,
      currency: "usd",
    });

    await expect(
      InvoiceService.markInvoicePaidManually("inv_other_org", "org_attacker"),
    ).rejects.toMatchObject({ message: "Invoice not found.", statusCode: 404 });
    expect(FinancePaymentService.recordManualPayment).not.toHaveBeenCalled();
  });

  it("refuses to draft an invoice for an appointment in another organisation", async () => {
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      InvoiceService.createDraftForAppointment({
        appointmentId,
        parentId,
        patientId,
        organisationId: "org_attacker",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [
          {
            name: "Consult",
            description: "Consult",
            quantity: 1,
            unitPrice: 10,
            total: 10,
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: "Appointment not found for organisation",
      statusCode: 404,
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("hides an invoice from a parent who does not own it", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_private",
      organisationId,
      parentId: "parent_owner",
      status: "AWAITING_PAYMENT",
    });

    await expect(
      InvoiceService.getById("inv_private", { parentId: "parent_attacker" }),
    ).rejects.toMatchObject({ message: "Invoice not found.", statusCode: 404 });
  });

  it("rejects an unscoped invoice read", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_unscoped",
      organisationId,
      parentId,
      status: "AWAITING_PAYMENT",
    });

    await expect(
      InvoiceService.getById("inv_unscoped", {}),
    ).rejects.toMatchObject({
      message: "Invoice scope is required.",
      statusCode: 403,
    });
  });

  it("scopes parent and companion invoice lists to the organisation when one is given", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

    await InvoiceService.listForParent(parentId, organisationId);
    expect(prisma.invoice.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { parentId, organisationId } }),
    );

    await InvoiceService.listForCompanion(patientId, organisationId);
    expect(prisma.invoice.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { patientId, organisationId } }),
    );
  });

  it("scopes the ready-for-billing lookup to the organisation", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await InvoiceService.markAppointmentReadyForBilling(
      appointmentId,
      { organisationId: "org_attacker" },
    );

    expect(result).toBeNull();
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointmentId,
          organisationId: "org_attacker",
        }),
      }),
    );
  });

  it("marks an invoice refunded, normalising mixed-typed metadata", async () => {
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_refund",
      organisationId,
      patientId,
      appointmentId,
      parentId,
      status: "REFUNDED",
      totalAmount: 90,
      currency: "usd",
      items: [],
      subtotal: 90,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      metadata: {
        notes: "handled",
        attempts: 3,
        flagged: true,
        nested: { a: 1 },
        list: [1, 2],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const refunded = await InvoiceService.markRefunded("inv_refund");

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_refund" },
        data: { status: "REFUNDED" },
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "INVOICE_REFUNDED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INVOICE_REFUNDED" }),
    );
    // Only scalar metadata values survive normalisation.
    expect(refunded.metadata).toEqual({
      notes: "handled",
      attempts: 3,
      flagged: true,
    });
  });

  it("marks an invoice failed and returns the raw prisma row", async () => {
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_failed",
      organisationId,
      patientId,
      appointmentId,
      status: "FAILED",
      totalAmount: 40,
      currency: "usd",
    });

    const doc = await InvoiceService.markFailed("inv_failed");

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_failed" },
        data: { status: "FAILED" },
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "INVOICE_FAILED" }),
      }),
    );
    expect(doc.status).toBe("FAILED");
  });

  it("updates status and resolves audit targets from the appointment when the row lacks them", async () => {
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_status",
      organisationId: null,
      patientId: null,
      appointmentId,
      status: "PAID",
      totalAmount: 100,
      currency: "usd",
    });
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
      organisationId,
      patient: { id: patientId, parent: { id: parentId } },
    });

    const invoice = await InvoiceService.updateStatus("inv_status", "PAID");

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_status" },
        data: { status: "PAID", visitBillingStage: "SETTLED" },
      }),
    );
    expect(prisma.appointment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: appointmentId } }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId,
        patientId,
        eventType: "INVOICE_UPDATED",
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_STATUS_CHANGED",
        }),
      }),
    );
    expect(invoice.status).toBe("PAID");
  });

  it("skips the audit write when neither the row nor its appointment resolve targets", async () => {
    (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
      id: "inv_status_2",
      organisationId: null,
      patientId: null,
      appointmentId,
      status: "AWAITING_PAYMENT",
      totalAmount: 100,
      currency: "usd",
    });
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await InvoiceService.updateStatus("inv_status_2", "AWAITING_PAYMENT");

    const updateArgs = (prisma.invoice.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({ status: "AWAITING_PAYMENT" });
    expect(updateArgs.data.visitBillingStage).toBeUndefined();
    expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_STATUS_CHANGED",
        }),
      }),
    );
  });

  it("returns the existing open invoice from getOrCreateDraftForAppointment", async () => {
    const openInvoice = {
      id: "inv_open",
      appointmentId,
      organisationId,
      status: "AWAITING_PAYMENT",
    };
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(openInvoice);

    const result = await InvoiceService.getOrCreateDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(result).toBe(openInvoice);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("creates a draft from getOrCreateDraftForAppointment when none is open", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const createSpy = jest
      .spyOn(InvoiceService, "createDraftForAppointment")
      .mockResolvedValueOnce({ id: "inv_new" } as never);

    const result = await InvoiceService.getOrCreateDraftForAppointment({
      appointmentId,
      parentId,
      organisationId,
      patientId,
      items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    expect(createSpy).toHaveBeenCalled();
    expect((result as { id: string }).id).toBe("inv_new");
    createSpy.mockRestore();
  });

  it("rejects extra invoices with no line items", async () => {
    await expect(
      InvoiceService.createExtraInvoiceForAppointment({
        appointmentId,
        items: [],
      }),
    ).rejects.toMatchObject({
      message: "At least one invoice item is required",
      statusCode: 400,
    });
  });

  it("returns null from markInvoicePaid when the invoice is missing or already paid", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    expect(
      await InvoiceService.markInvoicePaid({ invoiceId: "missing" }),
    ).toBeNull();

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_already",
      status: "PAID",
    });
    expect(
      await InvoiceService.markInvoicePaid({ invoiceId: "inv_already" }),
    ).toBeNull();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects manual payment for invoices not marked for in-clinic payment", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_link",
      organisationId,
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
    });

    await expect(
      InvoiceService.markInvoicePaidManually("inv_link", organisationId),
    ).rejects.toMatchObject({
      message: "Invoice is not marked for in-clinic payment.",
      statusCode: 409,
    });
    expect(FinancePaymentService.recordManualPayment).not.toHaveBeenCalled();
  });

  it("rejects manual payment for cancelled invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_cancelled",
      organisationId,
      status: "CANCELLED",
      paymentCollectionMethod: "PAYMENT_AT_CLINIC",
    });

    await expect(
      InvoiceService.markInvoicePaidManually("inv_cancelled", organisationId),
    ).rejects.toMatchObject({
      message: "Invoice cannot be marked paid.",
      statusCode: 409,
    });
  });

  it("rejects closeout settlement for missing or closed invoices", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      InvoiceService.settleInvoiceAtCloseout("missing", organisationId),
    ).rejects.toMatchObject({ message: "Invoice not found.", statusCode: 404 });

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_refunded",
      organisationId,
      status: "REFUNDED",
    });
    await expect(
      InvoiceService.settleInvoiceAtCloseout("inv_refunded", organisationId),
    ).rejects.toMatchObject({
      message: "Invoice cannot be settled.",
      statusCode: 409,
    });
  });

  it("returns the invoice unchanged when settling an already-paid invoice at closeout", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_paid_closeout",
      organisationId,
      patientId,
      parentId,
      status: "PAID",
      totalAmount: 100,
      currency: "usd",
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await InvoiceService.settleInvoiceAtCloseout(
      "inv_paid_closeout",
      organisationId,
    );

    expect(result.id).toBe("inv_paid_closeout");
    expect(getInvoiceFinancialSummary).not.toHaveBeenCalled();
    expect(FinancePaymentService.recordManualPayment).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  describe("updatePaymentCollectionMethod", () => {
    const openRow = {
      id: "inv_pcm",
      organisationId,
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_LINK",
      currency: "usd",
    };

    it("rejects an invalid collection method", async () => {
      await expect(
        InvoiceService.updatePaymentCollectionMethod(
          "inv_pcm",
          organisationId,
          "NONSENSE",
        ),
      ).rejects.toMatchObject({
        message: "Invalid payment collection method.",
        statusCode: 400,
      });
      expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
    });

    it("rejects when the invoice belongs to another organisation", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InvoiceService.updatePaymentCollectionMethod(
          "inv_pcm",
          organisationId,
          "PAYMENT_INTENT",
        ),
      ).rejects.toMatchObject({
        message: "Invoice not found.",
        statusCode: 404,
      });
    });

    it("rejects updating a closed invoice", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        ...openRow,
        status: "PAID",
      });
      await expect(
        InvoiceService.updatePaymentCollectionMethod(
          "inv_pcm",
          organisationId,
          "PAYMENT_INTENT",
        ),
      ).rejects.toMatchObject({
        message: "Invoice cannot be updated.",
        statusCode: 409,
      });
    });

    it("no-ops when the collection method is unchanged", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        ...openRow,
        items: [],
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.updatePaymentCollectionMethod(
        "inv_pcm",
        organisationId,
        "PAYMENT_LINK",
      );

      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect((result as { id: string }).id).toBe("inv_pcm");
    });

    it("persists a changed collection method", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(openRow);
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        ...openRow,
        paymentCollectionMethod: "PAYMENT_INTENT",
      });

      const result = await InvoiceService.updatePaymentCollectionMethod(
        "inv_pcm",
        organisationId,
        "payment_intent",
      );

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv_pcm" },
          data: { paymentCollectionMethod: "PAYMENT_INTENT" },
        }),
      );
      expect(
        (result as { paymentCollectionMethod: string }).paymentCollectionMethod,
      ).toBe("PAYMENT_INTENT");
    });
  });

  describe("issueCreditNote guard rails", () => {
    it("rejects non-positive amounts", async () => {
      await expect(
        InvoiceService.issueCreditNote("inv_x", { amount: 0 }),
      ).rejects.toMatchObject({
        message: "Credit note amount must be greater than zero",
        statusCode: 400,
      });
      expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
    });

    it("rejects when the invoice is missing", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InvoiceService.issueCreditNote("inv_missing", { amount: 10 }),
      ).rejects.toMatchObject({
        message: "Invoice not found.",
        statusCode: 404,
      });
    });

    it("rejects credit notes against cancelled invoices", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_cn_closed",
        organisationId,
        status: "CANCELLED",
        totalAmount: 100,
        creditNotes: [],
      });
      await expect(
        InvoiceService.issueCreditNote("inv_cn_closed", { amount: 10 }),
      ).rejects.toMatchObject({
        message: "Invoice cannot accept credit notes.",
        statusCode: 409,
      });
    });

    it("rejects credit notes exceeding the remaining creditable amount", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_cn_over",
        organisationId,
        status: "PAID",
        totalAmount: 100,
        creditNotes: [{ amount: 90 }],
      });
      await expect(
        InvoiceService.issueCreditNote("inv_cn_over", { amount: 20 }),
      ).rejects.toMatchObject({
        message: "Credit note amount exceeds invoice remaining amount",
        statusCode: 409,
      });
      expect(prisma.creditNote.create).not.toHaveBeenCalled();
    });

    it("issues a credit note without a reason and normalises boolean metadata", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_cn_ok",
        organisationId,
        status: "AWAITING_PAYMENT",
        totalAmount: 100,
        creditNotes: [],
      });
      (prisma.creditNote.create as jest.Mock).mockResolvedValueOnce({
        id: "cn_ok",
        invoiceId: "inv_cn_ok",
        creditNoteNumber: "CN-OK",
        reason: null,
        amount: 15,
        status: "ISSUED",
        metadata: { flagged: true, nested: { a: 1 } },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.issueCreditNote("inv_cn_ok", {
        amount: 15,
      });

      expect(prisma.creditNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 15,
            reason: undefined,
            metadata: undefined,
          }),
        }),
      );
      expect(result.reason).toBeUndefined();
      expect(result.metadata).toEqual({ flagged: true });
    });
  });

  describe("voidCreditNote guard rails", () => {
    it("rejects when the credit note does not belong to the invoice", async () => {
      (prisma.creditNote.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "cn_mismatch",
        invoiceId: "other_invoice",
        status: "ISSUED",
        invoice: { id: "other_invoice", organisationId },
      });
      await expect(
        InvoiceService.voidCreditNote("inv_void", "cn_mismatch"),
      ).rejects.toMatchObject({
        message: "Credit note not found.",
        statusCode: 404,
      });
    });

    it("returns the credit note unchanged when already voided", async () => {
      (prisma.creditNote.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "cn_voided",
        invoiceId: "inv_void",
        creditNoteNumber: "CN-VOIDED",
        reason: "x",
        amount: 10,
        status: "VOIDED",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        invoice: { id: "inv_void", organisationId },
      });

      const result = await InvoiceService.voidCreditNote(
        "inv_void",
        "cn_voided",
      );

      expect(result.status).toBe("VOIDED");
      expect(result.metadata).toBeUndefined();
      expect(prisma.creditNote.update).not.toHaveBeenCalled();
    });

    it("rejects voiding a credit note that is not currently issued", async () => {
      (prisma.creditNote.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "cn_draft",
        invoiceId: "inv_void",
        status: "DRAFT",
        metadata: {},
        invoice: { id: "inv_void", organisationId },
      });
      await expect(
        InvoiceService.voidCreditNote("inv_void", "cn_draft"),
      ).rejects.toMatchObject({
        message: "Credit note cannot be voided.",
        statusCode: 409,
      });
    });
  });

  it("returns the invoice as-is when it is already marked ready for billing", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_ready",
      appointmentId,
      organisationId,
      patientId,
      parentId,
      status: "AWAITING_PAYMENT",
      visitBillingStage: "READY_FOR_BILLING",
      billingCollectionMode: "PAY_AT_VISIT_END",
      depositTargetAmount: 0,
      depositCollectedAmount: 0,
      totalAmount: 100,
      currency: "usd",
      items: [],
      subtotal: 100,
      discountTotal: 0,
      invoiceDiscountTotal: 0,
      taxTotal: 0,
      taxPercent: 0,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      taxSnapshot: null,
    });

    const result = await InvoiceService.markAppointmentReadyForBilling(
      appointmentId,
      { organisationId },
    );

    expect(result?.visitBillingStage).toBe("READY_FOR_BILLING");
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  describe("getByAppointmentId", () => {
    it("requires a scope", async () => {
      await expect(
        InvoiceService.getByAppointmentId(appointmentId, {}),
      ).rejects.toMatchObject({
        message: "Invoice scope is required.",
        statusCode: 403,
      });
    });

    it("returns financial details and attaches the rendered document", async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "inv_appt",
          appointmentId,
          organisationId,
          patientId,
          parentId,
          currency: "usd",
          status: "AWAITING_PAYMENT",
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [
            { id: "l0", name: "Zero", total: 0 },
            {
              id: "l1",
              name: "First",
              quantity: 1,
              unitPrice: 100,
              total: 100,
            },
            { id: "l2", name: "Second", quantity: 1, unitPrice: 50, total: 50 },
          ],
          subtotal: 150,
          discountTotal: 0,
          invoiceDiscountTotal: 0,
          taxTotal: 0,
          taxPercent: 0,
          totalAmount: 150,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          creditNotes: [],
        },
      ]);
      (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "pay_appt",
          invoiceId: "inv_appt",
          provider: "STRIPE",
          amount: 30,
          currency: "usd",
          status: "SUCCEEDED",
          receiptUrl: null,
          refunds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      (prisma.creditNote.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "cn_appt", amount: 200 },
      ]);
      (prisma.renderedDocument.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "rd_appt",
        pdfUrl: "https://pdf/appt",
      });

      const [record] = await InvoiceService.getByAppointmentId(appointmentId, {
        organisationId,
      });

      expect(record.id).toBe("inv_appt");
      expect(record.renderedDocumentId).toBe("rd_appt");
      expect(record.pdfUrl).toBe("https://pdf/appt");
      const first = record.settlementSummary.lineAllocations.find(
        (line) => line.id === "l1",
      );
      expect(first?.cashApplied).toBe(30);
      const zero = record.settlementSummary.lineAllocations.find(
        (line) => line.id === "l0",
      );
      expect(zero?.cashApplied).toBe(0);
    });
  });

  it("returns the invoice without a rendered document when it has no organisation", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "inv_noorg",
        appointmentId,
        organisationId: null,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [],
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        creditNotes: [],
      },
    ]);

    const [record] = await InvoiceService.getByAppointmentId(appointmentId, {
      parentId,
    });

    expect(record.id).toBe("inv_noorg");
    expect(record).not.toHaveProperty("renderedDocumentId");
    expect(prisma.renderedDocument.findFirst).not.toHaveBeenCalled();
  });

  describe("bootstrapForAppointment guard rails", () => {
    it("throws when the appointment is missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InvoiceService.bootstrapForAppointment(appointmentId),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("returns the open invoice when one exists", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { id: "svc_1" },
        productItemId: null,
        concern: null,
      });
      const openInvoice = { id: "inv_boot_open", status: "PENDING" };
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(
        openInvoice,
      );

      const result =
        await InvoiceService.bootstrapForAppointment(appointmentId);
      expect(result).toBe(openInvoice);
    });

    it("returns the latest settled invoice instead of re-bootstrapping", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { id: "svc_1" },
        productItemId: null,
        concern: null,
      });
      const latest = { id: "inv_boot_paid", status: "PAID" };
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(latest);

      const result =
        await InvoiceService.bootstrapForAppointment(appointmentId);
      expect(result).toBe(latest);
    });

    it("throws when the appointment has no service or product to bill", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { name: "no id here" },
        productItemId: null,
        concern: null,
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        InvoiceService.bootstrapForAppointment(appointmentId),
      ).rejects.toMatchObject({
        message: "Service or product not found",
        statusCode: 404,
      });
    });

    it("throws when the appointment is missing parent or companion links", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: null,
        companion: null,
        appointmentType: { id: "svc_1" },
        productItemId: null,
        concern: null,
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        InvoiceService.bootstrapForAppointment(appointmentId),
      ).rejects.toMatchObject({
        message: "Appointment missing parent or companion",
        statusCode: 400,
      });
    });

    it("maps a non-package catalog selection to individual invoice lines", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { id: "svc_1", name: "Bundle" },
        productItemId: "prod_bundle",
        concern: "bundle",
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (CatalogService.resolveSelection as jest.Mock).mockResolvedValueOnce({
        productKind: "CONSULTATION",
        name: "Bundle",
        finalAmount: 100,
        billingItems: [
          {
            name: "Exam",
            quantity: 1,
            unitPrice: 60,
            defaultDiscountPercent: null,
          },
          {
            name: "Meds",
            quantity: 2,
            unitPrice: 20,
            defaultDiscountPercent: 10,
          },
        ],
      });
      const createSpy = jest
        .spyOn(InvoiceService, "createDraftForAppointment")
        .mockResolvedValueOnce({ id: "inv_bundle" } as never);

      const result =
        await InvoiceService.bootstrapForAppointment(appointmentId);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              description: "Exam",
              quantity: 1,
              unitPrice: 60,
              discountPercent: undefined,
            }),
            expect.objectContaining({
              description: "Meds",
              quantity: 2,
              unitPrice: 20,
              discountPercent: 10,
            }),
          ],
        }),
      );
      expect((result as { id: string }).id).toBe("inv_bundle");
      createSpy.mockRestore();
    });

    it("falls back to the service when the catalog selection is a 404 and throws if the service is missing", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { id: "svc_missing", name: "X" },
        productItemId: "prod_gone",
        concern: null,
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (CatalogService.resolveSelection as jest.Mock).mockRejectedValueOnce(
        new CatalogServiceError("gone", 404),
      );
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InvoiceService.bootstrapForAppointment(appointmentId),
      ).rejects.toMatchObject({
        message: "Service not found",
        statusCode: 404,
      });
    });

    it("re-throws non-404 catalog errors while bootstrapping", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { id: "svc_1", name: "X" },
        productItemId: "prod_err",
        concern: null,
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (CatalogService.resolveSelection as jest.Mock).mockRejectedValueOnce(
        new CatalogServiceError("boom", 500),
      );

      await expect(
        InvoiceService.bootstrapForAppointment(appointmentId),
      ).rejects.toMatchObject({ message: "boom", statusCode: 500 });
    });
  });

  it("throws a 404 when getById cannot find the invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      InvoiceService.getById("missing", { organisationId }),
    ).rejects.toMatchObject({ message: "Invoice not found.", statusCode: 404 });
  });

  it("hides an invoice from an organisation that does not own it", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_org_scope",
      organisationId: "org_owner",
      parentId: null,
      status: "AWAITING_PAYMENT",
    });
    await expect(
      InvoiceService.getById("inv_org_scope", {
        organisationId: "org_attacker",
      }),
    ).rejects.toMatchObject({ message: "Invoice not found.", statusCode: 404 });
  });

  it("lists invoices for an organisation", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "inv_list",
        organisationId,
        patientId,
        parentId,
        appointmentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        items: [],
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await InvoiceService.listForOrganisation(organisationId);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("inv_list");
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId } }),
    );
  });

  it("throws when adding items to a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      InvoiceService.addItemsToInvoice("missing", [
        {
          description: "Lab",
          name: "Lab",
          quantity: 1,
          unitPrice: 10,
          total: 10,
        },
      ]),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  describe("finalizeTaxForInvoice guard rails", () => {
    it("throws when the invoice is missing", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InvoiceService.finalizeTaxForInvoice("missing"),
      ).rejects.toMatchObject({
        message: "Invoice not found",
        statusCode: 404,
      });
    });

    it("throws when the invoice is already paid", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_final_paid",
        status: "PAID",
        items: [],
        taxSnapshot: null,
      });
      await expect(
        InvoiceService.finalizeTaxForInvoice("inv_final_paid"),
      ).rejects.toMatchObject({
        message: "Invoice cannot be finalized",
        statusCode: 409,
      });
    });

    it("returns an already-finalized invoice and reuses the rendered document", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_already_final",
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        items: [],
        subtotal: 100,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 18,
        taxPercent: 18,
        totalAmount: 118,
        finalizedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
      });
      (prisma.renderedDocument.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "rd_existing",
      });

      const result =
        await InvoiceService.finalizeTaxForInvoice("inv_already_final");

      expect(result.id).toBe("inv_already_final");
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.renderedDocument.create).not.toHaveBeenCalled();
    });

    it("skips the rendered document when an already-finalized invoice has no organisation", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_final_noorg",
        organisationId: null,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        items: [],
        subtotal: 100,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 100,
        finalizedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        taxSnapshot: null,
      });

      const result =
        await InvoiceService.finalizeTaxForInvoice("inv_final_noorg");

      expect(result.id).toBe("inv_final_noorg");
      expect(prisma.renderedDocument.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  it("throws when previewing tax for a missing invoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      InvoiceService.previewTaxForInvoice("missing"),
    ).rejects.toMatchObject({ message: "Invoice not found", statusCode: 404 });
  });

  it("previews tax using a stored invoice-level discount", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_preview_disc",
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
      taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const preview =
      await InvoiceService.previewTaxForInvoice("inv_preview_disc");

    expect(preview.invoice.id).toBe("inv_preview_disc");
    expect(preview.taxProvider).toBe("STRIPE");
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("routes tax through Stripe automatic tax when the parent has a billing address", async () => {
    const fakeStripe = {
      invoices: {
        createPreview: jest.fn().mockResolvedValue({
          id: "inprev_1",
          total_taxes: [{ amount: 500 }],
          total_excluding_tax: 10000,
          automatic_tax: { status: "complete" },
        }),
      },
    } as unknown as Stripe;
    __setFinanceTaxStripeClientForTests(fakeStripe);

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "inv_autotax",
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
      taxTotal: 0,
      taxPercent: 0,
      totalAmount: 100,
      taxSnapshot: null,
      finalizedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      stripeAccountId: "acct_123",
    });
    (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
      address: {
        addressLine: "1 Main St",
        city: "Denver",
        state: "CO",
        postalCode: "80202",
        country: "US",
      },
    });

    const preview = await InvoiceService.previewTaxForInvoice("inv_autotax");

    expect(fakeStripe.invoices.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_details: {
          address: expect.objectContaining({ country: "US", city: "Denver" }),
        },
      }),
    );
    expect(preview.taxTotal).toBe(5);
    expect(preview.taxProvider).toBe("STRIPE");
  });

  it("asserts the organisation before adding charges to an existing appointment invoice", async () => {
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValueOnce({
      id: appointmentId,
    });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv_charge_open",
      status: "AWAITING_PAYMENT",
    });
    const addItemsSpy = jest
      .spyOn(InvoiceService, "addItemsToInvoice")
      .mockResolvedValueOnce({ id: "inv_charge_open" } as never);

    const items = [
      {
        name: "Lab",
        description: "Lab",
        quantity: 1,
        unitPrice: 20,
        total: 20,
      },
    ];
    const result = await InvoiceService.addChargesToAppointment(
      appointmentId,
      items,
      organisationId,
    );

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: appointmentId, organisationId },
      }),
    );
    expect(addItemsSpy).toHaveBeenCalledWith("inv_charge_open", items);
    expect((result as { id: string }).id).toBe("inv_charge_open");
    addItemsSpy.mockRestore();
  });

  it("rejects adding charges when the bootstrapped invoice is not open", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const bootstrapSpy = jest
      .spyOn(InvoiceService, "bootstrapForAppointment")
      .mockResolvedValueOnce({
        id: "inv_boot_closed",
        status: "CANCELLED",
      } as never);

    await expect(
      InvoiceService.addChargesToAppointment(appointmentId, [
        {
          name: "Lab",
          description: "Lab",
          quantity: 1,
          unitPrice: 20,
          total: 20,
        },
      ]),
    ).rejects.toMatchObject({
      message: "Invoice is not open for appointment",
      statusCode: 409,
    });

    bootstrapSpy.mockRestore();
  });

  describe("handleAppointmentCancellation", () => {
    it("returns NO_INVOICE when the appointment has no invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        "reason",
      );
      expect(result).toEqual({ action: "NO_INVOICE" });
    });

    it("returns ALREADY_HANDLED for a cancelled invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_ac_cancelled",
        status: "CANCELLED",
      });
      const result = await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        "reason",
      );
      expect(result).toEqual({
        action: "ALREADY_HANDLED",
        status: "CANCELLED",
      });
    });

    it("refunds an unpaid-but-collected appointment invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_ac_partial",
        organisationId,
        patientId,
        appointmentId,
        status: "AWAITING_PAYMENT",
        totalAmount: 100,
        depositCollectedAmount: 20,
        currency: "usd",
        metadata: {},
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 20,
        credited: 0,
        balance: 80,
      });
      (
        FinancePaymentService.refundInvoicePayments as jest.Mock
      ).mockResolvedValueOnce({
        invoice: {
          id: "inv_ac_partial",
          organisationId,
          patientId,
          appointmentId,
          status: "REFUNDED",
          currency: "usd",
        },
        refunds: [{ refundId: "re_ac" }],
        totalRefunded: 20,
      });

      const result = await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        "reason",
      );

      expect(result).toEqual({ action: "REFUNDED", refundId: "re_ac" });
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "INVOICE_REFUNDED" }),
      );
    });

    it("cancels an unpaid appointment invoice with no money collected", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_ac_unpaid",
        organisationId,
        patientId,
        appointmentId,
        status: "PENDING",
        totalAmount: 50,
        depositCollectedAmount: 0,
        currency: "usd",
        metadata: {},
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 0,
        credited: 0,
        balance: 50,
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_ac_unpaid",
        organisationId,
        patientId,
        appointmentId,
        status: "CANCELLED",
        totalAmount: 50,
        currency: "usd",
        metadata: {},
      });

      const result = await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        "reason",
      );

      expect(result).toEqual({ action: "CANCELLED_UNPAID" });
      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "INVOICE_CANCELLED" }),
        }),
      );
    });

    it("refunds a paid appointment invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_ac_paid",
        organisationId,
        patientId,
        appointmentId,
        status: "PAID",
        totalAmount: 100,
        currency: "usd",
        metadata: {},
      });
      (
        FinancePaymentService.refundInvoicePayment as jest.Mock
      ).mockResolvedValueOnce({
        invoice: {
          id: "inv_ac_paid",
          organisationId,
          patientId,
          appointmentId,
          status: "REFUNDED",
          currency: "usd",
        },
        refund: { refundId: "re_paid", amountRefunded: 100 },
      });

      const result = await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        "reason",
      );

      expect(result).toEqual({ action: "REFUNDED", refundId: "re_paid" });
    });

    it("returns NO_ACTION for other statuses", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_ac_failed",
        status: "FAILED",
      });
      const result = await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        "reason",
      );
      expect(result).toEqual({ action: "NO_ACTION", status: "FAILED" });
    });
  });

  describe("handleInvoiceCancellation edge cases", () => {
    it("throws when the invoice is missing", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        InvoiceService.handleInvoiceCancellation("missing", "reason"),
      ).rejects.toMatchObject({
        message: "Invoice not found",
        statusCode: 404,
      });
    });

    it("returns ALREADY_HANDLED for a refunded invoice", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_ic_refunded",
        status: "REFUNDED",
      });
      const result = await InvoiceService.handleInvoiceCancellation(
        "inv_ic_refunded",
        "reason",
      );
      expect(result).toEqual({ action: "ALREADY_HANDLED", status: "REFUNDED" });
    });

    it("returns NO_ACTION for an unexpected status", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_ic_failed",
        status: "FAILED",
      });
      const result = await InvoiceService.handleInvoiceCancellation(
        "inv_ic_failed",
        "reason",
      );
      expect(result).toEqual({ action: "NO_ACTION", status: "FAILED" });
    });
  });

  describe("getByPaymentIntentId", () => {
    it("requires a scope", async () => {
      await expect(
        InvoiceService.getByPaymentIntentId("pi_x", {}),
      ).rejects.toMatchObject({
        message: "Invoice scope is required.",
        statusCode: 403,
      });
    });

    it("resolves the invoice via a settled payment when no attempt exists", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
        invoiceId: "inv_pi_pay",
      });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_pi_pay",
        appointmentId,
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        status: "PAID",
        paymentCollectionMethod: "PAYMENT_INTENT",
        items: [],
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.getByPaymentIntentId("pi_pay", {
        organisationId,
      });

      expect((result as { id: string }).id).toBe("inv_pi_pay");
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            providerPaymentId: "pi_pay",
            invoice: { organisationId },
          }),
        }),
      );
    });

    it("returns null when nothing references the payment intent", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await InvoiceService.getByPaymentIntentId("pi_none", {
        organisationId,
      });
      expect(result).toBeNull();
    });

    it("returns null when the resolved invoice belongs to another organisation", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        invoiceId: "inv_pi_other",
      });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_pi_other",
        organisationId: "org_owner",
        parentId,
        status: "AWAITING_PAYMENT",
      });

      const result = await InvoiceService.getByPaymentIntentId("pi_other", {
        organisationId: "org_attacker",
      });
      expect(result).toBeNull();
    });

    it("returns null when the resolved invoice belongs to another parent", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        invoiceId: "inv_pi_parent",
      });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_pi_parent",
        organisationId,
        parentId: "parent_owner",
        status: "AWAITING_PAYMENT",
      });

      const result = await InvoiceService.getByPaymentIntentId("pi_parent", {
        parentId: "parent_attacker",
      });
      expect(result).toBeNull();
    });
  });

  describe("createCheckoutSessionAndEmailParent", () => {
    it("throws when the invoice is missing", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({ url: "https://checkout" });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InvoiceService.createCheckoutSessionAndEmailParent("missing"),
      ).rejects.toMatchObject({
        message: "Invoice not found.",
        statusCode: 404,
      });
    });

    it("does not send an email when the checkout has no url", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({ url: null });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_nourl",
        organisationId,
        parentId,
        currency: "usd",
        totalAmount: 90,
      });

      const result =
        await InvoiceService.createCheckoutSessionAndEmailParent("inv_nourl");

      expect(result.emailSent).toBe(false);
      expect(sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("logs and reports failure when the checkout email cannot be sent", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({ url: "https://checkout" });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 0,
        credited: 0,
        balance: 90,
      });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_email_fail",
        organisationId,
        parentId,
        currency: "usd",
        totalAmount: 90,
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        email: "parent@example.com",
        firstName: "Pat",
        lastName: "Owner",
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        name: "Org",
      });
      (sendEmailTemplate as jest.Mock).mockRejectedValueOnce(
        new Error("smtp down"),
      );

      const result =
        await InvoiceService.createCheckoutSessionAndEmailParent(
          "inv_email_fail",
        );

      expect(result.emailSent).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send invoice checkout email",
        expect.any(Error),
      );
    });
  });

  describe("createDraftForAppointment error paths", () => {
    it("throws when the appointment cannot be loaded after the org check", async () => {
      (prisma.appointment.findFirst as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
      });
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          patientId,
          organisationId,
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toMatchObject({
        message: "Appointment not found",
        statusCode: 404,
      });
    });

    it("throws when the appointment lacks patient links", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: null,
        companion: null,
      });

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          patientId,
          organisationId,
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toMatchObject({
        message: "Appointment patient links are missing",
        statusCode: 500,
      });
    });

    it("throws when the appointment has a patient but no parent link", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId },
        companion: null,
      });

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          patientId,
          organisationId,
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toMatchObject({
        message: "Appointment missing parent or patient links",
        statusCode: 500,
      });
    });

    it("throws when the requested patient does not match the appointment", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
      });

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          patientId: "different_patient",
          organisationId,
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toMatchObject({
        message: "Appointment patient links are missing",
        statusCode: 500,
      });
    });

    it("re-throws non-unique-constraint errors from invoice creation", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
      });
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.invoice.create as jest.Mock).mockRejectedValueOnce(
        new Error("database exploded"),
      );

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          patientId,
          organisationId,
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toThrow("database exploded");
    });

    it("re-throws the unique-constraint error when no existing invoice is found", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
      });
      (prisma.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prisma.invoice.create as jest.Mock).mockRejectedValueOnce({
        code: "P2002",
      });

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          patientId,
          organisationId,
          paymentCollectionMethod: "PAYMENT_LINK",
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });
  });

  describe("branch coverage: fallbacks and edge paths", () => {
    it("normalises payment, refund, receipt and line-item fallbacks when reading an invoice", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_fallbacks",
        appointmentId,
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [{ name: "", quantity: 2, unitPrice: 10 }],
        subtotal: 20,
        discountTotal: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 20,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        creditNotes: [],
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        name: "Org",
        googlePlacesId: "p",
        address: { city: "X" },
        imageUrl: "i",
      });
      (prisma.payment.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "pay_a",
          invoiceId: "inv_fallbacks",
          provider: "STRIPE",
          settlementChannel: null,
          collectionMode: null,
          providerPaymentId: null,
          amount: 5,
          currency: "usd",
          status: "SUCCEEDED",
          paidAt: null,
          receiptUrl: "https://receipt",
          refunds: [
            {
              id: "rf_a",
              paymentId: "pay_a",
              provider: "STRIPE",
              providerRefundId: null,
              amount: 1,
              currency: "usd",
              status: "SUCCEEDED",
              reason: null,
              rawProviderPayload: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "pay_b",
          invoiceId: "inv_fallbacks",
          provider: "MANUAL",
          settlementChannel: "CASH",
          collectionMode: null,
          providerPaymentId: null,
          amount: 3,
          currency: "usd",
          status: "SUCCEEDED",
          paidAt: null,
          receiptUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await InvoiceService.getById("inv_fallbacks", {
        organisationId,
      });

      const payA = result.invoice.payments?.find((p) => p.id === "pay_a");
      const payB = result.invoice.payments?.find((p) => p.id === "pay_b");
      expect(payA?.refunds?.[0]).toEqual(
        expect.objectContaining({
          providerRefundId: undefined,
          reason: undefined,
        }),
      );
      expect(payB?.refunds).toBeUndefined();
      // Only the payment carrying a receipt url is surfaced, and its null
      // settlement channel and paid-at collapse to undefined.
      expect(result.invoice.receipts).toEqual([
        expect.objectContaining({
          paymentId: "pay_a",
          settlementChannel: undefined,
          paidAt: undefined,
        }),
      ]);
      // The line without an id/total/name gets a synthesised name, no id, and a
      // total computed from quantity * unit price.
      expect(result.invoice.settlementSummary.lineAllocations).toEqual([
        expect.objectContaining({ id: undefined, name: "Item 1", total: 20 }),
      ]);
    });

    it("returns empty organisation fields and no line allocations for a parent-scoped invoice with no organisation", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_noorg",
        appointmentId: null,
        organisationId: null,
        parentId: "parent_x",
        patientId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: null,
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

      const result = await InvoiceService.getById("inv_noorg", {
        parentId: "parent_x",
      });

      expect(result.organistion).toEqual({
        name: "",
        placesId: "",
        address: "",
        image: "",
      });
      expect(result.invoice.settlementSummary.lineAllocations).toEqual([]);
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(prisma.renderedDocument.findFirst).not.toHaveBeenCalled();
    });

    it("resolves PAY_AT_VISIT_END mode for in-clinic drafts and tolerates a null organisation on the created row", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValueOnce({
        id: "inv_clinic",
        appointmentId: null,
        organisationId: null,
        patientId: null,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_AT_CLINIC",
        billingCollectionMode: "PAY_AT_VISIT_END",
        items: [],
        subtotal: 10,
        discountTotal: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 10,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.createDraftForAppointment({
        appointmentId,
        parentId,
        organisationId,
        patientId,
        items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
        paymentCollectionMethod: "PAYMENT_AT_CLINIC",
      });

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCollectionMode: "PAY_AT_VISIT_END",
          }),
        }),
      );
      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "INVOICE_CREATED" }),
        }),
      );
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(
        parentId,
        expect.anything(),
      );
      expect((result as { id: string }).id).toBe("inv_clinic");
    });

    it("clamps the collected deposit to zero when the invoice has none recorded", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_dep_null",
        depositCollectedAmount: null,
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_dep_null",
        billingCollectionMode: "DEPOSIT_THEN_SETTLE",
        depositTargetAmount: 20,
        depositCollectedAmount: 0,
        totalAmount: 100,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        items: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await InvoiceService.setInvoiceDepositTarget(
        "inv_dep_null",
        20,
      );

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ depositCollectedAmount: 0 }),
        }),
      );
      expect(updated?.depositTargetAmount).toBe(20);
    });

    it("keeps the acting user and defaults billing mode when marking ready without a finalized snapshot", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_ready_b",
        appointmentId,
        organisationId,
        status: "AWAITING_PAYMENT",
        visitBillingStage: "DRAFT",
        billingCollectionMode: null,
        finalizedAt: null,
        totalAmount: 100,
        currency: "usd",
        items: [],
        subtotal: 100,
        discountTotal: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        taxSnapshot: { provider: "STRIPE" },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // finalizeTaxForInvoice short-circuits on an already-finalized row.
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_ready_b",
        organisationId,
        status: "AWAITING_PAYMENT",
        finalizedAt: new Date(),
        items: [],
        taxSnapshot: null,
        currency: "usd",
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.renderedDocument.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "rd_ready",
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_ready_b",
        appointmentId,
        organisationId,
        status: "AWAITING_PAYMENT",
        visitBillingStage: "READY_FOR_BILLING",
        billingCollectionMode: "PAY_AT_VISIT_END",
        readyForBillingAt: new Date(),
        readyForBillingActorId: "user_9",
        totalAmount: 100,
        currency: "usd",
        items: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await InvoiceService.markAppointmentReadyForBilling(
        appointmentId,
        { organisationId, actorUserId: "user_9" },
      );

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCollectionMode: "PAY_AT_VISIT_END",
            readyForBillingActorId: "user_9",
          }),
        }),
      );
      expect(updated?.visitBillingStage).toBe("READY_FOR_BILLING");
    });

    it("treats a missing collected deposit as zero when reversing ready-for-billing", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_rev",
        appointmentId,
        organisationId,
        status: "AWAITING_PAYMENT",
        visitBillingStage: "READY_FOR_BILLING",
        depositCollectedAmount: null,
        totalAmount: 80,
        currency: "usd",
        items: [],
        metadata: {},
        taxSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 0,
        credited: 0,
        balance: 80,
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_rev",
        appointmentId,
        organisationId,
        status: "AWAITING_PAYMENT",
        visitBillingStage: "DRAFT",
        readyForBillingAt: null,
        readyForBillingActorId: null,
        totalAmount: 80,
        currency: "usd",
        items: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await InvoiceService.reverseAppointmentReadyForBilling(
        appointmentId,
        { organisationId },
      );

      expect(getInvoiceFinancialSummary).toHaveBeenCalledWith("inv_rev", 80, 0);
      expect(updated?.visitBillingStage).toBe("DRAFT");
    });

    it("defaults the settlement channel to CASH when settling a balance at closeout", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_settle_cash",
        status: "AWAITING_PAYMENT",
        organisationId,
        patientId,
        parentId,
        totalAmount: 100,
        currency: "usd",
        depositCollectedAmount: 0,
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 20,
        credited: 0,
        balance: 80,
      });
      (
        FinancePaymentService.recordManualPayment as jest.Mock
      ).mockResolvedValueOnce({
        invoice: { id: "inv_settle_cash", status: "PAID" },
      });

      const result = await InvoiceService.settleInvoiceAtCloseout(
        "inv_settle_cash",
        organisationId,
      );

      expect(FinancePaymentService.recordManualPayment).toHaveBeenCalledWith(
        "inv_settle_cash",
        expect.objectContaining({ settlementChannel: "CASH" }),
      );
      expect((result as { id: string }).id).toBe("inv_settle_cash");
    });

    it("skips items without an id and tolerates a null organisation when recording a paid state", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_paid_noid",
        status: "AWAITING_PAYMENT",
        organisationId,
        appointmentId,
        patientId,
        parentId,
        items: [{ id: "good" }, { name: "noid" }],
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_paid_noid",
        status: "PAID",
        organisationId: null,
        patientId: null,
        parentId,
        appointmentId: null,
        totalAmount: 90,
        currency: "usd",
        paymentCollectionMethod: "PAYMENT_AT_CLINIC",
        metadata: {},
        items: [],
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const paid = await InvoiceService.markInvoicePaid({
        invoiceId: "inv_paid_noid",
      });

      expect(paid).toBeTruthy();
      expect(prisma.workspaceTreatmentItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceRowId: { in: ["good"] },
          }),
        }),
      );
      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "INVOICE_PAID" }),
        }),
      );
    });

    it("tolerates a null organisation when applying a terminal FAILED status", async () => {
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_failed_noorg",
        organisationId: null,
        status: "FAILED",
        totalAmount: 20,
        currency: "usd",
        patientId: null,
        appointmentId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const doc = await InvoiceService.markFailed("inv_failed_noorg");

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "INVOICE_FAILED" }),
        }),
      );
      expect((doc as { status: string }).status).toBe("FAILED");
    });

    it("issues a credit note when the invoice carries no credit notes and no organisation", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_cn_noorg",
        organisationId: null,
        totalAmount: 100,
        status: "AWAITING_PAYMENT",
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.creditNote.create as jest.Mock).mockResolvedValueOnce({
        id: "cn_noorg",
        invoiceId: "inv_cn_noorg",
        creditNoteNumber: "CN-NOORG",
        reason: null,
        amount: 10,
        status: "ISSUED",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.issueCreditNote("inv_cn_noorg", {
        amount: 10,
      });

      expect(prisma.creditNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 10, status: "ISSUED" }),
        }),
      );
      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "CREDIT_NOTE_ISSUED" }),
        }),
      );
      expect(result.amount).toBe(10);
    });

    it("voids a credit note with no reason, no metadata and no organisation", async () => {
      (prisma.creditNote.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "cn_v",
        invoiceId: "inv_v",
        creditNoteNumber: "CN-V",
        reason: null,
        amount: 10,
        status: "ISSUED",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        invoice: { id: "inv_v", organisationId: null },
      });
      (prisma.creditNote.update as jest.Mock).mockResolvedValueOnce({
        id: "cn_v",
        invoiceId: "inv_v",
        creditNoteNumber: "CN-V",
        reason: null,
        amount: 10,
        status: "VOIDED",
        metadata: { voidedAt: "2026-07-18T00:00:00.000Z" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.voidCreditNote("inv_v", "cn_v");

      expect(prisma.creditNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "VOIDED" }),
        }),
      );
      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "CREDIT_NOTE_VOIDED" }),
        }),
      );
      expect(result.status).toBe("VOIDED");
    });

    it("cancels an unpaid appointment invoice with null metadata, organisation and collected deposit", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "inv_cancel_null",
        appointmentId,
        status: "AWAITING_PAYMENT",
        organisationId: null,
        totalAmount: 50,
        currency: "usd",
        depositCollectedAmount: null,
        metadata: null,
        patientId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 0,
        credited: 0,
        balance: 50,
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_cancel_null",
        appointmentId,
        organisationId: null,
        patientId: null,
        status: "CANCELLED",
        metadata: { cancellationReason: "no show" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.handleAppointmentCancellation(
        "appt_cancel",
        "no show",
      );

      expect(getInvoiceFinancialSummary).toHaveBeenCalledWith(
        "inv_cancel_null",
        50,
        0,
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CANCELLED" }),
        }),
      );
      expect(result).toEqual({ action: "CANCELLED_UNPAID" });
    });

    it("throws when bootstrapping an appointment whose product 404s and has no backing service id", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { name: "NoId" },
        productItemId: "prod_x",
        concern: null,
      });

      await expect(
        InvoiceService.bootstrapForAppointment(appointmentId),
      ).rejects.toMatchObject({
        message: "Service not found",
        statusCode: 404,
      });
    });

    it("falls back to a Consultation description and undefined discount when the service has no name", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: patientId, parent: { id: parentId } },
        appointmentType: { id: "svc_x" },
        productItemId: null,
        concern: null,
      });
      (prisma.service.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "svc_x",
        name: null,
        cost: 50,
        maxDiscount: null,
      });
      const createSpy = jest
        .spyOn(InvoiceService, "createDraftForAppointment")
        .mockResolvedValueOnce({ id: "inv_b14" } as never);

      const result =
        await InvoiceService.bootstrapForAppointment(appointmentId);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: undefined,
          items: [
            expect.objectContaining({
              description: "Consultation",
              quantity: 1,
              unitPrice: 50,
              discountPercent: undefined,
            }),
          ],
        }),
      );
      expect((result as { id: string }).id).toBe("inv_b14");
      createSpy.mockRestore();
    });

    it("merges a line item that has neither a name nor a description", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_nameless",
        status: "AWAITING_PAYMENT",
        organisationId,
        parentId,
        currency: "usd",
        items: [],
        taxPercent: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_nameless",
        status: "AWAITING_PAYMENT",
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        items: [],
        subtotal: 5,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 5,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const namelessItems = [
        { quantity: 1, unitPrice: 5 },
      ] as unknown as Parameters<typeof InvoiceService.addItemsToInvoice>[1];

      const result = await InvoiceService.addItemsToInvoice(
        "inv_nameless",
        namelessItems,
      );

      expect(prisma.invoice.update).toHaveBeenCalled();
      expect((result as { id: string }).id).toBe("inv_nameless");
    });

    it("keeps the stored tax percent when the taxable subtotal is zero", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_zero_tax",
        organisationId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [
          {
            name: "Free",
            description: "Free",
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ],
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 5,
        totalAmount: 0,
        taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const preview = await InvoiceService.previewTaxForInvoice("inv_zero_tax");

      expect(preview.taxTotal).toBe(0);
      expect(preview.taxProvider).toBe("STRIPE");
    });

    it("falls back to a zero tax percent when both the taxable subtotal and stored percent are absent", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_zero_tax_null",
        organisationId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [
          {
            name: "Free",
            description: "Free",
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ],
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: null,
        totalAmount: 0,
        taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const preview =
        await InvoiceService.previewTaxForInvoice("inv_zero_tax_null");

      expect(preview.taxTotal).toBe(0);
      expect(preview.taxProvider).toBe("STRIPE");
    });

    it("rejects an appointment whose patient id is not a string", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce({
        id: appointmentId,
        organisationId,
        patient: { id: 123, parent: { id: parentId } },
      });

      await expect(
        InvoiceService.createDraftForAppointment({
          appointmentId,
          parentId,
          organisationId,
          patientId,
          items: [{ description: "Consult", quantity: 1, unitPrice: 10 }],
          paymentCollectionMethod: "PAYMENT_LINK",
        }),
      ).rejects.toMatchObject({
        message: "Appointment patient links are missing",
        statusCode: 500,
      });
    });

    it("adds items to an invoice missing organisation, parent, items and tax snapshot", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_bare",
        status: "AWAITING_PAYMENT",
        organisationId: null,
        parentId: null,
        currency: "usd",
        items: null,
        taxPercent: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        taxSnapshot: null,
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_bare",
        status: "AWAITING_PAYMENT",
        organisationId: null,
        parentId: null,
        patientId: null,
        appointmentId: null,
        currency: "usd",
        items: [],
        subtotal: 20,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 20,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await InvoiceService.addItemsToInvoice("inv_bare", [
        {
          name: "Lab",
          description: "Lab",
          quantity: 1,
          unitPrice: 20,
          total: 20,
        },
      ]);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "" } }),
      );
      expect(prisma.invoice.update).toHaveBeenCalled();
      expect((result as { id: string }).id).toBe("inv_bare");
    });

    it("previews tax for an invoice whose items field is null", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_noitems",
        organisationId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        items: null,
        subtotal: 0,
        discountTotal: 0,
        invoiceDiscountType: null,
        invoiceDiscountValue: null,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 0,
        taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const preview = await InvoiceService.previewTaxForInvoice("inv_noitems");

      expect(preview.taxProvider).toBe("STRIPE");
      expect(preview.taxTotal).toBe(0);
    });

    it("finalizes tax and records a null tax provider on the finance event when the update returns none", async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_final_np",
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
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
        taxTotal: 0,
        taxPercent: 0,
        taxSnapshot: { provider: "STRIPE", taxBehavior: "EXCLUSIVE" },
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValueOnce({
        id: "inv_final_np",
        organisationId,
        patientId,
        parentId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        taxProvider: null,
        subtotal: 100,
        discountTotal: 0,
        invoiceDiscountTotal: 0,
        taxTotal: 0,
        taxPercent: 0,
        totalAmount: 100,
        items: [],
        finalizedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.renderedDocument.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.renderedDocument.create as jest.Mock).mockResolvedValueOnce({
        id: "rd_final_np",
      });

      const result = await InvoiceService.finalizeTaxForInvoice("inv_final_np");

      expect(prisma.financeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "INVOICE_FINALIZED" }),
        }),
      );
      expect(result.id).toBe("inv_final_np");
    });

    it("looks up an invoice by payment intent for a parent-only scope without an organisation filter", async () => {
      (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
        invoiceId: "inv_pi",
      });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_pi",
        organisationId,
        parentId,
        patientId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
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

      const result = await InvoiceService.getByPaymentIntentId("pi_parent", {
        parentId,
      });

      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerPaymentId: "pi_parent" },
        }),
      );
      expect((result as { id: string }).id).toBe("inv_pi");
    });

    it("emails the checkout link with undefined organisation name and amount text when the invoice has no organisation or currency", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({ url: "https://checkout" });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_co_noorg",
        organisationId: null,
        parentId: "parent_x",
        currency: null,
        totalAmount: 50,
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        metadata: {},
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 0,
        credited: 0,
        balance: 50,
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        email: "parent@example.com",
        firstName: "Pat",
        lastName: "Owner",
      });

      const result =
        await InvoiceService.createCheckoutSessionAndEmailParent(
          "inv_co_noorg",
        );

      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            organisationName: undefined,
            amountText: undefined,
          }),
        }),
      );
      expect(result.emailSent).toBe(true);
    });

    it("does not email the checkout link when the parent record cannot be found", async () => {
      (
        FinancePaymentService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValueOnce({ url: "https://checkout" });
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_co_noparent",
        organisationId,
        parentId: "parent_x",
        currency: "usd",
        totalAmount: 50,
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        metadata: {},
      });
      (getInvoiceFinancialSummary as jest.Mock).mockResolvedValueOnce({
        paid: 0,
        credited: 0,
        balance: 50,
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        name: "Org",
      });

      const result =
        await InvoiceService.createCheckoutSessionAndEmailParent(
          "inv_co_noparent",
        );

      expect(sendEmailTemplate).not.toHaveBeenCalled();
      expect(result.emailSent).toBe(false);
    });

    it("builds a Stripe address that drops null lines while keeping the country", async () => {
      const fakeStripe = {
        invoices: {
          createPreview: jest.fn().mockResolvedValue({
            id: "inprev_addr",
            total_taxes: [{ amount: 250 }],
            total_excluding_tax: 5000,
            automatic_tax: { status: "complete" },
          }),
        },
      } as unknown as Stripe;
      __setFinanceTaxStripeClientForTests(fakeStripe);

      (prisma.invoice.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "inv_addr",
        organisationId,
        parentId,
        patientId,
        currency: "usd",
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_LINK",
        items: [
          {
            name: "Consult",
            description: "Consult",
            quantity: 1,
            unitPrice: 50,
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
        taxSnapshot: null,
        finalizedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        stripeAccountId: "acct_addr",
      });
      (prisma.parent.findUnique as jest.Mock).mockResolvedValueOnce({
        address: {
          addressLine: null,
          city: null,
          state: null,
          postalCode: null,
          country: "US",
        },
      });

      const preview = await InvoiceService.previewTaxForInvoice("inv_addr");

      expect(fakeStripe.invoices.createPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_details: {
            address: {
              line1: undefined,
              city: undefined,
              state: undefined,
              postal_code: undefined,
              country: "US",
            },
          },
        }),
      );
      expect(preview.taxProvider).toBe("STRIPE");
    });

    it("lists parent and companion invoices without an organisation filter", async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await InvoiceService.listForParent(parentId, null);
      expect(prisma.invoice.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { parentId } }),
      );

      await InvoiceService.listForCompanion(patientId, null);
      expect(prisma.invoice.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { patientId } }),
      );
    });
  });
});
