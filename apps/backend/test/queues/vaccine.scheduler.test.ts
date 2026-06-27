import { VaccineReminderQueue } from "../../src/queues/vaccine.queues";
import { registerVaccineReminderScheduler } from "../../src/queues/vaccine.scheduler";

jest.mock("../../src/queues/vaccine.queues", () => ({
  VaccineReminderQueue: {
    add: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

describe("registerVaccineReminderScheduler", () => {
  const mockedQueue = VaccineReminderQueue as unknown as { add: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enqueues a daily repeating vaccine-reminder job", async () => {
    await registerVaccineReminderScheduler();

    expect(mockedQueue.add).toHaveBeenCalledWith(
      "run",
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 },
        jobId: "vaccine-reminder-repeat",
      },
    );
  });
});
