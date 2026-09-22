const workerInstances: Array<{
  name: string;
  processor: (job: { name: string }) => Promise<unknown>;
  handlers: Record<string, (...args: unknown[]) => void>;
}> = [];

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation((name: string, processor: any) => {
    const instance = {
      name,
      processor,
      handlers: {} as Record<string, (...args: unknown[]) => void>,
      on(event: string, handler: (...args: unknown[]) => void) {
        this.handlers[event] = handler;
        return this;
      },
    };
    workerInstances.push(instance as never);
    return instance;
  }),
}));

jest.mock("../../src/queues/bull.config", () => ({
  redisConnection: { host: "localhost", port: 6379 },
}));

jest.mock("../../src/queues/developer-meter.queue", () => ({
  DeveloperMeterJobs: { DRAIN_EVENTS: "DRAIN_EVENTS" },
}));

const info = jest.fn();
const error = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info, error },
}));

const drainMeterEvents = jest.fn();
jest.mock("src/services/developer-usage.service", () => ({
  DeveloperUsageService: { drainMeterEvents },
}));

import "../../src/workers/developer-meter.worker";

const worker = workerInstances[0];
const summary = {
  delivered: 2,
  retrying: 1,
  pending: 5,
  oldestPendingSeconds: 900,
};

beforeEach(() => {
  info.mockClear();
  error.mockClear();
  drainMeterEvents.mockReset();
});

describe("DeveloperMeterWorker", () => {
  it("listens on the meter delivery queue", () => {
    expect(worker.name).toBe("developer-meter-delivery");
  });

  it("drains and logs operational counts", async () => {
    drainMeterEvents.mockResolvedValue(summary);

    await expect(worker.processor({ name: "DRAIN_EVENTS" })).resolves.toEqual(
      summary,
    );
    expect(info).toHaveBeenCalledWith(
      "Developer meter delivery drain",
      summary,
    );
  });

  it("rejects an unknown job", async () => {
    await expect(worker.processor({ name: "UNKNOWN" })).rejects.toThrow(
      "Unknown job name: UNKNOWN",
    );
    expect(drainMeterEvents).not.toHaveBeenCalled();
  });

  it("logs a failed drain", () => {
    const failure = new Error("redis unavailable");
    worker.handlers.failed(undefined, failure);
    expect(error).toHaveBeenCalledWith(
      "Developer meter delivery drain failed",
      failure,
    );
  });
});
