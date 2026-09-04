import logger from "src/utils/logger";
import { registerTaskSchedulers } from "./task.schedulers";
import { registerTaskScheduleSchedulers } from "./task-schedule.scheduler";
import { registerAppointmentSchedulers } from "./appointment.scheduler";
import { registerIdexxReferenceScheduler } from "./idexx-reference.scheduler";
import { registerLabStatusScheduler } from "./lab-status.scheduler";
import { registerLabResultsScheduler } from "./lab-results.scheduler";
import { registerVaccineReminderScheduler } from "./vaccine.scheduler";
import { registerPublicBookingSchedulers } from "./public-booking.scheduler";
import { registerParasiteRiskScheduler } from "./parasite-risk.scheduler";
import { AppointmentQueue } from "./appointment.queue";
import { IdexxReferenceQueue } from "./idexx-reference.queue";
import { LabResultsQueue } from "./lab-results.queue";
import { LabStatusQueue } from "./lab-status.queue";
import { TaskScheduleQueue } from "./task-schedule.queue";
import { TaskRecurrenceQueue, TaskReminderQueue } from "./task.queues";
import { VaccineReminderQueue } from "./vaccine.queues";
import { PublicBookingQueue } from "./public-booking.queue";
import {
  pruneLegacyRepeatablesAcross,
  SchedulerCapableQueue,
} from "./legacy-repeatables";

export const scheduledQueues = [
  AppointmentQueue,
  IdexxReferenceQueue,
  LabResultsQueue,
  LabStatusQueue,
  TaskScheduleQueue,
  TaskRecurrenceQueue,
  TaskReminderQueue,
  VaccineReminderQueue,
  PublicBookingQueue,
] as unknown as SchedulerCapableQueue[];
import "./ap-delivery.queue";
import "./ap-inbox.queue";

export async function initQueues() {
  // Must run before the upserts: bullmq 5 keyed its repeatables by an md5 of
  // the job options, not by the id, so an upsert adds a second entry instead of
  // replacing the old one and both keep firing. See legacy-repeatables.ts.
  await pruneLegacyRepeatablesAcross(scheduledQueues);

  await registerTaskSchedulers();
  await registerTaskScheduleSchedulers();
  await registerAppointmentSchedulers();
  await registerIdexxReferenceScheduler();
  await registerLabStatusScheduler();
  await registerLabResultsScheduler();
  await registerVaccineReminderScheduler();
  await registerPublicBookingSchedulers();
  await registerParasiteRiskScheduler();
  logger.info("📬 BullMQ queues initialized");
}
