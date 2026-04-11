import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { CodeController } from "src/controllers/web/code.controller";

const router = Router();

router.get("/entries", authorizeCognito, (req, res) =>
  CodeController.listEntries(req, res),
);

router.get("/mappings", authorizeCognito, (req, res) =>
  CodeController.listMappings(req, res),
);

router.get("/terms/suggest", authorizeCognito, (req, res) =>
  CodeController.suggestTerms(req, res),
);

export default router;
