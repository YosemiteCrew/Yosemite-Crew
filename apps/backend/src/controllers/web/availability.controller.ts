import { Request, Response } from "express";
import { AvailabilityService } from "src/services/availability.service";
import { AuthenticatedRequest } from "../../middlewares/auth";
import logger from "src/utils/logger";
import { AvailabilitySlotMongo, DayOfWeek } from "src/models/base-availability";
import { WeeklyOverrideDay } from "src/models/weekly-availablity-override";
import type { OccupancyMongo } from "src/models/occupancy";

type OrgParams = { orgId: string };

type AvailabilityBody = {
  availabilities?: {
    dayOfWeek: DayOfWeek;
    slots: AvailabilitySlotMongo[];
  }[];
};

type WeeklyOverrideBody = {
  weekStartDate?: string | number | Date;
  overrides?: WeeklyOverrideDay;
};

type WeeklyOverrideQuery = {
  weekStartDate?: string;
};

type AddOccupancyBody = {
  startTime?: string | number | Date;
  endTime?: string | number | Date;
  sourceType?: OccupancyMongo["sourceType"];
  referenceId?: string;
};

type AddAllOccupanciesBody = {
  organisationId?: string;
  userId?: string;
  occupancies?: {
    startTime: string | number | Date;
    endTime: string | number | Date;
    sourceType: OccupancyMongo["sourceType"];
    referenceId?: string;
  }[];
};

type OccupancyQuery = {
  startDate?: string;
  endDate?: string;
};

type FinalAvailabilityQuery = {
  referenceDate?: string;
};

const safeDate = (value?: string | number | Date): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const parsed =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

export const AvailabilityController = {

  /* ============================
     BASE AVAILABILITY
  ===============================*/

  async setAllBaseAvailability(
    req: Request<{ orgId: string }, unknown, {
      availabilities?: { dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] }[];
    }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { availabilities } = req.body;

      if (!orgId || !userId || !availabilities || !Array.isArray(availabilities)) {
        return res.status(400).json({ message: "Missing or invalid payload" });
      }

      const data = await AvailabilityService.setAllBaseAvailability(
        orgId,
        userId,
        availabilities
      );

      return res.status(201).json({
        message: "Base availability saved",
        data,
      });

    } catch (err: any) {
      logger.error("setAllBaseAvailability error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  async getBaseAvailability(req: Request<{ orgId: string }>, res: Response) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      if (!orgId || !userId) {
        return res.status(400).json({ message: "Missing orgId or userId" });
      }

      const data = await AvailabilityService.getBaseAvailability(orgId, userId);
      return res.status(200).json({ data });

    } catch (err: any) {
      logger.error("getBaseAvailability error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  async deleteBaseAvailability(req: Request<{ orgId: string }>, res: Response) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      if (!orgId || !userId) {
        return res.status(400).json({ message: "Missing orgId or userId" });
      }

      await AvailabilityService.deleteBaseAvailability(orgId, userId);

      return res.status(200).json({
        message: "Base availability deleted",
      });

    } catch (err: any) {
      logger.error("deleteBaseAvailability error", err);
      return res.status(500).json({ message: err.message });
    }
  },



  /* ============================
     WEEKLY OVERRIDES
  ===============================*/

  async addWeeklyAvailabilityOverride(
    req: Request<{ orgId: string }, unknown, {
      weekStartDate?: string | Date;
      overrides?: WeeklyOverrideDay;
    }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { weekStartDate, overrides } = req.body;

      if (!orgId || !userId || !weekStartDate || !overrides) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const parsedDate = safeDate(weekStartDate);
      if (!parsedDate) return res.status(400).json({ message: "Invalid date" });

      await AvailabilityService.addWeeklyAvailabilityOverride(
        orgId,
        userId,
        parsedDate,
        overrides
      );

      return res.status(201).json({ message: "Weekly override added" });

    } catch (err: any) {
      logger.error("addWeeklyAvailabilityOverride error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  async getWeeklyAvailabilityOverride(
    req: Request<{ orgId: string }, unknown, unknown, { weekStartDate?: string }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const parsed = safeDate(req.query.weekStartDate);

      if (!orgId || !userId || !parsed) {
        return res.status(400).json({ message: "Missing or invalid params" });
      }

      const data = await AvailabilityService.getWeeklyAvailabilityOverride(
        orgId,
        userId,
        parsed
      );

      if (!data) return res.status(404).json({ message: "No override found" });
      return res.status(200).json({ data });

    } catch (err: any) {
      logger.error("getWeeklyAvailabilityOverride error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  async deleteWeeklyAvailabilityOverride(
    req: Request<{ orgId: string }, unknown, unknown, { weekStartDate?: string }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const parsed = safeDate(req.query.weekStartDate);

      if (!orgId || !userId || !parsed) {
        return res.status(400).json({ message: "Missing or invalid params" });
      }

      await AvailabilityService.deleteWeeklyAvailabilityOverride(
        orgId,
        userId,
        parsed
      );

      return res.status(200).json({ message: "Override deleted" });

    } catch (err: any) {
      logger.error("deleteWeeklyAvailabilityOverride error", err);
      return res.status(500).json({ message: err.message });
    }
  },



  /* ============================
     OCCUPANCY BLOCKS
  ===============================*/

  async addOccupancy(
    req: Request<{ orgId: string }, unknown, {
      startTime?: string | Date;
      endTime?: string | Date;
      sourceType?: OccupancyMongo["sourceType"];
      referenceId?: string;
    }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { startTime, endTime, sourceType, referenceId } = req.body;

      const start = safeDate(startTime);
      const end = safeDate(endTime);

      if (!orgId || !userId || !start || !end || !sourceType) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      await AvailabilityService.addOccupancy(
        orgId,
        userId,
        start,
        end,
        sourceType,
        referenceId
      );

      return res.status(201).json({ message: "Occupancy added" });

    } catch (err: any) {
      logger.error("addOccupancy error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  /* Bulk insert blocking (surgery, off-day, etc.) */
  async addAllOccupancies(
    req: Request<unknown, unknown, {
      organisationId?: string;
      userId?: string;
      occupancies?: {
        startTime: Date | string;
        endTime: Date | string;
        sourceType: OccupancyMongo["sourceType"];
        referenceId?: string;
      }[];
    }>,
    res: Response
  ) {
    try {
      const { organisationId, userId, occupancies } = req.body;

      if (!organisationId || !userId || !Array.isArray(occupancies)) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const normalized = occupancies.map(o => ({
        startTime: safeDate(o.startTime),
        endTime: safeDate(o.endTime),
        sourceType: o.sourceType,
        referenceId: o.referenceId,
      }));

      if (normalized.some(x => !x.startTime || !x.endTime || !x.sourceType)) {
        return res.status(400).json({ message: "Invalid occupancy payload" });
      }

      await AvailabilityService.addAllOccupancies(
        organisationId,
        userId,
        normalized as any
      );

      return res.status(201).json({ message: "Occupancies added" });

    } catch (err: any) {
      logger.error("addAllOccupancies error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  async getOccupancy(
    req: Request<{ orgId: string }, unknown, unknown, { startDate?: string; endDate?: string }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      const start = safeDate(req.query.startDate);
      const end = safeDate(req.query.endDate);

      if (!orgId || !userId || !start || !end) {
        return res.status(400).json({ message: "Missing filters" });
      }

      const data = await AvailabilityService.getOccupancy(orgId, userId, start, end);
      return res.status(200).json({ data });

    } catch (err: any) {
      logger.error("getOccupancy error", err);
      return res.status(500).json({ message: err.message });
    }
  },



  /* ============================
     FINAL AVAILABILITY (READY FOR BOOKING)
  ===============================*/

  async getFinalAvailability(
    req: Request<{ orgId: string }, unknown, unknown, { referenceDate?: string }>,
    res: Response
  ) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const parsed = safeDate(req.query.referenceDate);

      if (!orgId || !userId || !parsed) {
        return res.status(400).json({ message: "Missing parameters" });
      }

      const data = await AvailabilityService.getFinalAvailabilityForDate(
        orgId,
        userId,
        parsed
      );

      return res.status(200).json({ data });

    } catch (err: any) {
      logger.error("getFinalAvailability error", err);
      return res.status(500).json({ message: err.message });
    }
  },


  async getCurrentStatus(req: Request<{ orgId: string }>, res: Response) {
    try {
      const orgId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      if (!orgId || !userId) {
        return res.status(400).json({ message: "Missing parameters" });
      }

      const status = await AvailabilityService.getCurrentStatus(orgId, userId);
      return res.status(200).json({ status });

    } catch (err: any) {
      logger.error("getCurrentStatus error", err);
      return res.status(500).json({ message: err.message });
    }
  },
};