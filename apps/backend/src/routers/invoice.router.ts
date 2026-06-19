import { Router } from "express";
import rateLimit from "express-rate-limit";
import { InvoiceController } from "../controllers/app/invoice.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentIntentOrgPermissions,
} from "src/middlewares/rbac";
import type { OrgRequest } from "src/middlewares/rbac";

const router = Router();

const invoiceActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const orgId =
      (req as OrgRequest).organisationId ??
      (req.headers["x-org-id"] as string | undefined) ??
      "unknown-org";
    const userId = (req as { userId?: string }).userId ?? "unknown-user";
    const invoiceId = req.params.invoiceId ?? "unknown-invoice";
    const appointmentId = req.params.appointmentId ?? "unknown-appointment";

    return `${orgId}:${userId}:${invoiceId}:${appointmentId}`;
  },
});

// Routes for Mobile

router.post(
  "/mobile/appointment/:appointmentId",
  authorizeCognitoMobile,
  invoiceActionLimiter,
  InvoiceController.listInvoicesForAppointment,
);

router.get(
  "/mobile/payment-intent/:paymentIntentId",
  authorizeCognitoMobile,
  InvoiceController.getInvoiceByPaymentIntentId,
);

router.get(
  "/mobile/:invoiceId",
  authorizeCognitoMobile,
  InvoiceController.getInvoiceById,
);
// Routes for PMS

router.post(
  "/appointment/:appointmentId/charges",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.addChargesToAppointment,
);

// List invoices for an appointment
router.post(
  "/appointment/:appointmentId",
  authorizeCognito,
  invoiceActionLimiter,
  withAppointmentOrgPermissions(),
  requirePermission("billing:view:any"),
  InvoiceController.listInvoicesForAppointment,
);

router.post(
  "/pms/appointment/:appointmentId/bootstrap",
  authorizeCognito,
  withAppointmentOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.bootstrapInvoiceForAppointment,
);

// Get invoice by Payment Intent ID
router.get(
  "/payment-intent/:paymentIntentId",
  authorizeCognito,
  withPaymentIntentOrgPermissions(),
  requirePermission("billing:view:any"),
  InvoiceController.getInvoiceByPaymentIntentId,
);

router.get(
  "/organisation/:organisationId/list",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  InvoiceController.listInvoicesForOrganisation,
);

// Create checkout session for invoice and email parent
router.post(
  "/:invoiceId/checkout-session",
  authorizeCognito,
  InvoiceController.createCheckoutSessionForInvoice,
);

// Mark invoice paid manually (in-clinic)
router.post(
  "/:invoiceId/mark-paid",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.markInvoicePaidManually,
);

// Update payment collection method
router.patch(
  "/:invoiceId/payment-collection-method",
  authorizeCognito,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.updatePaymentCollectionMethod,
);

// Issue credit note for invoice corrections
router.post(
  "/:invoiceId/credit-notes",
  authorizeCognito,
  invoiceActionLimiter,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.issueCreditNote,
);

router.post(
  "/:invoiceId/credit-notes/:creditNoteId/void",
  authorizeCognito,
  invoiceActionLimiter,
  withInvoiceOrgPermissions(),
  requirePermission("billing:edit:any"),
  InvoiceController.voidCreditNote,
);

// Get invoice by ID
router.get("/:invoiceId", authorizeCognito, InvoiceController.getInvoiceById);

export default router;
