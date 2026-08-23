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

describe("ap-inbox.queue", () => {
  beforeEach(() => {
    queueCtor.mockReset();
    jest.resetModules();
  });

  it("constructs the Queue with the ap-inbox name and merged options", () => {
    const mod = require("src/queues/ap-inbox.queue");

    expect(mod.ApInboxQueue).toBeInstanceOf(Object);
    expect(queueCtor).toHaveBeenCalledTimes(1);

    const [name, options] = queueCtor.mock.calls[0];
    expect(name).toBe("ap-inbox");
    expect(options).toMatchObject({
      connection: { host: "127.0.0.1", port: 6379 },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3_000 },
        removeOnComplete: true,
        removeOnFail: 200,
      },
    });
  });
});
