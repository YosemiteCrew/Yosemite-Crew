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

// The worker imports the job names from the queue module, which constructs a
// real Queue at import time. Mocking bullmq's Worker leaves no Queue to build.
jest.mock("../../src/queues/superadmin-contact.queue", () => ({
  SuperadminContactJobs: { DRAIN_FORWARDS: "DRAIN_FORWARDS" },
}));

const info = jest.fn();
const error = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info, error },
}));

const drainForwards = jest.fn();
jest.mock("src/services/superadmin-contact.service", () => ({
  SuperadminContactService: { drainForwards },
}));

import "../../src/workers/superadmin-contact.worker";

const worker = workerInstances[0];

const SUMMARY = {
  delivered: 2,
  retrying: 1,
  failed: 0,
  pending: 5,
  oldestPendingSeconds: 900,
};

beforeEach(() => {
  info.mockClear();
  error.mockClear();
  drainForwards.mockReset();
});

describe("SuperadminContactWorker", () => {
  it("listens on the forward queue", () => {
    expect(worker.name).toBe("superadmin-contact-forward");
  });

  it("drains and logs the tick as counts only", async () => {
    drainForwards.mockResolvedValue(SUMMARY);

    const result = await worker.processor({ name: "DRAIN_FORWARDS" });

    expect(drainForwards).toHaveBeenCalledTimes(1);
    expect(result).toEqual(SUMMARY);
    // This line is the mirror's only end-to-end health signal - only the
    // sender can see what has not arrived - so it has to carry the pending
    // backlog, and nothing from the submissions themselves.
    expect(info).toHaveBeenCalledWith(
      "📮 SuperAdmin contact forward drain",
      SUMMARY,
    );
  });

  it("rejects an unknown job name", async () => {
    await expect(worker.processor({ name: "SOMETHING_ELSE" })).rejects.toThrow(
      "Unknown job name: SOMETHING_ELSE",
    );
    expect(drainForwards).not.toHaveBeenCalled();
  });

  it("logs a failed tick", () => {
    const failure = new Error("redis unreachable");
    worker.handlers.failed(undefined, failure);
    expect(error).toHaveBeenCalledWith(
      "❌ SuperAdmin contact forward drain failed",
      failure,
    );
  });
});
