import { Request, Response } from "express";
import {
  ExpenseService,
  ExternalExpenseServiceError,
} from "../../services/expense.service";
import type { ExternalExpenseMongo } from "src/models/expense";

export const ExpenseController = {
  getExpenseSummary: async (req: Request, res: Response) => {
    try {
      const { companionId } = req.params;
      const summary =
        await ExpenseService.getTotalExpenseForCompanion(companionId);
      res.status(200).json(summary);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  },

  createExpense: async (req: Request, res: Response) => {
    try {
      const expenseData = req.body as Omit<
        ExternalExpenseMongo,
        "createdAt" | "updatedAt"
      >;
      const newExpense = await ExpenseService.createExpense(expenseData);
      res.status(201).json(newExpense);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  },

  updateExpense: async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const updateData = req.body as Partial<ExternalExpenseMongo>;
      const updatedExpense = await ExpenseService.updateExpense(
        expenseId,
        updateData,
      );
      res.status(200).json(updatedExpense);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  },

  deleteExpense: async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      await ExpenseService.deleteExpense(expenseId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  },

  getExpensesByCompanion: async (req: Request, res: Response) => {
    try {
      const { companionId } = req.params;
      const expenses = await ExpenseService.getExpensesByCompanion(companionId);
      res.status(200).json(expenses);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  },

  getExpenseById: async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const expense = await ExpenseService.getExpenseById(expenseId);
      res.status(200).json(expense);
    } catch (error) {
      if (error instanceof ExternalExpenseServiceError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  },
};
