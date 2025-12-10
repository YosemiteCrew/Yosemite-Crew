import { Router } from "express";
import { ExpenseController } from "../controllers/app/expense.controller";
import { authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

router.post("/", authorizeCognitoMobile, ExpenseController.createExpense);

router.patch(
  "/:expenseId",
  authorizeCognitoMobile,
  ExpenseController.updateExpense,
);

router.delete(
  "/:expenseId",
  authorizeCognitoMobile,
  ExpenseController.deleteExpense,
);

router.get(
  "/:expenseId",
  authorizeCognitoMobile,
  ExpenseController.getExpenseById,
);

router.get(
  "/companion/:companionId/list",
  authorizeCognitoMobile,
  ExpenseController.getExpensesByCompanion,
);

router.get(
  "/companion/:companionId/summary",
  authorizeCognitoMobile,
  ExpenseController.getExpenseSummary,
);

export default router;
