import { Router } from "express";
import { InvoiceController } from "../controllers/app/invoice.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// Routes for Mobile

router.get(
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
  InvoiceController.addChargesToAppointment,
);

// List invoices for an appointment
router.get(
  "/appointment/:appointmentId",
  authorizeCognito,
  InvoiceController.listInvoicesForAppointment,
);

// Get invoice by Payment Intent ID
router.get(
  "/payment-intent/:paymentIntentId",
  authorizeCognito,
  InvoiceController.getInvoiceByPaymentIntentId,
);

router.get(
  "/organisation/:organisationId/list",
  authorizeCognito,
  InvoiceController.listInvoicesForOrganisation,
);

// Get invoice by ID
router.get("/:invoiceId", authorizeCognito, InvoiceController.getInvoiceById);

export default router;
