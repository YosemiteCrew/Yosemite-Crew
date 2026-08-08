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
    expect(mockedQueue.add).toHaveBeenNthCalledWith(
      1,
      "sync",
      {},
      { jobId: "idexx-reference-startup" },
    );
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

  it("gives every enqueued job a stable id so restarts do not stack duplicates", async () => {
    await registerIdexxReferenceScheduler();
    await registerIdexxReferenceScheduler();

    const jobIds = mockedQueue.add.mock.calls.map(([, , opts]) => opts?.jobId);

    expect(jobIds).toEqual([
      "idexx-reference-startup",
      "idexx-reference-weekly",
      "idexx-reference-startup",
      "idexx-reference-weekly",
    ]);
    expect(jobIds).not.toContain(undefined);
  });
});
