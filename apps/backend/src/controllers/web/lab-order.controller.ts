import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import {
  LabOrderService,
  LabOrderServiceError,
} from "src/services/lab-order.service";

export const LabOrderController = {
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

      const query = typeof req.query.query === "string" ? req.query.query : undefined;
      const limit =
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const codesParam =
        typeof req.query.codes === "string" ? req.query.codes : undefined;
      const codes = codesParam
        ? codesParam.split(",").map((c) => c.trim()).filter(Boolean)
        : undefined;

      const tests = await LabOrderService.listProviderTests(provider, {
        query,
        limit: Number.isFinite(limit) ? limit : undefined,
        codes,
      });

      return res.status(200).json({ tests });
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
      return res
        .status(500)
        .json({ message: "Failed to create IDEXX order." });
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
