import { ParasiteRiskQueue } from "../../src/queues/parasite-risk.queue";
import { registerParasiteRiskScheduler } from "../../src/queues/parasite-risk.scheduler";

jest.mock("../../src/queues/parasite-risk.queue", () => ({
  ParasiteRiskQueue: {
    upsertJobScheduler: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

describe("registerParasiteRiskScheduler", () => {
  it("registers the daily parasite-risk refresh", async () => {
    await registerParasiteRiskScheduler();

    expect(ParasiteRiskQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "parasite-risk-daily-refresh",
      { pattern: "0 3 * * *" },
      { name: "refresh", data: {} },
    );
  });
});
