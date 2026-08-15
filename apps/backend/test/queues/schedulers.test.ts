import {
  AppointmentQueue,
  AppointmentJobs,
} from "../../src/queues/appointment.queue";
import { LabResultsQueue } from "../../src/queues/lab-results.queue";
import { LabStatusQueue } from "../../src/queues/lab-status.queue";
import { TaskScheduleQueue } from "../../src/queues/task-schedule.queue";
import {
  TaskRecurrenceQueue,
  TaskReminderQueue,
} from "../../src/queues/task.queues";
import { registerAppointmentSchedulers } from "../../src/queues/appointment.scheduler";
import { registerLabResultsScheduler } from "../../src/queues/lab-results.scheduler";
import { registerLabStatusScheduler } from "../../src/queues/lab-status.scheduler";
import { registerTaskScheduleSchedulers } from "../../src/queues/task-schedule.scheduler";
import { registerTaskSchedulers } from "../../src/queues/task.schedulers";

const queueDouble = () => ({ add: jest.fn(), upsertJobScheduler: jest.fn() });

jest.mock("../../src/queues/appointment.queue", () => ({
  AppointmentQueue: { add: jest.fn(), upsertJobScheduler: jest.fn() },
  AppointmentJobs: { MARK_NO_SHOW: "MARK_NO_SHOW" },
}));
jest.mock("../../src/queues/lab-results.queue", () => ({
  LabResultsQueue: { add: jest.fn(), upsertJobScheduler: jest.fn() },
}));
jest.mock("../../src/queues/lab-status.queue", () => ({
  LabStatusQueue: { add: jest.fn(), upsertJobScheduler: jest.fn() },
}));
jest.mock("../../src/queues/task-schedule.queue", () => ({
  TaskScheduleQueue: { add: jest.fn(), upsertJobScheduler: jest.fn() },
}));
jest.mock("../../src/queues/task.queues", () => ({
  TaskRecurrenceQueue: { add: jest.fn(), upsertJobScheduler: jest.fn() },
  TaskReminderQueue: { add: jest.fn(), upsertJobScheduler: jest.fn() },
}));

jest.mock("src/utils/logger", () => ({ info: jest.fn() }));

type QueueDouble = ReturnType<typeof queueDouble>;

const asDouble = (queue: unknown) => queue as unknown as QueueDouble;

const MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * MINUTE;

/**
 * Every recurring registration in bullmq 6, with the schedule each one is
 * expected to keep. The ids and intervals are asserted literally rather than
 * derived from the source, so a change of cadence has to be made deliberately
 * here as well as in the scheduler.
 */
const registrations = [
  {
    label: "appointment status updater",
    register: registerAppointmentSchedulers,
    queues: [AppointmentQueue],
    expected: [
      {
        queue: AppointmentQueue,
        id: "appointment-status-updater-repeat",
        every: MINUTE,
        job: AppointmentJobs.MARK_NO_SHOW,
      },
    ],
  },
  {
    label: "lab results poll",
    register: registerLabResultsScheduler,
    queues: [LabResultsQueue],
    expected: [
      {
        queue: LabResultsQueue,
        id: "lab-results-poll-repeat",
        every: FIVE_MINUTES,
        job: "poll",
      },
    ],
  },
  {
    label: "lab status poll",
    register: registerLabStatusScheduler,
    queues: [LabStatusQueue],
    expected: [
      {
        queue: LabStatusQueue,
        id: "lab-status-poll-repeat",
        every: FIVE_MINUTES,
        job: "poll",
      },
    ],
  },
  {
    label: "task schedule runner",
    register: registerTaskScheduleSchedulers,
    queues: [TaskScheduleQueue],
    expected: [
      {
        queue: TaskScheduleQueue,
        id: "task-schedule-repeat",
        every: MINUTE,
        job: "run",
      },
    ],
  },
  {
    label: "task recurrence and reminder",
    register: registerTaskSchedulers,
    queues: [TaskRecurrenceQueue, TaskReminderQueue],
    expected: [
      {
        queue: TaskRecurrenceQueue,
        id: "task-recurrence-repeat",
        every: 6 * 60 * MINUTE,
        job: "run",
      },
      {
        queue: TaskReminderQueue,
        id: "task-reminder-repeat",
        every: MINUTE,
        job: "run",
      },
    ],
  },
] as const;

describe("bullmq 6 recurring job registration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each(registrations)("$label", ({ register, queues, expected }) => {
    it("registers each recurring job on its own schedule", async () => {
      await register();

      for (const { queue, id, every, job } of expected) {
        expect(asDouble(queue).upsertJobScheduler).toHaveBeenCalledWith(
          id,
          { every },
          { name: job, data: {} },
        );
      }

      const registered = queues.reduce(
        (total, queue) =>
          total + asDouble(queue).upsertJobScheduler.mock.calls.length,
        0,
      );
      expect(registered).toBe(expected.length);
    });

    // bullmq 6 removed `repeat` from JobsOptions. It is dropped silently rather
    // than rejected, so a job left on the old API would simply never fire and
    // nothing would report an error.
    it("no longer schedules recurrence through Queue.add", async () => {
      await register();

      for (const queue of queues) {
        expect(asDouble(queue).add).not.toHaveBeenCalled();
      }
    });

    // Registration runs on every boot, so the ids have to be stable or each
    // restart stacks another copy of the same recurring job.
    it("reuses the same ids across restarts", async () => {
      await register();
      await register();

      for (const queue of queues) {
        const ids = asDouble(queue).upsertJobScheduler.mock.calls.map(
          ([schedulerId]) => schedulerId,
        );
        let perQueue = 0;
        for (const registration of expected) {
          if (registration.queue === queue) {
            perQueue += 1;
          }
        }

        // Two boots must produce twice the calls but the same set of ids.
        expect(ids).toHaveLength(2 * perQueue);
        expect(new Set(ids).size).toBe(perQueue);
        expect(ids).not.toContain(undefined);
      }
    });
  });

  it("gives every recurring job across the app a distinct id", async () => {
    for (const { register } of registrations) {
      await register();
    }

    const allQueues = [
      AppointmentQueue,
      LabResultsQueue,
      LabStatusQueue,
      TaskScheduleQueue,
      TaskRecurrenceQueue,
      TaskReminderQueue,
    ];
    const ids = allQueues.flatMap((queue) =>
      asDouble(queue).upsertJobScheduler.mock.calls.map(([id]) => id),
    );

    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
