import {
  ExpenseService,
  ExternalExpenseServiceError,
} from "../../src/services/expense.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    externalExpense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
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

describe("ExpenseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createExpense", () => {
    it("validates required fields", async () => {
      await expect(
        ExpenseService.createExpense({
          patientId: "",
          parentId: "parent-1",
          category: "Food",
          expenseName: "Food",
          date: new Date(),
          amount: 10,
        } as never),
      ).rejects.toThrow("patientId is required");
    });

    it("creates an external expense in postgres", async () => {
      (prisma.externalExpense.create as jest.Mock).mockResolvedValue({
        id: "ext-1",
      });

      const result = await ExpenseService.createExpense({
        patientId: "patient-1",
        parentId: "parent-1",
        category: "Food",
        expenseName: "Food",
        date: new Date("2024-01-01T00:00:00.000Z"),
        amount: 25,
      });

      expect(prisma.externalExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "USD",
            expenseName: "Food",
          }),
        }),
      );
      expect(result).toEqual({ id: "ext-1" });
    });
  });

  describe("getExpensesByCompanion", () => {
    it("returns combined postgres expenses sorted by date", async () => {
      (prisma.externalExpense.findMany as jest.Mock).mockResolvedValue([
        {
          id: "ext-1",
          date: new Date("2024-01-02T00:00:00.000Z"),
          amount: 30,
          expenseName: "Treats",
          notes: "note",
          category: "Food",
          subcategory: null,
          currency: "USD",
          businessName: null,
        },
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        {
          id: "inv-1",
          createdAt: new Date("2024-01-03T00:00:00.000Z"),
          totalAmount: 100,
          appointmentId: "appt-1",
          items: [{ name: "Consult" }],
          status: "PAID",
          currency: "USD",
          organisationId: "org-1",
        },
      ]);
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
        name: "Clinic",
      });

      const result = await ExpenseService.getExpensesByCompanion("patient-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        source: "IN_APP",
        invoiceId: "inv-1",
        businessName: "Clinic",
      });
      expect(result[1]).toMatchObject({
        source: "EXTERNAL",
        expenseId: "ext-1",
      });
    });

    it("rejects empty patient ids", async () => {
      await expect(ExpenseService.getExpensesByCompanion("")).rejects.toThrow(
        "patientId is required",
      );
    });
  });

  describe("getExpenseById", () => {
    it("returns mapped invoice expense when external expense is missing", async () => {
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: "inv-1",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        totalAmount: 40,
        appointmentId: "appt-1",
        items: [{ name: "Item" }],
        status: "DRAFT",
        currency: "USD",
        organisationId: "org-1",
      });
      (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await ExpenseService.getExpenseById("inv-1");

      expect(result).toMatchObject({
        source: "IN_APP",
        invoiceId: "inv-1",
        businessName: "Unknown Organization",
        status: undefined,
      });
    });

    it("throws when no expense exists", async () => {
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(ExpenseService.getExpenseById("missing")).rejects.toThrow(
        new ExternalExpenseServiceError("Expense not found", 404),
      );
    });
  });

  describe("deleteExpense", () => {
    it("deletes expense rows", async () => {
      (prisma.externalExpense.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await ExpenseService.deleteExpense("exp-1");

      expect(prisma.externalExpense.deleteMany).toHaveBeenCalledWith({
        where: { id: "exp-1" },
      });
    });

    it("throws when expense is missing", async () => {
      (prisma.externalExpense.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await expect(ExpenseService.deleteExpense("exp-1")).rejects.toThrow(
        "Expense not found",
      );
    });
  });

  describe("updateExpense", () => {
    it("updates existing expenses", async () => {
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue({
        id: "exp-1",
      });
      (prisma.externalExpense.update as jest.Mock).mockResolvedValue({
        id: "exp-1",
        expenseName: "Updated",
      });

      const result = await ExpenseService.updateExpense("exp-1", {
        expenseName: "Updated",
      });

      expect(result.expenseName).toBe("Updated");
    });

    it("throws when expense is missing", async () => {
      (prisma.externalExpense.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(ExpenseService.updateExpense("exp-1", {})).rejects.toThrow(
        "Expense not found",
      );
    });
  });

  describe("getTotalExpenseForCompanion", () => {
    it("aggregates invoice and external expense totals", async () => {
      (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 100 },
      });
      (prisma.externalExpense.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 25 },
      });

      const result =
        await ExpenseService.getTotalExpenseForCompanion("patient-1");

      expect(result).toEqual({
        patientId: "patient-1",
        invoiceTotal: 100,
        externalTotal: 25,
        totalExpense: 125,
      });
    });
  });
});
