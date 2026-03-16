import { Router, type RequestHandler } from "express";
import { ContactController } from "src/controllers/app/contact-us.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// In local dev (in-memory DB), skip auth for admin routes
const adminAuth: RequestHandler =
  process.env.USE_INMEMORY_DB === "true" && process.env.NODE_ENV === "development"
    ? (_req, _res, next) => next()
    : authorizeCognito;

// Authenticated endpoint for mobile users
const publicAuth: RequestHandler =
  process.env.USE_INMEMORY_DB === "true"
    ? (_req, _res, next) => next()
    : authorizeCognitoMobile;

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
router.get(
  "/dashboard/stats",
  adminAuth,
  ContactController.getDashboardStats,
);

export default router;
