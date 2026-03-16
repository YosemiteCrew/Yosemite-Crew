// src/controllers/web/dashboard.controller.ts
import { Request, Response } from "express";
import {
  DashboardService,
  DashboardServiceError,
  DashboardBucket,
  SummaryRange,
} from "src/services/dashboard.service";
import logger from "src/utils/logger";

const asSummaryRange = (
  value: unknown,
  fallback: SummaryRange,
): SummaryRange => {
  if (typeof value !== "string") return fallback;
  const allowed: SummaryRange[] = [
    "today",
    "yesterday",
    "last_7_days",
    "last_30_days",
    "this_week",
    "this_month",
    "last_week",
    "last_month",
    "last_6_months",
    "last_1_year",
  ];
  return allowed.includes(value as SummaryRange)
    ? (value as SummaryRange)
    : fallback;
};

const asBucket = (
  value: unknown,
  fallback: DashboardBucket,
): DashboardBucket => {
  if (value === "day" || value === "month") return value;
  return fallback;
};

export const DashboardController = {
  // ─────────────────────────────────────────────
  // 1. SUMMARY TILE DATA
  // ─────────────────────────────────────────────
  summary: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const range = asSummaryRange(req.query.range, "last_month");

      const data = await DashboardService.getSummary({
        organisationId,
        range,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get summury", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ─────────────────────────────────────────────
  // 2. APPOINTMENTS TREND (6-month bar chart)
  // ─────────────────────────────────────────────
  appointmentsTrend: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const range = asSummaryRange(req.query.range, "last_month");
      const bucket = asBucket(req.query.bucket, "month");

      const data = await DashboardService.getAppointmentsTrend({
        organisationId,
        range,
        bucket,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get appointments Trend", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ─────────────────────────────────────────────
  // 3. REVENUE TREND (6-month line chart)
  // ─────────────────────────────────────────────
  revenueTrend: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const range = asSummaryRange(req.query.range, "last_month");
      const bucket = asBucket(req.query.bucket, "month");

      const data = await DashboardService.getRevenueTrend({
        organisationId,
        range,
        bucket,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get revenue Trend", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ─────────────────────────────────────────────
  // 4. APPOINTMENT LEADERS
  // ─────────────────────────────────────────────
  appointmentLeaders: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      const range = asSummaryRange(req.query.range, "last_month");
      const limit = req.query.limit ? Number(req.query.limit) : 5;

      const data = await DashboardService.getAppointmentLeaders({
        organisationId,
        range,
        limit,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get appointments leader", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ─────────────────────────────────────────────
  // 5. REVENUE LEADERS
  // ─────────────────────────────────────────────
  revenueLeaders: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      const range = asSummaryRange(req.query.range, "last_month");
      const limit = req.query.limit ? Number(req.query.limit) : 5;

      const data = await DashboardService.getRevenueLeaders({
        organisationId,
        range,
        limit,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get revenue leader", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ─────────────────────────────────────────────
  // 6. INVENTORY TURNOVER SUMMARY
  // ─────────────────────────────────────────────
  inventoryTurnover: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      const year = req.query.year ? Number(req.query.year) : undefined;
      const range = req.query.range as SummaryRange | undefined;
      const targetTurnsPerYear = req.query.targetTurns
        ? Number(req.query.targetTurns)
        : undefined;

      const data = await DashboardService.getInventoryTurnover({
        organisationId,
        year,
        targetTurnsPerYear,
        range,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get inventory turnover", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ─────────────────────────────────────────────
  // 7. INVENTORY PRODUCT TURNOVER
  // ─────────────────────────────────────────────
  productTurnover: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      const year = req.query.year ? Number(req.query.year) : undefined;
      const range = req.query.range as SummaryRange | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const data = await DashboardService.getProductTurnover({
        organisationId,
        year,
        limit,
        range,
      });

      res.json(data);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Unable to get product turnover", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
