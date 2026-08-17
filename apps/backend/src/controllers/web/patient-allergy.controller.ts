import { z } from "zod";
import {
  PatientAllergyService,
  PatientAllergyError,
} from "src/services/patient-allergy.service";
import {
  createClinicalHandlers,
  orgParams,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const AllergyTypeEnum = z.enum(["DRUG", "FOOD", "ENVIRONMENTAL", "OTHER"]);
const AllergySeverityEnum = z.enum([
  "MILD",
  "MODERATE",
  "SEVERE",
  "LIFE_THREATENING",
]);
const AllergyStatusEnum = z.enum(["ACTIVE", "RESOLVED", "UNCONFIRMED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  allergen: z.string().min(1).max(200),
  allergyType: AllergyTypeEnum,
  severity: AllergySeverityEnum,
  reaction: z.string().max(1000).optional(),
  status: AllergyStatusEnum.optional(),
  onsetDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  allergen: z.string().min(1).max(200).optional(),
  allergyType: AllergyTypeEnum.optional(),
  severity: AllergySeverityEnum.optional(),
  reaction: z.string().max(1000).optional(),
  status: AllergyStatusEnum.optional(),
  onsetDate: z.string().datetime().optional(),
  resolvedDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ResolveBodySchema = z.object({
  resolvedDate: z.string().datetime().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: AllergyStatusEnum.optional(),
  allergyType: AllergyTypeEnum.optional(),
});

const AllergyParamsSchema = orgParams.extend({ allergyId: uuid() });

const { handler } = createClinicalHandlers(PatientAllergyError);

export const PatientAllergyController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list allergies",
    run: ({ params, input }) =>
      PatientAllergyService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create allergy record",
    run: ({ params, input, userId }) => {
      const { onsetDate, ...rest } = input;
      return PatientAllergyService.create({
        organisationId: params.organisationId,
        recordedBy: userId,
        ...(onsetDate ? { onsetDate: new Date(onsetDate) } : {}),
        ...rest,
      });
    },
  }),

  get: handler({
    params: AllergyParamsSchema,
    fallback: "Failed to get allergy record",
    run: ({ params }) =>
      PatientAllergyService.get(params.allergyId, params.organisationId),
  }),

  update: handler({
    params: AllergyParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update allergy record",
    run: ({ params, input, userId }) => {
      const { onsetDate, resolvedDate, ...rest } = input;
      return PatientAllergyService.update(
        params.allergyId,
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
    params: AllergyParamsSchema,
    body: ResolveBodySchema,
    fallback: "Failed to resolve allergy record",
    run: ({ params, input, userId }) =>
      PatientAllergyService.resolve(
        params.allergyId,
        params.organisationId,
        userId,
        input.resolvedDate ? new Date(input.resolvedDate) : undefined,
      ),
  }),
};
