import { ExpenseController } from "src/controllers/app/expense.controller";
import {
  ExpenseService,
  ExternalExpenseServiceError,
} from "src/services/expense.service";

jest.mock("src/services/expense.service", () => {
  const actual = jest.requireActual("src/services/expense.service");
  return {
    ...actual,
    ExpenseService: {
      getTotalExpenseForCompanion: jest.fn(),
      createExpense: jest.fn(),
      updateExpense: jest.fn(),
      deleteExpense: jest.fn(),
      getExpensesByCompanion: jest.fn(),
      getExpenseById: jest.fn(),
    },
  };
});

jest.mock("src/services/shared/parent-identity", () => ({
  findParentIdForAuthUser: jest.fn(),
}));

const { findParentIdForAuthUser: mockedFindParent } = jest.requireMock(
  "src/services/shared/parent-identity",
) as { findParentIdForAuthUser: jest.Mock };

const mockedService = ExpenseService as unknown as {
  getTotalExpenseForCompanion: jest.Mock;
  createExpense: jest.Mock;
  updateExpense: jest.Mock;
  deleteExpense: jest.Mock;
  getExpensesByCompanion: jest.Mock;
  getExpenseById: jest.Mock;
};

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe("ExpenseController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindParent.mockResolvedValue("parent-1");
  });

  describe("getExpenseSummary", () => {
    it("returns expense summary", async () => {
      const res = mockResponse();
      mockedService.getTotalExpenseForCompanion.mockResolvedValueOnce({
        patientId: "c1",
        totalExpense: 10,
      });

      await ExpenseController.getExpenseSummary(
        { params: { patientId: "c1" } } as any,
        res as any,
      );

      expect(mockedService.getTotalExpenseForCompanion).toHaveBeenCalledWith(
        "c1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        patientId: "c1",
        totalExpense: 10,
      });
    });

    it("maps service errors", async () => {
      const res = mockResponse();
      mockedService.getTotalExpenseForCompanion.mockRejectedValueOnce(
        new ExternalExpenseServiceError("bad", 422),
      );

      await ExpenseController.getExpenseSummary(
        { params: { patientId: "c1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "bad" });
    });
  });

  describe("createExpense", () => {
    it("creates expense", async () => {
      const res = mockResponse();
      mockedService.createExpense.mockResolvedValueOnce({ id: "exp-1" });

      await ExpenseController.createExpense(
        {
          userId: "auth-1",
          body: {
            expenseName: "Test",
            companionId: "pat-1",
            parentId: "someone-else",
          },
        } as any,
        res as any,
      );

      // The recorder is the signed-in parent, never the body's parentId, and
      // the companion is the one the route checked.
      expect(mockedFindParent).toHaveBeenCalledWith("auth-1");
      expect(mockedService.createExpense).toHaveBeenCalledWith({
        expenseName: "Test",
        companionId: "pat-1",
        patientId: "pat-1",
        parentId: "parent-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "exp-1" });
    });

    it("refuses a caller with no parent record", async () => {
      const res = mockResponse();
      mockedFindParent.mockResolvedValueOnce(null);

      await ExpenseController.createExpense(
        { userId: "auth-1", body: { patientId: "pat-1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(mockedService.createExpense).not.toHaveBeenCalled();
    });

    it("returns service error", async () => {
      const res = mockResponse();
      mockedService.createExpense.mockRejectedValueOnce(
        new ExternalExpenseServiceError("bad input", 400),
      );

      await ExpenseController.createExpense(
        { userId: "auth-1", body: {} } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "bad input" });
    });
  });

  describe("updateExpense", () => {
    it("updates expense", async () => {
      const res = mockResponse();
      mockedService.updateExpense.mockResolvedValueOnce({ id: "exp-1" });

      await ExpenseController.updateExpense(
        {
          userId: "auth-1",
          params: { expenseId: "1" },
          body: { notes: "n", patientId: "pat-other", parentId: "someone" },
        } as any,
        res as any,
      );

      // An expense stays with its companion and with whoever recorded it.
      expect(mockedService.updateExpense).toHaveBeenCalledWith("1", {
        notes: "n",
        patientId: undefined,
        parentId: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "exp-1" });
    });

    it("maps errors", async () => {
      const res = mockResponse();
      mockedService.updateExpense.mockRejectedValueOnce(
        new ExternalExpenseServiceError("nope", 404),
      );

      await ExpenseController.updateExpense(
        { userId: "auth-1", params: { expenseId: "1" }, body: {} } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "nope" });
    });
  });

  describe("deleteExpense", () => {
    it("deletes expense", async () => {
      const res = mockResponse();
      mockedService.deleteExpense.mockResolvedValueOnce(undefined);

      await ExpenseController.deleteExpense(
        { params: { expenseId: "1" } } as any,
        res as any,
      );

      expect(mockedService.deleteExpense).toHaveBeenCalledWith("1");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("returns error status", async () => {
      const res = mockResponse();
      mockedService.deleteExpense.mockRejectedValueOnce(
        new ExternalExpenseServiceError("not found", 404),
      );

      await ExpenseController.deleteExpense(
        { params: { expenseId: "1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "not found" });
    });
  });

  describe("getExpensesByCompanion", () => {
    it("returns expenses", async () => {
      const res = mockResponse();
      mockedService.getExpensesByCompanion.mockResolvedValueOnce([
        { id: "exp-1" },
      ]);

      await ExpenseController.getExpensesByCompanion(
        { params: { patientId: "c1" } } as any,
        res as any,
      );

      expect(mockedService.getExpensesByCompanion).toHaveBeenCalledWith("c1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "exp-1" }]);
    });

    it("maps service error", async () => {
      const res = mockResponse();
      mockedService.getExpensesByCompanion.mockRejectedValueOnce(
        new ExternalExpenseServiceError("bad request", 400),
      );

      await ExpenseController.getExpensesByCompanion(
        { params: { patientId: "c1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "bad request" });
    });
  });

  describe("getExpenseById", () => {
    it("returns expense", async () => {
      const res = mockResponse();
      mockedService.getExpenseById.mockResolvedValueOnce({ id: "1" });

      await ExpenseController.getExpenseById(
        { params: { expenseId: "1" } } as any,
        res as any,
      );

      expect(mockedService.getExpenseById).toHaveBeenCalledWith("1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "1" });
    });

    it("returns 500 for unknown errors", async () => {
      const res = mockResponse();
      mockedService.getExpenseById.mockRejectedValueOnce(new Error("boom"));

      await ExpenseController.getExpenseById(
        { params: { expenseId: "1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
    });
  });
});
