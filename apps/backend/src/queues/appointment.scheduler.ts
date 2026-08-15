import logger from "src/utils/logger";
import { AppointmentQueue, AppointmentJobs } from "./appointment.queue";

export async function registerAppointmentSchedulers() {
  // 🔄 Appointment Status Updater: every 15 minutes
  await AppointmentQueue.upsertJobScheduler(
    "appointment-status-updater-repeat",
    { every: 60 * 1000 },
    { name: AppointmentJobs.MARK_NO_SHOW, data: {} },
  );

  logger.info("✅ Appointment schedulers registered");
}
