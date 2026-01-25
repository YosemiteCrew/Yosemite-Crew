import { Router } from "express";
import { FormController } from "src/controllers/web/form.controller";
import { FormSigningController } from "src/controllers/web/formSigning.contorller";
import { authorizeCognitoMobile, authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS / ADMIN ROUTES (RBAC ENABLED)
   ====================================================== */

// Create form
router.post(
  "/admin/:orgId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormController.createForm,
);

// List forms for organisation
router.get(
  "/admin/:orgId/forms",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  FormController.getFormListForOrganisation,
);

// Get form for admin
router.get(
  "/admin/:orgId/:formId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  FormController.getFormForAdmin,
);

// Update form
router.put(
  "/admin/:orgId/:formId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormController.updateForm,
);

// Publish / Unpublish / Archive
router.post(
  "/admin/:formId/publish",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormController.publishForm,
);

router.post(
  "/admin/:formId/unpublish",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormController.unpublishForm,
);

router.post(
  "/admin/:formId/archive",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormController.archiveForm,
);

// Submit form from PMS
router.post(
  "/admin/:formId/submit",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormController.submitFormFromPMS,
);

/* ======================================================
   PMS – APPOINTMENT / SUBMISSIONS
   ====================================================== */

// SOAP notes for appointment
router.get(
  "/appointments/:appointmentId/soap-notes",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("prescription:view:any"),
  FormController.getSOAPNotesByAppointment,
);

// Forms for appointment
router.get(
  "/appointments/:appointmentId/forms",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  FormController.getFormsForAppointment,
);

// Start signing (PMS)
router.post(
  "/form-submissions/:submissionId/sign",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  FormSigningController.startSigning,
);

// Generate submission PDF (PMS)
router.get(
  "/form-submissions/:submissionId/pdf",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  FormController.getFormSubmissionPDF,
);

// Get signed document (PMS)
router.get(
  "/form-submissions/:submissionId/signed-document",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  FormSigningController.getSignedDocument,
);

/* ======================================================
   PUBLIC ROUTES (NO AUTH / NO RBAC)
   ====================================================== */

router.get("/public/:formId", FormController.getFormForClient);

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/mobile/forms/:formId/submit",
  authorizeCognitoMobile,
  FormController.submitForm,
);

router.get(
  "/mobile/submissions/:formId",
  authorizeCognitoMobile,
  FormController.getFormSubmissions,
);

router.get(
  "/mobile/forms/:formId/submissions",
  authorizeCognitoMobile,
  FormController.listFormSubmissions,
);

router.get(
  "/mobile/forms/:organizationId/:serivceId/consent-form",
  authorizeCognitoMobile,
  FormController.getConsentFormForParent,
);

router.get(
  "/mobile/appointments/:appointmentId/soap-notes",
  authorizeCognitoMobile,
  FormController.getSOAPNotesByAppointment,
);

router.get(
  "/mobile/appointments/:appointmentId/forms",
  authorizeCognitoMobile,
  FormController.getFormsForAppointment,
);

router.get(
  "/mobile/form-submissions/:submissionId/pdf",
  authorizeCognitoMobile,
  FormController.getFormSubmissionPDF,
);

router.post(
  "/mobile/form-submissions/:submissionId/sign",
  authorizeCognitoMobile,
  FormSigningController.startSigningMobile,
);

export default router;
