import { Router } from "express";
import { UserController } from "../controllers/web/user.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.post("/", authorizeCognito, UserController.create);
router.get("/:id", UserController.getById);
router.delete("/:id", authorizeCognito, UserController.deleteById);

export default router;
