import { Router } from "express";
import { AccountWithdrawalController } from "../controllers/app/account-withdrawals.controller";
import { requireMobileAuth } from "src/middlewares/auth";

const router = Router();

router.post("/withdraw", requireMobileAuth, AccountWithdrawalController.create);

export default router;
