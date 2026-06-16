// src/services/task.reminder.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
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

export const TaskReminderEngine = {
  /**
   * Runs every 1 minute
   */
  async run() {
    const nowUtc = dayjs.utc();

    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueAt: { gte: nowUtc.toDate() },
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

        const companion = await prisma.companion.findFirst({
          where: { id: task.companionId ?? undefined },
          select: { name: true },
        });
        if (!companion) {
          console.warn(
            `Skipping reminder for task ${task.id}; companion not found`,
          );
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
            reminder: nextReminder as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        console.error(`Failed reminder for task ${task.id}`, err);
      }
    }
  },
};
