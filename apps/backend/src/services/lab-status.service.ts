import { LabOrderService } from "src/services/lab-order.service";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import type { LabOrderStatus } from "@prisma/client";
import { mapInSequence } from "../utils/async-iteration";

const TERMINAL_STATUSES: LabOrderStatus[] = ["COMPLETE", "CANCELLED", "ERROR"];

export const LabStatusService = {
  async pollPending() {
    const pending = await prisma.labOrder.findMany({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        idexxOrderId: { not: null },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });

    if (!pending.length) return;

    // One order at a time: refreshing an order can add its charges to the
    // appointment invoice, and two orders on the same appointment must not
    // update that invoice at once.
    await mapInSequence(pending, async (order) => {
      try {
        await LabOrderService.getOrder(
          order.provider,
          order.organisationId,
          order.idexxOrderId ?? "",
        );
      } catch (error) {
        logger.error("Failed to refresh lab order status", error);
      }
    });
  },
};
