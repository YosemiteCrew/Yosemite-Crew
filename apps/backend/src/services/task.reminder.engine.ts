// src/services/task.reminder.engine.ts
import dayjs from "dayjs";
import type { Task } from "@prisma/client";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { prisma } from "src/config/prisma";
import { parentHasCompanionFeature } from "src/middlewares/companion-access";
import { NotificationService } from "src/services/notification.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";

dayjs.extend(utc);
dayjs.extend(timezone);

export class TaskReminderEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskReminderEngineError";
  }
}

/**
 * The companion a task's reminder names, or null when there is none.
 */
const companionToRemindAbout = async (
  task: Pick<Task, "id" | "patientId">,
): Promise<{ name: string } | null> => {
  // A task without a companion has no one to name; an unset id must
  // never reach the query, where it would match any companion.
  const companion = task.patientId
    ? await prisma.patient.findFirst({
        where: { id: task.patientId },
        select: { name: true },
      })
    : null;
  if (!companion) {
    console.warn(`Skipping reminder for task ${task.id}; companion not found`);
    return null;
  }
  return companion;
};

/** A parent task's assignee must still be a parent who may work on it. */
const mayRemindAssignee = async (
  task: Pick<Task, "patientId" | "audience" | "assignedTo">,
): Promise<boolean> =>
  task.audience !== "PARENT_TASK" ||
  parentHasCompanionFeature(task.assignedTo, task.patientId, "tasks");

export const TaskReminderEngine = {
  /**
   * Runs every 1 minute
   */
  async run() {
    const nowUtc = dayjs.utc();

    // Bound the scan with a lookback grace window rather than an upper
    // bound of "now": a `dueAt >= now` filter excludes a task the instant
    // its due time passes, which for a zero-offset reminder (fire at due
    // time) means no worker tick ever sees it - the tick just before due
    // finds it too early, and the tick just after finds it already
    // filtered out. `reminder.scheduledNotificationId` (checked below)
    // is what actually stops a reminder from resending, so the query only
    // needs to keep the scan bounded, not gate delivery.
    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueAt: { gte: nowUtc.subtract(1, "day").toDate() },
      },
    });

    for (const task of tasks) {
      try {
        const reminder = task.reminder as {
          enabled?: boolean;
          offsetMinutes?: number;
          scheduledNotificationId?: string;
        } | null;
        if (!reminder?.enabled) continue;
        if (reminder.scheduledNotificationId) continue;
        if (typeof reminder.offsetMinutes !== "number") continue;

        const tz = task.timezone || "UTC";
        const dueAtLocal = dayjs(task.dueAt).tz(tz);
        const reminderAtLocal = dueAtLocal.subtract(
          reminder.offsetMinutes,
          "minute",
        );
        const nowLocal = nowUtc.tz(tz);
        if (nowLocal.isBefore(reminderAtLocal)) continue;

        const humanTime = dueAtLocal.format("MMM D, h:mm A");

        const companion = await companionToRemindAbout(task);
        if (!companion) continue;

        // Handled like a sent reminder, so it is never re-checked or sent late.
        if (!(await mayRemindAssignee(task))) {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              reminder: { ...reminder, scheduledNotificationId: "skipped" },
            },
          });
          continue;
        }

        const payload = NotificationTemplates.Task.TASK_DUE_REMINDER(
          companion.name,
          task.name,
          humanTime,
        );

        const result = await NotificationService.sendToUser(
          task.assignedTo,
          payload,
        );

        const nextReminder = {
          ...reminder,
          scheduledNotificationId: result?.[0]?.token ?? "sent",
        };

        await prisma.task.update({
          where: { id: task.id },
          data: {
            reminder: nextReminder,
          },
        });
      } catch (err) {
        console.error(`Failed reminder for task ${task.id}`, err);
      }
    }
  },
};
