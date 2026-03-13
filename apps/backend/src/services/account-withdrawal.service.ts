// services/account-withdrawal.service.ts
import { AccountWithdrawalModel } from "../models/account-withdrawal";
import { prisma } from "../config/prisma";
import logger from "../utils/logger";

export class AccountWithdrawalServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AccountWithdrawalServiceError";
  }
}

export const AccountWithdrawalService = {
  async create(input: {
    userId?: string;
    fullName: string;
    email: string;
    address?: string;
    signatureText?: string;
    message?: string;
    checkboxConfirmed: boolean;
  }) {
    if (!input.fullName || !input.email) {
      throw new AccountWithdrawalServiceError(
        "fullName and email are required",
        400,
      );
    }

    if (!input.checkboxConfirmed) {
      throw new AccountWithdrawalServiceError(
        "Checkbox confirmation is required",
        400,
      );
    }

    const doc = await AccountWithdrawalModel.create({
      ...input,
      status: "RECEIVED",
    });

    if (process.env.DUAL_WRITE_ENABLED === "true") {
      try {
        await prisma.accountWithdrawal.create({
          data: {
            id: doc._id.toString(),
            userId: input.userId,
            fullName: input.fullName,
            email: input.email,
            address: input.address,
            signatureText: input.signatureText,
            message: input.message,
            checkboxConfirmed: input.checkboxConfirmed,
            status: "RECEIVED",
            processedAt: undefined,
            processedByUserId: undefined,
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        logger.error(`AccountWithdrawal dual-write failed: ${String(err)}`);
        if (process.env.DUAL_WRITE_STRICT === "true") {
          throw err;
        }
      }
    }

    return doc;
  },

  // For admin dashboard
  async listAll() {
    return AccountWithdrawalModel.find().sort({ createdAt: -1 }).exec();
  },

  async updateStatus(
    id: string,
    status: "IN_REVIEW" | "COMPLETED" | "REJECTED",
    processedByUserId: string,
  ) {
    const doc = await AccountWithdrawalModel.findById(id);
    if (!doc) throw new AccountWithdrawalServiceError("Request not found", 404);

    doc.status = status;
    doc.processedByUserId = processedByUserId;
    doc.processedAt = new Date();
    await doc.save();

    if (process.env.DUAL_WRITE_ENABLED === "true") {
      try {
        await prisma.accountWithdrawal.updateMany({
          where: { id },
          data: {
            status,
            processedByUserId,
            processedAt: doc.processedAt ?? undefined,
          },
        });
      } catch (err) {
        logger.error(`AccountWithdrawal dual-write status failed: ${String(err)}`);
        if (process.env.DUAL_WRITE_STRICT === "true") {
          throw err;
        }
      }
    }
    return doc;
  },
};
