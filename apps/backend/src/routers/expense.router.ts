import { Router } from "express";
import { ExpenseController } from "../controllers/app/expense.controller";
import { requireMobileAuth } from "src/middlewares/auth";

const router = Router();

router.post("/", requireMobileAuth, ExpenseController.createExpense);

router.patch("/:expenseId", requireMobileAuth, ExpenseController.updateExpense);

router.delete(
  "/:expenseId",
  requireMobileAuth,
  ExpenseController.deleteExpense,
);

router.get("/:expenseId", requireMobileAuth, ExpenseController.getExpenseById);

router.get(
  "/companion/:patientId/list",
  requireMobileAuth,
  ExpenseController.getExpensesByCompanion,
);

router.get(
  "/companion/:patientId/summary",
  requireMobileAuth,
  ExpenseController.getExpenseSummary,
);

export default router;
