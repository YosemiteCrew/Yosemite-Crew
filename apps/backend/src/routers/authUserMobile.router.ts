import { Router } from "express";
import { AuthUserMobileController } from "src/controllers/app/authUserMobile.controller";
import { requireMobileAuth } from "src/middlewares/auth";

const router = Router();

router.post("/signup", requireMobileAuth, (req, res) =>
  AuthUserMobileController.signup(req, res),
);

export default router;
