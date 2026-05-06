import { Router } from "express";
import { InvoiceController } from "../controllers/app/invoice.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentIntentOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

// Routes for Mobile

router.post(
  "/mobile/appointment/:appointmentId",
  authorizeCognitoMobile,
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

// Get invoice by ID
router.get("/:invoiceId", authorizeCognito, InvoiceController.getInvoiceById);

export default router;
