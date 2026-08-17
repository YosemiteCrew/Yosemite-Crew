import { z } from "zod";
import {
  PatientProblemService,
  PatientProblemError,
} from "src/services/patient-problem.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

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

const ProblemParamsSchema = orgParams.extend({ problemId: uuid() });

const { handler } = createClinicalHandlers(PatientProblemError);

export const PatientProblemController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list problems",
    run: ({ params, input }) =>
      PatientProblemService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create problem",
    run: ({ params, input, userId }) => {
      const { onsetDate, ...rest } = input;
      return PatientProblemService.create({
        organisationId: params.organisationId,
        recordedBy: userId,
        ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
        ...rest,
      });
    },
  }),

  get: handler({
    params: ProblemParamsSchema,
    fallback: "Failed to get problem",
    run: ({ params }) =>
      PatientProblemService.get(params.problemId, params.organisationId),
  }),

  update: handler({
    params: ProblemParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update problem",
    run: ({ params, input, userId }) => {
      const { onsetDate, resolvedDate, ...rest } = input;
      return PatientProblemService.update(
        params.problemId,
        params.organisationId,
        {
          ...rest,
          ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
          ...(resolvedDate ? { resolvedDate: new Date(resolvedDate) } : {}),
        },
        userId,
      );
    },
  }),

  resolve: handler({
    params: ProblemParamsSchema,
    body: ResolveBodySchema,
    fallback: "Failed to resolve problem",
    run: ({ params, input, userId }) =>
      PatientProblemService.resolve(
        params.problemId,
        params.organisationId,
        userId,
        input.resolvedDate ? new Date(input.resolvedDate) : undefined,
      ),
  }),
};
