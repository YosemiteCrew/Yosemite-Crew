import type { Request, Response } from "express";
import { z } from "zod";
import {
  PatientProblemService,
  PatientProblemError,
} from "src/services/patient-problem.service";
import type { OrgRequest } from "src/middlewares/rbac";

const StatusEnum = z.enum(["ACTIVE", "INACTIVE", "RESOLVED"]);
const SeverityEnum = z.enum(["MILD", "MODERATE", "SEVERE"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().optional(),
  name: z.string().min(1).max(300),
  codeSystem: z.string().max(50).optional(),
  code: z.string().max(50).optional(),
  severity: SeverityEnum.optional(),
  onsetDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(300).optional(),
  codeSystem: z.string().max(50).optional(),
  code: z.string().max(50).optional(),
  status: StatusEnum.optional(),
  severity: SeverityEnum.optional(),
  onsetDate: z.string().datetime().optional(),
  resolvedDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ResolveBodySchema = z.object({
  resolvedDate: z.string().datetime().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ProblemParamsSchema = z.object({
  organisationId: z.string().uuid(),
  problemId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PatientProblemError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PatientProblemController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const problems = await PatientProblemService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(problems);
    } catch (err) {
      return handleError(err, res, "Failed to list problems");
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
      const { onsetDate, ...rest } = body.data;
      const problem = await PatientProblemService.create({
        organisationId: params.data.organisationId,
        recordedBy: typedReq.userId ?? undefined,
        ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
        ...rest,
      });
      return res.status(201).json(problem);
    } catch (err) {
      return handleError(err, res, "Failed to create problem");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ProblemParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const problem = await PatientProblemService.get(
        params.data.problemId,
        params.data.organisationId,
      );
      return res.status(200).json(problem);
    } catch (err) {
      return handleError(err, res, "Failed to get problem");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ProblemParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { onsetDate, resolvedDate, ...rest } = body.data;
      const problem = await PatientProblemService.update(
        params.data.problemId,
        params.data.organisationId,
        {
          ...rest,
          ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
          ...(resolvedDate ? { resolvedDate: new Date(resolvedDate) } : {}),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(problem);
    } catch (err) {
      return handleError(err, res, "Failed to update problem");
    }
  },

  resolve: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ProblemParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ResolveBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const problem = await PatientProblemService.resolve(
        params.data.problemId,
        params.data.organisationId,
        typedReq.userId ?? undefined,
        body.data.resolvedDate ? new Date(body.data.resolvedDate) : undefined,
      );
      return res.status(200).json(problem);
    } catch (err) {
      return handleError(err, res, "Failed to resolve problem");
    }
  },
};
