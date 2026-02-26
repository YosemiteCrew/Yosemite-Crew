import logger from "src/utils/logger";
import { registerTaskSchedulers } from "./task.schedulers";
import { registerAppointmentSchedulers } from "./appointment.scheduler";
import { registerIdexxReferenceScheduler } from "./idexx-reference.scheduler";

export async function initQueues() {
  await registerTaskSchedulers();
  await registerAppointmentSchedulers();
  await registerIdexxReferenceScheduler();
  logger.info("📬 BullMQ queues initialized");
}
