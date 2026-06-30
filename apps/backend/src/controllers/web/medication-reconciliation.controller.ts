import type { Request, Response } from "express";
import { z } from "zod";
import {
  MedicationReconciliationService,
  MedicationReconciliationError,
} from "src/services/medication-reconciliation.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ReconciliationStatusEnum = z.enum([
  "IN_PROGRESS",
  "COMPLETED",
  "PENDING_REVIEW",
]);

const HomeMedSchema = z.object({
  name: z.string().min(1).max(500),
  dose: z.string().max(200).optional(),
  frequency: z.string().max(200).optional(),
  route: z.string().max(200).optional(),
});

const HospitalOrderSchema = z.object({
  name: z.string().min(1).max(500),
  dose: z.string().max(200).optional(),
  frequency: z.string().max(200).optional(),
  route: z.string().max(200).optional(),
  orderedBy: z.string().max(300).optional(),
});

const DiscrepancySchema = z.object({
  type: z.enum([
    "OMITTED",
    "ADDED",
    "CHANGED_DOSE",
    "CHANGED_FREQUENCY",
    "CHANGED_ROUTE",
    "DUPLICATE",
    "CONTRAINDICATED",
  ]),
  medication: z.string().min(1).max(500),
  comment: z.string().max(1000).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  homeMedications: z.array(HomeMedSchema),
  hospitalOrders: z.array(HospitalOrderSchema),
  discrepancies: z.array(DiscrepancySchema).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  homeMedications: z.array(HomeMedSchema).optional(),
  hospitalOrders: z.array(HospitalOrderSchema).optional(),
  discrepancies: z.array(DiscrepancySchema).optional(),
  notes: z.string().max(2000).optional(),
});

const CompleteBodySchema = z.object({
  discrepancies: z.array(DiscrepancySchema).optional(),
});

const ReviewBodySchema = z.object({
  reviewNotes: z.string().max(3000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: ReconciliationStatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const MedRecParamsSchema = z.object({
  organisationId: z.string().uuid(),
  medRecId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof MedicationReconciliationError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const MedicationReconciliationController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await MedicationReconciliationService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list medication reconciliations");
    }
  },

  create: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CreateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await MedicationReconciliationService.create({
        organisationId: params.data.organisationId,
        reconciledBy: typedReq.userId ?? undefined,
        ...body.data,
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to create medication reconciliation",
      );
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = MedRecParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await MedicationReconciliationService.get(
        params.data.medRecId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get medication reconciliation");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = MedRecParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await MedicationReconciliationService.update(
        params.data.medRecId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to update medication reconciliation",
      );
    }
  },

  complete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = MedRecParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CompleteBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await MedicationReconciliationService.complete(
        params.data.medRecId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to complete medication reconciliation",
      );
    }
  },

  review: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = MedRecParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ReviewBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await MedicationReconciliationService.review(
        params.data.medRecId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? "unknown",
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to review medication reconciliation",
      );
    }
  },
};
