import { Router } from "express";
import { UserController } from "../controllers/web/user.controller";
import { requireWebAuth } from "src/middlewares/auth";

const router = Router();

router.post("/", requireWebAuth, UserController.create);
router.get("/:id", requireWebAuth, UserController.getById);
router.delete("/:id", requireWebAuth, UserController.deleteById);
router.patch("/update-name", requireWebAuth, UserController.updateName);

export default router;
