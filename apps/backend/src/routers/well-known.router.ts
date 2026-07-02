import { Router } from "express";
import { WellKnownController } from "src/controllers/web/activitypub.controller";

const router = Router();

router.get("/webfinger", (req, res) => WellKnownController.webfinger(req, res));
router.get("/host-meta", (req, res) => WellKnownController.hostMeta(req, res));
router.get("/nodeinfo", (req, res) =>
  WellKnownController.nodeInfoIndex(req, res),
);

export default router;
