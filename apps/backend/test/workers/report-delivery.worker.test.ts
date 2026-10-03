const handlers = new Map<string, (...args: unknown[]) => unknown>();
let processor: (() => Promise<number>) | undefined;

jest.mock("bullmq", () => ({
  Worker: function Worker(
    _name: string,
    run: () => Promise<number>,
    _options: unknown,
  ) {
    processor = run;
    return {
      on: (event: string, handler: (...args: unknown[]) => unknown) =>
        handlers.set(event, handler),
    };
  },
}));
jest.mock("../../src/queues/bull.config", () => ({
  redisConnection: { host: "redis" },
}));
jest.mock("../../src/services/saved-report.service", () => ({
  SavedReportService: { deliverDue: jest.fn().mockResolvedValue(2) },
}));
const info = jest.fn();
const error = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info, error },
}));

it("runs due deliveries and reports worker outcomes", async () => {
  await import("../../src/workers/report-delivery.worker");
  await expect(processor?.()).resolves.toBe(2);
  handlers.get("completed")?.({ id: "job-1" }, 2);
  handlers.get("failed")?.({ id: "job-2" }, new Error("failed"));
  expect(info).toHaveBeenCalledWith("Scheduled reports processed", {
    jobId: "job-1",
    count: 2,
  });
  expect(error).toHaveBeenCalledWith(
    "Scheduled report delivery failed",
    expect.objectContaining({ jobId: "job-2" }),
  );
});
