import { Request, Response } from "express";
import {
  ExpenseService,
  ExternalExpenseServiceError,
  type ExternalExpenseInput,
  type ExternalExpenseUpdateInput,
} from "../../services/expense.service";
import logger from "src/utils/logger";

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
      const expenseData = req.body as ExternalExpenseInput;
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
      const updateData = req.body as ExternalExpenseUpdateInput;
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
