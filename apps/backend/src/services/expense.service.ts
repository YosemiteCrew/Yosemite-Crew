import {
  Prisma,
  type ExternalExpense as PrismaExternalExpense,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class ExternalExpenseServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

export type ExternalExpenseInput = {
  patientId: string;
  parentId: string;
  category: string;
  subcategory?: string | null;
  visitType?: string | null;
  expenseName: string;
  businessName?: string | null;
  date: Date;
  amount: number;
  currency?: string;
  attachments?: Prisma.InputJsonValue | null;
  notes?: string | null;
};

export type ExternalExpenseUpdateInput = Partial<ExternalExpenseInput>;

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

const normalizeInvoiceDescription = (
  items: Prisma.JsonValue | null,
): string | undefined => {
  if (!Array.isArray(items)) {
    return undefined;
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }
      const name = (item as Record<string, unknown>).name;
      return typeof name === "string" ? name : undefined;
    })
    .filter((value): value is string => Boolean(value))
    .join(", ");
};

const getOrganisationName = async (organisationId?: string | null) => {
  if (!organisationId) {
    return "Unknown Organization";
  }

  const org = await prisma.organization.findFirst({
    where: { id: organisationId },
    select: { name: true },
  });

  return org?.name ?? "Unknown Organization";
};

const toUnifiedExpenseFromExternal = (
  expense: PrismaExternalExpense,
): UnifiedExpense => ({
  source: "EXTERNAL",
  date: expense.date,
  amount: expense.amount,
  title: expense.expenseName,
  description: expense.notes ?? undefined,
  category: expense.category,
  subcategory: expense.subcategory ?? undefined,
  expenseId: expense.id,
  currency: expense.currency,
  businessName: expense.businessName ?? undefined,
});

const toUnifiedExpenseFromInvoice = async (invoice: {
  id: string;
  createdAt: Date;
  totalAmount: number;
  appointmentId?: string | null;
  items: Prisma.JsonValue;
  status: string;
  currency: string;
  organisationId?: string | null;
}): Promise<UnifiedExpense> => ({
  source: "IN_APP",
  date: invoice.createdAt,
  amount: invoice.totalAmount,
  appointmentId: invoice.appointmentId ?? undefined,
  title: "Invoice",
  description: normalizeInvoiceDescription(invoice.items),
  status:
    invoice.status === "PAID" || invoice.status === "AWAITING_PAYMENT"
      ? invoice.status
      : undefined,
  category: "Health",
  subcategory: "",
  invoiceId: invoice.id,
  currency: invoice.currency,
  businessName: await getOrganisationName(invoice.organisationId),
});

export const ExpenseService = {
  async createExpense(
    input: ExternalExpenseInput,
  ): Promise<PrismaExternalExpense> {
    if (!input.patientId) {
      throw new ExternalExpenseServiceError("patientId is required");
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
    if (typeof input.amount !== "number" || input.amount < 0) {
      throw new ExternalExpenseServiceError("amount must be a positive number");
    }

    return prisma.externalExpense.create({
      data: {
        patientId: input.patientId,
        parentId: input.parentId,
        category: input.category,
        subcategory: input.subcategory ?? undefined,
        visitType: input.visitType ?? undefined,
        expenseName: input.expenseName,
        businessName: input.businessName ?? undefined,
        date: input.date,
        amount: input.amount,
        currency: input.currency ?? "USD",
        attachments: (input.attachments ?? undefined) as Prisma.InputJsonValue,
        notes: input.notes ?? undefined,
      },
    });
  },

  async getExpensesByCompanion(patientId: string) {
    if (!patientId) {
      throw new ExternalExpenseServiceError("patientId is required");
    }

    const [external, invoices] = await Promise.all([
      prisma.externalExpense.findMany({
        where: { patientId },
        orderBy: { date: "desc" },
      }),
      prisma.invoice.findMany({
        where: {
          patientId,
          status: { in: ["PAID", "AWAITING_PAYMENT"] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const invoiceMapped = await Promise.all(
      invoices.map((invoice) =>
        toUnifiedExpenseFromInvoice({
          id: invoice.id,
          createdAt: invoice.createdAt,
          totalAmount: invoice.totalAmount,
          appointmentId: invoice.appointmentId,
          items: invoice.items,
          status: invoice.status,
          currency: invoice.currency,
          organisationId: invoice.organisationId,
        }),
      ),
    );

    return [
      ...external.map(toUnifiedExpenseFromExternal),
      ...invoiceMapped,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getExpenseById(expenseId: string) {
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
      return toUnifiedExpenseFromInvoice({
        id: invoice.id,
        createdAt: invoice.createdAt,
        totalAmount: invoice.totalAmount,
        appointmentId: invoice.appointmentId,
        items: invoice.items,
        status: invoice.status,
        currency: invoice.currency,
        organisationId: invoice.organisationId,
      });
    }

    throw new ExternalExpenseServiceError("Expense not found", 404);
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const result = await prisma.externalExpense.deleteMany({
      where: { id: expenseId },
    });

    if (!result.count) {
      throw new ExternalExpenseServiceError("Expense not found", 404);
    }
  },

  async updateExpense(
    expenseId: string,
    updates: ExternalExpenseUpdateInput,
  ): Promise<PrismaExternalExpense> {
    const existing = await prisma.externalExpense.findFirst({
      where: { id: expenseId },
    });
    if (!existing) {
      throw new ExternalExpenseServiceError("Expense not found", 404);
    }

    return prisma.externalExpense.update({
      where: { id: expenseId },
      data: {
        patientId: updates.patientId ?? undefined,
        parentId: updates.parentId ?? undefined,
        category: updates.category ?? undefined,
        subcategory: updates.subcategory ?? undefined,
        visitType: updates.visitType ?? undefined,
        expenseName: updates.expenseName ?? undefined,
        businessName: updates.businessName ?? undefined,
        date: updates.date ?? undefined,
        amount: updates.amount ?? undefined,
        currency: updates.currency ?? undefined,
        attachments: (updates.attachments ??
          undefined) as Prisma.InputJsonValue,
        notes: updates.notes ?? undefined,
      },
    });
  },

  async getTotalExpenseForCompanion(patientId: string) {
    const [invoiceAgg, externalAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { patientId, status: "PAID" },
        _sum: { totalAmount: true },
      }),
      prisma.externalExpense.aggregate({
        where: { patientId },
        _sum: { amount: true },
      }),
    ]);

    const invoiceTotal = invoiceAgg._sum.totalAmount ?? 0;
    const externalTotal = externalAgg._sum.amount ?? 0;

    return {
      patientId,
      invoiceTotal,
      externalTotal,
      totalExpense: invoiceTotal + externalTotal,
    };
  },
};
