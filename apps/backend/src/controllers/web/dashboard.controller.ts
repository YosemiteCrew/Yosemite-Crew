// src/controllers/web/dashboard.controller.ts
import { Request, Response } from "express";
import {
  DashboardService,
  DashboardServiceError,
  SummaryRange,
} from "src/services/dashboard.service";
import logger from "src/utils/logger";

export const DashboardController = {
  // ─────────────────────────────────────────────
  // 1. SUMMARY TILE DATA
  // ─────────────────────────────────────────────
  summary: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const range = (req.query.range as SummaryRange) ?? "last_week";

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
      const months = req.query.months ? Number(req.query.months) : 6;

      const data = await DashboardService.getAppointmentsTrend({
        organisationId,
        months,
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
      const months = req.query.months ? Number(req.query.months) : 6;

      const data = await DashboardService.getRevenueTrend({
        organisationId,
        months,
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

      const range = (req.query.range as SummaryRange) ?? "last_week";
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

      const range = (req.query.range as SummaryRange) ?? "last_week";
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
      const targetTurnsPerYear = req.query.targetTurns
        ? Number(req.query.targetTurns)
        : undefined;

      const data = await DashboardService.getInventoryTurnover({
        organisationId,
        year,
        targetTurnsPerYear,
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
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const data = await DashboardService.getProductTurnover({
        organisationId,
        year,
        limit,
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
