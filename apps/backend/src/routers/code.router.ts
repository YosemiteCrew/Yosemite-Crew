import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { CodeController } from "src/controllers/web/code.controller";

const router = Router();

router.get(
  "/entries",
  authorizeCognito,
  CodeController.listEntries,
);

router.get(
  "/mappings",
  authorizeCognito,
  CodeController.listMappings,
);

export default router;
