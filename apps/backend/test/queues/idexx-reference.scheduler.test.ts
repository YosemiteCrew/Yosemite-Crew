import { IdexxReferenceQueue } from "../../src/queues/idexx-reference.queue";
import { registerIdexxReferenceScheduler } from "../../src/queues/idexx-reference.scheduler";

jest.mock("../../src/queues/idexx-reference.queue", () => ({
  IdexxReferenceQueue: {
    add: jest.fn(),
    upsertJobScheduler: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  info: jest.fn(),
}));

describe("registerIdexxReferenceScheduler", () => {
  const mockedQueue = IdexxReferenceQueue as unknown as {
    add: jest.Mock;
    upsertJobScheduler: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The one-off startup sync stays an ordinary add; only the recurring leg
  // moved to a scheduler, because bullmq 6 dropped `repeat` from JobsOptions.
  it("enqueues one startup sync and registers one weekly scheduler", async () => {
    await registerIdexxReferenceScheduler();

    expect(mockedQueue.add).toHaveBeenCalledTimes(1);
    expect(mockedQueue.add).toHaveBeenCalledWith(
      "sync",
      {},
      { jobId: "idexx-reference-startup" },
    );

    expect(mockedQueue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(mockedQueue.upsertJobScheduler).toHaveBeenCalledWith(
      "idexx-reference-weekly",
      { every: 7 * 24 * 60 * 60 * 1000 },
      { name: "sync", data: {} },
    );
  });

  // The old `repeat` option is gone from Queue.add in bullmq 6 and is silently
  // ignored rather than rejected at runtime, so a regression here would look
  // like a scheduler that simply never fires.
  it("no longer passes a repeat option to add", async () => {
    await registerIdexxReferenceScheduler();

    for (const [, , opts] of mockedQueue.add.mock.calls) {
      expect(opts).not.toHaveProperty("repeat");
    }
  });

  it("keeps stable ids so restarts do not stack duplicates", async () => {
    await registerIdexxReferenceScheduler();
    await registerIdexxReferenceScheduler();

    const addIds = mockedQueue.add.mock.calls.map(([, , opts]) => opts?.jobId);
    const schedulerIds = mockedQueue.upsertJobScheduler.mock.calls.map(
      ([id]) => id,
    );

    expect(addIds).toEqual([
      "idexx-reference-startup",
      "idexx-reference-startup",
    ]);
    expect(schedulerIds).toEqual([
      "idexx-reference-weekly",
      "idexx-reference-weekly",
    ]);
    expect([...addIds, ...schedulerIds]).not.toContain(undefined);
  });
});
