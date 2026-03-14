import LabOrderModel, { type LabOrderStatus } from "src/models/lab-order";
import { LabOrderService } from "src/services/lab-order.service";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

const TERMINAL_STATUSES: LabOrderStatus[] = ["COMPLETE", "CANCELLED", "ERROR"];

export const LabStatusService = {
  async pollPending() {
    const pending = isReadFromPostgres()
      ? await prisma.labOrder.findMany({
          where: {
            status: { notIn: TERMINAL_STATUSES },
            idexxOrderId: { not: null },
          },
          orderBy: { updatedAt: "asc" },
          take: 100,
        })
      : await LabOrderModel.find({
          status: { $nin: TERMINAL_STATUSES },
          idexxOrderId: { $ne: null },
        })
          .sort({ updatedAt: 1 })
          .limit(100)
          .lean();

    if (!pending.length) return;

    for (const order of pending) {
      try {
        await LabOrderService.getOrder(
          order.provider,
          order.organisationId,
          order.idexxOrderId ?? "",
        );
      } catch (error) {
        logger.error("Failed to refresh lab order status", error);
      }
    }
  },
};
