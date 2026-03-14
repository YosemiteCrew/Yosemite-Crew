// services/account-withdrawal.service.ts
import { AccountWithdrawalModel } from "../models/account-withdrawal";
import { prisma } from "../config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";

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

    if (isReadFromPostgres()) {
      return prisma.accountWithdrawal.create({
        data: {
          userId: input.userId ?? undefined,
          fullName: input.fullName,
          email: input.email,
          address: input.address ?? undefined,
          signatureText: input.signatureText ?? undefined,
          message: input.message ?? undefined,
          checkboxConfirmed: input.checkboxConfirmed,
          status: "RECEIVED",
        },
      });
    }

    const doc = await AccountWithdrawalModel.create({
      ...input,
      status: "RECEIVED",
    });

    if (shouldDualWrite) {
      try {
        await prisma.accountWithdrawal.create({
          data: {
            id: doc._id.toString(),
            userId: input.userId ?? undefined,
            fullName: input.fullName,
            email: input.email,
            address: input.address ?? undefined,
            signatureText: input.signatureText ?? undefined,
            message: input.message ?? undefined,
            checkboxConfirmed: input.checkboxConfirmed,
            status: "RECEIVED",
            processedAt: undefined,
            processedByUserId: undefined,
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("AccountWithdrawal", err);
      }
    }

    return doc;
  },

  // For admin dashboard
  async listAll() {
    if (isReadFromPostgres()) {
      return prisma.accountWithdrawal.findMany({
        orderBy: { createdAt: "desc" },
      });
    }
    return AccountWithdrawalModel.find().sort({ createdAt: -1 }).exec();
  },

  async updateStatus(
    id: string,
    status: "IN_REVIEW" | "COMPLETED" | "REJECTED",
    processedByUserId: string,
  ) {
    if (isReadFromPostgres()) {
      const existing = await prisma.accountWithdrawal.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new AccountWithdrawalServiceError("Request not found", 404);
      }
      return prisma.accountWithdrawal.update({
        where: { id },
        data: {
          status,
          processedByUserId,
          processedAt: new Date(),
        },
      });
    }

    const doc = await AccountWithdrawalModel.findById(id);
    if (!doc) throw new AccountWithdrawalServiceError("Request not found", 404);

    doc.status = status;
    doc.processedByUserId = processedByUserId;
    doc.processedAt = new Date();
    await doc.save();

    if (shouldDualWrite) {
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
        handleDualWriteError("AccountWithdrawal", err);
      }
    }
    return doc;
  },
};
