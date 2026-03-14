// src/services/dashboard.service.ts
import dayjs from "dayjs";
import { Types } from "mongoose";

import AppointmentModel from "src/models/appointment";
import TaskModel from "src/models/task";
import { InventoryItemModel, StockMovementModel } from "src/models/inventory";
import InvoiceModel from "src/models/invoice";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
// ⬆️ adjust import paths/model names if needed

export class DashboardServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "DashboardServiceError";
  }
}

/**
 * Types for responses
 */
export type SummaryRange =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

export type DashboardRange = SummaryRange;

export interface DashboardSummary {
  revenue: number;
  appointments: number;
  tasks: number;
  staffOnDuty: number; // placeholder (0 for now)
}

export interface AppointmentsTrendPoint {
  label: string; // e.g. "Mar"
  year: number;
  month: number;
  completed: number;
  cancelled: number;
}

export interface RevenueTrendPoint {
  label: string;
  year: number;
  month: number;
  revenue: number;
}

export interface StaffLeader {
  staffId: string;
  name?: string; // populate using lookup if you have staff collection
  completedAppointments: number;
}

export interface RevenueLeader {
  serviceKey: string; // e.g. SOP or department
  label: string;
  revenue: number;
}

export interface InventoryTurnoverSummary {
  turnsPerYear: number;
  restockCycleDays: number | null;
  targetTurnsPerYear: number;
  trend: {
    month: string;
    year: number;
    turnover: number;
  }[];
}

export interface ProductTurnoverPoint {
  itemId: string;
  name: string;
  turnover: number;
}

type AppointmentSummaryAgg = {
  _id: null;
  revenue: number | null | undefined;
  count: number | null | undefined;
};

type AppointmentTrendAgg = {
  _id: { year: number; month: number };
  completed: number | null | undefined;
  cancelled: number | null | undefined;
};

type RevenueTrendAgg = {
  _id: { year: number; month: number };
  revenue: number | null | undefined;
};

type StaffLeaderAgg = {
  _id: Types.ObjectId | string | null | undefined;
  completedAppointments: number | null | undefined;
};

type RevenueLeaderAgg = {
  _id: string | null | undefined;
  revenue: number | null | undefined;
};

type InventoryConsumptionAgg = {
  _id: null;
  totalConsumed: number | null | undefined;
};

type MonthlyConsumptionAgg = {
  _id: { year: number; month: number };
  consumed: number | null | undefined;
};

type ProductConsumptionAgg = {
  _id: Types.ObjectId;
  consumed: number | null | undefined;
};

type InventoryItemLean = {
  _id: Types.ObjectId;
  onHand?: number;
  name?: string;
};

/**
 * Helper: convert SummaryRange -> date interval
 */
const resolveRange = (range: SummaryRange) => {
  const now = dayjs();

  switch (range) {
    case "today":
      return {
        from: now.startOf("day").toDate(),
        to: now.endOf("day").toDate(),
      };
    case "yesterday": {
      const y = now.subtract(1, "day");
      return { from: y.startOf("day").toDate(), to: y.endOf("day").toDate() };
    }
    case "last_30_days":
      return {
        from: now.subtract(30, "day").startOf("day").toDate(),
        to: now.toDate(),
      };
    case "this_week":
      return { from: now.startOf("week").toDate(), to: now.toDate() };
    case "last_week": {
      const start = now.subtract(1, "week").startOf("week");
      const end = start.endOf("week");
      return { from: start.toDate(), to: end.toDate() };
    }
    case "this_month":
      return { from: now.startOf("month").toDate(), to: now.toDate() };
    case "last_month": {
      const start = now.subtract(1, "month").startOf("month");
      const end = start.endOf("month");
      return { from: start.toDate(), to: end.toDate() };
    }
    default:
      return {
        from: now.subtract(7, "day").startOf("day").toDate(),
        to: now.toDate(),
      };
  }
};

/**
 * DashboardService
 */
export const DashboardService = {
  // ─────────────────────────────────────────────
  // 1. SUMMARY TILE DATA
  // ─────────────────────────────────────────────
  async getSummary(params: {
    organisationId: string;
    range: SummaryRange;
  }): Promise<DashboardSummary> {
    const { organisationId, range } = params;
    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = resolveRange(range);

    if (isReadFromPostgres()) {
      const [appointmentsCount, taskCount, revenueAgg] = await Promise.all([
        prisma.appointment.count({
          where: {
            organisationId,
            startTime: { gte: from, lte: to },
          },
        }),
        prisma.task.count({
          where: {
            organisationId,
            createdAt: { gte: from, lte: to },
          },
        }),
        prisma.invoice.aggregate({
          where: {
            organisationId,
            status: "PAID",
            paidAt: { gte: from, lte: to },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      return {
        revenue: revenueAgg._sum.totalAmount ?? 0,
        appointments: appointmentsCount ?? 0,
        tasks: taskCount ?? 0,
        staffOnDuty: 0,
      };
    }

    const [appointmentAgg, taskCount] = await Promise.all([
      AppointmentModel.aggregate<AppointmentSummaryAgg>([
        {
          $match: {
            organisationId,
            startTime: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: 0 },
            count: { $sum: 1 },
          },
        },
      ]),
      TaskModel.countDocuments({
        organisationId,
        createdAt: { $gte: from, $lte: to },
      }).exec(),
    ]);

    const agg =
      appointmentAgg[0] ??
      ({
        _id: null,
        revenue: 0,
        count: 0,
      } satisfies AppointmentSummaryAgg);

    // Staff-on-duty will depend on your schedule model.
    // For now, return 0 and we can wire later.
    const staffOnDuty = 0;

    const revenueAgg = await InvoiceModel.aggregate<AppointmentSummaryAgg>([
      {
        $match: {
          organisationId,
          status: "PAID",
          paidAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const revenueValue = revenueAgg[0]?.revenue ?? 0;

    return {
      revenue: revenueValue,
      appointments: agg.count ?? 0,
      tasks: taskCount ?? 0,
      staffOnDuty,
    };
  },

  // ─────────────────────────────────────────────
  // 2. APPOINTMENTS TREND (BAR CHART)
  // ─────────────────────────────────────────────
  async getAppointmentsTrend(params: {
    organisationId: string;
    range?: DashboardRange; // default last_30_days
  }): Promise<AppointmentsTrendPoint[]> {
    const { organisationId } = params;
    const range = params.range ?? "last_30_days";
    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = resolveRange(range);

    if (isReadFromPostgres()) {
      const rows = await prisma.appointment.findMany({
        where: {
          organisationId,
          startTime: { gte: from, lte: to },
        },
        select: { startTime: true, status: true },
      });

      const bucket = new Map<
        string,
        { year: number; month: number; completed: number; cancelled: number }
      >();
      for (const row of rows) {
        const year = dayjs(row.startTime).year();
        const month = dayjs(row.startTime).month() + 1;
        const key = `${year}-${month}`;
        const entry = bucket.get(key) ?? {
          year,
          month,
          completed: 0,
          cancelled: 0,
        };
        if (row.status === "COMPLETED") entry.completed += 1;
        if (row.status === "CANCELLED") entry.cancelled += 1;
        bucket.set(key, entry);
      }

      return Array.from(bucket.values())
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((row) => {
          const d = dayjs()
            .year(row.year)
            .month(row.month - 1);
          return {
            label: d.format("MMM"),
            year: row.year,
            month: row.month,
            completed: row.completed,
            cancelled: row.cancelled,
          };
        });
    }

    const agg = await AppointmentModel.aggregate<AppointmentTrendAgg>([
      {
        $match: {
          organisationId,
          startTime: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$startTime" },
            month: { $month: "$startTime" },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const result: AppointmentsTrendPoint[] = agg.map((row) => {
      const year = row._id.year;
      const month = row._id.month; // 1-12
      const d = dayjs()
        .year(year)
        .month(month - 1);
      return {
        label: d.format("MMM"),
        year,
        month,
        completed: row.completed ?? 0,
        cancelled: row.cancelled ?? 0,
      };
    });

    return result;
  },

  // ─────────────────────────────────────────────
  // 3. REVENUE TREND (LINE CHART)
  // ─────────────────────────────────────────────
  async getRevenueTrend(params: {
    organisationId: string;
    range?: DashboardRange; // default last_30_days
  }): Promise<RevenueTrendPoint[]> {
    const { organisationId } = params;
    const range = params.range ?? "last_30_days";
    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = resolveRange(range);

    if (isReadFromPostgres()) {
      const rows = await prisma.invoice.findMany({
        where: {
          organisationId,
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
        select: { paidAt: true, totalAmount: true },
      });

      const bucket = new Map<
        string,
        { year: number; month: number; revenue: number }
      >();
      for (const row of rows) {
        if (!row.paidAt) continue;
        const year = dayjs(row.paidAt).year();
        const month = dayjs(row.paidAt).month() + 1;
        const key = `${year}-${month}`;
        const entry = bucket.get(key) ?? { year, month, revenue: 0 };
        entry.revenue += row.totalAmount ?? 0;
        bucket.set(key, entry);
      }

      return Array.from(bucket.values())
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((row) => {
          const d = dayjs()
            .year(row.year)
            .month(row.month - 1);
          return {
            label: d.format("MMM"),
            year: row.year,
            month: row.month,
            revenue: row.revenue,
          };
        });
    }

    const agg = await InvoiceModel.aggregate<RevenueTrendAgg>([
      {
        $match: {
          organisationId,
          status: "PAID",
          paidAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paidAt" },
            month: { $month: "$paidAt" },
          },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const result: RevenueTrendPoint[] = agg.map((row) => {
      const year = row._id.year;
      const month = row._id.month;
      const d = dayjs()
        .year(year)
        .month(month - 1);
      return {
        label: d.format("MMM"),
        year,
        month,
        revenue: row.revenue ?? 0,
      };
    });

    return result;
  },

  // ─────────────────────────────────────────────
  // 4. APPOINTMENT LEADERS (BAR CHART)
  // ─────────────────────────────────────────────
  async getAppointmentLeaders(params: {
    organisationId: string;
    range?: SummaryRange; // default last_week
    limit?: number;
  }): Promise<StaffLeader[]> {
    const { organisationId } = params;
    const range = params.range ?? "last_week";
    const limit = params.limit ?? 5;

    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = resolveRange(range);

    if (isReadFromPostgres()) {
      const rows = await prisma.appointment.findMany({
        where: {
          organisationId,
          startTime: { gte: from, lte: to },
          status: "COMPLETED",
        },
        select: { lead: true },
      });

      const counts = new Map<string, number>();
      for (const row of rows) {
        if (!row.lead || typeof row.lead !== "object") continue;
        const leadId = (row.lead as { id?: string }).id;
        if (!leadId) continue;
        counts.set(leadId, (counts.get(leadId) ?? 0) + 1);
      }

      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([staffId, completedAppointments]) => ({
          staffId,
          completedAppointments,
          name: undefined,
        }));
    }

    // doctorId / clinicianId – adjust to your schema
    const agg = await AppointmentModel.aggregate<StaffLeaderAgg>([
      {
        $match: {
          organisationId,
          startTime: { $gte: from, $lte: to },
          status: "COMPLETED",
          "lead.id": { $exists: true, $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: "$lead.id",
          completedAppointments: { $sum: 1 },
        },
      },
      { $sort: { completedAppointments: -1 } },
      { $limit: limit },
    ]);

    const result: StaffLeader[] = agg.map((row) => {
      const staffId = row._id ? String(row._id) : "unknown";
      return {
        staffId,
        completedAppointments: row.completedAppointments ?? 0,
        name: undefined, // Optionally populate via separate StaffModel lookup
      };
    });

    return result;
  },

  // ─────────────────────────────────────────────
  // 5. REVENUE LEADERS (BY SERVICE / DEPARTMENT)
  // ─────────────────────────────────────────────
  async getRevenueLeaders(params: {
    organisationId: string;
    range?: SummaryRange;
    limit?: number;
  }): Promise<RevenueLeader[]> {
    const { organisationId } = params;
    const range = params.range ?? "last_week";
    const limit = params.limit ?? 5;

    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = resolveRange(range);

    if (isReadFromPostgres()) {
      const rows = await prisma.invoice.findMany({
        where: {
          organisationId,
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
        select: { items: true },
      });

      const totals = new Map<string, number>();
      for (const row of rows) {
        const items = Array.isArray(row.items) ? row.items : [];
        for (const item of items as Array<{ name?: string; total?: number }>) {
          const name = item.name ?? "Unknown";
          totals.set(name, (totals.get(name) ?? 0) + (item.total ?? 0));
        }
      }

      return Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, revenue]) => ({
          serviceKey: label,
          label,
          revenue,
        }));
    }

    const agg = await InvoiceModel.aggregate<RevenueLeaderAgg>([
      {
        $match: {
          organisationId,
          status: "PAID",
          paidAt: { $gte: from, $lte: to },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          revenue: { $sum: "$items.total" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    const result: RevenueLeader[] = agg.map((row) => ({
      serviceKey: row._id ?? "Unknown",
      label: row._id ?? "Unknown",
      revenue: row.revenue ?? 0,
    }));

    return result;
  },

  // ─────────────────────────────────────────────
  // 6. INVENTORY TURNOVER SUMMARY
  // ─────────────────────────────────────────────
  async getInventoryTurnover(params: {
    organisationId: string;
    year?: number; // default current year
    targetTurnsPerYear?: number;
    range?: DashboardRange;
  }): Promise<InventoryTurnoverSummary> {
    const { organisationId } = params;
    const range = params.range;
    const year = params.year ?? dayjs().year();
    const targetTurnsPerYear = params.targetTurnsPerYear ?? 8; // arbitrary target

    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = range
      ? resolveRange(range)
      : {
          from: dayjs().year(year).startOf("year").toDate(),
          to: dayjs().year(year).endOf("year").toDate(),
        };

    if (isReadFromPostgres()) {
      const items = await prisma.inventoryItem.findMany({
        where: { organisationId },
        select: { id: true, onHand: true, name: true },
      });
      const itemIds = items.map((item) => item.id);

      const movements = itemIds.length
        ? await prisma.inventoryStockMovement.findMany({
            where: {
              itemId: { in: itemIds },
              createdAt: { gte: from, lte: to },
              change: { lt: 0 },
            },
            select: { itemId: true, change: true, createdAt: true },
          })
        : [];

      const totalConsumed = movements.reduce(
        (sum, move) => sum + Math.abs(move.change ?? 0),
        0,
      );

      const totalOnHand = items.reduce(
        (sum, item) => sum + (item.onHand ?? 0),
        0,
      );
      const avgOnHand = totalOnHand || 1;
      const turnsPerYear = totalConsumed / avgOnHand;
      const restockCycleDays =
        turnsPerYear > 0 ? Math.round(365 / turnsPerYear) : null;

      const bucket = new Map<
        string,
        { year: number; month: number; consumed: number }
      >();
      for (const move of movements) {
        const year = dayjs(move.createdAt).year();
        const month = dayjs(move.createdAt).month() + 1;
        const key = `${year}-${month}`;
        const entry = bucket.get(key) ?? { year, month, consumed: 0 };
        entry.consumed += Math.abs(move.change ?? 0);
        bucket.set(key, entry);
      }

      const trend = Array.from(bucket.values())
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((row) => {
          const d = dayjs()
            .year(row.year)
            .month(row.month - 1);
          const monthlyAverageOnHand = avgOnHand;
          const monthlyTurnover =
            monthlyAverageOnHand > 0 ? row.consumed / monthlyAverageOnHand : 0;
          return {
            month: d.format("MMM"),
            year: row.year,
            turnover: monthlyTurnover,
          };
        });

      return {
        turnsPerYear,
        restockCycleDays,
        targetTurnsPerYear,
        trend,
      };
    }

    // 1) Sum up all negative stock movements (consumption)
    const consumptionAgg =
      await StockMovementModel.aggregate<InventoryConsumptionAgg>([
        {
          $match: {
            organisationId,
            createdAt: { $gte: from, $lte: to },
            change: { $lt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalConsumed: { $sum: { $multiply: ["$change", -1] } },
          },
        },
      ]);

    const totalConsumed = consumptionAgg[0]?.totalConsumed ?? 0;

    // 2) Approximate average inventory value:
    //    - using average of current onHand across items
    const items = await InventoryItemModel.find<InventoryItemLean>({
      organisationId,
    })
      .lean()
      .exec();
    const totalOnHand = items.reduce(
      (sum, item) => sum + (item.onHand ?? 0),
      0,
    );
    const avgOnHand = totalOnHand || 1; // avoid division by zero

    const turnsPerYear = totalConsumed / avgOnHand;

    // 3) Restock cycle days ~ 365 / turns
    const restockCycleDays =
      turnsPerYear > 0 ? Math.round(365 / turnsPerYear) : null;

    // 4) Monthly trend (rough: same formula grouped per month)
    const monthlyAgg =
      await StockMovementModel.aggregate<MonthlyConsumptionAgg>([
        {
          $match: {
            organisationId,
            createdAt: { $gte: from, $lte: to },
            change: { $lt: 0 },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            consumed: { $sum: { $multiply: ["$change", -1] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

    const trend = monthlyAgg.map((row) => {
      const mYear = row._id.year;
      const mMonth = row._id.month;
      const d = dayjs()
        .year(mYear)
        .month(mMonth - 1);
      const monthlyAverageOnHand = avgOnHand; // simplification
      const monthlyTurnover =
        monthlyAverageOnHand > 0 ? row.consumed! / monthlyAverageOnHand : 0;

      return {
        month: d.format("MMM"),
        year: mYear,
        turnover: monthlyTurnover,
      };
    });

    return {
      turnsPerYear,
      restockCycleDays,
      targetTurnsPerYear,
      trend,
    };
  },

  // ─────────────────────────────────────────────
  // 7. INDIVIDUAL PRODUCT TURNOVER
  // ─────────────────────────────────────────────
  async getProductTurnover(params: {
    organisationId: string;
    limit?: number;
    year?: number;
    range?: DashboardRange;
  }): Promise<ProductTurnoverPoint[]> {
    const { organisationId } = params;
    const range = params.range;
    const year = params.year ?? dayjs().year();
    const limit = params.limit ?? 10;

    if (!organisationId) {
      throw new DashboardServiceError("organisationId is required", 400);
    }

    const { from, to } = range
      ? resolveRange(range)
      : {
          from: dayjs().year(year).startOf("year").toDate(),
          to: dayjs().year(year).endOf("year").toDate(),
        };

    if (isReadFromPostgres()) {
      const items = await prisma.inventoryItem.findMany({
        where: { organisationId },
        select: { id: true, name: true, onHand: true },
      });
      const itemIds = items.map((item) => item.id);

      const movements = itemIds.length
        ? await prisma.inventoryStockMovement.findMany({
            where: {
              itemId: { in: itemIds },
              createdAt: { gte: from, lte: to },
              change: { lt: 0 },
            },
            select: { itemId: true, change: true },
          })
        : [];

      const consumptionByItem = new Map<string, number>();
      for (const move of movements) {
        if (!move.itemId) continue;
        const current = consumptionByItem.get(move.itemId) ?? 0;
        consumptionByItem.set(
          move.itemId,
          current + Math.abs(move.change ?? 0),
        );
      }

      const itemMap = new Map(items.map((item) => [item.id, item]));

      return Array.from(consumptionByItem.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([itemId, consumed]) => {
          const item = itemMap.get(itemId);
          const onHand = item?.onHand ?? 0;
          const avgOnHand = onHand || 1;
          const turnover = consumed / avgOnHand;

          return {
            itemId,
            name: item?.name ?? "Unknown",
            turnover,
          };
        });
    }

    // 1) Consumption per item
    const agg = await StockMovementModel.aggregate<ProductConsumptionAgg>([
      {
        $match: {
          organisationId,
          createdAt: { $gte: from, $lte: to },
          change: { $lt: 0 },
        },
      },
      {
        $group: {
          _id: "$itemId",
          consumed: { $sum: { $multiply: ["$change", -1] } },
        },
      },
      { $sort: { consumed: -1 } },
      { $limit: limit },
    ]);

    const itemIds = agg.map((a) => a._id).filter(Boolean);
    const items = await InventoryItemModel.find<InventoryItemLean>({
      _id: { $in: itemIds },
    })
      .lean()
      .exec();

    const itemMap = new Map<string, InventoryItemLean>();
    for (const it of items) {
      itemMap.set(it._id.toString(), it);
    }

    const result: ProductTurnoverPoint[] = agg.map((row) => {
      const idStr = row._id.toString();
      const item = itemMap.get(idStr);
      const onHand = item?.onHand ?? 0;
      const avgOnHand = onHand || 1;
      const turnover = row.consumed! / avgOnHand;

      return {
        itemId: idStr,
        name: item?.name ?? "Unknown",
        turnover,
      };
    });

    return result;
  },
};
