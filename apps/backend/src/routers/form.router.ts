import { Router } from "express";
import { FormController } from "src/controllers/web/form.controller";
import { authorizeCognitoMobile, authorizeCognito } from "src/middlewares/auth";

const router = Router();

// PMS / ADMIN ROUTES
router.post("/admin/:orgId", authorizeCognito, FormController.createForm);

router.get(
  "/admin/:orgId/forms",
  authorizeCognito,
  FormController.getFormListForOrganisation,
);

// Get form for admin
router.get(
  "/admin/:orgId/:formId",
  authorizeCognito,
  FormController.getFormForAdmin,
);

// Update form
router.put(
  "/admin/:orgId/:formId",
  authorizeCognito,
  FormController.updateForm,
);

// Publish / Unpublish / Archive
router.post(
  "/admin/:formId/publish",
  authorizeCognito,
  FormController.publishForm,
);
router.post(
  "/admin/:formId/unpublish",
  authorizeCognito,
  FormController.unpublishForm,
);
router.post(
  "/admin/:formId/archive",
  authorizeCognito,
  FormController.archiveForm,
);
router.post(
  "/admin/:formId/submit",
  authorizeCognito,
  FormController.submitFormFromPMS
)

//Router to get SOAP notes for appointment
router.get(
  "/appointments/:appointmentId/soap-notes",
  authorizeCognito,
  FormController.getSOAPNotesByAppointment
);

// PUBLIC ROUTES
router.get("/public/:formId", FormController.getFormForClient);

// MOBILE ROUTES
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

export default router;
