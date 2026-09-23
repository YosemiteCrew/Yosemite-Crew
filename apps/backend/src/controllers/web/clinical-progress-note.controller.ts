import { z } from "zod";
import {
  ClinicalProgressNoteService,
  ClinicalProgressNoteError,
} from "src/services/clinical-progress-note.service";
import {
  createClinicalHandlers,
  orgParams,
  patientScopeQuery,
  uuid,
} from "src/controllers/web/shared/clinical-controller.helpers";

const NoteTypeEnum = z.enum([
  "SHIFT_NOTE",
  "PROGRESS_NOTE",
  "NURSE_NOTE",
  "SPECIALIST_NOTE",
  "DISCHARGE_SUMMARY",
  "OTHER",
]);

const CreateBodySchema = z.object({
  patientId: z.uuid(),
  encounterId: z.uuid().optional(),
  noteType: NoteTypeEnum,
  subjectiveFindings: z.string().max(10000).optional(),
  objectiveFindings: z.string().max(10000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  freeText: z.string().max(20000).optional(),
  authorName: z.string().max(300).optional(),
});

const UpdateBodySchema = z.object({
  subjectiveFindings: z.string().max(10000).optional(),
  objectiveFindings: z.string().max(10000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  freeText: z.string().max(20000).optional(),
});

const ListQuerySchema = patientScopeQuery.extend({
  noteType: NoteTypeEnum.optional(),
});

const NoteParamsSchema = orgParams.extend({ noteId: uuid() });

const { handler } = createClinicalHandlers(ClinicalProgressNoteError);

export const ClinicalProgressNoteController = {
  list: handler({
    params: orgParams,
    query: ListQuerySchema,
    fallback: "Failed to list clinical notes",
    run: ({ params, input }) =>
      ClinicalProgressNoteService.list({
        organisationId: params.organisationId,
        ...input,
      }),
  }),

  create: handler({
    params: orgParams,
    body: CreateBodySchema,
    status: 201,
    fallback: "Failed to create clinical note",
    run: ({ params, input, userId }) =>
      ClinicalProgressNoteService.create({
        organisationId: params.organisationId,
        authorId: userId,
        ...input,
      }),
  }),

  get: handler({
    params: NoteParamsSchema,
    fallback: "Failed to get clinical note",
    run: ({ params }) =>
      ClinicalProgressNoteService.get(params.noteId, params.organisationId),
  }),

  update: handler({
    params: NoteParamsSchema,
    body: UpdateBodySchema,
    fallback: "Failed to update clinical note",
    run: ({ params, input }) =>
      ClinicalProgressNoteService.update(
        params.noteId,
        params.organisationId,
        input,
      ),
  }),

  sign: handler({
    params: NoteParamsSchema,
    fallback: "Failed to sign clinical note",
    run: ({ params, userId }) =>
      ClinicalProgressNoteService.sign(
        params.noteId,
        params.organisationId,
        userId ?? "unknown",
      ),
  }),
};
