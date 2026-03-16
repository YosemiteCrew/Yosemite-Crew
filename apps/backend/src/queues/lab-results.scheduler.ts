import logger from "src/utils/logger";
import { LabResultsQueue } from "./lab-results.queue";

const FIVE_MIN_MS = 5 * 60 * 1000;

export async function registerLabResultsScheduler() {
  await LabResultsQueue.add(
    "poll",
    {},
    {
      repeat: { every: FIVE_MIN_MS },
      jobId: "lab-results-poll-repeat",
    },
  );

  logger.info("✅ Lab results scheduler registered");
}
