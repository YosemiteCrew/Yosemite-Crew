import { Router } from "express";
import { DeviceTokenController } from "../controllers/app/deviceToken.controller";
import { requireMobileAuth } from "src/middlewares/auth";

const router = Router();

// Route to register a device token
router.post(
  "/register",
  requireMobileAuth,
  DeviceTokenController.registerDeviceToken,
);

// Route to unregister a device token
router.post(
  "/unregister",
  requireMobileAuth,
  DeviceTokenController.unregisterDeviceToken,
);

export default router;
