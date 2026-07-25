import { Router } from "express";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { CodeController } from "src/controllers/web/code.controller";

const router = Router();

router.get("/entries", requireWebAuth, (req, res) =>
  CodeController.listEntries(req, res),
);

router.get("/mappings", requireWebAuth, (req, res) =>
  CodeController.listMappings(req, res),
);

router.get("/terms/suggest", requireWebAuth, (req, res) =>
  CodeController.suggestTerms(req, res),
);

router.get("/mobile/entries", requireMobileAuth, (req, res) =>
  CodeController.listEntries(req, res),
);

router.get("/mobile/mappings", requireMobileAuth, (req, res) =>
  CodeController.listMappings(req, res),
);

router.get("/mobile/terms/suggest", requireMobileAuth, (req, res) =>
  CodeController.suggestTerms(req, res),
);

export default router;
