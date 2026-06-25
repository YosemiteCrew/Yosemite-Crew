import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  PetPassportService,
  PetPassportServiceError,
} from "src/services/pet-passport.service";
import { OrgRequest } from "src/middlewares/rbac";

// Ids may be Mongo ObjectIds or Postgres UUIDs (dual-write), so validate
// leniently and let the data lookup decide existence.
const IdSchema = z.string().min(1).max(64);

const ParamsSchema = z.object({
  organisationId: IdSchema,
  patientId: IdSchema,
});

const VaccinationBodySchema = z.object({
  vaccineType: z.enum(["RABIES", "CORE", "NON_CORE", "OTHER"]),
  vaccineName: z.string().min(1).max(200),
  manufacturer: z.string().max(200).optional(),
  batchNumber: z.string().max(100).optional(),
  lotNumber: z.string().max(100).optional(),
  dateAdministered: z.string().min(1),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  nextDueDate: z.string().optional(),
  administeringVetName: z.string().max(200).optional(),
  vetLicenseNumber: z.string().max(100).optional(),
  site: z.string().max(200).optional(),
  route: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const permissionsLoaded = (req: OrgRequest, res: Response): boolean => {
  if (req.userPermissions) return true;
  res.status(500).json({
    message:
      "Permissions not loaded. Include withOrgPermissions before handler.",
  });
  return false;
};

const handleError = (
  err: unknown,
  res: Response,
  context: string,
): Response => {
  if (err instanceof PetPassportServiceError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  logger.error(context, err);
  return res.status(500).json({ message: "Internal Server Error" });
};

export const PetPassportController = {
  recordVaccination: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = VaccinationBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const vaccination = await PetPassportService.recordVaccination({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        input: body.data,
      });
      return res.status(201).json(vaccination);
    } catch (err) {
      return handleError(err, res, "Vaccination recording failed");
    }
  },

  listVaccinations: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const vaccinations = await PetPassportService.listVaccinations(
        params.data.patientId,
        params.data.organisationId,
      );
      return res.status(200).json({ vaccinations });
    } catch (err) {
      return handleError(err, res, "Vaccination listing failed");
    }
  },
};
