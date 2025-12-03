import { Types } from "mongoose";
import ExternalExpenseModel from "src/models/expense";
import InvoiceModel from "src/models/invoice";
import OrganizationModel from "src/models/organization";
import { ExpenseService } from "src/services/expense.service";

jest.mock("src/models/expense", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock("src/models/invoice", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

const mockedExpenseModel = ExternalExpenseModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
  deleteOne: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  aggregate: jest.Mock;
};

const mockedInvoiceModel = InvoiceModel as unknown as {
  find: jest.Mock;
  findById: jest.Mock;
  aggregate: jest.Mock;
};

const mockedOrgModel = OrganizationModel as unknown as {
  findById: jest.Mock;
};

const validId = "507f1f77bcf86cd799439011";

describe("ExpenseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createExpense", () => {
    it("validates required fields", async () => {
      const payload = {
        parentId: "p1",
        category: "Health",
        expenseName: "Vet Visit",
        amount: 10,
        companionId: "",
      } as any;

      await expect(ExpenseService.createExpense(payload)).rejects.toThrow(
        "companionId is required",
      );
      expect(mockedExpenseModel.create).not.toHaveBeenCalled();
    });

    it("applies default currency", async () => {
      const doc = { id: "exp-1" };
      mockedExpenseModel.create.mockResolvedValueOnce(doc);

      const payload = {
        companionId: "c1",
        parentId: "p1",
        category: "Health",
        expenseName: "Vet Visit",
        amount: 50,
        date: new Date(),
      } as any;

      const result = await ExpenseService.createExpense(payload);

      expect(mockedExpenseModel.create).toHaveBeenCalledWith({
        ...payload,
        currency: "USD",
      });
      expect(result).toBe(doc);
    });
  });

  describe("getExpensesByCompanion", () => {
    it("requires companionId", async () => {
      await expect(ExpenseService.getExpensesByCompanion("")).rejects.toThrow(
        "companionId is required",
      );
    });

    it("maps external and invoice expenses and sorts by date", async () => {
      const external = {
        _id: new Types.ObjectId(validId),
        date: new Date("2023-01-01"),
        amount: 25,
        expenseName: "Grooming",
        notes: "Trim",
        category: "Care",
        subcategory: null,
        currency: "CAD",
        businessName: "Pet Spa",
      };
      const invoice = {
        _id: new Types.ObjectId(validId),
        createdAt: new Date("2024-01-01"),
        totalAmount: 75,
        items: [{ name: "Service" }],
        status: "PAID",
        companionId: "c1",
        currency: "USD",
        organisationId: "org-1",
      };

      mockedExpenseModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([external]),
        }),
      });

      mockedInvoiceModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([invoice]),
        }),
      });

      mockedOrgModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: "Org" }),
      });

      const result = await ExpenseService.getExpensesByCompanion("c1");

      expect(mockedExpenseModel.find).toHaveBeenCalledWith({
        companionId: "c1",
      });
      expect(mockedInvoiceModel.find).toHaveBeenCalledWith({
        companionId: "c1",
        status: { $in: ["PAID", "AWAITING_PAYMENT"] },
      });
      expect(result).toHaveLength(2);
      expect(result[0].source).toBe("IN_APP");
      expect(result[0].businessName).toBe("Org");
      expect(result[1].source).toBe("EXTERNAL");
    });
  });

  describe("getExpenseById", () => {
    it("validates ObjectId", async () => {
      await expect(ExpenseService.getExpenseById("bad")).rejects.toThrow(
        "Invalid expenseId",
      );
    });

    it("returns external expense when found", async () => {
      const external = { _id: validId, expenseName: "Test" };
      mockedExpenseModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(external),
      });

      const result = (await ExpenseService.getExpenseById(validId)) as any;

      expect(mockedExpenseModel.findById).toHaveBeenCalledWith(validId);
      expect(result).toBe(external);
    });

    it("maps invoice expense when no external is found", async () => {
      mockedExpenseModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockedInvoiceModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: validId,
          createdAt: new Date("2024-02-02"),
          totalAmount: 120,
          items: [{ name: "Visit" }],
          status: "PAID",
          organisationId: "org-1",
          currency: "USD",
        }),
      });
      mockedOrgModel.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ name: "Clinic" }),
        }),
      });

      const result = (await ExpenseService.getExpenseById(validId)) as any;

      expect(result.source).toBe("IN_APP");
      expect(result.status).toBe("PAID");
      expect(result.businessName).toBe("Clinic");
    });

    it("throws when nothing is found", async () => {
      mockedExpenseModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockedInvoiceModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(ExpenseService.getExpenseById(validId)).rejects.toThrow(
        "Expense not found",
      );
    });
  });

  describe("deleteExpense", () => {
    it("validates ObjectId", async () => {
      await expect(ExpenseService.deleteExpense("bad")).rejects.toThrow(
        "Invalid expenseId",
      );
    });

    it("errors when nothing deleted", async () => {
      mockedExpenseModel.deleteOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });

      await expect(ExpenseService.deleteExpense(validId)).rejects.toThrow(
        "Expense not found",
      );
    });

    it("deletes expense", async () => {
      mockedExpenseModel.deleteOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await ExpenseService.deleteExpense(validId);

      expect(mockedExpenseModel.deleteOne).toHaveBeenCalledWith({
        _id: validId,
      });
    });
  });

  describe("updateExpense", () => {
    it("validates ObjectId", async () => {
      await expect(
        ExpenseService.updateExpense("bad", { notes: "updated" }),
      ).rejects.toThrow("Invalid expenseId");
    });

    it("errors when not found", async () => {
      mockedExpenseModel.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ExpenseService.updateExpense(validId, { notes: "updated" }),
      ).rejects.toThrow("Expense not found");
    });

    it("returns updated expense", async () => {
      const updated = { _id: validId, notes: "updated" };
      mockedExpenseModel.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await ExpenseService.updateExpense(validId, {
        notes: "updated",
      });

      expect(mockedExpenseModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        { $set: { notes: "updated" } },
        { new: true },
      );
      expect(result).toBe(updated);
    });
  });

  describe("getTotalExpenseForCompanion", () => {
    it("returns sums of invoices and external expenses", async () => {
      mockedInvoiceModel.aggregate.mockResolvedValueOnce([{ total: 50 }]);
      mockedExpenseModel.aggregate.mockResolvedValueOnce([{ total: 20 }]);

      const result =
        await ExpenseService.getTotalExpenseForCompanion("companion-1");

      expect(mockedInvoiceModel.aggregate).toHaveBeenCalled();
      expect(mockedExpenseModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual({
        companionId: "companion-1",
        invoiceTotal: 50,
        externalTotal: 20,
        totalExpense: 70,
      });
    });
  });
});
