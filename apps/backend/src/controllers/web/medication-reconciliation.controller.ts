import { z } from "zod";
import {
  MedicationReconciliationService,
  MedicationReconciliationError,
} from "src/services/medication-reconciliation.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

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

const ListQuerySchema = patientScopeQuery.extend({
  status: ReconciliationStatusEnum.optional(),
});

const MedRecParamsSchema = orgParams.extend({ medRecId: uuid() });

const { handler } = createClinicalHandlers(MedicationReconciliationError);

export const MedicationReconciliationController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list medication reconciliations",
    run: ({ params, input }) =>
      MedicationReconciliationService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create medication reconciliation",
    run: ({ params, input, userId }) =>
      MedicationReconciliationService.create({
        organisationId: params.organisationId,
        reconciledBy: userId,
        ...input,
      }),
  }),

  get: handler({
    params: MedRecParamsSchema,
    fallback: "Failed to get medication reconciliation",
    run: ({ params }) =>
      MedicationReconciliationService.get(
        params.medRecId,
        params.organisationId,
      ),
  }),

  update: handler({
    params: MedRecParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update medication reconciliation",
    run: ({ params, input }) =>
      MedicationReconciliationService.update(
        params.medRecId,
        params.organisationId,
        input,
      ),
  }),

  complete: handler({
    params: MedRecParamsSchema,
    body: CompleteBodySchema,
    fallback: "Failed to complete medication reconciliation",
    run: ({ params, input, userId }) =>
      MedicationReconciliationService.complete(
        params.medRecId,
        params.organisationId,
        input,
        userId,
      ),
  }),

  review: handler({
    params: MedRecParamsSchema,
    body: ReviewBodySchema,
    fallback: "Failed to review medication reconciliation",
    run: ({ params, input, userId }) =>
      MedicationReconciliationService.review(
        params.medRecId,
        params.organisationId,
        input,
        userId ?? "unknown",
      ),
  }),
};
