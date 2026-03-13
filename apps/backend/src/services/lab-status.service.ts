import LabOrderModel, { type LabOrderStatus } from "src/models/lab-order";
import { LabOrderService } from "src/services/lab-order.service";
import logger from "src/utils/logger";

const TERMINAL_STATUSES: LabOrderStatus[] = [
  "COMPLETE",
  "CANCELLED",
  "ERROR",
];

export const LabStatusService = {
  async pollPending() {
    const pending = await LabOrderModel.find({
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
