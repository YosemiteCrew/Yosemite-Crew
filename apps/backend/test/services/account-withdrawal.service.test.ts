import {
  AccountWithdrawalService,
  AccountWithdrawalServiceError,
} from "../../src/services/account-withdrawal.service";
import { AccountWithdrawalModel } from "../../src/models/account-withdrawal";

jest.mock("../../src/models/account-withdrawal", () => ({
  AccountWithdrawalModel: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

const mockedModel = AccountWithdrawalModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
};

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
  });
});
