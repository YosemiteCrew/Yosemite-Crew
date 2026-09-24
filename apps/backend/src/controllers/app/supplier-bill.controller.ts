import { Request, Response } from "express";
import { z } from "zod";
import {
  SupplierBillService,
  SupplierBillServiceError,
} from "src/services/supplier-bills";
import logger from "src/utils/logger";
import {
  resolveVerifiedOrganisationId,
  resolveVerifiedUserId,
} from "src/utils/request";

type RequestContext = { organisationId: string; actorId: string };

/**
 * The organisation always comes from `withOrgPermissions`, which has checked
 * the caller's membership, and never from the body: the middleware reads the
 * `x-org-id` header before the body, so a body naming another organisation
 * would otherwise be written to without that organisation ever being checked.
 */
const resolveContext = (req: Request): RequestContext => {
  const organisationId = resolveVerifiedOrganisationId(req);
  const actorId = resolveVerifiedUserId(req);
  if (!organisationId || !actorId) {
    throw new SupplierBillServiceError("Not authorised", 401);
  }
  return { organisationId, actorId };
};

const handle =
  (action: (req: Request, ctx: RequestContext) => Promise<[number, unknown]>) =>
  async (req: Request, res: Response) => {
    try {
      const [status, body] = await action(req, resolveContext(req));
      return res.status(status).json(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation error",
          details: z.flattenError(error),
        });
      }
      if (error instanceof SupplierBillServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      logger.error("Supplier bill request failed", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

const Id = z.string().trim().min(1);
const Currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Currency must be a three-letter code")
  .transform((value) => value.toUpperCase());
const Money = z.number().positive();
const IsoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

const DraftSupplierBillLineBodySchema = z.object({
  lineType: z.enum(["STOCK", "NON_STOCK_EXPENSE"]),
  description: z.string().trim().min(1),
  quantityOrdered: z.number().positive().optional(),
  quantityReceived: z.number().nonnegative().optional(),
  quantityBilled: z.number().positive(),
  unitCost: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).optional(),
  purchaseOrderId: Id.optional(),
  purchaseOrderLineId: Id.optional(),
  receiptId: Id.optional(),
  receiptLineId: Id.optional(),
  inventoryItemId: Id.optional(),
});

const CreateSupplierBillBodySchema = z.object({
  vendorId: Id,
  currency: Currency,
  externalReference: Id,
  lines: z.array(DraftSupplierBillLineBodySchema).min(1),
  idempotencyKey: Id.optional(),
});

const PostSupplierBillBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: Id,
});

const VoidSupplierBillBodySchema = z.object({
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

const CreateSupplierCreditBodySchema = z.object({
  vendorId: Id,
  currency: Currency,
  externalReference: Id,
  amount: Money,
  billId: Id.optional(),
  receiptId: Id.optional(),
  reason: z.string().trim().min(1).optional(),
  documentId: Id.optional(),
  idempotencyKey: Id.optional(),
});

const CreateSupplierPaymentBodySchema = z.object({
  vendorId: Id,
  currency: Currency,
  amount: Money,
  paidAt: IsoDate,
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]),
  reference: Id,
  allocations: z.array(z.object({ billId: Id, amount: Money })).min(1),
  idempotencyKey: Id,
});

const ListSupplierBillsQuerySchema = z.object({
  vendorId: Id.optional(),
  status: z.enum(["DRAFT", "POSTED", "VOID"]).optional(),
  cursor: Id.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const SupplierAccountParamsSchema = z.object({
  vendorId: Id,
  currency: Currency,
});

const SupplierAccountStatementQuerySchema = z.object({
  fromDate: IsoDate.optional(),
  toDate: IsoDate.optional(),
});

const createDraft = handle(async (req, { organisationId }) => {
  const parsed = CreateSupplierBillBodySchema.parse(req.body);
  const bill = await SupplierBillService.createDraft({
    ...parsed,
    organisationId,
  });
  return [201, { bill }];
});

const getById = handle(async (req, { organisationId }) => {
  const bill = await SupplierBillService.getById(
    Id.parse(req.params.id),
    organisationId,
  );
  return [200, { bill }];
});

const list = handle(async (req, { organisationId }) => {
  const parsed = ListSupplierBillsQuerySchema.parse(req.query);
  const result = await SupplierBillService.list({ ...parsed, organisationId });
  return [200, result];
});

const postBill = handle(async (req, { organisationId, actorId }) => {
  const parsed = PostSupplierBillBodySchema.parse(req.body);
  const bill = await SupplierBillService.postBill({
    ...parsed,
    billId: Id.parse(req.params.id),
    organisationId,
    actorId,
  });
  return [200, { bill }];
});

const voidBill = handle(async (req, { organisationId, actorId }) => {
  const parsed = VoidSupplierBillBodySchema.parse(req.body);
  const bill = await SupplierBillService.voidBill({
    ...parsed,
    billId: Id.parse(req.params.id),
    organisationId,
    actorId,
  });
  return [200, { bill }];
});

const createCredit = handle(async (req, { organisationId }) => {
  const parsed = CreateSupplierCreditBodySchema.parse(req.body);
  const credit = await SupplierBillService.createCredit({
    ...parsed,
    organisationId,
  });
  return [201, { credit }];
});

const createPayment = handle(async (req, { organisationId }) => {
  const parsed = CreateSupplierPaymentBodySchema.parse(req.body);
  const payment = await SupplierBillService.createPayment({
    ...parsed,
    organisationId,
  });
  return [201, { payment }];
});

const getSupplierAccount = handle(async (req, { organisationId }) => {
  const { vendorId, currency } = SupplierAccountParamsSchema.parse(req.params);
  const account = await SupplierBillService.getSupplierAccount(
    organisationId,
    vendorId,
    currency,
  );
  return [200, { account }];
});

const getSupplierAccountStatement = handle(async (req, { organisationId }) => {
  const { vendorId, currency } = SupplierAccountParamsSchema.parse(req.params);
  const { fromDate, toDate } = SupplierAccountStatementQuerySchema.parse(
    req.query,
  );
  const statement = await SupplierBillService.getSupplierAccountStatement({
    organisationId,
    vendorId,
    currency,
    fromDate,
    toDate,
  });
  return [200, { statement }];
});

export const SupplierBillController = {
  createDraft,
  getById,
  list,
  postBill,
  voidBill,
  createCredit,
  createPayment,
  getSupplierAccount,
  getSupplierAccountStatement,
};
