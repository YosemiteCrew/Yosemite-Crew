// services/account-withdrawal.service.ts
import { prisma } from "../config/prisma";

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
  },

  // For admin dashboard
  async listAll() {
    return prisma.accountWithdrawal.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async updateStatus(
    id: string,
    status: "IN_REVIEW" | "COMPLETED" | "REJECTED",
    processedByUserId: string,
  ) {
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
  },
};
