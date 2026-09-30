import { CareReminderService } from "../../src/services/care-reminder.service";

type WorkerInstance = {
  name: string;
  processor: () => Promise<number>;
  on: jest.Mock;
};
const mockWorkerInstances: WorkerInstance[] = [];

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation((name, processor) => {
    const worker = { name, processor, on: jest.fn() };
    mockWorkerInstances.push(worker);
    return worker;
  }),
}));
jest.mock("../../src/services/care-reminder.service", () => ({
  CareReminderService: { sendScheduledDue: jest.fn() },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

it("runs scheduled delivery and reports worker lifecycle events", async () => {
  (CareReminderService.sendScheduledDue as jest.Mock).mockResolvedValue(2);
  await import("../../src/workers/care-reminder.worker");
  const worker = mockWorkerInstances.find(
    ({ name }) => name === "care-reminder",
  );

  await expect(worker?.processor()).resolves.toBe(2);
  expect(CareReminderService.sendScheduledDue).toHaveBeenCalled();

  const completed = worker?.on.mock.calls.find(
    ([event]) => event === "completed",
  );
  const failed = worker?.on.mock.calls.find(([event]) => event === "failed");
  completed?.[1]({ id: "job-1" }, 2);
  failed?.[1]({ id: "job-2" }, new Error("redis unavailable"));
  expect(completed).toBeDefined();
  expect(failed).toBeDefined();
});
