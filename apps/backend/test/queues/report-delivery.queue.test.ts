const queueConstructor = jest.fn();
jest.mock("bullmq", () => ({
  Queue: function Queue(...args: unknown[]) {
    queueConstructor(...args);
  },
}));

jest.mock("../../src/queues/bull.config", () => ({
  defaultQueueOptions: { connection: { host: "redis" } },
}));

it("configures report delivery jobs with bounded retention", async () => {
  await import("../../src/queues/report-delivery.queue");
  expect(queueConstructor).toHaveBeenCalledWith("report-delivery", {
    connection: { host: "redis" },
    defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
  });
});
