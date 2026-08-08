import {
  AccountWithdrawalService,
  AccountWithdrawalServiceError,
} from "../../src/services/account-withdrawal.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    accountWithdrawal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("AccountWithdrawalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("throws when required fields are missing", async () => {
      await expect(
        AccountWithdrawalService.create({
          fullName: "",
          email: "",
          checkboxConfirmed: true,
        }),
      ).rejects.toBeInstanceOf(AccountWithdrawalServiceError);
    });

    it("throws when checkbox is not confirmed", async () => {
      await expect(
        AccountWithdrawalService.create({
          fullName: "John Doe",
          email: "john@example.com",
          checkboxConfirmed: false,
        }),
      ).rejects.toThrow("Checkbox confirmation is required");
    });

    it("creates a withdrawal request with RECEIVED status", async () => {
      (prisma.accountWithdrawal.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await AccountWithdrawalService.create({
        userId: "user-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        message: "Please remove my account",
        checkboxConfirmed: true,
      });

      expect(prisma.accountWithdrawal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            fullName: "Jane Doe",
            email: "jane@example.com",
            message: "Please remove my account",
            status: "RECEIVED",
          }),
        }),
      );
      expect(result).toEqual({ id: "pg-1" });
    });
  });

  describe("listAll", () => {
    it("returns sorted withdrawal requests", async () => {
      (prisma.accountWithdrawal.findMany as jest.Mock).mockResolvedValue([
        { id: "pg-1" },
      ]);

      const result = await AccountWithdrawalService.listAll();

      expect(prisma.accountWithdrawal.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([{ id: "pg-1" }]);
    });
  });

  describe("updateStatus", () => {
    it("updates status and processed metadata", async () => {
      (prisma.accountWithdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });
      (prisma.accountWithdrawal.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        status: "COMPLETED",
      });

      const result = await AccountWithdrawalService.updateStatus(
        "pg-1",
        "COMPLETED",
        "admin-1",
      );

      expect(prisma.accountWithdrawal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pg-1" },
          data: expect.objectContaining({
            status: "COMPLETED",
            processedByUserId: "admin-1",
            processedAt: expect.any(Date),
          }),
        }),
      );
      expect(result).toEqual({ id: "pg-1", status: "COMPLETED" });
    });

    it("throws when request is not found", async () => {
      (prisma.accountWithdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        AccountWithdrawalService.updateStatus("pg-1", "REJECTED", "admin-1"),
      ).rejects.toThrow("Request not found");
    });
  });
});
