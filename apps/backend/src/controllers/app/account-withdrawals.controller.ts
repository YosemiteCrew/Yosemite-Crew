// controllers/account-withdrawal.controller.ts
import { Request, Response } from "express";
import {
  AccountWithdrawalService,
  AccountWithdrawalServiceError,
} from "src/services/account-withdrawal.service";
import { AuthenticatedRequest } from "src/middlewares/auth";

export const AccountWithdrawalController = {
  create: async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.userId; // optional if you have auth

      const {
        fullName,
        email,
        address,
        signatureText,
        message,
        checkboxConfirmed,
      } = req.body;

      const doc = await AccountWithdrawalService.create({
        userId,
        fullName,
        email,
        address,
        signatureText,
        message,
        checkboxConfirmed,
      });

      res.status(201).json({ id: doc._id });
    } catch (err) {
      if (err instanceof AccountWithdrawalServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // Admin-only endpoints:
  list: async (req: Request, res: Response) => {
    const docs = await AccountWithdrawalService.listAll();
    res.status(200).json(docs);
  },
};