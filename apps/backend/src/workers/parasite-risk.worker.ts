import { Worker } from "bullmq";
import { redisConnection } from "../queues/bull.config";
import { refreshFollowedCells } from "../services/parasite-risk.alerts";
import logger from "src/utils/logger";

export const ParasiteRiskWorker = new Worker(
  "parasite-risk",
  async () => {
    logger.info("🪳 Refreshing parasite risk for followed locations...");
    return refreshFollowedCells();
  },
  { connection: redisConnection },
);

ParasiteRiskWorker.on("completed", (job) =>
  logger.info("✅ Parasite risk refresh completed", {
    summary: job.returnvalue,
  }),
);

ParasiteRiskWorker.on("failed", (_, err) =>
  logger.error("❌ Parasite risk refresh failed", err),
);
