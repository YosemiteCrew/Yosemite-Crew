import type { Request, Response } from "express";
import { z } from "zod";
import { SOAPNoteService, SOAPNoteError } from "src/services/soap-note.service";
import type { OrgRequest } from "src/middlewares/rbac";

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  noteDate: z.string().datetime(),
  subjective: z.string().max(10000).optional(),
  objective: z.string().max(10000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
});

const UpdateBodySchema = z.object({
  subjective: z.string().max(10000).optional(),
  objective: z.string().max(10000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
});

const AmendBodySchema = z.object({
  subjective: z.string().max(10000).optional(),
  objective: z.string().max(10000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  amendedReason: z.string().min(1).max(1000),
});

const SignBodySchema = z.object({
  signedBy: z.string().max(200),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  authorId: z.string().optional(),
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
  if (err instanceof SOAPNoteError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const SOAPNoteController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await SOAPNoteService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list SOAP notes");
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
      const { noteDate, ...rest } = body.data;
      const record = await SOAPNoteService.create({
        organisationId: params.data.organisationId,
        authorId: typedReq.userId ?? undefined,
        ...rest,
        noteDate: new Date(noteDate),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create SOAP note");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = NoteParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await SOAPNoteService.get(
        params.data.noteId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get SOAP note");
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
      const record = await SOAPNoteService.update(
        params.data.noteId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update SOAP note");
    }
  },

  sign: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = NoteParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = SignBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const signedBy = body.data.signedBy || (typedReq.userId ?? "");
      const record = await SOAPNoteService.sign(
        params.data.noteId,
        params.data.organisationId,
        signedBy,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to sign SOAP note");
    }
  },

  amend: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = NoteParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = AmendBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await SOAPNoteService.amend(
        params.data.noteId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to amend SOAP note");
    }
  },
};
