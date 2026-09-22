import logger from "src/utils/logger";
import {
  DeveloperMeterJobs,
  DeveloperMeterQueue,
} from "./developer-meter.queue";

export async function registerDeveloperMeterScheduler() {
  await DeveloperMeterQueue.upsertJobScheduler(
    "developer-meter-delivery-repeat",
    { every: 60 * 1000 },
    { name: DeveloperMeterJobs.DRAIN_EVENTS, data: {} },
  );
  logger.info("✅ Developer meter delivery scheduler registered");
}
