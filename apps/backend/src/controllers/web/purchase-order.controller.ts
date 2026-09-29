import { PurchaseOrderStatus } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { OrgRequest } from "src/middlewares/rbac";
import {
  PurchaseOrderService,
  PurchaseOrderServiceError,
} from "src/services/purchase-order.service";
import logger from "src/utils/logger";

const handleError = (error: unknown, res: Response): void => {
  if (error instanceof PurchaseOrderServiceError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  logger.error("Purchase order controller error", { error });
  res.status(500).json({ message: "Internal Server Error" });
};

const createPurchaseOrderLineSchema = z.object({
  itemId: z.uuid(),
  quantityOrdered: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  packSize: z.number().int().positive().optional(),
  batchNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.iso
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

const idempotencyKey = z.string().trim().min(1).max(200);

const createPurchaseOrderSchema = z.object({
  vendorId: z.uuid(),
  orderNumber: z.string().trim().min(1).max(100).optional(),
  expectedDate: z.iso
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Currency must be a three-letter code")
    .transform((value) => value.toUpperCase()),
  notes: z.string().optional(),
  lines: z.array(createPurchaseOrderLineSchema).min(1),
});

const receiveDeliveryLineSchema = z.object({
  purchaseOrderLineId: z.uuid(),
  quantityReceived: z.number().int().positive(),
  batchId: z.uuid().optional(),
});

const receiveDeliverySchema = z.object({
  idempotencyKey,
  deliveryDate: z.iso
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  notes: z.string().optional(),
  lines: z
    .array(receiveDeliveryLineSchema)
    .min(1)
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.purchaseOrderLineId)).size ===
        lines.length,
      "Each order line can appear only once",
    ),
});

const returnDeliveryLineSchema = z.object({
  deliveryLineId: z.uuid(),
  quantityReturned: z.number().int().positive(),
});

const returnDeliverySchema = z.object({
  idempotencyKey,
  notes: z.string().optional(),
  lines: z
    .array(returnDeliveryLineSchema)
    .min(1)
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.deliveryLineId)).size === lines.length,
      "Each delivery line can appear only once",
    ),
});

const listOrdersQuerySchema = z.object({
  vendorId: z.uuid().optional(),
  status: z.enum(PurchaseOrderStatus).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const PurchaseOrderController = {
  async createOrder(
    this: void,
    req: Request<{ organisationId: string }, unknown, unknown>,
    res: Response,
  ): Promise<void> {
    try {
      const parsed = createPurchaseOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ message: "Invalid input", errors: parsed.error.issues });
        return;
      }

      const { organisationId } = req as OrgRequest;
      const input = {
        ...parsed.data,
        organisationId: organisationId!,
        createdBy: (req as AuthenticatedRequest).userId,
      };

      const order = await PurchaseOrderService.createOrder(input);
      res.status(201).json(order);
    } catch (error) {
      handleError(error, res);
    }
  },

  async confirmOrder(
    this: void,
    req: Request<{ purchaseOrderId: string }>,
    res: Response,
  ): Promise<void> {
    try {
      const { purchaseOrderId } = req.params;
      const { organisationId } = req as OrgRequest;

      const order = await PurchaseOrderService.confirmOrder(
        purchaseOrderId,
        organisationId!,
      );
      res.json(order);
    } catch (error) {
      handleError(error, res);
    }
  },

  async receiveDelivery(
    this: void,
    req: Request<{ purchaseOrderId: string }, unknown, unknown>,
    res: Response,
  ): Promise<void> {
    try {
      const parsed = receiveDeliverySchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ message: "Invalid input", errors: parsed.error.issues });
        return;
      }

      const { organisationId } = req as OrgRequest;
      const delivery = await PurchaseOrderService.receiveDelivery({
        ...parsed.data,
        organisationId: organisationId!,
        purchaseOrderId: req.params.purchaseOrderId,
        receivedBy: (req as AuthenticatedRequest).userId,
      });
      res.status(201).json(delivery);
    } catch (error) {
      handleError(error, res);
    }
  },

  async returnDelivery(
    this: void,
    req: Request<{ deliveryId: string }, unknown, unknown>,
    res: Response,
  ): Promise<void> {
    try {
      const parsed = returnDeliverySchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ message: "Invalid input", errors: parsed.error.issues });
        return;
      }

      const { organisationId } = req as OrgRequest;
      const delivery = await PurchaseOrderService.returnDelivery({
        ...parsed.data,
        organisationId: organisationId!,
        deliveryId: req.params.deliveryId,
        returnedBy: (req as AuthenticatedRequest).userId,
      });
      res.json(delivery);
    } catch (error) {
      handleError(error, res);
    }
  },

  async getOrder(
    this: void,
    req: Request<{ purchaseOrderId: string }>,
    res: Response,
  ): Promise<void> {
    try {
      const { purchaseOrderId } = req.params;
      const { organisationId } = req as OrgRequest;

      const order = await PurchaseOrderService.getPurchaseOrder(
        purchaseOrderId,
        organisationId!,
      );
      if (!order) {
        res.status(404).json({ message: "Purchase order not found" });
        return;
      }
      res.json(order);
    } catch (error) {
      handleError(error, res);
    }
  },

  async listOrders(
    this: void,
    req: Request<
      { organisationId: string },
      unknown,
      unknown,
      {
        vendorId?: string;
        status?: PurchaseOrderStatus;
        page?: string;
        pageSize?: string;
      }
    >,
    res: Response,
  ): Promise<void> {
    try {
      const { organisationId } = req as OrgRequest;
      const parsedQuery = listOrdersQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        res.status(400).json({
          message: "Invalid query",
          errors: parsedQuery.error.issues,
        });
        return;
      }

      const result = await PurchaseOrderService.listPurchaseOrders({
        organisationId: organisationId!,
        ...parsedQuery.data,
      });
      res.json(result);
    } catch (error) {
      handleError(error, res);
    }
  },

  async cancelOrder(
    this: void,
    req: Request<{ purchaseOrderId: string }>,
    res: Response,
  ): Promise<void> {
    try {
      const { purchaseOrderId } = req.params;
      const { organisationId } = req as OrgRequest;

      const order = await PurchaseOrderService.cancelOrder(
        purchaseOrderId,
        organisationId!,
      );
      res.json(order);
    } catch (error) {
      handleError(error, res);
    }
  },

  async getOutstandingDeliveries(
    this: void,
    req: Request<{ organisationId: string }>,
    res: Response,
  ): Promise<void> {
    try {
      const { organisationId } = req as OrgRequest;
      const items = await PurchaseOrderService.getOutstandingDeliveries(
        organisationId!,
      );
      res.json(items);
    } catch (error) {
      handleError(error, res);
    }
  },
};
