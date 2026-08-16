import { VaccineReminderQueue } from "../../src/queues/vaccine.queues";
import { registerVaccineReminderScheduler } from "../../src/queues/vaccine.scheduler";

jest.mock("../../src/queues/vaccine.queues", () => ({
  VaccineReminderQueue: {
    upsertJobScheduler: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn() },
}));

describe("registerVaccineReminderScheduler", () => {
  const mockedQueue = VaccineReminderQueue as unknown as {
    upsertJobScheduler: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a daily repeating vaccine-reminder job scheduler", async () => {
    await registerVaccineReminderScheduler();

    expect(mockedQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "vaccine-reminder-repeat",
      { every: 24 * 60 * 60 * 1000 },
      { name: "run", data: {} },
    );
  });
});
