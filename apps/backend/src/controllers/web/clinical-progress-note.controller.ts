import type { Request, Response } from "express";
import { z } from "zod";
import {
  ClinicalProgressNoteService,
  ClinicalProgressNoteError,
} from "src/services/clinical-progress-note.service";
import type { OrgRequest } from "src/middlewares/rbac";

const NoteTypeEnum = z.enum([
  "SHIFT_NOTE",
  "PROGRESS_NOTE",
  "NURSE_NOTE",
  "SPECIALIST_NOTE",
  "DISCHARGE_SUMMARY",
  "OTHER",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
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

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  noteType: NoteTypeEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const NoteParamsSchema = z.object({
  organisationId: z.string().uuid(),
  noteId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof ClinicalProgressNoteError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const ClinicalProgressNoteController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const notes = await ClinicalProgressNoteService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(notes);
    } catch (err) {
      return handleError(err, res, "Failed to list clinical notes");
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
      const note = await ClinicalProgressNoteService.create({
        organisationId: params.data.organisationId,
        authorId: typedReq.userId ?? undefined,
        ...body.data,
      });
      return res.status(201).json(note);
    } catch (err) {
      return handleError(err, res, "Failed to create clinical note");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = NoteParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const note = await ClinicalProgressNoteService.get(
        params.data.noteId,
        params.data.organisationId,
      );
      return res.status(200).json(note);
    } catch (err) {
      return handleError(err, res, "Failed to get clinical note");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = NoteParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const note = await ClinicalProgressNoteService.update(
        params.data.noteId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(note);
    } catch (err) {
      return handleError(err, res, "Failed to update clinical note");
    }
  },

  sign: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = NoteParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const note = await ClinicalProgressNoteService.sign(
        params.data.noteId,
        params.data.organisationId,
        typedReq.userId ?? "unknown",
      );
      return res.status(200).json(note);
    } catch (err) {
      return handleError(err, res, "Failed to sign clinical note");
    }
  },
};
