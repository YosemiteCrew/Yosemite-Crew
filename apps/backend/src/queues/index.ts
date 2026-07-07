import logger from "src/utils/logger";
import { registerTaskSchedulers } from "./task.schedulers";
import { registerTaskScheduleSchedulers } from "./task-schedule.scheduler";
import { registerAppointmentSchedulers } from "./appointment.scheduler";
import { registerIdexxReferenceScheduler } from "./idexx-reference.scheduler";
import { registerLabStatusScheduler } from "./lab-status.scheduler";
import { registerLabResultsScheduler } from "./lab-results.scheduler";
import { registerDeveloperMaintenanceScheduler } from "./developer-maintenance.scheduler";
import { registerDeveloperExportRecovery } from "./developer-export.scheduler";

export async function initQueues() {
  await registerTaskSchedulers();
  await registerTaskScheduleSchedulers();
  await registerAppointmentSchedulers();
  await registerIdexxReferenceScheduler();
  await registerLabStatusScheduler();
  await registerLabResultsScheduler();
  await registerDeveloperMaintenanceScheduler();
  await registerDeveloperExportRecovery();
  logger.info("📬 BullMQ queues initialized");
}
