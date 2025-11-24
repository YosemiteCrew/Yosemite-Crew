import { Router } from "express";
import { ParentController } from "../controllers/app/parent.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { CompanionController } from "src/controllers/app/companion.controller";

const router = Router();

// Routes for Mobile
router.post(
  "/", 
  authorizeCognitoMobile, 
  ParentController.createParentMobile
);
router.get("/:id", authorizeCognitoMobile, ParentController.getParentMobile);
router.put("/:id", authorizeCognitoMobile, ParentController.updateParentMobile);
router.delete(
  "/:id",
  authorizeCognitoMobile,
  ParentController.deleteParentMobile,
);
router.post(
  "/profile/presigned",
  authorizeCognitoMobile,
  ParentController.getProfileUploadUrl,
);
router.get(
  "/:parentId/companions",
  authorizeCognitoMobile,
  CompanionController.getCompanionsByParentId,
);

// Routes for PMS
router.post("/pms/parents", authorizeCognito, ParentController.createParentPMS);
router.get("/pms/parents/:id", authorizeCognito, ParentController.getParentPMS);
router.put(
  "/pms/parents/:id",
  authorizeCognito,
  ParentController.updateParentPMS,
);

export default router;
