import { VaccineReminderEngine } from "../../src/services/vaccine.reminder.engine";

type WorkerCtor = (
  name: string,
  processor: () => Promise<void>,
  opts: unknown,
) => { on: jest.Mock };

const workerInstances: Array<{
  name: string;
  processor: () => Promise<void>;
  on: jest.Mock;
}> = [];
const queueArgs: Array<unknown[]> = [];

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(((name, processor) => {
    const on = jest.fn();
    workerInstances.push({ name, processor, on });
    return { on };
  }) as WorkerCtor),
  Queue: jest.fn().mockImplementation((...args: unknown[]) => {
    queueArgs.push(args);
    return { add: jest.fn() };
  }),
}));

jest.mock("../../src/services/vaccine.reminder.engine", () => ({
  VaccineReminderEngine: { run: jest.fn() },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

describe("VaccineReminderWorker", () => {
  it("registers a vaccine-reminder worker + queue that runs the engine", async () => {
    await import("../../src/queues/vaccine.queues");
    await import("../../src/workers/vaccineReminder.worker");

    expect(queueArgs[0]?.[0]).toBe("vaccine-reminder");

    const worker = workerInstances.find((w) => w.name === "vaccine-reminder");
    expect(worker).toBeDefined();

    await worker?.processor();
    expect(VaccineReminderEngine.run).toHaveBeenCalled();

    // Exercise the lifecycle event handlers.
    const completed = worker?.on.mock.calls.find((c) => c[0] === "completed");
    const failed = worker?.on.mock.calls.find((c) => c[0] === "failed");
    expect(completed).toBeDefined();
    expect(failed).toBeDefined();
    completed?.[1]();
    failed?.[1](undefined, new Error("boom"));
  });
});
