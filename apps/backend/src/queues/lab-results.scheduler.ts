import logger from "src/utils/logger";
import { LabResultsQueue } from "./lab-results.queue";

const FIVE_MIN_MS = 5 * 60 * 1000;

export async function registerLabResultsScheduler() {
  await LabResultsQueue.upsertJobScheduler(
    "lab-results-poll-repeat",
    { every: FIVE_MIN_MS },
    { name: "poll", data: {} },
  );

  logger.info("✅ Lab results scheduler registered");
}
