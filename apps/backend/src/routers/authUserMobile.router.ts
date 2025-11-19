import { Router } from "express";
import { AuthUserMobileController } from "src/controllers/app/authUserMobile.controller";
import { authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

router.post("/signup", authorizeCognitoMobile, (req, res) =>
  AuthUserMobileController.signup(req, res),
);

export default router;
