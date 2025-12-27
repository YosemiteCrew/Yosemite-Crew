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
   * Runs every 1 minute
   */
  async run() {
    const nowUtc = dayjs.utc();

    const tasks = await TaskModel.find({
      "reminder.enabled": true,
      "reminder.scheduledNotificationId": { $exists: false },
      status: { $in: ["PENDING", "IN_PROGRESS"] },
      dueAt: { $gte: nowUtc.toDate() },
    }).exec();

    for (const task of tasks) {
      try {
        const reminder = task.reminder;
        if (!reminder) continue;

        const tz = task.timezone || "UTC";

        const dueAtLocal = dayjs(task.dueAt).tz(tz);
        const reminderAtLocal = dueAtLocal.subtract(
          reminder.offsetMinutes,
          "minute",
        );

        const nowLocal = nowUtc.tz(tz);

        // Not time yet
        if (nowLocal.isBefore(reminderAtLocal)) continue;

        const humanTime = dueAtLocal.format("MMM D, h:mm A");

        const payload =
          NotificationTemplates.Task.TASK_DUE_REMINDER(
            task.companionId!,
            task.name,
            humanTime,
          );

        const result = await NotificationService.sendToUser(
          task.assignedTo,
          payload,
        );

        // ✅ Mark reminder as sent
        task.reminder!.scheduledNotificationId =
          result?.[0]?.token ?? "sent";

        await task.save();
      } catch (err) {
        console.error(
          `Failed reminder for task ${String(task._id)}`,
          err,
        );
      }
    }
  },
};
