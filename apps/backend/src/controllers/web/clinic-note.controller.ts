import { Request, Response } from "express";
import { z } from "zod";
import {
  ClinicNoteService,
  ClinicNoteError,
} from "src/services/clinic-note.service";

const SubjectTypeEnum = z.enum(["PATIENT", "CLIENT", "APPOINTMENT"]);
const NoteTypeEnum = z.enum([
  "GENERAL",
  "BILLING",
  "COMMUNICATION",
  "FOLLOW_UP",
  "ALERT",
]);

const CreateNoteSchema = z.object({
  subjectType: SubjectTypeEnum,
  subjectId: z.string().min(1),
  noteType: NoteTypeEnum.optional(),
  content: z.string().min(1),
  isPinned: z.boolean().optional(),
  createdBy: z.string().optional(),
});

const UpdateNoteSchema = z.object({
  content: z.string().min(1).optional(),
  noteType: NoteTypeEnum.optional(),
});

const handleError = (res: Response, err: unknown) => {
  if (err instanceof ClinicNoteError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal server error." });
};

export const ClinicNoteController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const note = await ClinicNoteService.create({
        organisationId: req.params.organisationId,
        ...parsed.data,
      });
      return res.status(201).json(note);
    } catch (err) {
      return handleError(res, err);
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const note = await ClinicNoteService.get(
        req.params.noteId,
        req.params.organisationId,
      );
      return res.json(note);
    } catch (err) {
      return handleError(res, err);
    }
  },

  list: async (req: Request, res: Response) => {
    const subjectType = req.query.subjectType as string | undefined;
    const subjectId = req.query.subjectId as string | undefined;
    const noteType = req.query.noteType as string | undefined;
    const isPinnedRaw = req.query.isPinned as string | undefined;
    const isPinned =
      isPinnedRaw === "true"
        ? true
        : isPinnedRaw === "false"
          ? false
          : undefined;

    try {
      const notes = await ClinicNoteService.list({
        organisationId: req.params.organisationId,
        subjectType: subjectType as Parameters<
          typeof ClinicNoteService.list
        >[0]["subjectType"],
        subjectId,
        noteType: noteType as Parameters<
          typeof ClinicNoteService.list
        >[0]["noteType"],
        isPinned,
      });
      return res.json(notes);
    } catch (err) {
      return handleError(res, err);
    }
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const note = await ClinicNoteService.update(
        req.params.noteId,
        req.params.organisationId,
        parsed.data,
      );
      return res.json(note);
    } catch (err) {
      return handleError(res, err);
    }
  },

  pin: async (req: Request, res: Response) => {
    const pinnedBy = (req.body as { pinnedBy?: string }).pinnedBy;
    try {
      const note = await ClinicNoteService.pin(
        req.params.noteId,
        req.params.organisationId,
        pinnedBy,
      );
      return res.json(note);
    } catch (err) {
      return handleError(res, err);
    }
  },

  unpin: async (req: Request, res: Response) => {
    try {
      const note = await ClinicNoteService.unpin(
        req.params.noteId,
        req.params.organisationId,
      );
      return res.json(note);
    } catch (err) {
      return handleError(res, err);
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      await ClinicNoteService.delete(
        req.params.noteId,
        req.params.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(res, err);
    }
  },
};
