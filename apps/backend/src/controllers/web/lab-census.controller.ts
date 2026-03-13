import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import { LabCensusService } from "src/services/lab-census.service";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { mapAxiosError } from "src/utils/external-error";

export const LabCensusController = {
  async listIvlsDevices(req: Request, res: Response) {
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

      const data = await LabCensusService.listIvlsDevices(
        provider,
        organisationId,
      );
      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list IVLS devices", error);
      return res
        .status(500)
        .json({ message: "Failed to list IVLS devices." });
    }
  },

  async listCensus(req: Request, res: Response) {
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

      const data = await LabCensusService.listCensus(provider, organisationId);
      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list census", error);
      return res.status(500).json({ message: "Failed to list census." });
    }
  },

  async deleteCensus(req: Request, res: Response) {
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

      const data = await LabCensusService.deleteCensus(
        provider,
        organisationId,
      );
      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to delete census", error);
      return res.status(500).json({ message: "Failed to delete census." });
    }
  },

  async getCensusById(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const censusId = req.params.censusId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!censusId) {
        return res.status(400).json({ message: "censusId is required." });
      }

      const data = await LabCensusService.getCensusById(
        provider,
        organisationId,
        censusId,
      );
      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to fetch census by id", error);
      return res.status(500).json({ message: "Failed to fetch census by id." });
    }
  },

  async deleteCensusById(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const censusId = req.params.censusId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!censusId) {
        return res.status(400).json({ message: "censusId is required." });
      }

      const data = await LabCensusService.deleteCensusById(
        provider,
        organisationId,
        censusId,
      );
      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to delete census by id", error);
      return res
        .status(500)
        .json({ message: "Failed to delete census by id." });
    }
  },

  async getCensusPatient(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const patientId = req.params.patientId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!patientId) {
        return res.status(400).json({ message: "patientId is required." });
      }

      const data = await LabCensusService.getCensusPatient(
        provider,
        organisationId,
        patientId,
      );
      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to fetch census patient", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch census patient." });
    }
  },

  async addCensusPatient(req: Request, res: Response) {
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

      const body = req.body as {
        companionId?: string;
        parentId?: string;
        veterinarian?: string;
        ivls?: Array<{ serialNumber: string }>;
      };

      const data = await LabCensusService.addCensusPatient(provider, organisationId, {
        companionId: body.companionId ?? "",
        parentId: body.parentId ?? undefined,
        veterinarian: body.veterinarian ?? null,
        ivls: body.ivls,
      });

      return res.status(200).json(data);
    } catch (error) {
      const axiosError = mapAxiosError(error, "IDEXX request failed");
      if (axiosError) {
        return res
          .status(axiosError.status)
          .json({ message: axiosError.message, details: axiosError.details });
      }
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to add census patient", error);
      return res
        .status(500)
        .json({ message: "Failed to add census patient." });
    }
  },

  async deleteCensusPatient(req: Request, res: Response) {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = orgReq.organisationId ?? req.params.organisationId;
      const provider = req.params.provider;
      const patientId = req.params.patientId;

      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!provider) {
        return res.status(400).json({ message: "provider is required." });
      }
      if (!patientId) {
        return res.status(400).json({ message: "patientId is required." });
      }

      const data = await LabCensusService.deleteCensusPatient(
        provider,
        organisationId,
        patientId,
      );
      return res.status(200).json(data);
    } catch (error) {
      if (error instanceof LabOrderServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to delete census patient", error);
      return res
        .status(500)
        .json({ message: "Failed to delete census patient." });
    }
  },
};
