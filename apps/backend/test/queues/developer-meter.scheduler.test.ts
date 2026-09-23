import { DeveloperMeterQueue } from "../../src/queues/developer-meter.queue";
import { registerDeveloperMeterScheduler } from "../../src/queues/developer-meter.scheduler";

jest.mock("../../src/queues/developer-meter.queue", () => ({
  DeveloperMeterQueue: { upsertJobScheduler: jest.fn() },
  DeveloperMeterJobs: { DRAIN_EVENTS: "DRAIN_EVENTS" },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

it("registers the durable meter drain every 60 seconds", async () => {
  await registerDeveloperMeterScheduler();

  expect(DeveloperMeterQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "developer-meter-delivery-repeat",
    { every: 60 * 1000 },
    { name: "DRAIN_EVENTS", data: {} },
  );
});
