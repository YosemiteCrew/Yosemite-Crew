import { AccountWithdrawalController } from "../../src/controllers/app/account-withdrawals.controller";
import {
  AccountWithdrawalService,
  AccountWithdrawalServiceError,
} from "../../src/services/account-withdrawal.service";

jest.mock("../../src/services/account-withdrawal.service", () => {
  const actual = jest.requireActual(
    "../../src/services/account-withdrawal.service",
  );
  return {
    ...actual,
    AccountWithdrawalService: {
      create: jest.fn(),
      listAll: jest.fn(),
    },
  };
});

const mockedService = AccountWithdrawalService as unknown as {
  create: jest.Mock;
  listAll: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("AccountWithdrawalController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("returns 201 with created id", async () => {
      mockedService.create.mockResolvedValueOnce({ _id: "req-1" });
      const req = {
        userId: "user-1",
        body: {
          fullName: "Jane",
          email: "jane@example.com",
          checkboxConfirmed: true,
        },
      } as any;
      const res = createResponse();

      await AccountWithdrawalController.create(req as any, res as any);

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          fullName: "Jane",
          email: "jane@example.com",
          checkboxConfirmed: true,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "req-1" });
    });

    it("handles service errors with status codes", async () => {
      mockedService.create.mockRejectedValueOnce(
        new AccountWithdrawalServiceError("invalid", 422),
      );
      const req = {
        body: { fullName: "", email: "", checkboxConfirmed: false },
      } as any;
      const res = createResponse();

      await AccountWithdrawalController.create(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "invalid" });
    });

    it("returns 500 on unexpected errors", async () => {
      mockedService.create.mockRejectedValueOnce(new Error("boom"));
      const res = createResponse();

      await AccountWithdrawalController.create({ body: {} } as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("list", () => {
    it("returns withdrawal requests", async () => {
      const docs = [{ id: "1" }];
      mockedService.listAll.mockResolvedValueOnce(docs);
      const res = createResponse();

      await AccountWithdrawalController.list({} as any, res as any);

      expect(mockedService.listAll).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(docs);
    });
  });
});
