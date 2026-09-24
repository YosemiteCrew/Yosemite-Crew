import {
  Prisma,
  SupplierBill as PrismaSupplierBill,
  SupplierBillLine as PrismaSupplierBillLine,
  SupplierBillStatus as PrismaSupplierBillStatus,
  SupplierCredit as PrismaSupplierCredit,
  SupplierPayment as PrismaSupplierPayment,
  SupplierAllocation as PrismaSupplierAllocation,
  SupplierAccount as PrismaSupplierAccount,
  SupplierEntry as PrismaSupplierEntry,
  SupplierEntryType as PrismaSupplierEntryType,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { randomUUID } from "node:crypto";
import { roundMoney } from "src/services/finance/pricing";

type PrismaTransactionClient = Prisma.TransactionClient;

export class SupplierBillServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SupplierBillServiceError";
  }
}

type DraftSupplierBillLineInput = {
  id?: string;
  lineType: "STOCK" | "NON_STOCK_EXPENSE";
  description: string;
  quantityOrdered?: number;
  quantityReceived?: number;
  quantityBilled: number;
  unitCost: number;
  taxPercent?: number;
  purchaseOrderId?: string;
  purchaseOrderLineId?: string;
  receiptId?: string;
  receiptLineId?: string;
  inventoryItemId?: string;
};

type CreateSupplierBillInput = {
  organisationId: string;
  vendorId: string;
  currency: string;
  externalReference: string;
  lines: DraftSupplierBillLineInput[];
  idempotencyKey?: string;
};

type PostSupplierBillInput = {
  billId: string;
  organisationId: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
};

type VoidSupplierBillInput = {
  billId: string;
  organisationId: string;
  actorId: string;
  reason: string;
  expectedVersion: number;
};

type CreateSupplierCreditInput = {
  organisationId: string;
  vendorId: string;
  currency: string;
  externalReference: string;
  amount: number;
  billId?: string;
  receiptId?: string;
  reason?: string;
  documentId?: string;
  idempotencyKey?: string;
};

type CreateSupplierPaymentInput = {
  organisationId: string;
  vendorId: string;
  currency: string;
  amount: number;
  paidAt: Date;
  method: "CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "OTHER";
  reference: string;
  allocations: Array<{ billId: string; amount: number }>;
  idempotencyKey: string;
};

type SupplierAllocationInput = {
  creditId?: string;
  paymentId?: string;
  billId: string;
  amount: number;
  idempotencyKey: string;
};

const assignLineId = (existing?: string) => {
  const trimmed = existing?.trim();
  return trimmed || randomUUID();
};

const buildBillLineSnapshots = (lines: DraftSupplierBillLineInput[]) =>
  lines.map((line) => {
    const lineTotal = line.quantityBilled * line.unitCost;
    const taxAmount = roundMoney(lineTotal * ((line.taxPercent ?? 0) / 100));
    return {
      id: assignLineId(line.id),
      lineType: line.lineType,
      description: line.description,
      quantityOrdered: line.quantityOrdered ?? null,
      quantityReceived: line.quantityReceived ?? null,
      quantityBilled: line.quantityBilled,
      unitCost: line.unitCost,
      lineTotal: roundMoney(lineTotal),
      taxPercent: line.taxPercent ?? 0,
      taxAmount,
      purchaseOrderId: line.purchaseOrderId ?? null,
      purchaseOrderLineId: line.purchaseOrderLineId ?? null,
      receiptId: line.receiptId ?? null,
      receiptLineId: line.receiptLineId ?? null,
      inventoryItemId: line.inventoryItemId ?? null,
    };
  });

const computeBillTotals = (
  lines: ReturnType<typeof buildBillLineSnapshots>,
) => {
  const totalAmount = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
  );
  const taxTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.taxAmount, 0),
  );
  return { totalAmount, taxTotal };
};

const findSupplierAccountOrCreate = async (
  organisationId: string,
  vendorId: string,
  currency: string,
) => {
  let account = await prisma.supplierAccount.findUnique({
    where: {
      organisationId_vendorId_currency: { organisationId, vendorId, currency },
    },
  });

  if (!account) {
    account = await prisma.supplierAccount.create({
      data: { organisationId, vendorId, currency },
    });
  }

  return account;
};

const recordSupplierEntry = async (
  entry: Omit<PrismaSupplierEntry, "id" | "createdAt"> & {
    type: PrismaSupplierEntryType;
  },
) => {
  await prisma.supplierEntry.create({ data: entry });
};

const assertVersionMatch = <T extends { version: number }>(
  record: T,
  expectedVersion: number,
  entityName: string,
) => {
  if (record.version !== expectedVersion) {
    throw new SupplierBillServiceError(
      `${entityName} has been modified by another process (expected version ${expectedVersion}, found ${record.version})`,
      409,
    );
  }
};

export const SupplierBillService = {
  async createDraft(input: CreateSupplierBillInput) {
    const {
      organisationId,
      vendorId,
      currency,
      externalReference,
      lines,
      idempotencyKey,
    } = input;

    if (!lines.length) {
      throw new SupplierBillServiceError(
        "At least one bill line is required",
        400,
      );
    }

    for (const line of lines) {
      if (!Number.isFinite(line.quantityBilled) || line.quantityBilled <= 0) {
        throw new SupplierBillServiceError(
          "Quantity billed must be positive",
          400,
        );
      }
      if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
        throw new SupplierBillServiceError(
          "Unit cost must be non-negative",
          400,
        );
      }
    }

    const supplierAccount = await findSupplierAccountOrCreate(
      organisationId,
      vendorId,
      currency,
    );

    const lineSnapshots = buildBillLineSnapshots(lines);
    const { totalAmount, taxTotal } = computeBillTotals(lineSnapshots);

    const existing = await prisma.supplierBill.findUnique({
      where: {
        organisationId_vendorId_externalReference: {
          organisationId,
          vendorId,
          externalReference,
        },
      },
    });

    if (existing) {
      if (idempotencyKey && existing.idempotencyKey === idempotencyKey) {
        return this.getById(existing.id, organisationId);
      }
      throw new SupplierBillServiceError(
        "Supplier bill with this external reference already exists",
        409,
      );
    }

    const bill = await prisma.supplierBill.create({
      data: {
        organisationId,
        vendorId,
        supplierAccountId: supplierAccount.id,
        externalReference,
        currency,
        status: "DRAFT",
        totalAmount,
        taxTotal,
        lines: { create: lineSnapshots },
        idempotencyKey,
      },
      include: { lines: true },
    });

    await recordSupplierEntry({
      organisationId,
      vendorId,
      supplierAccountId: supplierAccount.id,
      type: "BILL" as PrismaSupplierEntryType,
      billId: bill.id,
      amount: totalAmount,
      currency,
      description: `Draft bill created: ${externalReference}`,
      version: 0,
    });

    logger.info("Supplier bill draft created", {
      billId: bill.id,
      organisationId,
      vendorId,
    });
    return this.getById(bill.id, organisationId);
  },

  async getById(billId: string, organisationId: string) {
    const bill = await prisma.supplierBill.findUnique({
      where: { id: billId },
      include: {
        lines: { orderBy: { createdAt: "asc" } },
        credits: { orderBy: { createdAt: "desc" } },
        allocations: { orderBy: { createdAt: "asc" } },
        supplierAccount: true,
      },
    });

    if (!bill || bill.organisationId !== organisationId) {
      throw new SupplierBillServiceError("Supplier bill not found", 404);
    }

    return bill;
  },

  async list(params: {
    organisationId: string;
    vendorId?: string;
    status?: PrismaSupplierBillStatus;
    cursor?: string;
    limit?: number;
  }) {
    const { organisationId, vendorId, status, cursor, limit = 20 } = params;

    const where: Prisma.SupplierBillWhereInput = { organisationId };
    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;
    if (cursor) where.id = { lt: cursor };

    const bills = await prisma.supplierBill.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: "desc" },
      include: {
        lines: { orderBy: { createdAt: "asc" } },
        supplierAccount: true,
      },
    });

    let nextCursor: string | undefined;
    if (bills.length > limit) {
      const next = bills.pop();
      nextCursor = next!.id;
    }

    return { bills, nextCursor };
  },

  async postBill(input: PostSupplierBillInput) {
    const { billId, organisationId, actorId, expectedVersion, idempotencyKey } =
      input;

    const bill = await prisma.supplierBill.findUnique({
      where: { id: billId },
      include: { lines: true, supplierAccount: true },
    });

    if (!bill || bill.organisationId !== organisationId) {
      throw new SupplierBillServiceError("Supplier bill not found", 404);
    }

    if (bill.status !== "DRAFT") {
      throw new SupplierBillServiceError("Only draft bills can be posted", 409);
    }

    assertVersionMatch(bill, expectedVersion, "Supplier bill");

    if (bill.idempotencyKey && bill.idempotencyKey !== idempotencyKey) {
      throw new SupplierBillServiceError("Idempotency key mismatch", 409);
    }

    for (const line of bill.lines) {
      if (
        line.lineType === "STOCK" &&
        (line.quantityOrdered ?? 0) > 0 &&
        line.quantityBilled > (line.quantityReceived ?? 0)
      ) {
        throw new SupplierBillServiceError(
          `Line "${line.description}": cannot bill more than received quantity without documented non-stock expense line`,
          409,
        );
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const updatedBill = await tx.supplierBill.update({
          where: { id: billId },
          data: {
            status: "POSTED",
            version: bill.version + 1,
            postedAt: now,
            postedBy: actorId,
            idempotencyKey,
          },
        });

        await tx.supplierAccount.update({
          where: { id: bill.supplierAccountId },
          data: {
            balance: { increment: bill.totalAmount },
            version: { increment: 1 },
          },
        });

        await tx.supplierEntry.create({
          data: {
            organisationId,
            vendorId: bill.vendorId,
            supplierAccountId: bill.supplierAccountId,
            type: "BILL",
            billId: bill.id,
            amount: bill.totalAmount,
            currency: bill.currency,
            description: `Bill posted: ${bill.externalReference}`,
            version: 0,
          },
        });

        return updatedBill;
      },
    );

    logger.info("Supplier bill posted", { billId, organisationId, actorId });
    return this.getById(billId, organisationId);
  },

  async voidBill(input: VoidSupplierBillInput) {
    const { billId, organisationId, actorId, reason, expectedVersion } = input;

    const bill = await prisma.supplierBill.findUnique({
      where: { id: billId },
      include: { supplierAccount: true },
    });

    if (!bill || bill.organisationId !== organisationId) {
      throw new SupplierBillServiceError("Supplier bill not found", 404);
    }

    if (bill.status !== "POSTED") {
      throw new SupplierBillServiceError(
        "Only posted bills can be voided",
        409,
      );
    }

    assertVersionMatch(bill, expectedVersion, "Supplier bill");

    const now = new Date();
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.supplierBill.update({
        where: { id: billId },
        data: {
          status: "VOID",
          version: bill.version + 1,
          voidedAt: now,
          voidedBy: actorId,
          voidReason: reason,
        },
      });

      await tx.supplierAccount.update({
        where: { id: bill.supplierAccountId },
        data: {
          balance: { decrement: bill.totalAmount },
          version: { increment: 1 },
        },
      });

      await tx.supplierEntry.create({
        data: {
          organisationId,
          vendorId: bill.vendorId,
          supplierAccountId: bill.supplierAccountId,
          type: "REVERSAL",
          billId: bill.id,
          amount: -bill.totalAmount,
          currency: bill.currency,
          description: `Bill voided: ${reason}`,
          version: 0,
        },
      });
    });

    logger.info("Supplier bill voided", {
      billId,
      organisationId,
      actorId,
      reason,
    });
    return this.getById(billId, organisationId);
  },

  async createCredit(input: CreateSupplierCreditInput) {
    const {
      organisationId,
      vendorId,
      currency,
      externalReference,
      amount,
      billId,
      receiptId,
      reason,
      documentId,
      idempotencyKey,
    } = input;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new SupplierBillServiceError("Credit amount must be positive", 400);
    }

    if (billId && receiptId) {
      throw new SupplierBillServiceError(
        "Credit cannot reference both a bill and a receipt",
        400,
      );
    }

    const supplierAccount = await findSupplierAccountOrCreate(
      organisationId,
      vendorId,
      currency,
    );

    const existing = await prisma.supplierCredit.findUnique({
      where: {
        organisationId_vendorId_externalReference: {
          organisationId,
          vendorId,
          externalReference,
        },
      },
    });

    if (existing) {
      if (idempotencyKey && existing.idempotencyKey === idempotencyKey) {
        return existing;
      }
      throw new SupplierBillServiceError(
        "Supplier credit with this external reference already exists",
        409,
      );
    }

    let linkedBill: PrismaSupplierBill | null = null;
    if (billId) {
      linkedBill = await prisma.supplierBill.findUnique({
        where: { id: billId },
      });
      if (
        !linkedBill ||
        linkedBill.organisationId !== organisationId ||
        linkedBill.vendorId !== vendorId
      ) {
        throw new SupplierBillServiceError("Referenced bill not found", 404);
      }
      if (linkedBill.status !== "POSTED") {
        throw new SupplierBillServiceError(
          "Credit can only reference a posted bill",
          409,
        );
      }
    }

    const credit = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const createdCredit = await tx.supplierCredit.create({
          data: {
            organisationId,
            vendorId,
            supplierAccountId: supplierAccount.id,
            externalReference,
            currency,
            amount: roundMoney(amount),
            billId: billId ?? null,
            receiptId: receiptId ?? null,
            reason,
            documentId,
            idempotencyKey,
          },
        });

        await tx.supplierAccount.update({
          where: { id: supplierAccount.id },
          data: {
            balance: { decrement: roundMoney(amount) },
            version: { increment: 1 },
          },
        });

        await tx.supplierEntry.create({
          data: {
            organisationId,
            vendorId,
            supplierAccountId: supplierAccount.id,
            type: "CREDIT",
            creditId: createdCredit.id,
            billId: billId ?? null,
            amount: -roundMoney(amount),
            currency,
            description: `Credit created: ${reason ?? externalReference}`,
            version: 0,
          },
        });

        return createdCredit;
      },
    );

    logger.info("Supplier credit created", {
      creditId: credit.id,
      organisationId,
      vendorId,
      amount,
    });
    return credit;
  },

  async createPayment(input: CreateSupplierPaymentInput) {
    const {
      organisationId,
      vendorId,
      currency,
      amount,
      paidAt,
      method,
      reference,
      allocations,
      idempotencyKey,
    } = input;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new SupplierBillServiceError(
        "Payment amount must be positive",
        400,
      );
    }

    if (!allocations.length) {
      throw new SupplierBillServiceError(
        "At least one allocation is required",
        400,
      );
    }

    const totalAllocated = roundMoney(
      allocations.reduce((sum, a) => sum + a.amount, 0),
    );
    if (totalAllocated > roundMoney(amount)) {
      throw new SupplierBillServiceError(
        "Total allocated amount exceeds payment amount",
        400,
      );
    }

    const supplierAccount = await findSupplierAccountOrCreate(
      organisationId,
      vendorId,
      currency,
    );

    const existing = await prisma.supplierPayment.findUnique({
      where: {
        organisationId_vendorId_idempotencyKey: {
          organisationId,
          vendorId,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const bills = await prisma.supplierBill.findMany({
      where: {
        id: { in: allocations.map((a) => a.billId) },
        organisationId,
        vendorId,
      },
    });

    if (bills.length !== allocations.length) {
      throw new SupplierBillServiceError(
        "One or more referenced bills not found",
        404,
      );
    }

    for (const bill of bills) {
      if (bill.status !== "POSTED") {
        throw new SupplierBillServiceError(
          `Bill ${bill.externalReference} is not posted`,
          409,
        );
      }
    }

    const payment = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const createdPayment = await tx.supplierPayment.create({
          data: {
            organisationId,
            vendorId,
            supplierAccountId: supplierAccount.id,
            amount: roundMoney(amount),
            currency,
            paidAt,
            method,
            reference,
            idempotencyKey,
          },
        });

        for (const alloc of allocations) {
          await tx.supplierAllocation.create({
            data: {
              organisationId,
              supplierAccountId: supplierAccount.id,
              paymentId: createdPayment.id,
              billId: alloc.billId,
              amount: roundMoney(alloc.amount),
              idempotencyKey: `${idempotencyKey}-${alloc.billId}`,
            },
          });

          await tx.supplierEntry.create({
            data: {
              organisationId,
              vendorId,
              supplierAccountId: supplierAccount.id,
              type: "PAYMENT",
              paymentId: createdPayment.id,
              billId: alloc.billId,
              amount: -roundMoney(alloc.amount),
              currency,
              description: `Payment allocated to ${alloc.billId}`,
              version: 0,
            },
          });
        }

        await tx.supplierAccount.update({
          where: { id: supplierAccount.id },
          data: {
            balance: { decrement: roundMoney(amount) },
            version: { increment: 1 },
          },
        });

        await tx.supplierEntry.create({
          data: {
            organisationId,
            vendorId,
            supplierAccountId: supplierAccount.id,
            type: "PAYMENT",
            paymentId: createdPayment.id,
            amount: -roundMoney(amount),
            currency,
            description: `Payment recorded: ${reference}`,
            version: 0,
          },
        });

        return createdPayment;
      },
    );

    logger.info("Supplier payment created", {
      paymentId: payment.id,
      organisationId,
      vendorId,
      amount,
    });
    return payment;
  },

  async getSupplierAccount(
    organisationId: string,
    vendorId: string,
    currency: string,
  ) {
    const account = await prisma.supplierAccount.findUnique({
      where: {
        organisationId_vendorId_currency: {
          organisationId,
          vendorId,
          currency,
        },
      },
    });

    if (!account) {
      throw new SupplierBillServiceError("Supplier account not found", 404);
    }

    return account;
  },

  async getSupplierAccountStatement(params: {
    organisationId: string;
    vendorId: string;
    currency: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { organisationId, vendorId, currency, fromDate, toDate } = params;

    const account = await this.getSupplierAccount(
      organisationId,
      vendorId,
      currency,
    );

    const where: Prisma.SupplierEntryWhereInput = {
      supplierAccountId: account.id,
    };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const entries = await prisma.supplierEntry.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: { bill: true, credit: true, payment: true, allocation: true },
    });

    return { account, entries };
  },
};
