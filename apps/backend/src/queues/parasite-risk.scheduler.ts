import logger from "src/utils/logger";
import { ParasiteRiskQueue } from "./parasite-risk.queue";

/**
 * The models are driven by daily weather, so refreshing more than once a day
 * would burn weather requests without moving any index.
 */
export async function registerParasiteRiskScheduler() {
  await ParasiteRiskQueue.upsertJobScheduler(
    "parasite-risk-daily-refresh",
    // 03:00 server time, when nobody is waiting on the API.
    { pattern: "0 3 * * *" },
    { name: "refresh", data: {} },
  );

  logger.info("✅ Parasite risk scheduler registered");
}
