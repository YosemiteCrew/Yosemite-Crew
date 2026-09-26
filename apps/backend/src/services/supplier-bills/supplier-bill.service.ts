import {
  Prisma,
  SupplierBillStatus as PrismaSupplierBillStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
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

type AllocatableBill = {
  id: string;
  version: number;
  totalAmount: number;
  currency: string;
  externalReference: string;
};

const isUniqueConstraintViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "P2002";

const conflict = (message: string) =>
  new SupplierBillServiceError(message, 409);

/**
 * Line snapshots are written once, at draft time, and never recomputed: a
 * posted bill must keep the amounts it was posted with even if tax or cost
 * rules change later. `lineTotal` is net of tax; the bill's `totalAmount` is
 * the gross payable (net plus tax), because that is what the supplier is owed.
 */
const buildBillLineSnapshots = (
  lines: DraftSupplierBillLineInput[],
  currency?: string,
) =>
  lines.map((line) => {
    const lineTotal = roundMoney(line.quantityBilled * line.unitCost, currency);
    const taxPercent = line.taxPercent ?? 0;
    return {
      lineType: line.lineType,
      description: line.description,
      quantityOrdered: line.quantityOrdered ?? null,
      quantityReceived: line.quantityReceived ?? null,
      quantityBilled: line.quantityBilled,
      unitCost: line.unitCost,
      lineTotal,
      taxPercent,
      taxAmount: roundMoney(lineTotal * (taxPercent / 100), currency),
      purchaseOrderId: line.purchaseOrderId ?? null,
      purchaseOrderLineId: line.purchaseOrderLineId ?? null,
      receiptId: line.receiptId ?? null,
      receiptLineId: line.receiptLineId ?? null,
      inventoryItemId: line.inventoryItemId ?? null,
    };
  });

export const computeBillTotals = (
  lines: ReturnType<typeof buildBillLineSnapshots>,
  currency?: string,
) => {
  const netTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const taxTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.taxAmount, 0),
    currency,
  );
  return {
    totalAmount: roundMoney(netTotal + taxTotal, currency),
    taxTotal,
  };
};

/**
 * A stock line may only be billed up to what was received. Anything billed
 * beyond that has to be a separate NON_STOCK_EXPENSE line, so an unexplained
 * quantity difference can never post silently.
 */
export const findUnreceivedStockLine = <
  T extends {
    lineType: string;
    quantityBilled: number;
    quantityReceived: number | null;
  },
>(
  lines: T[],
): T | undefined =>
  lines.find(
    (line) =>
      line.lineType === "STOCK" &&
      line.quantityBilled > (line.quantityReceived ?? 0),
  );

const assertVendorInOrganisation = async (
  organisationId: string,
  vendorId: string,
) => {
  const vendor = await prisma.inventoryVendor.findFirst({
    where: { id: vendorId, organisationId },
    select: { id: true },
  });
  if (!vendor) {
    throw new SupplierBillServiceError("Supplier not found", 404);
  }
};

const upsertSupplierAccount = (
  organisationId: string,
  vendorId: string,
  currency: string,
) =>
  prisma.supplierAccount.upsert({
    where: {
      organisationId_vendorId_currency: { organisationId, vendorId, currency },
    },
    create: { organisationId, vendorId, currency },
    update: {},
  });

const loadBill = async (billId: string, organisationId: string) => {
  const bill = await prisma.supplierBill.findUnique({
    where: { id: billId },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      credits: { orderBy: { createdAt: "desc" } },
      allocations: { orderBy: { createdAt: "asc" } },
      supplierAccount: true,
    },
  });

  if (bill?.organisationId !== organisationId) {
    throw new SupplierBillServiceError("Supplier bill not found", 404);
  }

  return bill;
};

/**
 * What is still owed on a bill: its gross total less every credit and payment
 * already allocated to it. Read inside the transaction that writes the next
 * allocation, so the figure and the write agree.
 */
const outstandingOn = async (
  tx: PrismaTransactionClient,
  bill: Pick<AllocatableBill, "id" | "totalAmount" | "currency">,
) => {
  const allocated = await tx.supplierAllocation.aggregate({
    where: { billId: bill.id },
    _sum: { amount: true },
  });
  return roundMoney(
    bill.totalAmount - (allocated._sum.amount ?? 0),
    bill.currency,
  );
};

/**
 * Claims a bill for one allocation. Two payments allocating to the same bill
 * at once would each read the same outstanding amount; bumping the version
 * with a compare-and-set means the second one fails with 409 and retries
 * against the updated figure instead of overpaying the bill.
 */
const claimBillForAllocation = async (
  tx: PrismaTransactionClient,
  bill: AllocatableBill,
  amount: number,
) => {
  const claimed = await tx.supplierBill.updateMany({
    where: { id: bill.id, version: bill.version, status: "POSTED" },
    data: { version: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw conflict(
      `Bill ${bill.externalReference} changed while allocating, reload and retry`,
    );
  }
  if (amount > (await outstandingOn(tx, bill))) {
    throw conflict(
      `Allocation exceeds the amount outstanding on bill ${bill.externalReference}`,
    );
  }
};

const validatePaymentInput = (input: CreateSupplierPaymentInput) => {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new SupplierBillServiceError("Payment amount must be positive", 400);
  }
  if (!input.allocations.length) {
    throw new SupplierBillServiceError(
      "At least one allocation is required",
      400,
    );
  }
  const billIds = new Set(input.allocations.map((a) => a.billId));
  if (billIds.size !== input.allocations.length) {
    throw new SupplierBillServiceError(
      "Each bill may appear only once in a payment",
      400,
    );
  }
  const totalAllocated = roundMoney(
    input.allocations.reduce((sum, a) => sum + a.amount, 0),
    input.currency,
  );
  if (totalAllocated > roundMoney(input.amount, input.currency)) {
    throw new SupplierBillServiceError(
      "Total allocated amount exceeds payment amount",
      400,
    );
  }
};

const findPaymentByKey = (input: {
  organisationId: string;
  vendorId: string;
  idempotencyKey: string;
}) =>
  prisma.supplierPayment.findUnique({
    where: { organisationId_vendorId_idempotencyKey: input },
    include: { allocations: true },
  });

const loadPostedBillsForAllocation = async (
  input: CreateSupplierPaymentInput,
) => {
  const bills = await prisma.supplierBill.findMany({
    where: {
      id: { in: input.allocations.map((a) => a.billId) },
      organisationId: input.organisationId,
      vendorId: input.vendorId,
      currency: input.currency,
    },
  });

  if (bills.length !== input.allocations.length) {
    throw new SupplierBillServiceError(
      "One or more referenced bills not found",
      404,
    );
  }

  const notPosted = bills.find((bill) => bill.status !== "POSTED");
  if (notPosted) {
    throw conflict(`Bill ${notPosted.externalReference} is not posted`);
  }

  return new Map(bills.map((bill) => [bill.id, bill]));
};

const writePayment = (
  input: CreateSupplierPaymentInput,
  supplierAccountId: string,
  billsById: Map<string, AllocatableBill>,
) =>
  prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const amount = roundMoney(input.amount, input.currency);
    const payment = await tx.supplierPayment.create({
      data: {
        organisationId: input.organisationId,
        vendorId: input.vendorId,
        supplierAccountId,
        amount,
        currency: input.currency,
        paidAt: input.paidAt,
        method: input.method,
        reference: input.reference,
        idempotencyKey: input.idempotencyKey,
      },
    });

    for (const alloc of input.allocations) {
      const allocationAmount = roundMoney(alloc.amount, input.currency);
      await claimBillForAllocation(
        tx,
        billsById.get(alloc.billId)!,
        allocationAmount,
      );
      await tx.supplierAllocation.create({
        data: {
          organisationId: input.organisationId,
          supplierAccountId,
          paymentId: payment.id,
          billId: alloc.billId,
          amount: allocationAmount,
          idempotencyKey: `${input.idempotencyKey}:${alloc.billId}`,
        },
      });
    }

    // One ledger entry for the money that left, whatever it was allocated to.
    // Any part not allocated to a bill stays on the account as supplier credit.
    await tx.supplierAccount.update({
      where: { id: supplierAccountId },
      data: { balance: { decrement: amount }, version: { increment: 1 } },
    });
    await tx.supplierEntry.create({
      data: {
        organisationId: input.organisationId,
        vendorId: input.vendorId,
        supplierAccountId,
        type: "PAYMENT",
        paymentId: payment.id,
        amount: -amount,
        currency: input.currency,
        description: `Payment recorded: ${input.reference}`,
      },
    });

    return tx.supplierPayment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { allocations: true },
    });
  });

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

    await assertVendorInOrganisation(organisationId, vendorId);

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
        return loadBill(existing.id, organisationId);
      }
      throw conflict(
        "Supplier bill with this external reference already exists",
      );
    }

    const supplierAccount = await upsertSupplierAccount(
      organisationId,
      vendorId,
      currency,
    );
    const lineSnapshots = buildBillLineSnapshots(lines, currency);
    const { totalAmount, taxTotal } = computeBillTotals(
      lineSnapshots,
      currency,
    );

    // A draft is not a liability yet, so it writes no ledger entry and does
    // not move the account balance. Only posting does.
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
    });

    logger.info("Supplier bill draft created", {
      billId: bill.id,
      organisationId,
    });
    return loadBill(bill.id, organisationId);
  },

  getById(billId: string, organisationId: string) {
    return loadBill(billId, organisationId);
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

    const bills = await prisma.supplierBill.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        lines: { orderBy: { createdAt: "asc" } },
        supplierAccount: true,
      },
    });

    let nextCursor: string | undefined;
    if (bills.length > limit) {
      bills.pop();
      nextCursor = bills.at(-1)?.id;
    }

    return { bills, nextCursor };
  },

  async postBill(input: PostSupplierBillInput) {
    const { billId, organisationId, actorId, expectedVersion, idempotencyKey } =
      input;

    const bill = await loadBill(billId, organisationId);

    // A retry of a post that already committed returns the posted bill rather
    // than a conflict, so a client that timed out can read back the result.
    if (
      bill.status === "POSTED" &&
      bill.postIdempotencyKey === idempotencyKey
    ) {
      return bill;
    }

    if (bill.status !== "DRAFT") {
      throw conflict("Only draft bills can be posted");
    }

    const unreceived = findUnreceivedStockLine(bill.lines);
    if (unreceived) {
      throw conflict(
        `Line "${unreceived.description}": cannot bill more than the received quantity; bill the difference as a separate non-stock expense line`,
      );
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const claimed = await tx.supplierBill.updateMany({
        where: {
          id: billId,
          organisationId,
          version: expectedVersion,
          status: "DRAFT",
        },
        data: {
          status: "POSTED",
          version: { increment: 1 },
          postedAt: new Date(),
          postedBy: actorId,
          postIdempotencyKey: idempotencyKey,
        },
      });
      if (claimed.count !== 1) {
        throw conflict(
          "Supplier bill has been modified by another request, reload and retry",
        );
      }

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
        },
      });
    });

    logger.info("Supplier bill posted", { billId, organisationId });
    return loadBill(billId, organisationId);
  },

  async voidBill(input: VoidSupplierBillInput) {
    const { billId, organisationId, actorId, reason, expectedVersion } = input;

    const bill = await loadBill(billId, organisationId);

    if (bill.status !== "POSTED") {
      throw conflict("Only posted bills can be voided");
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const claimed = await tx.supplierBill.updateMany({
        where: {
          id: billId,
          organisationId,
          version: expectedVersion,
          status: "POSTED",
        },
        data: {
          status: "VOID",
          version: { increment: 1 },
          voidedAt: new Date(),
          voidedBy: actorId,
          voidReason: reason,
        },
      });
      if (claimed.count !== 1) {
        throw conflict(
          "Supplier bill has been modified by another request, reload and retry",
        );
      }

      // Checked after the claim so no allocation can land in between: every
      // allocation path bumps the bill version first.
      const allocations = await tx.supplierAllocation.count({
        where: { billId },
      });
      if (allocations > 0) {
        throw conflict(
          "A bill with credits or payments allocated to it cannot be voided",
        );
      }

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
        },
      });
    });

    logger.info("Supplier bill voided", { billId, organisationId });
    return loadBill(billId, organisationId);
  },

  async createCredit(input: CreateSupplierCreditInput) {
    const {
      organisationId,
      vendorId,
      currency,
      externalReference,
      billId,
      receiptId,
      reason,
      documentId,
      idempotencyKey,
    } = input;

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new SupplierBillServiceError("Credit amount must be positive", 400);
    }
    const amount = roundMoney(input.amount, currency);

    if (billId && receiptId) {
      throw new SupplierBillServiceError(
        "Credit cannot reference both a bill and a receipt",
        400,
      );
    }

    await assertVendorInOrganisation(organisationId, vendorId);

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
      throw conflict(
        "Supplier credit with this external reference already exists",
      );
    }

    let linkedBill: AllocatableBill | null = null;
    if (billId) {
      const bill = await prisma.supplierBill.findUnique({
        where: { id: billId },
      });
      if (
        bill?.organisationId !== organisationId ||
        bill.vendorId !== vendorId ||
        bill.currency !== currency
      ) {
        throw new SupplierBillServiceError("Referenced bill not found", 404);
      }
      if (bill.status !== "POSTED") {
        throw conflict("Credit can only reference a posted bill");
      }
      linkedBill = bill;
    }

    const supplierAccount = await upsertSupplierAccount(
      organisationId,
      vendorId,
      currency,
    );

    const credit = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const createdCredit = await tx.supplierCredit.create({
          data: {
            organisationId,
            vendorId,
            supplierAccountId: supplierAccount.id,
            externalReference,
            currency,
            amount,
            billId: billId ?? null,
            receiptId: receiptId ?? null,
            reason,
            documentId,
            idempotencyKey,
          },
        });

        // A credit against a bill reduces what is owed on that bill, so it is
        // recorded as an allocation and counts toward the bill's outstanding.
        if (linkedBill) {
          await claimBillForAllocation(tx, linkedBill, amount);
          await tx.supplierAllocation.create({
            data: {
              organisationId,
              supplierAccountId: supplierAccount.id,
              creditId: createdCredit.id,
              billId: linkedBill.id,
              amount,
              idempotencyKey: `${createdCredit.id}:${linkedBill.id}`,
            },
          });
        }

        await tx.supplierAccount.update({
          where: { id: supplierAccount.id },
          data: {
            balance: { decrement: amount },
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
            amount: -amount,
            currency,
            description: `Credit recorded: ${externalReference}`,
          },
        });

        return createdCredit;
      },
    );

    logger.info("Supplier credit created", {
      creditId: credit.id,
      organisationId,
    });
    return credit;
  },

  async createPayment(input: CreateSupplierPaymentInput) {
    validatePaymentInput(input);

    const key = {
      organisationId: input.organisationId,
      vendorId: input.vendorId,
      idempotencyKey: input.idempotencyKey,
    };
    const replay = await findPaymentByKey(key);
    if (replay) {
      return replay;
    }

    await assertVendorInOrganisation(input.organisationId, input.vendorId);
    const billsById = await loadPostedBillsForAllocation(input);
    const supplierAccount = await upsertSupplierAccount(
      input.organisationId,
      input.vendorId,
      input.currency,
    );

    let payment;
    try {
      payment = await writePayment(input, supplierAccount.id, billsById);
    } catch (error) {
      // Two submissions of the same payment raced past the replay check; the
      // one that committed is the answer to both.
      const winner = isUniqueConstraintViolation(error)
        ? await findPaymentByKey(key)
        : null;
      if (!winner) throw error;
      return winner;
    }

    logger.info("Supplier payment created", {
      paymentId: payment.id,
      organisationId: input.organisationId,
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

    const account = await SupplierBillService.getSupplierAccount(
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
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return { account, entries };
  },
};
