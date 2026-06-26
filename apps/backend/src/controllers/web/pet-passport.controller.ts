import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  PetPassportService,
  PetPassportServiceError,
} from "src/services/pet-passport.service";
import {
  WalletPassService,
  WalletNotConfiguredError,
} from "src/services/wallet-pass.service";
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

const TreatmentBodySchema = z.object({
  treatmentType: z.enum(["ECHINOCOCCUS", "TICK", "FLEA", "OTHER"]),
  productName: z.string().min(1).max(200),
  manufacturer: z.string().max(200).optional(),
  treatedAt: z.string().min(1),
  administeringVetName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const TitrationBodySchema = z.object({
  approvedLab: z.string().min(1).max(200),
  sampleDate: z.string().min(1),
  resultIuMl: z.number(),
  reportUrl: z.string().max(2048).optional(),
});

const IssuanceBodySchema = z.object({
  passportNumber: z.string().min(1).max(100),
  issuingCountry: z.string().max(100).optional(),
  issuingAuthority: z.string().max(200).optional(),
  issuingVetName: z.string().max(200).optional(),
  issuingVetLicense: z.string().max(100).optional(),
});

const ClinicalExamBodySchema = z.object({
  examinedAt: z.string().min(1),
  examiningVetName: z.string().max(200).optional(),
  vetLicenseNumber: z.string().max(100).optional(),
  fitForTravel: z.boolean(),
  weightKg: z.number().optional(),
  temperatureC: z.number().optional(),
  findings: z.string().max(2000).optional(),
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
  if (
    err instanceof PetPassportServiceError ||
    err instanceof WalletNotConfiguredError
  ) {
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

  recordParasiteTreatment: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = TreatmentBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const treatment = await PetPassportService.recordParasiteTreatment({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        input: body.data,
      });
      return res.status(201).json(treatment);
    } catch (err) {
      return handleError(err, res, "Parasite treatment recording failed");
    }
  },

  listParasiteTreatments: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const treatments = await PetPassportService.listParasiteTreatments(
        params.data.patientId,
        params.data.organisationId,
      );
      return res.status(200).json({ treatments });
    } catch (err) {
      return handleError(err, res, "Parasite treatment listing failed");
    }
  },

  recordRabiesTitration: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = TitrationBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const titration = await PetPassportService.recordRabiesTitration({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        input: body.data,
      });
      return res.status(201).json(titration);
    } catch (err) {
      return handleError(err, res, "Rabies titration recording failed");
    }
  },

  listRabiesTitrations: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const titrations = await PetPassportService.listRabiesTitrations(
        params.data.patientId,
        params.data.organisationId,
      );
      return res.status(200).json({ titrations });
    } catch (err) {
      return handleError(err, res, "Rabies titration listing failed");
    }
  },

  recordClinicalExam: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = ClinicalExamBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const exam = await PetPassportService.recordClinicalExam({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        input: body.data,
      });
      return res.status(201).json(exam);
    } catch (err) {
      return handleError(err, res, "Clinical exam recording failed");
    }
  },

  listClinicalExams: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const exams = await PetPassportService.listClinicalExams(
        params.data.patientId,
        params.data.organisationId,
      );
      return res.status(200).json({ exams });
    } catch (err) {
      return handleError(err, res, "Clinical exam listing failed");
    }
  },

  issuePassport: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = IssuanceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const issuance = await PetPassportService.issuePassport({
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        input: body.data,
      });
      return res.status(201).json(issuance);
    } catch (err) {
      return handleError(err, res, "Pet passport issuance failed");
    }
  },

  getPassport: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const passport = await PetPassportService.getPassport(
        params.data.patientId,
        params.data.organisationId,
      );
      return res.status(200).json(passport);
    } catch (err) {
      return handleError(err, res, "Pet passport assembly failed");
    }
  },

  getApplePass: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const passport = await PetPassportService.getPassport(
        params.data.patientId,
        params.data.organisationId,
      );
      const pkpass = await WalletPassService.buildApplePass(passport);
      const safeName =
        passport.identity.name.replaceAll(/[^a-z0-9]+/gi, "-") || "passport";
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.pkpass"`,
      );
      return res.status(200).send(pkpass);
    } catch (err) {
      return handleError(err, res, "Apple Wallet pass generation failed");
    }
  },

  getGooglePass: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const passport = await PetPassportService.getPassport(
        params.data.patientId,
        params.data.organisationId,
      );
      const saveUrl = WalletPassService.buildGoogleSaveUrl(passport);
      return res.status(200).json({ saveUrl });
    } catch (err) {
      return handleError(err, res, "Google Wallet pass generation failed");
    }
  },

  // Public, unauthenticated QR verification. No org scope on the request; a
  // uniform 404 for anything unresolved keeps the surface unprobeable.
  getPublicPassport: async (req: Request, res: Response): Promise<Response> => {
    try {
      const patientId =
        typeof req.params.patientId === "string" ? req.params.patientId : "";
      const passport = await PetPassportService.getPublicPassport(patientId);
      return res.status(200).json(passport);
    } catch (err) {
      if (err instanceof PetPassportServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Public pet passport resolve failed", err);
      return res.status(404).json({ message: "Passport not found." });
    }
  },
};
