import { Request, Response } from "express";
import { z } from "zod";
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
  issuedBy: z.string().optional(),
  validForTravel: z.boolean().optional(),
  destinationCountry: z.string().optional(),
  clinicalFindings: z.string().optional(),
  restrictions: z.string().optional(),
  notes: z.string().optional(),
});

const IssueSchema = z.object({
  issuedBy: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  clinicalFindings: z.string().optional(),
  restrictions: z.string().optional(),
  notes: z.string().optional(),
});

const RevokeSchema = z.object({
  revokedBy: z.string().min(1),
  revokedReason: z.string().optional(),
});

const handleError = (err: unknown, res: Response) => {
  if (err instanceof MedicalCertificateError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: "Internal server error" });
};

export const MedicalCertificateController = {
  async create(req: Request, res: Response) {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
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

  async get(req: Request, res: Response) {
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

  async list(req: Request, res: Response) {
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

  async issue(req: Request, res: Response) {
    const parsed = IssueSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
    try {
      const cert = await MedicalCertificateService.issue(
        req.params.certId,
        req.params.organisationId,
        {
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

  async revoke(req: Request, res: Response) {
    const parsed = RevokeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
    try {
      const cert = await MedicalCertificateService.revoke(
        req.params.certId,
        req.params.organisationId,
        parsed.data.revokedBy,
        parsed.data.revokedReason,
      );
      return res.json(cert);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async expire(req: Request, res: Response) {
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
