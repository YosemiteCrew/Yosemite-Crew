import { Request, Response } from "express";
import { z } from "zod";
import type { PetPassportDTO } from "@yosemite-crew/types";
import logger from "src/utils/logger";
import {
  PetPassportService,
  PetPassportServiceError,
  type PassportActor,
} from "src/services/pet-passport.service";
import {
  WalletPassService,
  WalletNotConfiguredError,
} from "src/services/wallet-pass.service";
import {
  PetClinicalRecordService,
  PetClinicalRecordError,
  type CaptureContext,
} from "src/services/pet-clinical-records.service";
import { OrgRequest } from "src/middlewares/rbac";
import {
  createOrgErrorHandler,
  looseId,
  orgPatientParams,
  permissionsLoaded,
} from "src/controllers/web/shared/org-controller.helpers";

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
  encounterId: looseId,
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
  encounterId: looseId,
  treatmentType: z.enum(["ECHINOCOCCUS", "TICK", "FLEA", "OTHER"]),
  productName: z.string().min(1).max(200),
  manufacturer: z.string().max(200).optional(),
  treatedAt: ClinicalDateSchema,
  administeringVetName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const TitrationBodySchema = z.object({
  encounterId: looseId,
  approvedLab: z.string().min(1).max(200),
  sampleDate: ClinicalDateSchema,
  resultIuMl: z.number(),
  reportUrl: z.string().max(2048).optional(),
});

const ExamBodySchema = z.object({
  encounterId: looseId,
  examinedAt: ClinicalDateSchema,
  fitForTravel: z.boolean(),
  findings: z.string().max(2000).optional(),
  weightKg: z.number().optional(),
  temperatureC: z.number().optional(),
});

// The mobile app has no org context: the pet parent is authenticated and the
// organisation is derived from the pet's own membership.
const ParentParamsSchema = z.object({ patientId: looseId });

const RecordParamsSchema = orgPatientParams.extend({ recordId: looseId });

const AttestBodySchema = z.object({
  signatoryName: z.string().max(200).optional(),
  signatoryLicence: z.string().max(100).optional(),
});

const RevokeBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

const passFileName = (name: string): string =>
  name.replaceAll(/[^a-z0-9]+/gi, "-") || "passport";

const handleError = createOrgErrorHandler(
  PetPassportServiceError,
  PetClinicalRecordError,
  WalletNotConfiguredError,
);

type PassportHandler = (req: Request, res: Response) => Promise<Response>;

type HandlerConfig<P extends z.ZodTypeAny, B extends z.ZodTypeAny> = {
  params: P;
  /** Body schema. Handlers without one never look at `req.body`. */
  body?: B;
  /** Set when an absent body is equivalent to an empty one. */
  bodyDefaultsToEmpty?: boolean;
  /**
   * Pet-parent routes carry no organisation in the path, so they are not
   * mounted behind `withOrgPermissions` and skip that guard.
   */
  parentScope?: boolean;
  fallback: string;
  run: (ctx: {
    params: z.output<P>;
    body: z.output<B>;
    req: OrgRequest;
    res: Response;
  }) => Promise<Response>;
};

/**
 * The shell every passport handler shares: the permissions guard, route-param
 * validation (400 "Invalid route parameters"), optional body validation
 * (400 "Invalid request body") and the service-error mapping.
 */
const passportHandler =
  <P extends z.ZodTypeAny, B extends z.ZodTypeAny = z.ZodUndefined>(
    config: HandlerConfig<P, B>,
  ): PassportHandler =>
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      if (!config.parentScope && !permissionsLoaded(typedReq, res)) return res;
      const params = config.params.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }
      let body: unknown;
      if (config.body) {
        const source: unknown = config.bodyDefaultsToEmpty
          ? (req.body ?? {})
          : req.body;
        const parsed = config.body.safeParse(source);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid request body" });
        }
        body = parsed.data;
      }
      return await config.run({
        params: params.data as z.output<P>,
        body,
        req: typedReq,
        res,
      });
    } catch (err) {
      return handleError(err, res, config.fallback);
    }
  };

const pmsActor = (req: OrgRequest): PassportActor => ({
  type: "PMS_USER",
  id: req.userId ?? null,
});

/** Capture context shared by the four clinical-record recording handlers. */
const captureContext = (
  params: z.output<typeof orgPatientParams>,
  encounterId: string,
  req: OrgRequest,
): CaptureContext => ({
  patientId: params.patientId,
  organisationId: params.organisationId,
  encounterId,
  actor: pmsActor(req),
});

/** Arguments shared by the signature-request and attestation handlers. */
const attestationParams = (
  params: z.output<typeof RecordParamsSchema>,
  body: z.output<typeof AttestBodySchema>,
  req: OrgRequest,
) => ({
  artifactId: params.recordId,
  patientId: params.patientId,
  organisationId: params.organisationId,
  actor: pmsActor(req),
  signatoryName: body.signatoryName,
  signatoryLicence: body.signatoryLicence,
});

const orgPassport = (
  params: z.output<typeof orgPatientParams>,
): Promise<PetPassportDTO> =>
  PetPassportService.getPassport(params.patientId, params.organisationId);

const parentPassport = (
  params: z.output<typeof ParentParamsSchema>,
  req: OrgRequest,
): Promise<PetPassportDTO> =>
  PetPassportService.getPassportForParent(params.patientId, req.userId ?? null);

/** Streams a signed .pkpass for an already-assembled passport. */
const applePassResponse = async (
  passport: PetPassportDTO,
  patientId: string,
  res: Response,
): Promise<Response> => {
  const shareToken = await PetPassportService.ensurePublicToken(patientId);
  const pkpass = await WalletPassService.buildApplePass(passport, shareToken);
  res.setHeader("Content-Type", "application/vnd.apple.pkpass");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${passFileName(passport.identity.name)}.pkpass"`,
  );
  return res.status(200).send(pkpass);
};

/** Answers with the Google Wallet save link for an assembled passport. */
const googlePassResponse = async (
  passport: PetPassportDTO,
  patientId: string,
  res: Response,
): Promise<Response> => {
  const shareToken = await PetPassportService.ensurePublicToken(patientId);
  const saveUrl = WalletPassService.buildGoogleSaveUrl(passport, shareToken);
  return res.status(200).json({ saveUrl });
};

export const PetPassportController = {
  recordImmunization: passportHandler({
    params: orgPatientParams,
    body: ImmunizationBodySchema,
    fallback: "Immunization recording failed",
    run: async ({ params, body, req, res }) => {
      const { encounterId, ...input } = body;
      const record = await PetClinicalRecordService.recordImmunization(
        captureContext(params, encounterId, req),
        input,
      );
      return res.status(201).json(record);
    },
  }),

  recordParasiteTreatment: passportHandler({
    params: orgPatientParams,
    body: TreatmentBodySchema,
    fallback: "Parasite treatment recording failed",
    run: async ({ params, body, req, res }) => {
      const { encounterId, ...input } = body;
      const record = await PetClinicalRecordService.recordParasiteTreatment(
        captureContext(params, encounterId, req),
        input,
      );
      return res.status(201).json(record);
    },
  }),

  recordRabiesTitration: passportHandler({
    params: orgPatientParams,
    body: TitrationBodySchema,
    fallback: "Rabies titration recording failed",
    run: async ({ params, body, req, res }) => {
      const { encounterId, ...input } = body;
      const record = await PetClinicalRecordService.recordRabiesTitration(
        captureContext(params, encounterId, req),
        input,
      );
      return res.status(201).json(record);
    },
  }),

  recordClinicalExam: passportHandler({
    params: orgPatientParams,
    body: ExamBodySchema,
    fallback: "Clinical exam recording failed",
    run: async ({ params, body, req, res }) => {
      const { encounterId, ...input } = body;
      const record = await PetClinicalRecordService.recordClinicalExam(
        captureContext(params, encounterId, req),
        input,
      );
      return res.status(201).json(record);
    },
  }),

  signRecord: passportHandler({
    params: RecordParamsSchema,
    body: AttestBodySchema,
    bodyDefaultsToEmpty: true,
    fallback: "Clinical record signature request failed",
    run: async ({ params, body, req, res }) => {
      const result = await PetClinicalRecordService.requestRecordSignature(
        attestationParams(params, body, req),
      );
      return res.status(202).json(result);
    },
  }),

  attestRecord: passportHandler({
    params: RecordParamsSchema,
    body: AttestBodySchema,
    bodyDefaultsToEmpty: true,
    fallback: "Clinical record attestation failed",
    run: async ({ params, body, req, res }) => {
      const result = await PetClinicalRecordService.attestRecord(
        attestationParams(params, body, req),
      );
      return res.status(200).json(result);
    },
  }),

  revokeRecord: passportHandler({
    params: RecordParamsSchema,
    body: RevokeBodySchema,
    bodyDefaultsToEmpty: true,
    fallback: "Clinical record revocation failed",
    run: async ({ params, body, res }) => {
      const result = await PetClinicalRecordService.revokeRecord({
        artifactId: params.recordId,
        organisationId: params.organisationId,
        reason: body.reason,
      });
      return res.status(200).json(result);
    },
  }),

  issuePassport: passportHandler({
    params: orgPatientParams,
    body: IssuanceBodySchema,
    fallback: "Pet passport issuance failed",
    run: async ({ params, body, req, res }) => {
      const issuance = await PetPassportService.issuePassport({
        patientId: params.patientId,
        organisationId: params.organisationId,
        actor: pmsActor(req),
        input: body,
      });
      return res.status(201).json(issuance);
    },
  }),

  getPassport: passportHandler({
    params: orgPatientParams,
    fallback: "Pet passport assembly failed",
    run: async ({ params, res }) => {
      const passport = await orgPassport(params);
      return res.status(200).json(passport);
    },
  }),

  getApplePass: passportHandler({
    params: orgPatientParams,
    fallback: "Apple Wallet pass generation failed",
    run: async ({ params, res }) =>
      applePassResponse(await orgPassport(params), params.patientId, res),
  }),

  getGooglePass: passportHandler({
    params: orgPatientParams,
    fallback: "Google Wallet pass generation failed",
    run: async ({ params, res }) =>
      googlePassResponse(await orgPassport(params), params.patientId, res),
  }),

  /**
   * Pet-parent (mobile) surface: the passport plus its two wallet passes.
   *
   * Authenticated as the owner rather than gated by a share token, so the app
   * never has to store a bearer credential. No org in the path - the service
   * derives it from the pet's own membership after proving parentage.
   */
  getPassportForParent: passportHandler({
    params: ParentParamsSchema,
    parentScope: true,
    fallback: "Pet passport read failed",
    run: async ({ params, req, res }) => {
      const passport = await parentPassport(params, req);
      return res.status(200).json(passport);
    },
  }),

  getApplePassForParent: passportHandler({
    params: ParentParamsSchema,
    parentScope: true,
    fallback: "Apple Wallet pass generation failed",
    run: async ({ params, req, res }) =>
      applePassResponse(
        await parentPassport(params, req),
        params.patientId,
        res,
      ),
  }),

  getGooglePassForParent: passportHandler({
    params: ParentParamsSchema,
    parentScope: true,
    fallback: "Google Wallet pass generation failed",
    run: async ({ params, req, res }) =>
      googlePassResponse(
        await parentPassport(params, req),
        params.patientId,
        res,
      ),
  }),

  /** Owner-only: kills the circulating public link for the pet's passport. */
  revokePublicToken: passportHandler({
    params: ParentParamsSchema,
    parentScope: true,
    fallback: "Passport share link revoke failed",
    run: async ({ params, req, res }) => {
      const result = await PetPassportService.revokePublicToken({
        patientId: params.patientId,
        userId: req.userId ?? null,
      });
      return res.status(200).json(result);
    },
  }),

  // Public, unauthenticated QR verification. No org scope on the request; a
  // uniform 404 for anything unresolved keeps the surface unprobeable.
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
