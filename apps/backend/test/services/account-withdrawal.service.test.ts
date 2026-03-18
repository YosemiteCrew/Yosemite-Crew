import {
  AccountWithdrawalService,
  AccountWithdrawalServiceError,
} from "../../src/services/account-withdrawal.service";
import { AccountWithdrawalModel } from "../../src/models/account-withdrawal";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

jest.mock("../../src/models/account-withdrawal", () => ({
  AccountWithdrawalModel: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    accountWithdrawal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

const mockedModel = AccountWithdrawalModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
};

describe("AccountWithdrawalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
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
      const doc = { _id: "req-1" };
      mockedModel.create.mockResolvedValueOnce(doc);

      const result = await AccountWithdrawalService.create({
        userId: "user-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        message: "Please remove my account",
        checkboxConfirmed: true,
      });

      expect(mockedModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          fullName: "Jane Doe",
          email: "jane@example.com",
          message: "Please remove my account",
          status: "RECEIVED",
        }),
      );
      expect(result).toBe(doc);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.accountWithdrawal.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await AccountWithdrawalService.create({
        userId: "user-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        checkboxConfirmed: true,
      });

      expect(prisma.accountWithdrawal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "RECEIVED" }),
        }),
      );
      expect(result).toEqual({ id: "pg-1" });
    });

    it("handles dual-write errors on mongo create", async () => {
      mockedModel.create.mockResolvedValueOnce({
        _id: { toString: () => "req-1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.accountWithdrawal.create as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await AccountWithdrawalService.create({
        fullName: "Jane Doe",
        email: "jane@example.com",
        checkboxConfirmed: true,
      });

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "AccountWithdrawal",
        expect.any(Error),
      );
    });
  });

  describe("listAll", () => {
    it("returns sorted withdrawal requests", async () => {
      const exec = jest.fn().mockResolvedValueOnce([{ id: 1 }]);
      const sort = jest.fn().mockReturnValue({ exec });
      mockedModel.find.mockReturnValue({ sort } as any);

      const result = await AccountWithdrawalService.listAll();

      expect(mockedModel.find).toHaveBeenCalled();
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(exec).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1 }]);
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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
      const save = jest.fn();
      const doc: any = {
        status: "RECEIVED",
        processedByUserId: undefined,
        processedAt: undefined,
        save,
      };
      mockedModel.findById.mockResolvedValueOnce(doc);

      const result = await AccountWithdrawalService.updateStatus(
        "req-1",
        "COMPLETED",
        "admin-1",
      );

      expect(doc.status).toBe("COMPLETED");
      expect(doc.processedByUserId).toBe("admin-1");
      expect(doc.processedAt).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalled();
      expect(result).toBe(doc);
    });

    it("throws when request is not found", async () => {
      mockedModel.findById.mockResolvedValueOnce(null);

      await expect(
        AccountWithdrawalService.updateStatus("missing", "REJECTED", "admin"),
      ).rejects.toBeInstanceOf(AccountWithdrawalServiceError);
    });

    it("uses prisma update when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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

      expect(prisma.accountWithdrawal.update).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1", status: "COMPLETED" });
    });

    it("throws 404 on postgres update when request not found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.accountWithdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        AccountWithdrawalService.updateStatus("pg-1", "REJECTED", "admin-1"),
      ).rejects.toThrow("Request not found");
    });

    it("handles dual-write errors on mongo update", async () => {
      const save = jest.fn();
      mockedModel.findById.mockResolvedValueOnce({
        status: "RECEIVED",
        processedByUserId: undefined,
        processedAt: undefined,
        save,
      });
      (prisma.accountWithdrawal.updateMany as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await AccountWithdrawalService.updateStatus(
        "req-1",
        "COMPLETED",
        "admin-1",
      );

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "AccountWithdrawal",
        expect.any(Error),
      );
    });
  });
});
