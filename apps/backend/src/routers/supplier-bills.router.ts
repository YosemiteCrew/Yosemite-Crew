import { Router } from "express";
import { SupplierBillController } from "src/controllers/app/supplier-bill.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   SUPPLIER BILLS
   ====================================================== */

// Create supplier bill draft
router.post(
  "/supplier-bills",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  SupplierBillController.createDraft,
);

// List supplier bills
router.get(
  "/organisation/:organisationId/supplier-bills",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  SupplierBillController.list,
);

// Get supplier bill by ID
router.get(
  "/supplier-bills/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  SupplierBillController.getById,
);

// Post supplier bill
router.post(
  "/supplier-bills/:id/post",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  SupplierBillController.postBill,
);

// Void supplier bill
router.post(
  "/supplier-bills/:id/void",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  SupplierBillController.voidBill,
);

/* ======================================================
   SUPPLIER CREDITS
   ====================================================== */

// Create supplier credit
router.post(
  "/supplier-credits",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  SupplierBillController.createCredit,
);

/* ======================================================
   SUPPLIER PAYMENTS
   ====================================================== */

// Create supplier payment with allocations
router.post(
  "/supplier-payments",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  SupplierBillController.createPayment,
);

/* ======================================================
   SUPPLIER ACCOUNTS
   ====================================================== */

// Get supplier account
router.get(
  "/organisation/:organisationId/vendors/:vendorId/accounts/:currency",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  SupplierBillController.getSupplierAccount,
);

// Get supplier account statement (ledger)
router.get(
  "/organisation/:organisationId/vendors/:vendorId/accounts/:currency/statement",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  SupplierBillController.getSupplierAccountStatement,
);

export default router;
