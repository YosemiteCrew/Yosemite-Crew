import { Types } from "mongoose";
import { ExpenseService } from "../../src/services/expense.service";
import ExternalExpenseModel from "../../src/models/expense";
import InvoiceModel from "../../src/models/invoice";
import OrganizationModel from "../../src/models/organization";
import { prisma } from "src/config/prisma";
import { handleDualWriteError } from "src/utils/dual-write";

// --- Mocks ---
jest.mock("../../src/models/expense");
jest.mock("../../src/models/invoice");
jest.mock("../../src/models/organization");
jest.mock("src/config/prisma", () => ({
  prisma: {
    externalExpense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: true,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

describe("ExpenseService", () => {
  const validObjectId = new Types.ObjectId().toString();
  const validCompanionId = new Types.ObjectId().toString();

  // Helper to create mock document
  const createMockDoc = (data: any) => ({
    ...data,
    _id: new Types.ObjectId(validObjectId),
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(true),
    toObject: () => ({ ...data, _id: new Types.ObjectId(validObjectId) }),
  });

  // Helper for Mongoose chains: find().sort().lean()
  const mockMongooseChain = (data: any) => ({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(data),
    }),
    lean: jest.fn().mockResolvedValue(data),
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        catch: jest.fn().mockResolvedValue(data),
      }),
    }),
    exec: jest.fn().mockResolvedValue(data),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
  });

  // 1. createExpense
  describe("createExpense", () => {
    const input: any = {
      companionId: validCompanionId,
      parentId: validObjectId,
      category: "Food",
      expenseName: "Dog Food",
      amount: 50,
      currency: "USD",
      date: new Date(),
    };

    it("should throw if companionId is missing", async () => {
      await expect(
        ExpenseService.createExpense({ ...input, companionId: "" }),
      ).rejects.toThrow("companionId is required");
    });

    it("should throw if parentId is missing", async () => {
      await expect(
        ExpenseService.createExpense({ ...input, parentId: "" }),
      ).rejects.toThrow("parentId is required");
    });

    it("should throw if category is missing", async () => {
      await expect(
        ExpenseService.createExpense({ ...input, category: "" }),
      ).rejects.toThrow("category is required");
    });

    it("should throw if expenseName is missing", async () => {
      await expect(
        ExpenseService.createExpense({ ...input, expenseName: "" }),
      ).rejects.toThrow("expenseName is required");
    });

    it("should throw if amount is missing or negative", async () => {
      await expect(
        ExpenseService.createExpense({ ...input, amount: -10 }),
      ).rejects.toThrow("amount must be a positive number");
    });

    it("should create expense successfully", async () => {
      const mockDoc = createMockDoc(input);
      (ExternalExpenseModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const result = await ExpenseService.createExpense(input);

      expect(ExternalExpenseModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseName: "Dog Food",
          currency: "USD",
        }),
      );
      expect(result).toEqual(mockDoc);
    });

    it("should default currency to USD if missing", async () => {
      const noCurrency = { ...input, currency: undefined };
      const mockDoc = createMockDoc(input);
      (ExternalExpenseModel.create as jest.Mock).mockResolvedValue(mockDoc);

      await ExpenseService.createExpense(noCurrency);

      expect(ExternalExpenseModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "USD",
        }),
      );
    });

    it("uses prisma when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.create as jest.Mock).mockResolvedValue({
        id: "pg-1",
      });

      const result = await ExpenseService.createExpense({
        ...input,
        currency: undefined,
      });

      expect(prisma.externalExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "USD",
          }),
        }),
      );
      expect(result).toEqual({ id: "pg-1" });
    });

    it("handles dual-write errors", async () => {
      const mockDoc = createMockDoc(input);
      (ExternalExpenseModel.create as jest.Mock).mockResolvedValue(mockDoc);
      (prisma.externalExpense.create as jest.Mock).mockRejectedValue(
        new Error("sync fail"),
      );

      await ExpenseService.createExpense(input);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ExternalExpense",
        expect.any(Error),
      );
    });
  });

  // 2. getExpensesByCompanion (Unified List)
  describe("getExpensesByCompanion", () => {
    it("should throw if companionId is missing", async () => {
      await expect(ExpenseService.getExpensesByCompanion("")).rejects.toThrow(
        "companionId is required",
      );
    });

    it("should return combined sorted expenses", async () => {
      const date1 = new Date("2023-01-01");
      const date2 = new Date("2023-01-02");

      // Mock External Expenses
      const mockExternal = [
        {
          _id: "ext1",
          date: date1,
          amount: 50,
          expenseName: "Ext Expense",
          notes: "Note",
          category: "Food",
          currency: "USD",
        },
      ];

      // Setup Mongoose Chain for External
      (ExternalExpenseModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain(mockExternal),
      );

      // Mock Invoices
      const mockInvoices = [
        {
          _id: "inv1",
          createdAt: date2,
          totalAmount: 100,
          appointmentId: "appt1",
          items: [{ name: "Service A" }],
          status: "PAID",
          currency: "USD",
          organisationId: "org1",
        },
      ];

      // Setup Mongoose Chain for Invoice
      (InvoiceModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain(mockInvoices),
      );

      // Mock Organization Lookup
      (OrganizationModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: "Vet Clinic" }),
      });

      const result: any[] =
        await ExpenseService.getExpensesByCompanion(validCompanionId);

      expect(result).toHaveLength(2);
      // Sort order: date2 (newer) first
      expect(result[0].title).toBe("Invoice");
      expect(result[0].businessName).toBe("Vet Clinic");

      expect(result[1].title).toBe("Ext Expense");
      expect(result[1].source).toBe("EXTERNAL");
    });

    it("should handle invoice with unknown organization", async () => {
      (ExternalExpenseModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );

      const mockInvoices = [
        {
          _id: "inv1",
          createdAt: new Date(),
          totalAmount: 100,
          organisationId: "missingOrg",
          items: [],
        },
      ];
      (InvoiceModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain(mockInvoices),
      );

      (OrganizationModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result: any[] =
        await ExpenseService.getExpensesByCompanion(validCompanionId);
      expect(result[0].businessName).toBe("Unknown Organization");
    });

    it("returns combined list from postgres", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      const date1 = new Date("2023-01-01");
      const date2 = new Date("2023-01-03");
      (prisma.externalExpense.findMany as jest.Mock).mockResolvedValue([
        {
          id: "ext1",
          date: date1,
          amount: 25,
          expenseName: "External",
          notes: "Note",
          category: "Food",
          subcategory: null,
          currency: "USD",
          businessName: null,
        },
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        {
          id: "inv1",
          createdAt: date2,
          totalAmount: 100,
          appointmentId: "appt1",
          items: [{ name: "Service" }],
          status: "PAID",
          currency: "USD",
          organisationId: "org1",
        },
      ]);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        name: "Clinic",
      });

      const result =
        await ExpenseService.getExpensesByCompanion(validCompanionId);

      expect(result[0].source).toBe("IN_APP");
      expect(result[0].businessName).toBe("Clinic");
      expect(result[1].source).toBe("EXTERNAL");
    });
  });

  // 3. getExpenseById
  describe("getExpenseById", () => {
    it("should throw if id is invalid", async () => {
      await expect(ExpenseService.getExpenseById("invalid")).rejects.toThrow(
        "Invalid expenseId",
      );
    });

    it("should return external expense if found", async () => {
      const mockExt = { _id: validObjectId, expenseName: "Found" };
      (ExternalExpenseModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockExt),
      });

      const res: any = await ExpenseService.getExpenseById(validObjectId);
      expect(res.expenseName).toBe("Found");
    });

    it("should return mapped invoice if found (when external not found)", async () => {
      (ExternalExpenseModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const mockInv = {
        _id: validObjectId,
        createdAt: new Date(),
        totalAmount: 200,
        organisationId: "org1",
        items: [{ name: "Item 1" }],
        status: "PAID",
        currency: "USD",
        appointmentId: "appt1",
      };

      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockInv),
      });

      // Mock Org chain: findById().select().lean().catch()
      const mockOrgChain = {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            catch: jest.fn().mockResolvedValue({ name: "Clinic" }),
          }),
        }),
      };
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockOrgChain);

      const res: any = await ExpenseService.getExpenseById(validObjectId);

      expect(res.source).toBe("IN_APP");
      expect(res.title).toBe("Invoice");
      expect(res.businessName).toBe("Clinic");
    });

    it("should handle invoice organization fetch failure", async () => {
      (ExternalExpenseModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: validObjectId, organisationId: "org1" }),
      });

      // Mock Org chain to return null via catch
      const mockOrgChain = {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            catch: jest.fn().mockResolvedValue(null),
          }),
        }),
      };
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockOrgChain);

      const res: any = await ExpenseService.getExpenseById(validObjectId);
      expect(res.businessName).toBe("Unknown Organization");
    });

    it("should set invoice status to undefined if not PAID/AWAITING", async () => {
      (ExternalExpenseModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: validObjectId, status: "DRAFT" }),
      });
      (OrganizationModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ catch: jest.fn().mockResolvedValue({}) }),
        }),
      });

      const res: any = await ExpenseService.getExpenseById(validObjectId);
      expect(res.status).toBeUndefined();
    });

    it("should throw 404 if neither found", async () => {
      (ExternalExpenseModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (InvoiceModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ExpenseService.getExpenseById(validObjectId),
      ).rejects.toThrow("Expense not found");
    });

    it("returns external expense from postgres when found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue({
        id: "ext-1",
      });

      const result = await ExpenseService.getExpenseById("ext-1");
      expect(result).toEqual({ id: "ext-1" });
    });

    it("returns mapped invoice from postgres", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: "inv-1",
        createdAt: new Date("2023-01-01"),
        totalAmount: 20,
        status: "DRAFT",
        items: [{ name: "Item" }],
        currency: "USD",
        organisationId: "org1",
        appointmentId: "appt1",
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        name: "Clinic",
      });

      const result: any = await ExpenseService.getExpenseById("inv-1");
      expect(result.source).toBe("IN_APP");
      expect(result.status).toBeUndefined();
      expect(result.businessName).toBe("Clinic");
    });

    it("throws 404 in postgres when not found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(ExpenseService.getExpenseById("missing")).rejects.toThrow(
        "Expense not found",
      );
    });
  });

  // 4. deleteExpense
  describe("deleteExpense", () => {
    it("should throw if id is invalid", async () => {
      await expect(ExpenseService.deleteExpense("invalid")).rejects.toThrow(
        "Invalid expenseId",
      );
    });

    it("should delete successfully", async () => {
      (ExternalExpenseModel.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await ExpenseService.deleteExpense(validObjectId);
      expect(ExternalExpenseModel.deleteOne).toHaveBeenCalledWith({
        _id: validObjectId,
      });
    });

    it("should throw 404 if not found", async () => {
      (ExternalExpenseModel.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });
      await expect(ExpenseService.deleteExpense(validObjectId)).rejects.toThrow(
        "Expense not found",
      );
    });

    it("handles dual-write delete errors", async () => {
      (ExternalExpenseModel.deleteOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });
      (prisma.externalExpense.deleteMany as jest.Mock).mockRejectedValue(
        new Error("delete fail"),
      );

      await ExpenseService.deleteExpense(validObjectId);

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ExternalExpense delete",
        expect.any(Error),
      );
    });

    it("uses prisma deleteMany when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await ExpenseService.deleteExpense("pg-1");

      expect(prisma.externalExpense.deleteMany).toHaveBeenCalledWith({
        where: { id: "pg-1" },
      });
    });

    it("throws 404 on postgres delete when not found", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await expect(ExpenseService.deleteExpense("pg-1")).rejects.toThrow(
        "Expense not found",
      );
    });
  });

  // 5. updateExpense
  describe("updateExpense", () => {
    it("should throw if id is invalid", async () => {
      await expect(ExpenseService.updateExpense("invalid", {})).rejects.toThrow(
        "Invalid expenseId",
      );
    });

    it("should update and return doc", async () => {
      const mockDoc = { _id: validObjectId, expenseName: "Updated" };
      (ExternalExpenseModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const res = await ExpenseService.updateExpense(validObjectId, {
        expenseName: "Updated",
      });
      expect(res.expenseName).toBe("Updated");
    });

    it("should throw 404 if doc not found", async () => {
      (ExternalExpenseModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        ExpenseService.updateExpense(validObjectId, {}),
      ).rejects.toThrow("Expense not found");
    });

    it("handles dual-write update errors", async () => {
      const mockDoc = {
        _id: new Types.ObjectId(validObjectId),
        companionId: new Types.ObjectId(validCompanionId),
        parentId: new Types.ObjectId(validObjectId),
        category: "Food",
        expenseName: "Updated",
        amount: 10,
        date: new Date(),
        currency: "USD",
      };
      (ExternalExpenseModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });
      (prisma.externalExpense.updateMany as jest.Mock).mockRejectedValue(
        new Error("update fail"),
      );

      await ExpenseService.updateExpense(validObjectId, {
        expenseName: "Updated",
      });

      expect(handleDualWriteError).toHaveBeenCalledWith(
        "ExternalExpense update",
        expect.any(Error),
      );
    });

    it("uses prisma update when READ_FROM_POSTGRES is true", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.externalExpense.update as jest.Mock).mockResolvedValue({
        id: "pg-1",
        expenseName: "Updated",
      });

      const result = await ExpenseService.updateExpense("pg-1", {
        expenseName: "Updated",
      });

      expect(prisma.externalExpense.update).toHaveBeenCalled();
      expect(result).toEqual({ id: "pg-1", expenseName: "Updated" });
    });
  });

  // 6. getTotalExpenseForCompanion
  describe("getTotalExpenseForCompanion", () => {
    it("should aggregate totals correctly", async () => {
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue([{ total: 100 }]);
      (ExternalExpenseModel.aggregate as jest.Mock).mockResolvedValue([
        { total: 50 },
      ]);

      const res =
        await ExpenseService.getTotalExpenseForCompanion(validCompanionId);

      expect(res).toEqual({
        companionId: validCompanionId,
        invoiceTotal: 100,
        externalTotal: 50,
        totalExpense: 150,
      });
    });

    it("should handle empty aggregations (defaults to 0)", async () => {
      (InvoiceModel.aggregate as jest.Mock).mockResolvedValue([]);
      (ExternalExpenseModel.aggregate as jest.Mock).mockResolvedValue([]);

      const res =
        await ExpenseService.getTotalExpenseForCompanion(validCompanionId);

      expect(res.totalExpense).toBe(0);
    });

    it("aggregates totals from postgres", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 120 },
      });
      (prisma.externalExpense.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 30 },
      });

      const res =
        await ExpenseService.getTotalExpenseForCompanion(validCompanionId);

      expect(res).toEqual({
        companionId: validCompanionId,
        invoiceTotal: 120,
        externalTotal: 30,
        totalExpense: 150,
      });
    });
  });
});
