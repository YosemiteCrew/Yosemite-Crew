// src/services/task.reminder.engine.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import TaskModel from "src/models/task";
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
   * Should run every 1–5 minutes via cron.
   */
  async run() {
    const nowUtc = dayjs.utc();

    const tasks = await TaskModel.find({
      "reminder.enabled": true,
      status: { $in: ["PENDING", "IN_PROGRESS"] },

      // do not remind for already expired tasks
      dueAt: { $gte: nowUtc.toDate() },
    }).exec();

    for (const task of tasks) {
      const reminder = task.reminder;
      if (!reminder) continue;

      // already sent?
      if (reminder.scheduledNotificationId) continue;

      const tz = task.timezone || "UTC";

      // Convert dueAt into user's timezone for reminder logic
      const dueAtLocal = dayjs(task.dueAt).tz(tz);

      // reminderAtLocal = dueAtLocal - offsetMinutes
      const reminderAtLocal = dueAtLocal.subtract(
        reminder.offsetMinutes || 0,
        "minute",
      );

      const nowLocal = nowUtc.tz(tz);

      if (nowLocal.isBefore(reminderAtLocal)) {
        continue; // not time yet
      }

      // Build notification text
      const humanTime = dueAtLocal.format("MMM D, h:mm A");

      const notifBody = NotificationTemplates.Task.TASK_DUE_REMINDER(
        task.companionId,
        task.name,
        humanTime,
      );

      // Send notification
      await NotificationService.sendToUser(task.assignedTo, notifBody);
      await task.save();
    }
  },
};
