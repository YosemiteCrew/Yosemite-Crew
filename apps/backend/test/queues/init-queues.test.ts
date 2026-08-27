import { beforeEach, describe, expect, it, jest } from "@jest/globals";

/**
 * `initQueues` is the single startup hook main.ts awaits before the HTTP server
 * listens. What matters about it is not that it runs, but the ordering
 * contract documented in src/queues/index.ts: the bullmq 5 legacy repeatables
 * must be pruned across every scheduled queue *before* any scheduler upserts
 * its replacement, otherwise both entries survive and every recurring job
 * fires twice. This suite pins that ordering, the exact queue set handed to the
 * prune, and the fact that a failing prune aborts the registration instead of
 * continuing half-configured.
 */

const queueDouble = (name: string) => ({
  name,
  getJobSchedulers: jest.fn(),
  removeJobScheduler: jest.fn(),
});

const appointmentQueue = queueDouble("appointment");
const idexxReferenceQueue = queueDouble("idexx-reference");
const labResultsQueue = queueDouble("lab-results");
const labStatusQueue = queueDouble("lab-status");
const taskScheduleQueue = queueDouble("task-schedule");
const taskRecurrenceQueue = queueDouble("task-recurrence");
const taskReminderQueue = queueDouble("task-reminder");
const vaccineReminderQueue = queueDouble("vaccine-reminder");
const publicBookingQueue = queueDouble("public-booking");

jest.mock("../../src/queues/appointment.queue", () => ({
  AppointmentQueue: appointmentQueue,
}));
jest.mock("../../src/queues/idexx-reference.queue", () => ({
  IdexxReferenceQueue: idexxReferenceQueue,
}));
jest.mock("../../src/queues/lab-results.queue", () => ({
  LabResultsQueue: labResultsQueue,
}));
jest.mock("../../src/queues/lab-status.queue", () => ({
  LabStatusQueue: labStatusQueue,
}));
jest.mock("../../src/queues/task-schedule.queue", () => ({
  TaskScheduleQueue: taskScheduleQueue,
}));
jest.mock("../../src/queues/task.queues", () => ({
  TaskRecurrenceQueue: taskRecurrenceQueue,
  TaskReminderQueue: taskReminderQueue,
}));
jest.mock("../../src/queues/vaccine.queues", () => ({
  VaccineReminderQueue: vaccineReminderQueue,
}));
jest.mock("../../src/queues/public-booking.queue", () => ({
  PublicBookingQueue: publicBookingQueue,
}));

const pruneLegacyRepeatablesAcross = jest.fn(
  async (..._queues: unknown[]): Promise<void> => undefined,
);
jest.mock("../../src/queues/legacy-repeatables", () => ({
  pruneLegacyRepeatablesAcross: (...args: unknown[]) =>
    pruneLegacyRepeatablesAcross(...(args as [])),
}));

const registerTaskSchedulers = jest.fn(async () => undefined);
const registerTaskScheduleSchedulers = jest.fn(async () => undefined);
const registerAppointmentSchedulers = jest.fn(async () => undefined);
const registerIdexxReferenceScheduler = jest.fn(async () => undefined);
const registerLabStatusScheduler = jest.fn(async () => undefined);
const registerLabResultsScheduler = jest.fn(async () => undefined);
const registerVaccineReminderScheduler = jest.fn(async () => undefined);
const registerPublicBookingSchedulers = jest.fn(async () => undefined);

jest.mock("../../src/queues/task.schedulers", () => ({
  registerTaskSchedulers: () => registerTaskSchedulers(),
}));
jest.mock("../../src/queues/task-schedule.scheduler", () => ({
  registerTaskScheduleSchedulers: () => registerTaskScheduleSchedulers(),
}));
jest.mock("../../src/queues/appointment.scheduler", () => ({
  registerAppointmentSchedulers: () => registerAppointmentSchedulers(),
}));
jest.mock("../../src/queues/idexx-reference.scheduler", () => ({
  registerIdexxReferenceScheduler: () => registerIdexxReferenceScheduler(),
}));
jest.mock("../../src/queues/lab-status.scheduler", () => ({
  registerLabStatusScheduler: () => registerLabStatusScheduler(),
}));
jest.mock("../../src/queues/lab-results.scheduler", () => ({
  registerLabResultsScheduler: () => registerLabResultsScheduler(),
}));
jest.mock("../../src/queues/vaccine.scheduler", () => ({
  registerVaccineReminderScheduler: () => registerVaccineReminderScheduler(),
}));
jest.mock("../../src/queues/public-booking.scheduler", () => ({
  registerPublicBookingSchedulers: () => registerPublicBookingSchedulers(),
}));

const info = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: (...args: unknown[]) => info(...args) },
}));

import { initQueues, scheduledQueues } from "../../src/queues";

const registrations = [
  registerTaskSchedulers,
  registerTaskScheduleSchedulers,
  registerAppointmentSchedulers,
  registerIdexxReferenceScheduler,
  registerLabStatusScheduler,
  registerLabResultsScheduler,
  registerVaccineReminderScheduler,
  registerPublicBookingSchedulers,
];

const orderOf = (mock: jest.Mock): number =>
  mock.mock.invocationCallOrder[0] as number;

beforeEach(() => {
  jest.clearAllMocks();
  pruneLegacyRepeatablesAcross.mockResolvedValue(undefined);
});

describe("scheduledQueues", () => {
  // The prune only reaches queues named here, so an added recurring queue that
  // is left out keeps its duplicated bullmq 5 repeatable forever.
  it("lists every queue that owns a job scheduler, once each", () => {
    expect(scheduledQueues).toEqual([
      appointmentQueue,
      idexxReferenceQueue,
      labResultsQueue,
      labStatusQueue,
      taskScheduleQueue,
      taskRecurrenceQueue,
      taskReminderQueue,
      vaccineReminderQueue,
      publicBookingQueue,
    ]);
    expect(new Set(scheduledQueues)).toHaveProperty("size", 9);
  });
});

describe("initQueues", () => {
  it("prunes the legacy repeatables across every scheduled queue before registering any scheduler", async () => {
    await initQueues();

    expect(pruneLegacyRepeatablesAcross).toHaveBeenCalledTimes(1);
    expect(pruneLegacyRepeatablesAcross).toHaveBeenCalledWith(scheduledQueues);

    const pruneOrder = orderOf(pruneLegacyRepeatablesAcross);
    for (const register of registrations) {
      expect(register).toHaveBeenCalledTimes(1);
      expect(orderOf(register)).toBeGreaterThan(pruneOrder);
    }
  });

  it("registers the schedulers in the declared order and announces completion", async () => {
    await initQueues();

    const orders = registrations.map(orderOf);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(info).toHaveBeenCalledWith("📬 BullMQ queues initialized");
  });

  // main.ts awaits initQueues before listening, so a rejected prune has to
  // surface rather than leaving the process serving traffic with stale
  // duplicate repeatables registered alongside fresh ones.
  it("propagates a prune failure and registers nothing", async () => {
    const failure = new Error("redis unreachable");
    pruneLegacyRepeatablesAcross.mockRejectedValueOnce(failure);

    await expect(initQueues()).rejects.toThrow("redis unreachable");

    for (const register of registrations) {
      expect(register).not.toHaveBeenCalled();
    }
    expect(info).not.toHaveBeenCalled();
  });

  it("propagates a scheduler failure and stops the remaining registrations", async () => {
    registerAppointmentSchedulers.mockRejectedValueOnce(
      new Error("scheduler upsert failed") as never,
    );

    await expect(initQueues()).rejects.toThrow("scheduler upsert failed");

    expect(registerTaskSchedulers).toHaveBeenCalledTimes(1);
    expect(registerIdexxReferenceScheduler).not.toHaveBeenCalled();
    expect(registerVaccineReminderScheduler).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
