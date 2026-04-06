import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import {
  LabOrderService,
  LabOrderServiceError,
} from "src/services/lab-order.service";
import type { LabOrderStatus } from "src/models/lab-order";

const getSingleQueryValue = (
  value: Request["query"][string],
): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((entry): entry is string => typeof entry === "string");
  }
  return undefined;
};

const requireOrgAndProvider = (req: Request, res: Response) => {
  const orgReq = req as OrgRequest;
  const organisationId = orgReq.organisationId ?? req.params.organisationId;
  const provider = req.params.provider;

  if (!organisationId) {
    res.status(400).json({ message: "organisationId is required." });
    return null;
  }
  if (!provider) {
    res.status(400).json({ message: "provider is required." });
    return null;
  }

  return { organisationId, provider, orgReq };
};

const requireOrderParams = (req: Request, res: Response) => {
  const base = requireOrgAndProvider(req, res);
  if (!base) return null;

  const idexxOrderId = req.params.idexxOrderId;
  if (!idexxOrderId) {
    res.status(400).json({ message: "idexxOrderId is required." });
    return null;
  }

  return { ...base, idexxOrderId };
};

const handleLabOrderError = (
  res: Response,
  error: unknown,
  logMessage: string,
  responseMessage: string,
) => {
  if (error instanceof LabOrderServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logMessage, error);
  return res.status(500).json({ message: responseMessage });
};

export const LabOrderController = {
  async listOrders(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { organisationId, provider } = base;

      const appointmentId = getSingleQueryValue(req.query.appointmentId);
      const companionId = getSingleQueryValue(req.query.companionId);
      const status = getSingleQueryValue(req.query.status);
      const limit = getSingleQueryValue(req.query.limit);

      const orders = await LabOrderService.listOrders({
        organisationId,
        appointmentId,
        companionId,
        provider,
        status: status as LabOrderStatus | undefined,
        limit: typeof limit === "string" ? Number(limit) : undefined,
      });

      return res.status(200).json({ orders });
    } catch (error) {
      return handleLabOrderError(
        res,
        error,
        "Failed to list lab orders",
        "Failed to list lab orders.",
      );
    }
  },

  async listProviderTests(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { provider } = base;

      const body = req.body as
        | {
            query?: string;
            limit?: number;
            page?: number;
            codes?: string[];
          }
        | undefined;
      const query = typeof body?.query === "string" ? body.query : undefined;
      const limit = typeof body?.limit === "number" ? body.limit : undefined;
      const page = typeof body?.page === "number" ? body.page : undefined;
      const codesParam = Array.isArray(body?.codes)
        ? body?.codes.join(",")
        : undefined;
      const codes = codesParam
        ? codesParam
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined;

      const tests = await LabOrderService.listProviderTests(provider, {
        query,
        limit: Number.isFinite(limit) ? limit : undefined,
        page: Number.isFinite(page) ? page : undefined,
        codes,
      });

      return res.status(200).json(tests);
    } catch (error) {
      return handleLabOrderError(
        res,
        error,
        "Failed to list lab tests",
        "Failed to list lab tests.",
      );
    }
  },

  async createIdexxOrder(req: Request, res: Response) {
    try {
      const base = requireOrgAndProvider(req, res);
      if (!base) return;
      const { organisationId, provider, orgReq } = base;
      const createdByUserId = orgReq.userId;

      const body = req.body as {
        companionId?: string;
        appointmentId?: string;
        tests?: string[];
        modality?: "IN_HOUSE" | "REFERENCE_LAB";
        ivls?: Array<{ serialNumber: string }>;
        veterinarian?: string;
        technician?: string;
        notes?: string;
        specimenCollectionDate?: string;
      };

      const created = await LabOrderService.createOrder(provider, {
        organisationId,
        companionId: body.companionId ?? "",
        appointmentId: body.appointmentId,
        createdByUserId: createdByUserId ?? undefined,
        tests: body.tests ?? [],
        modality: body.modality,
        ivls: body.ivls,
        veterinarian: body.veterinarian ?? null,
        technician: body.technician ?? null,
        notes: body.notes ?? null,
        specimenCollectionDate: body.specimenCollectionDate ?? null,
      });

      return res.status(201).json(created);
    } catch (error) {
      return handleLabOrderError(
        res,
        error,
        "Failed to create IDEXX order",
        "Failed to create IDEXX order.",
      );
    }
  },

  async getOrder(req: Request, res: Response) {
    try {
      const params = requireOrderParams(req, res);
      if (!params) return;
      const { organisationId, provider, idexxOrderId } = params;

      const order = await LabOrderService.getOrder(
        provider,
        organisationId,
        idexxOrderId,
      );

      return res.status(200).json(order);
    } catch (error) {
      return handleLabOrderError(
        res,
        error,
        "Failed to fetch lab order",
        "Failed to fetch lab order.",
      );
    }
  },

  async updateOrder(req: Request, res: Response) {
    try {
      const params = requireOrderParams(req, res);
      if (!params) return;
      const { organisationId, provider, idexxOrderId } = params;

      const body = req.body as {
        tests?: string[];
        modality?: "IN_HOUSE" | "REFERENCE_LAB";
        ivls?: Array<{ serialNumber: string }>;
        veterinarian?: string;
        technician?: string;
        notes?: string;
        specimenCollectionDate?: string;
      };

      const order = await LabOrderService.updateOrder(
        provider,
        organisationId,
        idexxOrderId,
        {
          tests: body.tests,
          modality: body.modality,
          ivls: body.ivls,
          veterinarian: body.veterinarian ?? null,
          technician: body.technician ?? null,
          notes: body.notes ?? null,
          specimenCollectionDate: body.specimenCollectionDate ?? null,
        },
      );

      return res.status(200).json(order);
    } catch (error) {
      return handleLabOrderError(
        res,
        error,
        "Failed to update lab order",
        "Failed to update lab order.",
      );
    }
  },

  async cancelOrder(req: Request, res: Response) {
    try {
      const params = requireOrderParams(req, res);
      if (!params) return;
      const { organisationId, provider, idexxOrderId } = params;

      const order = await LabOrderService.cancelOrder(
        provider,
        organisationId,
        idexxOrderId,
      );

      return res.status(200).json(order);
    } catch (error) {
      return handleLabOrderError(
        res,
        error,
        "Failed to cancel lab order",
        "Failed to cancel lab order.",
      );
    }
  },
};
