import { Router } from "express";
import { CompanionController } from "../controllers/app/companion.controller";
import { authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// Routes for mobile

router.post(
  "/",
  authorizeCognitoMobile,
  CompanionController.createCompanionMobile,
);
router.get(
  "/:id",
  authorizeCognitoMobile,
  CompanionController.getCompanionById,
);
router.put("/:id", authorizeCognitoMobile, CompanionController.updateCompanion);
router.delete(
  "/:id",
  authorizeCognitoMobile,
  CompanionController.deleteCompanion,
);
router.post(
  "/profile/presigned",
  authorizeCognitoMobile,
  CompanionController.getProfileUploadUrl,
);

// Routes for PMS
router.get("/org/search", CompanionController.searchCompanionByName);
// router.post('/org/:orgid', authorizeCognito, CompanionController.createCompanionMobile)
// router.get('/org/:id', authorizeCognito, CompanionController.getCompanionById)
// router.put('/org/:id', authorizeCognito, CompanionController.updateCompanion)
// router.delete('/:id', authorizeCognito, CompanionController.deleteCompanion)

export default router;
