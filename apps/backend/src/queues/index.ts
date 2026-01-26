import logger from "src/utils/logger";
import { registerTaskSchedulers } from "./task.schedulers";
import { registerAppointmentSchedulers } from "./appointment.scheduler";

export async function initQueues() {
  await registerTaskSchedulers();
  await registerAppointmentSchedulers();
  logger.info("📬 BullMQ queues initialized");
}
