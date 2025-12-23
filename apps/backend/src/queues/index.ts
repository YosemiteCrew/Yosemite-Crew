import logger from "src/utils/logger";
import { registerTaskSchedulers } from "./task.schedulers";

export async function initQueues() {
  await registerTaskSchedulers();
  logger.info("📬 BullMQ queues initialized");
}