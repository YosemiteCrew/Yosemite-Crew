import { Router } from "express";
import { FormController } from "src/controllers/web/form.controller";
import { FormSigningController } from "src/controllers/web/formSigning.contorller";
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
  FormController.submitFormFromPMS,
);

//Router to get SOAP notes for appointment
router.get(
  "/appointments/:appointmentId/soap-notes",
  authorizeCognito,
  FormController.getSOAPNotesByAppointment,
);

router.post(
  "/form-submissions/:submissionId/sign",
  authorizeCognito,
  FormSigningController.startSigning
);

router.get(
  "/form-submissions/:submissionId/signed-document",
  //authorizeCognito,
  FormSigningController.getSignedDocument
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
  "/mobile/form-submissions/:submissionId/pdf",
  authorizeCognitoMobile,
  FormController.getFormSubmissionPDF,
);

router.post(
  "/mobile/form-submissions/:submissionId/sign",
  authorizeCognitoMobile,
  FormSigningController.startSigningMobile
);



export default router;
