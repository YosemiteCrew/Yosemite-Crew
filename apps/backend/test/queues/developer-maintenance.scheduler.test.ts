import { DeveloperMaintenanceQueue } from "../../src/queues/developer-maintenance.queue";
import { registerDeveloperMaintenanceScheduler } from "../../src/queues/developer-maintenance.scheduler";

jest.mock("../../src/queues/developer-maintenance.queue", () => ({
  DeveloperMaintenanceQueue: {
    add: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  info: jest.fn(),
}));

describe("registerDeveloperMaintenanceScheduler", () => {
  const mockedQueue = DeveloperMaintenanceQueue as unknown as {
    add: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers exactly one daily repeatable job (the expiry-reminder dedupe relies on it)", async () => {
    await registerDeveloperMaintenanceScheduler();

    expect(mockedQueue.add).toHaveBeenCalledTimes(1);
    expect(mockedQueue.add).toHaveBeenCalledWith(
      "run",
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 },
        jobId: "developer-maintenance-daily",
      },
    );
  });
});
