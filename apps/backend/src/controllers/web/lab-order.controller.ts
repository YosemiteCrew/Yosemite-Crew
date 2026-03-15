import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import {
  LabOrderService,
  LabOrderServiceError,
} from "src/services/lab-order.service";
import type { LabOrderStatus } from "src/models/lab-order";

export const LabOrderController = {
  async listOrders(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }

      const body = req.body as
        | {
            appointmentId?: string;
            companionId?: string;
            status?: string;
            limit?: number;
          }
        | undefined;
      const { appointmentId, companionId, status, limit } = body ?? {};

      const orders = await LabOrderService.listOrders({
        organisationId,
        appointmentId,
        companionId,
        provider,
        status: status as LabOrderStatus | undefined,
        limit:
          typeof limit === "number"
            ? limit
            : typeof limit === "string"
              ? Number(limit)
              : undefined,
      });

      return res.status(200).json({ orders });
    } catch (error) {
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list lab orders", error);
      return res.status(500).json({ message: "Failed to list lab orders." });
    }
  },

  async listProviderTests(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }

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
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list lab tests", error);
      return res.status(500).json({ message: "Failed to list lab tests." });
    }
  },

  async createIdexxOrder(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const createdByUserId = orgReq.userId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }

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
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to create IDEXX order", error);
      return res.status(500).json({ message: "Failed to create IDEXX order." });
    }
  },

  async getOrder(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const idexxOrderId = req.params.idexxOrderId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!idexxOrderId) {
        return res.status(400).json({ message: "idexxOrderId is required." });
      }

      const order = await LabOrderService.getOrder(
        provider,
        organisationId,
        idexxOrderId,
      );

      return res.status(200).json(order);
    } catch (error) {
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to fetch lab order", error);
      return res.status(500).json({ message: "Failed to fetch lab order." });
    }
  },

  async updateOrder(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const idexxOrderId = req.params.idexxOrderId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!idexxOrderId) {
        return res.status(400).json({ message: "idexxOrderId is required." });
      }

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
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to update lab order", error);
      return res.status(500).json({ message: "Failed to update lab order." });
    }
  },

  async cancelOrder(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const idexxOrderId = req.params.idexxOrderId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!idexxOrderId) {
        return res.status(400).json({ message: "idexxOrderId is required." });
      }

      const order = await LabOrderService.cancelOrder(
        provider,
        organisationId,
        idexxOrderId,
      );

      return res.status(200).json(order);
    } catch (error) {
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to cancel lab order", error);
      return res.status(500).json({ message: "Failed to cancel lab order." });
    }
  },
};
