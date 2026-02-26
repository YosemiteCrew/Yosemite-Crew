import logger from "src/utils/logger";
import { IdexxReferenceQueue } from "./idexx-reference.queue";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function registerIdexxReferenceScheduler() {
  await IdexxReferenceQueue.add(
    "sync",
    {},
    {
      jobId: "idexx-reference-startup",
    },
  );

  await IdexxReferenceQueue.add(
    "sync",
    {},
    {
      repeat: { every: WEEK_MS },
      jobId: "idexx-reference-weekly",
    },
  );

  logger.info("✅ IDEXX reference scheduler registered");
}
