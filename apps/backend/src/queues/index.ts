import logger from "src/utils/logger";
import { registerTaskSchedulers } from "./task.schedulers";
import { registerTaskScheduleSchedulers } from "./task-schedule.scheduler";
import { registerAppointmentSchedulers } from "./appointment.scheduler";
import { registerIdexxReferenceScheduler } from "./idexx-reference.scheduler";
import { registerLabStatusScheduler } from "./lab-status.scheduler";
import { registerLabResultsScheduler } from "./lab-results.scheduler";

export async function initQueues() {
  await registerTaskSchedulers();
  await registerTaskScheduleSchedulers();
  await registerAppointmentSchedulers();
  await registerIdexxReferenceScheduler();
  await registerLabStatusScheduler();
  await registerLabResultsScheduler();
  logger.info("📬 BullMQ queues initialized");
}
