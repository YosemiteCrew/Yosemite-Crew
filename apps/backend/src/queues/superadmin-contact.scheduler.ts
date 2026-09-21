import logger from "src/utils/logger";
import { SuperadminContactService } from "src/services/superadmin-contact.service";
import {
  SuperadminContactQueue,
  SuperadminContactJobs,
} from "./superadmin-contact.queue";

export async function registerSuperadminContactScheduler() {
  // Every 60 seconds. This job is the mirror's only sender, so its period and
  // batch size together are what hold the whole mirror - live submissions and
  // any backfilled history alike - under the panel intake's rate limit.
  await SuperadminContactQueue.upsertJobScheduler(
    "superadmin-contact-forward-repeat",
    { every: 60 * 1000 },
    { name: SuperadminContactJobs.DRAIN_FORWARDS, data: {} },
  );

  // Once, here, rather than once per submission: unconfigured is a standing
  // state and the useful number is how much has queued up behind it.
  await SuperadminContactService.warnIfUnconfigured();

  logger.info("✅ SuperAdmin contact forward scheduler registered");
}
