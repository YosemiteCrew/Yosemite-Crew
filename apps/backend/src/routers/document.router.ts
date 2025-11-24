import { Router } from "express";
import { DocumentController } from "../controllers/app/document.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

//Mobile routes

router.post(
  "/mobile/upload-url",
  authorizeCognitoMobile,
  DocumentController.getUploadUrl,
);
router.post(
  "/mobile/:companionId",
  authorizeCognitoMobile,
  DocumentController.createDocument,
);
router.get(
  "/mobile/:companionId",
  authorizeCognitoMobile,
  DocumentController.listDocumentsForParent,
);
router.patch(
  "/mobile/details/:id",
  authorizeCognito,
  DocumentController.updateDocument,
);
router.get(
  "/mobile/appointments/:appointmentId",
  authorizeCognitoMobile,
  DocumentController.listForAppointment,
);
router.get(
  "/mobile/view/:documentId",
  authorizeCognitoMobile,
  DocumentController.getDocumentDownloadUrl,
);
router.post(
  "/mobile/view",
  authorizeCognitoMobile,
  DocumentController.getSignedDownloadUrl,
);
router.delete(
  "/mobile/:documentId",
  authorizeCognitoMobile,
  DocumentController.deleteForParent,
);

// PMS routes

router.post(
  "/pms/:companionId",
  authorizeCognito,
  DocumentController.createDocumentPms,
);
router.get(
  "/pms/:companionId",
  authorizeCognitoMobile,
  DocumentController.listForPms,
);
router.get(
  "/pms/details/:documentId",
  authorizeCognito,
  DocumentController.getForPms,
);
router.patch(
  "/pms/details/:documentId",
  authorizeCognito,
  DocumentController.updateDocument,
);
router.get(
  "/pms/view/:documentId",
  authorizeCognito,
  DocumentController.getDocumentDownloadUrl,
);
router.post(
  "/pms/view",
  authorizeCognito,
  DocumentController.getSignedDownloadUrl,
);
router.get(
  "/pms/appointments/:appointmentId",
  authorizeCognito,
  DocumentController.listForAppointment,
);

export default router;
