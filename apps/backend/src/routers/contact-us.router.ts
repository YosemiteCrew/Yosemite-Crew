import { Router, type RequestHandler } from "express";
import { ContactController } from "src/controllers/app/contact-us.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// In local dev (in-memory DB + development), skip auth for admin routes
const skipAuth: RequestHandler = (_req, _res, next) => next();
const isLocalDev =
  process.env.USE_INMEMORY_DB === "true" &&
  process.env.NODE_ENV === "development";

const adminAuth = isLocalDev ? skipAuth : authorizeCognito;
const publicAuth = isLocalDev ? skipAuth : authorizeCognitoMobile;

// Mobile/web endpoint (authenticated via mobile auth)
router.post("/contact", publicAuth, ContactController.create);
router.post("/contact-web", ContactController.createWeb);
router.post(
  "/attachments/presigned-url",
  ContactController.getAttachmentUploadUrl,
);

// Internal admin / support tools
router.get("/requests", adminAuth, ContactController.list);
router.get("/requests/:id", adminAuth, ContactController.getById);
router.patch("/requests/:id/status", adminAuth, ContactController.updateStatus);
router.patch(
  "/requests/:id/priority",
  adminAuth,
  ContactController.updatePriority,
);
router.patch(
  "/requests/:id/assign",
  adminAuth,
  ContactController.assignRequest,
);
router.get("/dashboard/stats", adminAuth, ContactController.getDashboardStats);

export default router;
