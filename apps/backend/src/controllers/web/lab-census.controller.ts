import { Request, Response } from "express";
import { OrgRequest } from "src/middlewares/rbac";
import logger from "src/utils/logger";
import { LabCensusService } from "src/services/lab-census.service";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { mapAxiosError } from "src/utils/external-error";

const resolveOrganisationId = (req: Request): string | undefined => {
  const orgReq = req as OrgRequest;
  return orgReq.organisationId ?? req.params.organisationId;
};

const requireOrganisationAndProvider = (
  req: Request,
  res: Response,
): { organisationId: string; provider: string } | null => {
  const organisationId = resolveOrganisationId(req);
  const provider = req.params.provider;

  if (!organisationId) {
    res.status(400).json({ message: "organisationId is required." });
    return null;
  }
  if (!provider) {
    res.status(400).json({ message: "provider is required." });
    return null;
  }

  return { organisationId, provider };
};

const requireParam = (
  req: Request,
  res: Response,
  name: string,
): string | null => {
  const value = req.params[name];
  if (!value) {
    res.status(400).json({ message: `${name} is required.` });
    return null;
  }
  return value;
};

const handleIdexxError = (
  error: unknown,
  res: Response,
  logMessage: string,
  responseMessage: string,
) => {
  const axiosError = mapAxiosError(error, "IDEXX request failed");
  if (axiosError) {
    return res
      .status(axiosError.status)
      .json({ message: axiosError.message, details: axiosError.details });
  }
  if (error instanceof LabOrderServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logMessage, error);
  return res.status(500).json({ message: responseMessage });
};

export const LabCensusController = {
  async listIvlsDevices(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;

    try {
      const data = await LabCensusService.listIvlsDevices(
        base.provider,
        base.organisationId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to list IVLS devices",
        "Failed to list IVLS devices.",
      );
    }
  },

  async listCensus(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;

    try {
      const data = await LabCensusService.listCensus(
        base.provider,
        base.organisationId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to list census",
        "Failed to list census.",
      );
    }
  },

  async deleteCensus(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;

    try {
      const data = await LabCensusService.deleteCensus(
        base.provider,
        base.organisationId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to delete census",
        "Failed to delete census.",
      );
    }
  },

  async getCensusById(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;
    const censusId = requireParam(req, res, "censusId");
    if (!censusId) return;

    try {
      const data = await LabCensusService.getCensusById(
        base.provider,
        base.organisationId,
        censusId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to fetch census by id",
        "Failed to fetch census by id.",
      );
    }
  },

  async deleteCensusById(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;
    const censusId = requireParam(req, res, "censusId");
    if (!censusId) return;

    try {
      const data = await LabCensusService.deleteCensusById(
        base.provider,
        base.organisationId,
        censusId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to delete census by id",
        "Failed to delete census by id.",
      );
    }
  },

  async getCensusPatient(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;
    const patientId = requireParam(req, res, "patientId");
    if (!patientId) return;

    try {
      const data = await LabCensusService.getCensusPatient(
        base.provider,
        base.organisationId,
        patientId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to fetch census patient",
        "Failed to fetch census patient.",
      );
    }
  },

  async addCensusPatient(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;

    try {
      const body = req.body as {
        companionId?: string;
        parentId?: string;
        veterinarian?: string;
        ivls?: Array<{ serialNumber: string }>;
      };

      const data = await LabCensusService.addCensusPatient(
        base.provider,
        base.organisationId,
        {
          companionId: body.companionId ?? "",
          parentId: body.parentId ?? undefined,
          veterinarian: body.veterinarian ?? null,
          ivls: body.ivls,
        },
      );

      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to add census patient",
        "Failed to add census patient.",
      );
    }
  },

  async deleteCensusPatient(req: Request, res: Response) {
    const base = requireOrganisationAndProvider(req, res);
    if (!base) return;
    const patientId = requireParam(req, res, "patientId");
    if (!patientId) return;

    try {
      const data = await LabCensusService.deleteCensusPatient(
        base.provider,
        base.organisationId,
        patientId,
      );
      return res.status(200).json(data);
    } catch (error) {
      return handleIdexxError(
        error,
        res,
        "Failed to delete census patient",
        "Failed to delete census patient.",
      );
    }
  },
};
