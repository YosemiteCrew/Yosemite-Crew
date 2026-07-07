import { DeveloperExportService } from "src/services/developer-export.service";
import logger from "src/utils/logger";

// Boot-time recovery, not a repeating schedule: the one-pending-job-per-org
// cap means an export row stuck in QUEUED/RUNNING (Redis wiped, worker killed
// mid-job) would block that org's exports forever. Mark anything stale as
// FAILED so the org can submit again.
export async function registerDeveloperExportRecovery() {
  const recovered = await DeveloperExportService.recoverStaleJobs();
  if (recovered > 0) {
    logger.info(`♻️ Recovered ${recovered} stale developer export job(s)`);
  }
  logger.info("✅ Developer export recovery registered");
}
