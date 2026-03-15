import { Types } from "mongoose";
import ExternalExpenseModel, {
  ExternalExpenseDocument,
  ExternalExpenseMongo,
} from "src/models/expense";
import InvoiceModel from "src/models/invoice";
import OrganizationModel from "src/models/organization";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

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

    if (isReadFromPostgres()) {
      const doc = await prisma.externalExpense.create({
        data: {
          companionId: input.companionId.toString(),
          parentId: input.parentId.toString(),
          category: input.category,
          subcategory: input.subcategory ?? undefined,
          visitType: input.visitType ?? undefined,
          expenseName: input.expenseName,
          businessName: input.businessName ?? undefined,
          date: input.date,
          amount: input.amount,
          currency: input.currency ?? "USD",
          attachments: (input.attachments ??
            undefined) as unknown as Prisma.InputJsonValue,
          notes: input.notes ?? undefined,
        },
      });
      return doc as unknown as ExternalExpenseDocument;
    }

    const doc = await ExternalExpenseModel.create({
      ...input,
      currency: input.currency ?? "USD",
    });

    if (shouldDualWrite) {
      try {
        await prisma.externalExpense.create({
          data: {
            id: doc._id.toString(),
            companionId: doc.companionId.toString(),
            parentId: doc.parentId.toString(),
            category: doc.category,
            subcategory: doc.subcategory ?? undefined,
            visitType: doc.visitType ?? undefined,
            expenseName: doc.expenseName,
            businessName: doc.businessName ?? undefined,
            date: doc.date,
            amount: doc.amount,
            currency: doc.currency ?? "USD",
            attachments: (doc.attachments ??
              undefined) as unknown as Prisma.InputJsonValue,
            notes: doc.notes ?? undefined,
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("ExternalExpense", err);
      }
    }

    return doc;
  },

  async getExpensesByCompanion(companionId: string) {
    if (!companionId) {
      throw new ExternalExpenseServiceError("companionId is required");
    }

    if (isReadFromPostgres()) {
      const external = await prisma.externalExpense.findMany({
        where: { companionId },
        orderBy: { date: "desc" },
      });

      const externalMapped: UnifiedExpense[] = external.map((exp) => ({
        source: "EXTERNAL",
        date: exp.date,
        amount: exp.amount,
        title: exp.expenseName,
        description: exp.notes ?? undefined,
        category: exp.category,
        subcategory: exp.subcategory ?? undefined,
        expenseId: exp.id,
        currency: exp.currency,
        businessName: exp.businessName ?? undefined,
      }));

      const invoices = await prisma.invoice.findMany({
        where: {
          companionId,
          status: { in: ["PAID", "AWAITING_PAYMENT"] },
        },
        orderBy: { createdAt: "desc" },
      });

      const invoiceMapped: UnifiedExpense[] = await Promise.all(
        invoices.map(async (inv) => {
          const org = inv.organisationId
            ? await prisma.organization.findFirst({
                where: { id: inv.organisationId },
                select: { name: true },
              })
            : null;

          const items = inv.items as Array<{ name?: string }> | null;

          return {
            source: "IN_APP",
            date: inv.createdAt,
            amount: inv.totalAmount,
            appointmentId: inv.appointmentId ?? undefined,
            title: "Invoice",
            description: items
              ?.map((i) => i.name)
              .filter(Boolean)
              .join(", "),
            status: inv.status,
            category: "Health",
            subcategory: "",
            invoiceId: inv.id,
            currency: inv.currency,
            businessName: org?.name ?? "Unknown Organization",
          };
        }),
      );

      const combined = [...externalMapped, ...invoiceMapped].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      return combined;
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
    if (isReadFromPostgres()) {
      const external = await prisma.externalExpense.findFirst({
        where: { id: expenseId },
      });
      if (external) {
        return external;
      }

      const invoice = await prisma.invoice.findFirst({
        where: { id: expenseId },
      });
      if (invoice) {
        const org = invoice.organisationId
          ? await prisma.organization.findFirst({
              where: { id: invoice.organisationId },
              select: { name: true },
            })
          : null;

        const items = invoice.items as Array<{ name?: string }> | null;
        const businessName = org?.name ?? "Unknown Organization";

        const mapped: UnifiedExpense = {
          source: "IN_APP",
          date: invoice.createdAt,
          amount: invoice.totalAmount,
          title: "Invoice",
          description: items
            ?.map((i) => i.name)
            .filter(Boolean)
            .join(", "),
          status:
            invoice.status === "PAID" || invoice.status === "AWAITING_PAYMENT"
              ? invoice.status
              : undefined,
          category: "Health",
          subcategory: "",
          invoiceId: invoice.id,
          currency: invoice.currency,
          businessName,
          appointmentId: invoice.appointmentId ?? undefined,
        };

        return mapped;
      }

      throw new ExternalExpenseServiceError("Expense not found", 404);
    }

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
    if (isReadFromPostgres()) {
      const result = await prisma.externalExpense.deleteMany({
        where: { id: expenseId },
      });
      if (!result.count) {
        throw new ExternalExpenseServiceError("Expense not found", 404);
      }
      return;
    }

    if (!Types.ObjectId.isValid(expenseId)) {
      throw new ExternalExpenseServiceError("Invalid expenseId");
    }

    const result = await ExternalExpenseModel.deleteOne({
      _id: expenseId,
    }).exec();
    if (result.deletedCount === 0) {
      throw new ExternalExpenseServiceError("Expense not found", 404);
    }

    if (shouldDualWrite) {
      try {
        await prisma.externalExpense.deleteMany({ where: { id: expenseId } });
      } catch (err) {
        handleDualWriteError("ExternalExpense delete", err);
      }
    }
  },

  async updateExpense(
    expenseId: string,
    updates: Partial<ExternalExpenseMongo>,
  ): Promise<ExternalExpenseDocument> {
    if (isReadFromPostgres()) {
      const doc = await prisma.externalExpense.update({
        where: { id: expenseId },
        data: {
          companionId: updates.companionId?.toString(),
          parentId: updates.parentId?.toString(),
          category: updates.category ?? undefined,
          subcategory: updates.subcategory ?? undefined,
          visitType: updates.visitType ?? undefined,
          expenseName: updates.expenseName ?? undefined,
          businessName: updates.businessName ?? undefined,
          date: updates.date ?? undefined,
          amount: updates.amount ?? undefined,
          currency: updates.currency ?? undefined,
          attachments: (updates.attachments ??
            undefined) as unknown as Prisma.InputJsonValue,
          notes: updates.notes ?? undefined,
        },
      });
      return doc as unknown as ExternalExpenseDocument;
    }

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

    if (shouldDualWrite) {
      try {
        await prisma.externalExpense.updateMany({
          where: { id: doc._id.toString() },
          data: {
            companionId: doc.companionId.toString(),
            parentId: doc.parentId.toString(),
            category: doc.category,
            subcategory: doc.subcategory ?? undefined,
            visitType: doc.visitType ?? undefined,
            expenseName: doc.expenseName,
            businessName: doc.businessName ?? undefined,
            date: doc.date,
            amount: doc.amount,
            currency: doc.currency ?? "USD",
            attachments: (doc.attachments ??
              undefined) as unknown as Prisma.InputJsonValue,
            notes: doc.notes ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("ExternalExpense update", err);
      }
    }

    return doc;
  },

  async getTotalExpenseForCompanion(companionId: string) {
    if (isReadFromPostgres()) {
      const [invoiceAgg, externalAgg] = await Promise.all([
        prisma.invoice.aggregate({
          where: { companionId, status: "PAID" },
          _sum: { totalAmount: true },
        }),
        prisma.externalExpense.aggregate({
          where: { companionId },
          _sum: { amount: true },
        }),
      ]);

      const invoiceTotal = invoiceAgg._sum.totalAmount ?? 0;
      const externalTotal = externalAgg._sum.amount ?? 0;

      return {
        companionId,
        invoiceTotal,
        externalTotal,
        totalExpense: invoiceTotal + externalTotal,
      };
    }

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
