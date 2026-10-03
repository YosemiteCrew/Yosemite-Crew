import logger from "src/utils/logger";
import { ReportDeliveryQueue } from "./report-delivery.queue";

export async function registerReportDeliveryScheduler() {
  await ReportDeliveryQueue.upsertJobScheduler(
    "report-delivery-due-dispatch",
    { every: 60_000 },
    { name: "dispatch-due", data: {} },
  );
  logger.info("Report delivery scheduler registered");
}
