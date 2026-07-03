import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentOrgPermissions,
  withPaymentIntentOrgPermissions,
} from "src/middlewares/rbac";
import { FinanceController } from "src/controllers/app/finance.controller";

const router = Router();

const financeAppointmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const orgId =
      (req.params.organisationId as string | undefined) ??
      (req.headers["x-org-id"] as string | undefined) ??
      "unknown-org";
    const userId = (req as { userId?: string }).userId ?? "unknown-user";
    const appointmentId = req.params.appointmentId ?? "unknown-appointment";

    return `${orgId}:${userId}:${appointmentId}`;
  },
});

router.get(
  "/organisation/:organisationId/subscription/seat-sync-plan",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:view:any"),
  FinanceController.getSubscriptionSeatSyncPlan,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/customer",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionCustomer,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/checkout/completed",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionCheckoutCompleted,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/updated",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionUpdated,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/deleted",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionDeleted,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/invoice-paid",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionInvoicePaid,
);

router.post(
  "/organisation/:organisationId/subscription/provider/:provider/invoice-failed",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordSubscriptionInvoiceFailed,
);

router.get(
  "/subscriptions/current",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:view:any"),
  FinanceController.getCurrentSubscription,
);

router.post(
  "/subscriptions",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.upsertSubscription,
);

router.post(
  "/usage-events",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:edit:any"),
  FinanceController.recordUsageEvent,
);

router.get(
  "/usage-snapshots",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("subscription:view:any"),
  FinanceController.getUsageSnapshots,
);

router.post(
  "/visits/:visitId/milestones",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.recordVisitMilestone,
);

router.post(
  "/appointments/:appointmentId/ready-for-billing",
  requireWebAuth,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.markAppointmentReadyForBilling,
);

router.delete(
  "/appointments/:appointmentId/ready-for-billing",
  requireWebAuth,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.reverseAppointmentReadyForBilling,
);

router.get(
  "/invoices",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.listInvoices,
);

router.post(
  "/invoices",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.createInvoice,
);

router.post(
  "/invoices/:invoiceId/lines",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.addInvoiceItems,
);

router.get(
  "/invoices/:invoiceId",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.getInvoiceById,
);

router.get(
  "/invoices/payment-intent/:paymentIntentId",
  requireWebAuth,
  withPaymentIntentOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.retrievePaymentIntent,
);

router.post(
  "/invoices/:invoiceId/finalize",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.finalizeInvoice,
);

router.post(
  "/invoices/:invoiceId/closeout",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.settleInvoiceAtCloseout,
);

router.post(
  "/invoices/:invoiceId/tax/preview",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.previewInvoiceTax,
);

router.post(
  "/invoices/:invoiceId/tax/finalize",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.finalizeInvoice,
);

router.post(
  "/invoices/:invoiceId/void",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.voidInvoice,
);

router.post(
  "/invoices/:invoiceId/supplement",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.supplementInvoice,
);

router.post(
  "/invoices/:invoiceId/payments",
  requireWebAuth,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.recordInvoicePayment,
);

router.post(
  "/invoices/:invoiceId/payments/sessions",
  requireWebAuth,
  financeAppointmentLimiter,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.createInvoicePaymentSession,
);

router.get(
  "/:invoiceId",
  requireWebAuth,
  financeAppointmentLimiter,
  withInvoiceOrgPermissions(),
  requirePermission("billing:view:any"),
  FinanceController.getInvoiceById,
);

router.get(
  "/mobile/parents/:parentId/invoices",
  requireMobileAuth,
  FinanceController.listInvoicesForParent,
);

router.post(
  "/mobile/appointments/:appointmentId/invoices",
  requireMobileAuth,
  financeAppointmentLimiter,
  FinanceController.listInvoicesForAppointment,
);

router.post(
  "/mobile/appointments/:appointmentId/seed",
  requireMobileAuth,
  FinanceController.bootstrapInvoiceForAppointment,
);

router.post(
  "/mobile/invoices/:invoiceId/payments/sessions",
  requireMobileAuth,
  FinanceController.createMobileInvoicePaymentSession,
);

router.get(
  "/mobile/payment-intent/:paymentIntentId",
  requireMobileAuth,
  FinanceController.retrievePaymentIntent,
);

router.get(
  "/mobile/:invoiceId",
  requireMobileAuth,
  FinanceController.getInvoiceById,
);

router.post(
  "/payments/:paymentId/refunds",
  requireWebAuth,
  withPaymentOrgPermissions(),
  requirePermission("billing:edit:any"),
  FinanceController.refundPayment,
);

export default router;
