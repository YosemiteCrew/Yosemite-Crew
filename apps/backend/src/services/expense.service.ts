import { Types } from "mongoose";
import ExternalExpenseModel, {
  ExternalExpenseDocument,
  ExternalExpenseMongo,
} from "src/models/expense";
import InvoiceModel from "src/models/invoice";
import OrganizationModel from "src/models/organization";

export class ExternalExpenseServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

type UnifiedExpense = {
  source: "IN_APP" | "EXTERNAL";
  date: Date;
  amount: number;
  title: string;
  status?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  invoiceId?: string;
  expenseId?: string;
  businessName?: string;
  appointmentId?: string;
  currency?: string;
};

export const ExpenseService = {
  async createExpense(
    input: Omit<ExternalExpenseMongo, "createdAt" | "updatedAt">,
  ): Promise<ExternalExpenseDocument> {
    if (!input.companionId) {
      throw new ExternalExpenseServiceError("companionId is required");
    }
    if (!input.parentId) {
      throw new ExternalExpenseServiceError("parentId is required");
    }
    if (!input.category) {
      throw new ExternalExpenseServiceError("category is required");
    }
    if (!input.expenseName) {
      throw new ExternalExpenseServiceError("expenseName is required");
    }
    if (!input.amount || input.amount < 0) {
      throw new ExternalExpenseServiceError("amount must be a positive number");
    }

    const doc = await ExternalExpenseModel.create({
      ...input,
      currency: input.currency ?? "USD",
    });

    return doc;
  },

  async getExpensesByCompanion(companionId: string) {
    if (!companionId) {
      throw new ExternalExpenseServiceError("companionId is required");
    }

    const external = await ExternalExpenseModel.find({ companionId })
      .sort({ date: -1 })
      .lean();

    const externalMapped: UnifiedExpense[] = external.map((exp) => ({
      source: "EXTERNAL",
      date: exp.date,
      amount: exp.amount,
      title: exp.expenseName,
      description: exp.notes!,
      category: exp.category,
      subcategory: exp.subcategory ?? undefined,
      expenseId: exp._id.toString(),
      currency: exp.currency,
      businessName: exp.businessName ?? undefined,
    }));

    const invoices = await InvoiceModel.find({
      companionId,
      status: { $in: ["PAID", "AWAITING_PAYMENT"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const invoiceMapped: UnifiedExpense[] = await Promise.all(
      invoices.map(async (inv) => {
        const org = await OrganizationModel.findById(inv.organisationId).lean();

        return {
          source: "IN_APP",
          date: inv.createdAt,
          amount: inv.totalAmount,
          appointmentId: inv.appointmentId,
          title: "Invoice",
          description: inv.items?.map((i) => i.name).join(", "),
          status: inv.status,
          category: "Health",
          subcategory: "",
          invoiceId: inv._id.toString(),
          currency: inv.currency,
          businessName: org?.name ?? "Unknown Organization",
        };
      }),
    );

    const combined = [...externalMapped, ...invoiceMapped].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return combined;
  },

  async getExpenseById(expenseId: string) {
    if (!Types.ObjectId.isValid(expenseId)) {
      throw new ExternalExpenseServiceError("Invalid expenseId");
    }

    const external = await ExternalExpenseModel.findById(expenseId).lean();
    if (external) {
      return external;
    }

    const invoice = await InvoiceModel.findById(expenseId).lean();
    if (invoice) {
      const org = await OrganizationModel.findById(invoice.organisationId)
        .select("name")
        .lean()
        .catch(() => null);

      const businessName = org?.name ?? "Unknown Organization";

      const mapped: UnifiedExpense = {
        source: "IN_APP",
        date: invoice.createdAt,
        amount: invoice.totalAmount,
        title: "Invoice",
        description: invoice.items?.map((i) => i.name).join(", "),
        status:
          invoice.status === "PAID" || invoice.status === "AWAITING_PAYMENT"
            ? invoice.status
            : undefined,
        category: "Health",
        subcategory: "",
        invoiceId: invoice._id.toString(),
        currency: invoice.currency,
        businessName,
        appointmentId: invoice.appointmentId,
      };

      return mapped;
    }

    throw new ExternalExpenseServiceError("Expense not found", 404);
  },

  async deleteExpense(expenseId: string): Promise<void> {
    if (!Types.ObjectId.isValid(expenseId)) {
      throw new ExternalExpenseServiceError("Invalid expenseId");
    }

    const result = await ExternalExpenseModel.deleteOne({
      _id: expenseId,
    }).exec();
    if (result.deletedCount === 0) {
      throw new ExternalExpenseServiceError("Expense not found", 404);
    }
  },

  async updateExpense(
    expenseId: string,
    updates: Partial<ExternalExpenseMongo>,
  ): Promise<ExternalExpenseDocument> {
    if (!Types.ObjectId.isValid(expenseId)) {
      throw new ExternalExpenseServiceError("Invalid expenseId");
    }

    const doc = await ExternalExpenseModel.findByIdAndUpdate(
      expenseId,
      { $set: updates },
      { new: true },
    ).exec();

    if (!doc) {
      throw new ExternalExpenseServiceError("Expense not found", 404);
    }

    return doc;
  },

  async getTotalExpenseForCompanion(companionId: string) {
    const invoices = await InvoiceModel.aggregate<{ total?: number }>([
      { $match: { companionId, status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const invoiceTotal: number = invoices[0]?.total ?? 0;

    // 2. Sum external expenses
    const external = await ExternalExpenseModel.aggregate<{ total?: number }>([
      { $match: { companionId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const externalTotal: number = external[0]?.total ?? 0;

    return {
      companionId,
      invoiceTotal,
      externalTotal,
      totalExpense: invoiceTotal + externalTotal,
    };
  },
};
