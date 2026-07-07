import logger from "src/utils/logger";
import { DeveloperMaintenanceQueue } from "./developer-maintenance.queue";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Daily developer-platform maintenance: request-log retention (30 days) and
// API-key expiry reminders. The expiry-reminder dedupe RELIES on this running
// once a day (see developer-maintenance.service.ts) - do not shorten the
// repeat interval below 12 hours without adding a sent-marker.
export async function registerDeveloperMaintenanceScheduler() {
  await DeveloperMaintenanceQueue.add(
    "run",
    {},
    {
      repeat: { every: ONE_DAY_MS },
      jobId: "developer-maintenance-daily",
    },
  );

  logger.info("✅ Developer maintenance scheduler registered");
}
