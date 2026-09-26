import { Request, Response } from "express";
import { CalendarBlockTargetType } from "@prisma/client";
import { z } from "zod";
import { AuthenticatedRequest } from "src/middlewares/auth";
import {
  CalendarBlockError,
  CalendarBlockService,
} from "src/services/calendar-block.service";

const InputFieldsSchema = z.object({
  targetType: z.enum(CalendarBlockTargetType),
  targetId: z.string().trim().min(1).max(200),
  startAt: z.iso.datetime().transform((value) => new Date(value)),
  endAt: z.iso.datetime().transform((value) => new Date(value)),
  reason: z.string().trim().min(1).max(200),
});

const InputSchema = InputFieldsSchema.refine(
  (value) => value.endAt > value.startAt,
  {
    path: ["endAt"],
    message: "The end must be after the start.",
  },
);

const UpdateSchema = InputFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required." },
);

const DateRangeSchema = z.object({
  from: z.iso.datetime().transform((value) => new Date(value)),
  to: z.iso.datetime().transform((value) => new Date(value)),
});

const handleError = (error: unknown, res: Response) => {
  if (error instanceof CalendarBlockError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return res.status(500).json({ message: "Internal server error" });
};

export const CalendarBlockController = {
  list: async (req: Request, res: Response) => {
    const parsed = DateRangeSchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });
    try {
      const blocks = await CalendarBlockService.list(
        req.params.organisationId,
        parsed.data.from,
        parsed.data.to,
      );
      return res.json(blocks);
    } catch (error) {
      return handleError(error, res);
    }
  },

  create: async (req: Request, res: Response) => {
    const parsed = InputSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const block = await CalendarBlockService.create({
        organisationId: req.params.organisationId,
        ...parsed.data,
        createdBy: typeof userId === "string" ? userId : undefined,
      });
      return res.status(201).json(block);
    } catch (error) {
      return handleError(error, res);
    }
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.issues });
    try {
      return res.json(
        await CalendarBlockService.update(
          req.params.organisationId,
          req.params.blockId,
          parsed.data,
        ),
      );
    } catch (error) {
      return handleError(error, res);
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      await CalendarBlockService.delete(
        req.params.organisationId,
        req.params.blockId,
      );
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },
};
