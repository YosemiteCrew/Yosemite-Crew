import { IdexxReferenceQueue } from "../../src/queues/idexx-reference.queue";
import { registerIdexxReferenceScheduler } from "../../src/queues/idexx-reference.scheduler";

jest.mock("../../src/queues/idexx-reference.queue", () => ({
  IdexxReferenceQueue: {
    add: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  info: jest.fn(),
}));

describe("registerIdexxReferenceScheduler", () => {
  const mockedQueue = IdexxReferenceQueue as unknown as {
    add: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enqueues one startup sync and one weekly repeat", async () => {
    await registerIdexxReferenceScheduler();

    expect(mockedQueue.add).toHaveBeenCalledTimes(2);
    expect(mockedQueue.add).toHaveBeenNthCalledWith(1, "sync", {}, {});
    expect(mockedQueue.add).toHaveBeenNthCalledWith(
      2,
      "sync",
      {},
      {
        repeat: { every: 7 * 24 * 60 * 60 * 1000 },
        jobId: "idexx-reference-weekly",
      },
    );
  });
});
