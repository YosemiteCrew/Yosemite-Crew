export {};

const queueCtor = jest.fn();

jest.mock("bullmq", () => ({
  Queue: class {
    constructor(...args: unknown[]) {
      queueCtor(...args);
    }
  },
}));

jest.mock("src/queues/bull.config", () => ({
  defaultQueueOptions: { connection: { host: "127.0.0.1", port: 6379 } },
}));

describe("developer-meter.queue", () => {
  beforeEach(() => {
    queueCtor.mockReset();
    jest.resetModules();
  });

  it("constructs the durable delivery queue with bounded job history", () => {
    const mod = require("src/queues/developer-meter.queue");

    expect(mod.DeveloperMeterQueue).toBeInstanceOf(Object);
    expect(mod.DeveloperMeterJobs.DRAIN_EVENTS).toBe("DRAIN_EVENTS");
    expect(queueCtor).toHaveBeenCalledWith(
      "developer-meter-delivery",
      expect.objectContaining({
        connection: { host: "127.0.0.1", port: 6379 },
        defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
      }),
    );
  });
});
