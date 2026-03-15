// src/services/task.reminder.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import TaskModel from "src/models/task";
import { NotificationService } from "src/services/notification.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import CompanionModel from "src/models/companion";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

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

    if (isReadFromPostgres()) {
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

      return;
    }

    const tasks = await TaskModel.find({
      "reminder.enabled": true,
      "reminder.scheduledNotificationId": { $exists: false },
      status: { $in: ["PENDING", "IN_PROGRESS"] },
      dueAt: { $gte: nowUtc.toDate() },
    }).exec();

    for (const task of tasks) {
      try {
        const reminder = task.reminder;
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

        const companion = await CompanionModel.findById(task.companionId!);
        if (!companion) {
          console.warn(
            `Skipping reminder for task ${task._id.toString()}; companion not found`,
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

        task.reminder!.scheduledNotificationId = result?.[0]?.token ?? "sent";
        await task.save();

        if (shouldDualWrite) {
          try {
            await prisma.task.updateMany({
              where: { id: task._id.toString() },
              data: {
                reminder: task.reminder as unknown as Prisma.InputJsonValue,
                updatedAt: task.updatedAt ?? undefined,
              },
            });
          } catch (err) {
            handleDualWriteError("Task reminder update", err);
          }
        }
      } catch (err) {
        console.error(`Failed reminder for task ${task._id.toString()}`, err);
      }
    }
  },
};
