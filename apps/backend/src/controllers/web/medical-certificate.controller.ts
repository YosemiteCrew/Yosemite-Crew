import { Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import {
  MedicalCertificateService,
  MedicalCertificateError,
} from "src/services/medical-certificate.service";

const CertTypeEnum = z.enum([
  "HEALTH_CERTIFICATE",
  "VACCINATION_CERTIFICATE",
  "FIT_FOR_TRAVEL",
  "EXPORT_CERTIFICATE",
  "BOARDING_CLEARANCE",
  "BREEDING_CLEARANCE",
  "OTHER",
]);

const CertStatusEnum = z.enum(["DRAFT", "ISSUED", "EXPIRED", "REVOKED"]);

const CreateSchema = z.object({
  patientId: z.string().min(1),
  clientId: z.string().min(1),
  encounterId: z.string().optional(),
  appointmentId: z.string().optional(),
  certificateType: CertTypeEnum,
  validForTravel: z.boolean().optional(),
  destinationCountry: z.string().optional(),
  clinicalFindings: z.string().optional(),
  restrictions: z.string().optional(),
  notes: z.string().optional(),
});

const IssueSchema = z.object({
  expiresAt: z.iso.datetime().optional(),
  clinicalFindings: z.string().optional(),
  restrictions: z.string().optional(),
  notes: z.string().optional(),
});

const RevokeSchema = z.object({
  revokedReason: z.string().optional(),
});

const authenticatedUserId = (req: Request): string | null => {
  const userId = (req as AuthenticatedRequest).userId?.trim();
  return userId || null;
};

const handleError = (err: unknown, res: Response) => {
  if (err instanceof MedicalCertificateError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: "Internal server error" });
};

export const MedicalCertificateController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });
    try {
      const cert = await MedicalCertificateService.create({
        organisationId: req.params.organisationId,
        ...parsed.data,
      });
      return res.status(201).json(cert);
    } catch (err) {
      return handleError(err, res);
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const cert = await MedicalCertificateService.get(
        req.params.certId,
        req.params.organisationId,
      );
      return res.json(cert);
    } catch (err) {
      return handleError(err, res);
    }
  },

  list: async (req: Request, res: Response) => {
    const { patientId, clientId, status, certificateType } =
      req.query as Record<string, string | undefined>;
    const parsedStatus = CertStatusEnum.safeParse(status);
    const parsedType = CertTypeEnum.safeParse(certificateType);
    try {
      const certs = await MedicalCertificateService.list({
        organisationId: req.params.organisationId,
        patientId,
        clientId,
        status: parsedStatus.success ? parsedStatus.data : undefined,
        certificateType: parsedType.success ? parsedType.data : undefined,
      });
      return res.json(certs);
    } catch (err) {
      return handleError(err, res);
    }
  },

  issue: async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ message: "Authentication required." });
    const parsed = IssueSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });
    try {
      const cert = await MedicalCertificateService.issue(
        req.params.certId,
        req.params.organisationId,
        {
          issuedBy: userId,
          ...parsed.data,
          expiresAt: parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : undefined,
        },
      );
      return res.json(cert);
    } catch (err) {
      return handleError(err, res);
    }
  },

  revoke: async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    if (!userId)
      return res.status(401).json({ message: "Authentication required." });
    const parsed = RevokeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });
    try {
      const cert = await MedicalCertificateService.revoke(
        req.params.certId,
        req.params.organisationId,
        userId,
        parsed.data.revokedReason,
      );
      return res.json(cert);
    } catch (err) {
      return handleError(err, res);
    }
  },

  expire: async (req: Request, res: Response) => {
    try {
      const cert = await MedicalCertificateService.expire(
        req.params.certId,
        req.params.organisationId,
      );
      return res.json(cert);
    } catch (err) {
      return handleError(err, res);
    }
  },
};
