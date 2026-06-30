import { Request, Response } from "express";
import { z } from "zod";
import {
  StaffShiftService,
  StaffShiftError,
} from "src/services/staff-shift.service";

const ShiftStatusEnum = z.enum([
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

const CreateSchema = z.object({
  staffId: z.string().min(1),
  role: z.string().min(1),
  shiftDate: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  breakMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
});

const UpdateSchema = z.object({
  role: z.string().min(1).optional(),
  shiftDate: z.string().datetime().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  breakMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  updatedBy: z.string().optional(),
});

const handleError = (err: unknown, res: Response) => {
  if (err instanceof StaffShiftError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: "Internal server error" });
};

export const StaffShiftController = {
  async create(req: Request, res: Response) {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
    try {
      const shift = await StaffShiftService.schedule({
        organisationId: req.params.organisationId,
        ...parsed.data,
        shiftDate: new Date(parsed.data.shiftDate),
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
      });
      return res.status(201).json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async get(req: Request, res: Response) {
    try {
      const shift = await StaffShiftService.get(
        req.params.shiftId,
        req.params.organisationId,
      );
      return res.json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async list(req: Request, res: Response) {
    const { staffId, role, status, date } = req.query as Record<
      string,
      string | undefined
    >;
    const parsedStatus = ShiftStatusEnum.safeParse(status);
    try {
      const shifts = await StaffShiftService.list({
        organisationId: req.params.organisationId,
        staffId,
        role,
        status: parsedStatus.success ? parsedStatus.data : undefined,
        date: date ? new Date(date) : undefined,
      });
      return res.json(shifts);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.errors });
    try {
      const shift = await StaffShiftService.update(
        req.params.shiftId,
        req.params.organisationId,
        {
          ...parsed.data,
          shiftDate: parsed.data.shiftDate
            ? new Date(parsed.data.shiftDate)
            : undefined,
          startTime: parsed.data.startTime
            ? new Date(parsed.data.startTime)
            : undefined,
          endTime: parsed.data.endTime
            ? new Date(parsed.data.endTime)
            : undefined,
        },
      );
      return res.json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async start(req: Request, res: Response) {
    try {
      const shift = await StaffShiftService.start(
        req.params.shiftId,
        req.params.organisationId,
      );
      return res.json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async complete(req: Request, res: Response) {
    try {
      const shift = await StaffShiftService.complete(
        req.params.shiftId,
        req.params.organisationId,
      );
      return res.json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async cancel(req: Request, res: Response) {
    const { cancelledBy } = req.body as { cancelledBy?: string };
    try {
      const shift = await StaffShiftService.cancel(
        req.params.shiftId,
        req.params.organisationId,
        cancelledBy,
      );
      return res.json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },

  async markNoShow(req: Request, res: Response) {
    try {
      const shift = await StaffShiftService.markNoShow(
        req.params.shiftId,
        req.params.organisationId,
      );
      return res.json(shift);
    } catch (err) {
      return handleError(err, res);
    }
  },
};
