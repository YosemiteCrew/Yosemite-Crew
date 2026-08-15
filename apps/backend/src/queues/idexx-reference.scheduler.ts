import logger from "src/utils/logger";
import { IdexxReferenceQueue } from "./idexx-reference.queue";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function registerIdexxReferenceScheduler() {
  await IdexxReferenceQueue.add(
    "sync",
    {},
    { jobId: "idexx-reference-startup" },
  );

  await IdexxReferenceQueue.upsertJobScheduler(
    "idexx-reference-weekly",
    { every: WEEK_MS },
    { name: "sync", data: {} },
  );

  logger.info("✅ IDEXX reference scheduler registered");
}
