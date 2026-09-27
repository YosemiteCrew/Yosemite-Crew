import { CareReminderQueue } from "../../src/queues/care-reminder.queue";
import { registerCareReminderScheduler } from "../../src/queues/care-reminder.scheduler";

jest.mock("../../src/queues/care-reminder.queue", () => ({
  CareReminderQueue: { upsertJobScheduler: jest.fn() },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

it("registers due reminders for one-minute dispatch", async () => {
  await registerCareReminderScheduler();
  expect(CareReminderQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "care-reminder-due-dispatch",
    { every: 60_000 },
    { name: "dispatch-due", data: {} },
  );
});
