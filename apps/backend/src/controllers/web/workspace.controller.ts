import { Request, Response } from "express";
import { z } from "zod";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { WorkspaceDocumentPacketService } from "src/services/workspace-document-packet.service";
import logger from "src/utils/logger";
import { resolveUserIdFromRequest } from "src/utils/request";
import type { OrgRequest } from "src/middlewares/rbac";

const appointmentParamsSchema = z.object({
  organisationId: z.string().min(1),
  appointmentId: z.string().min(1),
});

const encounterParamsSchema = z.object({
  organisationId: z.string().min(1),
  encounterId: z.string().min(1),
});

const mobileEncounterParamsSchema = z.object({
  encounterId: z.string().min(1),
});

const companionParamsSchema = z.object({
  organisationId: z.string().min(1),
  companionId: z.string().min(1),
});

const packetParamsSchema = z.object({
  organisationId: z.string().min(1),
  packetId: z.string().min(1),
});

const treatmentItemEncounterParamsSchema = z.object({
  organisationId: z.string().min(1),
  encounterId: z.string().min(1),
});

const treatmentItemParamsSchema = z.object({
  organisationId: z.string().min(1),
  itemId: z.string().min(1),
});

const signPacketBodySchema = z.object({
  signerName: z.string().trim().min(1).optional(),
  signerEmail: z.string().trim().email().optional(),
});

const treatmentItemBodySchema = z.object({
  appointmentId: z.string().trim().min(1).nullable().optional(),
  productId: z.string().trim().min(1).optional(),
  productVersion: z.number().int().nullable().optional(),
  productSnapshot: z.record(z.unknown()).optional(),
  servicePackageKind: z.string().trim().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  priceSnapshot: z.record(z.unknown()).optional(),
  billingStatus: z.string().trim().min(1).optional(),
  invoiceRowId: z.string().trim().min(1).nullable().optional(),
  lockState: z
    .union([z.record(z.unknown()), z.string()])
    .nullable()
    .optional(),
});

const treatmentItemCreateBodySchema = treatmentItemBodySchema.extend({
  productId: z.string().trim().min(1),
  productSnapshot: z.record(z.unknown()),
  servicePackageKind: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  priceSnapshot: z.record(z.unknown()),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid workspace request.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof WorkspaceServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error("Unexpected workspace bootstrap error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolvePermissions = (req: Request) => {
  const typedReq = req as OrgRequest;
  return typedReq.userPermissions ?? [];
};

export const WorkspaceController = {
  async getAppointmentBootstrap(req: Request, res: Response) {
    try {
      const params = appointmentParamsSchema.parse(req.params);
      const data = await WorkspaceService.getAppointmentBootstrap(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterBootstrap(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data = await WorkspaceService.getEncounterBootstrap(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterFinalizationGate(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data = await WorkspaceService.getEncounterFinalizationGate(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getAppointmentDocuments(req: Request, res: Response) {
    try {
      const params = appointmentParamsSchema.parse(req.params);
      const data = await WorkspaceService.getAppointmentDocuments(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterDocuments(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data = await WorkspaceService.getEncounterDocuments(
        params,
        resolvePermissions(req),
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getCompanionDocuments(req: Request, res: Response) {
    try {
      const params = companionParamsSchema.parse(req.params);
      const data = await WorkspaceService.getCompanionDocuments(params);
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getCompanionMedicalRecords(req: Request, res: Response) {
    try {
      const params = companionParamsSchema.parse(req.params);
      const data = await WorkspaceService.getCompanionMedicalRecords(params);
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createDocumentPacket(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const data =
        await WorkspaceDocumentPacketService.createForEncounter(params);
      return res.status(201).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterDocumentPacketPdf(req: Request, res: Response) {
    try {
      const params = encounterParamsSchema.parse(req.params);
      const pdf = await WorkspaceDocumentPacketService.buildEncounterPacketPdf(
        params.organisationId,
        params.encounterId,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="clinical-packet-${params.encounterId}.pdf"`,
      );
      return res.status(200).send(pdf);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getMobileEncounterDocumentPacketPdf(req: Request, res: Response) {
    try {
      const params = mobileEncounterParamsSchema.parse(req.params);
      const authUserId = resolveUserIdFromRequest(req);

      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(authUserId);
      const parentId = authUser?.parentId?.toString();

      if (!parentId) {
        return res.status(403).json({ message: "Parent profile not found." });
      }

      const pdf =
        await WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent(
          parentId,
          params.encounterId,
        );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="clinical-packet-${params.encounterId}.pdf"`,
      );
      return res.status(200).send(pdf);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getDocumentPacket(req: Request, res: Response) {
    try {
      const params = packetParamsSchema.parse(req.params);
      const data = await WorkspaceDocumentPacketService.getById(
        params.organisationId,
        params.packetId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async signDocumentPacket(req: Request, res: Response) {
    try {
      const params = packetParamsSchema.parse(req.params);
      const body = signPacketBodySchema.parse(req.body ?? {});
      const signerId = resolveUserIdFromRequest(req);

      if (!signerId) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      const data = await WorkspaceDocumentPacketService.sign({
        organisationId: params.organisationId,
        packetId: params.packetId,
        signerId,
        signerName: body.signerName,
        signerEmail: body.signerEmail,
      });
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getEncounterTreatmentItems(req: Request, res: Response) {
    try {
      const params = treatmentItemEncounterParamsSchema.parse(req.params);
      const data = await WorkspaceService.getEncounterTreatmentItems(params);
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createEncounterTreatmentItem(req: Request, res: Response) {
    try {
      const params = treatmentItemEncounterParamsSchema.parse(req.params);
      const body = treatmentItemCreateBodySchema.parse(req.body ?? {});
      const data = await WorkspaceService.createEncounterTreatmentItem({
        organisationId: params.organisationId,
        encounterId: params.encounterId,
        appointmentId: body.appointmentId ?? null,
        productId: body.productId,
        productVersion: body.productVersion ?? null,
        productSnapshot: body.productSnapshot,
        servicePackageKind: body.servicePackageKind,
        quantity: body.quantity,
        priceSnapshot: body.priceSnapshot,
        billingStatus: body.billingStatus,
        invoiceRowId: body.invoiceRowId ?? null,
        lockState: body.lockState ?? null,
      });
      return res.status(201).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateTreatmentItem(req: Request, res: Response) {
    try {
      const params = treatmentItemParamsSchema.parse(req.params);
      const body = treatmentItemBodySchema.partial().parse(req.body ?? {});
      const data = await WorkspaceService.updateTreatmentItem(
        params.itemId,
        params.organisationId,
        body,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async deleteTreatmentItem(req: Request, res: Response) {
    try {
      const params = treatmentItemParamsSchema.parse(req.params);
      await WorkspaceService.deleteTreatmentItem(
        params.itemId,
        params.organisationId,
      );
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },
};
