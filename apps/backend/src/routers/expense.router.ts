import { Router } from "express";
import { ExpenseController } from "../controllers/app/expense.controller";
import { requireMobileAuth } from "src/middlewares/auth";
import {
  requireCompanionPermission,
  requireCompanionPermissionForResource,
  resolveExpenseCompanion,
} from "src/middlewares/companion-access";

const router = Router();

// The by-id routes are keyed by an expense id, not a patient id, so the
// companion is read off the row before the permission is checked.
const requireExpenseAccess = requireCompanionPermissionForResource(
  "expenses",
  resolveExpenseCompanion,
);

router.post("/", requireMobileAuth, ExpenseController.createExpense);

router.patch(
  "/:expenseId",
  requireMobileAuth,
  requireExpenseAccess,
  ExpenseController.updateExpense,
);

router.delete(
  "/:expenseId",
  requireMobileAuth,
  requireExpenseAccess,
  ExpenseController.deleteExpense,
);

router.get(
  "/:expenseId",
  requireMobileAuth,
  requireExpenseAccess,
  ExpenseController.getExpenseById,
);

router.get(
  "/companion/:patientId/list",
  requireMobileAuth,
  requireCompanionPermission("expenses", "patientId"),
  ExpenseController.getExpensesByCompanion,
);

router.get(
  "/companion/:patientId/summary",
  requireMobileAuth,
  requireCompanionPermission("expenses", "patientId"),
  ExpenseController.getExpenseSummary,
);

export default router;
