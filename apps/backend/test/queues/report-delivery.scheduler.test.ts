import { ReportDeliveryQueue } from "../../src/queues/report-delivery.queue";
import { registerReportDeliveryScheduler } from "../../src/queues/report-delivery.scheduler";

jest.mock("../../src/queues/report-delivery.queue", () => ({
  ReportDeliveryQueue: { upsertJobScheduler: jest.fn() },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

it("registers due report delivery every minute", async () => {
  await registerReportDeliveryScheduler();
  expect(ReportDeliveryQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "report-delivery-due-dispatch",
    { every: 60_000 },
    { name: "dispatch-due", data: {} },
  );
});
