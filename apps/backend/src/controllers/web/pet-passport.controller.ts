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
import {
  PetClinicalRecordService,
  PetClinicalRecordError,
} from "src/services/pet-clinical-records.service";
import { OrgRequest } from "src/middlewares/rbac";
import {
  createOrgErrorHandler,
  permissionsLoaded,
} from "src/controllers/web/shared/org-controller.helpers";

// Ids may be Mongo ObjectIds or Postgres UUIDs (dual-write), so validate
// leniently and let the data lookup decide existence.
const IdSchema = z.string().min(1).max(64);

const ParamsSchema = z.object({
  organisationId: IdSchema,
  patientId: IdSchema,
});

const IssuanceBodySchema = z.object({
  passportNumber: z.string().min(1).max(100),
  issuingCountry: z.string().max(100).optional(),
  issuingAuthority: z.string().max(200).optional(),
  issuingVetName: z.string().max(200).optional(),
  issuingVetLicense: z.string().max(100).optional(),
});

// Clinical dates end up on a travel health document, so only an unambiguous
// ISO-8601 calendar date ("2026-02-14") or full ISO-8601 datetime is accepted.
// The refinement re-checks the parsed value because JavaScript's Date rolls
// impossible days over silently ("2026-02-30" would become 2 March).
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const roundTripsToSameDay = (value: string): boolean => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  if (!ISO_DATE_ONLY_PATTERN.test(value)) return true;
  return parsed.toISOString().startsWith(value);
};

const ClinicalDateSchema = z
  .union([z.string().date(), z.string().datetime({ offset: true })])
  .refine(roundTripsToSameDay, {
    message: "Must be a real ISO-8601 date or datetime",
  });

// Clinical-record capture: each record is hung off the appointment's encounter,
// so encounterId is required in the body.
const ImmunizationBodySchema = z.object({
  encounterId: IdSchema,
  vaccineType: z.enum(["RABIES", "CORE", "NON_CORE", "OTHER"]),
  vaccineName: z.string().min(1).max(200),
  manufacturer: z.string().max(200).optional(),
  batchNumber: z.string().max(100).optional(),
  lotNumber: z.string().max(100).optional(),
  dateAdministered: ClinicalDateSchema,
  validFrom: ClinicalDateSchema.optional(),
  validUntil: ClinicalDateSchema.optional(),
  nextDueDate: ClinicalDateSchema.optional(),
  administeringVetName: z.string().max(200).optional(),
  vetLicenseNumber: z.string().max(100).optional(),
  site: z.string().max(200).optional(),
  route: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const TreatmentBodySchema = z.object({
  encounterId: IdSchema,
  treatmentType: z.enum(["ECHINOCOCCUS", "TICK", "FLEA", "OTHER"]),
  productName: z.string().min(1).max(200),
  manufacturer: z.string().max(200).optional(),
  treatedAt: ClinicalDateSchema,
  administeringVetName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const TitrationBodySchema = z.object({
  encounterId: IdSchema,
  approvedLab: z.string().min(1).max(200),
  sampleDate: ClinicalDateSchema,
  resultIuMl: z.number(),
  reportUrl: z.string().max(2048).optional(),
});

const ExamBodySchema = z.object({
  encounterId: IdSchema,
  examinedAt: ClinicalDateSchema,
  fitForTravel: z.boolean(),
  findings: z.string().max(2000).optional(),
  weightKg: z.number().optional(),
  temperatureC: z.number().optional(),
});

// The mobile app has no org context: the pet parent is authenticated and the
// organisation is derived from the pet's own membership.
const ParentParamsSchema = z.object({ patientId: IdSchema });

const passFileName = (name: string): string =>
  name.replaceAll(/[^a-z0-9]+/gi, "-") || "passport";

const RecordParamsSchema = ParamsSchema.extend({ recordId: IdSchema });

const AttestBodySchema = z.object({
  signatoryName: z.string().max(200).optional(),
  signatoryLicence: z.string().max(100).optional(),
});

const RevokeBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

const handleError = createOrgErrorHandler(
  PetPassportServiceError,
  PetClinicalRecordError,
  WalletNotConfiguredError,
);
export const PetPassportController = {
  recordImmunization: async (
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
      const body = ImmunizationBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const { encounterId, ...input } = body.data;
      const record = await PetClinicalRecordService.recordImmunization(
        {
          patientId: params.data.patientId,
          organisationId: params.data.organisationId,
          encounterId,
          actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        },
        input,
      );
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Immunization recording failed");
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
      const { encounterId, ...input } = body.data;
      const record = await PetClinicalRecordService.recordParasiteTreatment(
        {
          patientId: params.data.patientId,
          organisationId: params.data.organisationId,
          encounterId,
          actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        },
        input,
      );
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Parasite treatment recording failed");
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
      const { encounterId, ...input } = body.data;
      const record = await PetClinicalRecordService.recordRabiesTitration(
        {
          patientId: params.data.patientId,
          organisationId: params.data.organisationId,
          encounterId,
          actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        },
        input,
      );
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Rabies titration recording failed");
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
      const body = ExamBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const { encounterId, ...input } = body.data;
      const record = await PetClinicalRecordService.recordClinicalExam(
        {
          patientId: params.data.patientId,
          organisationId: params.data.organisationId,
          encounterId,
          actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        },
        input,
      );
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Clinical exam recording failed");
    }
  },

  signRecord: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = AttestBodySchema.safeParse(req.body ?? {});
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const result = await PetClinicalRecordService.requestRecordSignature({
        artifactId: params.data.recordId,
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        signatoryName: body.data.signatoryName,
        signatoryLicence: body.data.signatoryLicence,
      });
      return res.status(202).json(result);
    } catch (err) {
      return handleError(err, res, "Clinical record signature request failed");
    }
  },

  attestRecord: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = AttestBodySchema.safeParse(req.body ?? {});
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const result = await PetClinicalRecordService.attestRecord({
        artifactId: params.data.recordId,
        patientId: params.data.patientId,
        organisationId: params.data.organisationId,
        actor: { type: "PMS_USER", id: typedReq.userId ?? null },
        signatoryName: body.data.signatoryName,
        signatoryLicence: body.data.signatoryLicence,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res, "Clinical record attestation failed");
    }
  },

  revokeRecord: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!permissionsLoaded(typedReq, res)) return res;
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const body = RevokeBodySchema.safeParse(req.body ?? {});
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      const result = await PetClinicalRecordService.revokeRecord({
        artifactId: params.data.recordId,
        organisationId: params.data.organisationId,
        reason: body.data.reason,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res, "Clinical record revocation failed");
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
      const shareToken = await PetPassportService.ensurePublicToken(
        params.data.patientId,
      );
      const pkpass = await WalletPassService.buildApplePass(
        passport,
        shareToken,
      );
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
      const shareToken = await PetPassportService.ensurePublicToken(
        params.data.patientId,
      );
      const saveUrl = WalletPassService.buildGoogleSaveUrl(
        passport,
        shareToken,
      );
      return res.status(200).json({ saveUrl });
    } catch (err) {
      return handleError(err, res, "Google Wallet pass generation failed");
    }
  },

  // Public, unauthenticated QR verification. No org scope on the request; a
  // uniform 404 for anything unresolved keeps the surface unprobeable.
  /**
   * Pet-parent (mobile) surface: the passport plus its two wallet passes.
   *
   * Authenticated as the owner rather than gated by a share token, so the app
   * never has to store a bearer credential. No org in the path - the service
   * derives it from the pet's own membership after proving parentage.
   */
  getPassportForParent: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ParentParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const passport = await PetPassportService.getPassportForParent(
        params.data.patientId,
        typedReq.userId ?? null,
      );
      return res.status(200).json(passport);
    } catch (err) {
      return handleError(err, res, "Pet passport read failed");
    }
  },

  getApplePassForParent: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ParentParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const passport = await PetPassportService.getPassportForParent(
        params.data.patientId,
        typedReq.userId ?? null,
      );
      const shareToken = await PetPassportService.ensurePublicToken(
        params.data.patientId,
      );
      const pkpass = await WalletPassService.buildApplePass(
        passport,
        shareToken,
      );
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${passFileName(passport.identity.name)}.pkpass"`,
      );
      return res.status(200).send(pkpass);
    } catch (err) {
      return handleError(err, res, "Apple Wallet pass generation failed");
    }
  },

  getGooglePassForParent: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ParentParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const passport = await PetPassportService.getPassportForParent(
        params.data.patientId,
        typedReq.userId ?? null,
      );
      const shareToken = await PetPassportService.ensurePublicToken(
        params.data.patientId,
      );
      const saveUrl = WalletPassService.buildGoogleSaveUrl(
        passport,
        shareToken,
      );
      return res.status(200).json({ saveUrl });
    } catch (err) {
      return handleError(err, res, "Google Wallet pass generation failed");
    }
  },

  /** Owner-only: kills the circulating public link for the pet's passport. */
  revokePublicToken: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ParentParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      const result = await PetPassportService.revokePublicToken({
        patientId: params.data.patientId,
        userId: typedReq.userId ?? null,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res, "Passport share link revoke failed");
    }
  },

  getPublicPassportByToken: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const token =
        typeof req.params.token === "string" ? req.params.token : "";
      const passport = await PetPassportService.getPublicPassportByToken(token);
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
