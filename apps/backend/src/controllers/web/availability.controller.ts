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
  // Controllers for Base Availability

  async setAllBaseAvailability(
    req: Request<OrgParams, unknown, AvailabilityBody>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { availabilities } = req.body;

      if (!organisationId || !userId || !availabilities) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const result = await AvailabilityService.setAllBaseAvailability(
        organisationId,
        userId,
        availabilities,
      );

      return res.status(201).json({
        message: "Base availability set successfully",
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in setAllBaseAvailability:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async getBaseAvailability(req: Request<OrgParams>, res: Response) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      if (!organisationId || !userId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const result = await AvailabilityService.getBaseAvailability(
        String(organisationId),
        String(userId),
      );

      return res.status(200).json({ data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in getBaseAvailability:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async deleteBaseAvailability(req: Request<OrgParams>, res: Response) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      if (!organisationId || !userId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      await AvailabilityService.deleteBaseAvailability(
        String(organisationId),
        String(userId),
      );

      return res
        .status(200)
        .json({ message: "Base availability deleted successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in deleteBaseAvailability:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  // Contollers for Weekly Availability Overrides

  async addWeeklyAvailabilityOverride(
    req: Request<OrgParams, unknown, WeeklyOverrideBody>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { weekStartDate, overrides } = req.body;

      if (!organisationId || !userId || !weekStartDate || !overrides) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const parsedDate = safeDate(weekStartDate);

      if (!parsedDate) {
        return res.status(400).json({ message: "Invalid weekStartDate" });
      }

      await AvailabilityService.addWeeklyAvailabilityOverride(
        organisationId,
        userId,
        parsedDate,
        overrides,
      );

      return res
        .status(201)
        .json({ message: "Weekly override added successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in addWeeklyAvailabilityOverride:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async getWeeklyAvailabilityOverride(
    req: Request<OrgParams, unknown, unknown, WeeklyOverrideQuery>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { weekStartDate } = req.query;

      if (!organisationId || !userId || !weekStartDate) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const parsedDate = safeDate(weekStartDate);

      if (!parsedDate) {
        return res.status(400).json({ message: "Invalid weekStartDate" });
      }

      const result = await AvailabilityService.getWeeklyAvailabilityOverride(
        String(organisationId),
        String(userId),
        parsedDate,
      );

      if (!result)
        return res.status(404).json({ message: "No weekly override found" });

      return res.status(200).json({ data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in getWeeklyAvailabilityOverride:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async deleteWeeklyAvailabilityOverride(
    req: Request<OrgParams, unknown, unknown, WeeklyOverrideQuery>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { weekStartDate } = req.query;

      if (!organisationId || !userId || !weekStartDate) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const parsedDate = safeDate(weekStartDate);

      if (!parsedDate) {
        return res.status(400).json({ message: "Invalid weekStartDate" });
      }

      await AvailabilityService.deleteWeeklyAvailabilityOverride(
        String(organisationId),
        String(userId),
        parsedDate,
      );

      return res
        .status(200)
        .json({ message: "Weekly override deleted successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in deleteWeeklyAvailabilityOverride:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  // Controllers for Occupancy

  async addOccupancy(
    req: Request<OrgParams, unknown, AddOccupancyBody>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { startTime, endTime, sourceType, referenceId } = req.body;

      const parsedStart = safeDate(startTime);
      const parsedEnd = safeDate(endTime);

      if (
        !organisationId ||
        !userId ||
        !parsedStart ||
        !parsedEnd ||
        !sourceType
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await AvailabilityService.addOccupancy(
        organisationId,
        userId,
        parsedStart,
        parsedEnd,
        sourceType,
        referenceId,
      );

      return res.status(201).json({ message: "Occupancy added successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in addOccupancy:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async addAllOccupancies(
    req: Request<unknown, unknown, AddAllOccupanciesBody>,
    res: Response,
  ) {
    try {
      const { organisationId, userId, occupancies } = req.body;

      if (
        !organisationId ||
        !userId ||
        !Array.isArray(occupancies) ||
        !occupancies.length
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const normalized = [];

      for (const occupancy of occupancies) {
        const parsedStart = safeDate(occupancy.startTime);
        const parsedEnd = safeDate(occupancy.endTime);

        if (!parsedStart || !parsedEnd || !occupancy.sourceType) {
          return res.status(400).json({ message: "Invalid occupancy payload" });
        }

        normalized.push({
          startTime: parsedStart,
          endTime: parsedEnd,
          sourceType: occupancy.sourceType,
          referenceId: occupancy.referenceId,
        });
      }

      await AvailabilityService.addAllOccupancies(
        organisationId,
        userId,
        normalized,
      );

      return res
        .status(201)
        .json({ message: "All occupancies added successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in addAllOccupancies:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async getOccupancy(
    req: Request<OrgParams, unknown, unknown, OccupancyQuery>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { startDate, endDate } = req.query;

      const parsedStart = safeDate(startDate);
      const parsedEnd = safeDate(endDate);

      if (!organisationId || !userId || !parsedStart || !parsedEnd) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const result = await AvailabilityService.getOccupancy(
        String(organisationId),
        String(userId),
        parsedStart,
        parsedEnd,
      );

      return res.status(200).json({ data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in getOccupancy:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  // Controllers for Final Availability and Current Status

  async getFinalAvailability(
    req: Request<OrgParams, unknown, unknown, FinalAvailabilityQuery>,
    res: Response,
  ) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);
      const { referenceDate } = req.query;

      logger.info(
        `Received getFinalAvailability request with orgId: ${organisationId}, userId: ${userId}, referenceDate: ${referenceDate}`,
      );

      const parsedDate = safeDate(referenceDate);

      if (!organisationId || !userId || !parsedDate) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const result = await AvailabilityService.getFinalAvailabilityForDate(
        String(organisationId),
        String(userId),
        parsedDate,
      );

      return res.status(200).json({ data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in getFinalAvailability:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },

  async getCurrentStatus(req: Request<OrgParams>, res: Response) {
    try {
      const organisationId = req.params.orgId;
      const userId = resolveUserIdFromRequest(req);

      if (!organisationId || !userId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const status = await AvailabilityService.getCurrentStatus(
        String(organisationId),
        String(userId),
      );

      return res.status(200).json({ status });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error in getCurrentStatus:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: message });
    }
  },
};
