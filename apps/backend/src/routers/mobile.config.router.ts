import { Router } from "express";
import logger from "../utils/logger";
import {
  resolveMobileConfig,
  summarizeAppUpdateConfig,
} from "../utils/mobile-config";

const router = Router();

router.get("", (_req, res) => {
  try {
    const config = resolveMobileConfig();

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
    res.status(200).json(config);

    logger.info("mobile-config served", {
      env: config.env,
      hasAppUpdate: Boolean(config.appUpdate),
      appUpdate: summarizeAppUpdateConfig(config.appUpdate),
    });
  } catch (error) {
    logger.error("mobile-config failed", { error });
    res.status(500).json({ message: "Unable to load mobile config" });
  }
});

export default router;
