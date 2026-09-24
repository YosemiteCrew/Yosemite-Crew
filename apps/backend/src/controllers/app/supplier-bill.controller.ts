import { Request, Response } from "express";
import { z } from "zod";
import {
  SupplierBillService,
  SupplierBillServiceError,
} from "src/services/supplier-bills";
import { OrgRequest } from "src/middlewares/rbac";
import { resolveVerifiedUserId } from "src/utils/request";

const resolveActorId = (req: OrgRequest): string => {
  const actorId = resolveVerifiedUserId(req as Request);
  if (!actorId) {
    throw new SupplierBillServiceError("Actor identity not resolved", 401);
  }
  return actorId;
};

const DraftSupplierBillLineBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  lineType: z.enum(["STOCK", "NON_STOCK_EXPENSE"]),
  description: z.string().trim().min(1),
  quantityOrdered: z.number().positive().optional(),
  quantityReceived: z.number().nonnegative().optional(),
  quantityBilled: z.number().positive(),
  unitCost: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).optional(),
  purchaseOrderId: z.string().trim().min(1).optional(),
  purchaseOrderLineId: z.string().trim().min(1).optional(),
  receiptId: z.string().trim().min(1).optional(),
  receiptLineId: z.string().trim().min(1).optional(),
  inventoryItemId: z.string().trim().min(1).optional(),
});

const CreateSupplierBillBodySchema = z.object({
  organisationId: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  currency: z.string().trim().min(1).max(3),
  externalReference: z.string().trim().min(1),
  lines: z.array(DraftSupplierBillLineBodySchema).min(1),
  idempotencyKey: z.string().trim().min(1).optional(),
});

const PostSupplierBillBodySchema = z.object({
  billId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(1),
});

const VoidSupplierBillBodySchema = z.object({
  billId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

const CreateSupplierCreditBodySchema = z.object({
  organisationId: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  currency: z.string().trim().min(1).max(3),
  externalReference: z.string().trim().min(1),
  amount: z.number().positive(),
  billId: z.string().trim().min(1).optional(),
  receiptId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).optional(),
  documentId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
});

const CreateSupplierPaymentBodySchema = z.object({
  organisationId: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  currency: z.string().trim().min(1).max(3),
  amount: z.number().positive(),
  paidAt: z.string().trim().min(1),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]),
  reference: z.string().trim().min(1),
  allocations: z
    .array(
      z.object({
        billId: z.string().trim().min(1),
        amount: z.number().positive(),
      }),
    )
    .min(1),
  idempotencyKey: z.string().trim().min(1),
});

const ListSupplierBillsQuerySchema = z.object({
  vendorId: z.string().trim().min(1).optional(),
  status: z.enum(["DRAFT", "POSTED", "VOID"]).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const SupplierAccountStatementQuerySchema = z.object({
  vendorId: z.string().trim().min(1),
  currency: z.string().trim().min(1).max(3),
  fromDate: z.string().trim().min(1).optional(),
  toDate: z.string().trim().min(1).optional(),
});

export const SupplierBillController = {
  async createDraft(req: OrgRequest, res: Response) {
    try {
      const actorId = resolveActorId(req);
      const parsed = CreateSupplierBillBodySchema.parse(req.body);
      const bill = await SupplierBillService.createDraft({ ...parsed });
      res.status(201).json({ bill });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async getById(req: OrgRequest, res: Response) {
    try {
      const { id } = req.params;
      const organisationId = req.organisationId!;
      const bill = await SupplierBillService.getById(id, organisationId);
      res.json({ bill });
    } catch (error) {
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async list(req: OrgRequest, res: Response) {
    try {
      const organisationId = req.organisationId!;
      const parsed = ListSupplierBillsQuerySchema.parse(req.query);
      const { bills, nextCursor } = await SupplierBillService.list({
        organisationId,
        ...parsed,
      });
      res.json({ bills, nextCursor });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async postBill(req: OrgRequest, res: Response) {
    try {
      const actorId = resolveActorId(req);
      const parsed = PostSupplierBillBodySchema.parse(req.body);
      const bill = await SupplierBillService.postBill({ ...parsed, actorId });
      res.json({ bill });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async voidBill(req: OrgRequest, res: Response) {
    try {
      const actorId = resolveActorId(req);
      const parsed = VoidSupplierBillBodySchema.parse(req.body);
      const bill = await SupplierBillService.voidBill({ ...parsed, actorId });
      res.json({ bill });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async createCredit(req: OrgRequest, res: Response) {
    try {
      const parsed = CreateSupplierCreditBodySchema.parse(req.body);
      const credit = await SupplierBillService.createCredit(parsed);
      res.status(201).json({ credit });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async createPayment(req: OrgRequest, res: Response) {
    try {
      const parsed = CreateSupplierPaymentBodySchema.parse(req.body);
      const payment = await SupplierBillService.createPayment({
        ...parsed,
        paidAt: new Date(parsed.paidAt),
      });
      res.status(201).json({ payment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async getSupplierAccount(req: OrgRequest, res: Response) {
    try {
      const { vendorId, currency } = req.params;
      const organisationId = req.organisationId!;
      const account = await SupplierBillService.getSupplierAccount(
        organisationId,
        vendorId,
        currency,
      );
      res.json({ account });
    } catch (error) {
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },

  async getSupplierAccountStatement(req: OrgRequest, res: Response) {
    try {
      const organisationId = req.organisationId!;
      const parsed = SupplierAccountStatementQuerySchema.parse(req.query);
      const statement = await SupplierBillService.getSupplierAccountStatement({
        organisationId,
        vendorId: parsed.vendorId,
        currency: parsed.currency,
        fromDate: parsed.fromDate ? new Date(parsed.fromDate) : undefined,
        toDate: parsed.toDate ? new Date(parsed.toDate) : undefined,
      });
      res.json({ statement });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.flatten() });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  },
};
