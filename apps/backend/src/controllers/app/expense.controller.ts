import { Request, Response } from "express";
import {
  ExpenseService,
  ExternalExpenseServiceError,
  type ExternalExpenseInput,
  type ExternalExpenseUpdateInput,
} from "../../services/expense.service";
import logger from "src/utils/logger";
import { readBodyPatientId } from "src/middlewares/companion-access";
import { findParentIdForAuthUser } from "src/services/shared/parent-identity";
import { resolveVerifiedUserId } from "src/utils/request";

/** The signed-in caller's parent record; never an id from the body. */
const resolveCallerParentId = async (req: Request) => {
  const userId = resolveVerifiedUserId(req);
  return userId ? findParentIdForAuthUser(userId) : null;
};

export const ExpenseController = {
  getExpenseSummary: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const summary =
        await ExpenseService.getTotalExpenseForCompanion(patientId);
      res.status(200).json(summary);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError)
        res.status(error.statusCode).json({ message: error.message });

      logger.error("Error fetching expense summary:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  createExpense: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveCallerParentId(req);
      if (!parentId) {
        return res.status(404).json({ message: "Companion not found." });
      }
      // The companion is the one the route checked; the recorder is the caller.
      const expenseData = {
        ...(req.body as ExternalExpenseInput),
        patientId: readBodyPatientId(req.body) as string,
        parentId,
      };
      const newExpense = await ExpenseService.createExpense(expenseData);
      res.status(201).json(newExpense);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError)
        return res.status(error.statusCode).json({ message: error.message });

      logger.error("Error creating expense:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  updateExpense: async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const parentId = await resolveCallerParentId(req);
      if (!parentId) {
        return res.status(404).json({ message: "Companion not found." });
      }
      // An expense stays with its companion; the editor is the caller.
      const updateData: ExternalExpenseUpdateInput = {
        ...(req.body as ExternalExpenseUpdateInput),
        patientId: undefined,
        parentId,
      };
      const updatedExpense = await ExpenseService.updateExpense(
        expenseId,
        updateData,
      );
      res.status(200).json(updatedExpense);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError)
        res.status(error.statusCode).json({ message: error.message });

      logger.error("Error updating expense:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  deleteExpense: async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      await ExpenseService.deleteExpense(expenseId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError)
        res.status(error.statusCode).json({ message: error.message });

      logger.error("Error deleting expense:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getExpensesByCompanion: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const expenses = await ExpenseService.getExpensesByCompanion(patientId);
      res.status(200).json(expenses);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError)
        res.status(error.statusCode).json({ message: error.message });

      logger.error("Error fetching expenses:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getExpenseById: async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const expense = await ExpenseService.getExpenseById(expenseId);
      res.status(200).json(expense);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError)
        res.status(error.statusCode).json({ message: error.message });

      logger.error("Error fetching expense by ID:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
