import logger from "src/utils/logger";
import { LabStatusQueue } from "./lab-status.queue";

const FIVE_MIN_MS = 5 * 60 * 1000;

export async function registerLabStatusScheduler() {
  await LabStatusQueue.upsertJobScheduler(
    "lab-status-poll-repeat",
    { every: FIVE_MIN_MS },
    { name: "poll", data: {} },
  );

  logger.info("✅ Lab status scheduler registered");
}
