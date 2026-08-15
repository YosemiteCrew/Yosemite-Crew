import {
  isLegacyRepeatableKey,
  pruneLegacyRepeatables,
  pruneLegacyRepeatablesAcross,
  SchedulerCapableQueue,
} from "../../src/queues/legacy-repeatables";

const warn = jest.fn();
const info = jest.fn();
jest.mock("src/utils/logger", () => ({
  warn: (...args: unknown[]) => warn(...args),
  info: (...args: unknown[]) => info(...args),
}));

// A real bullmq 5 repeat key: the md5 of "name:jobId:endDate:tz:every".
const LEGACY_A = "4e6026e1b5e80c93a279dc4c7cc5242f";
const LEGACY_B = "0123456789abcdef0123456789abcdef";

const makeQueue = (
  name: string,
  keys: string[],
  removeImpl?: jest.Mock,
): SchedulerCapableQueue & {
  getJobSchedulers: jest.Mock;
  removeJobScheduler: jest.Mock;
} => ({
  name,
  getJobSchedulers: jest.fn().mockResolvedValue(keys.map((key) => ({ key }))),
  removeJobScheduler: removeImpl ?? jest.fn().mockResolvedValue(true),
});

describe("isLegacyRepeatableKey", () => {
  it("recognises a 32 character hex digest", () => {
    expect(isLegacyRepeatableKey(LEGACY_A)).toBe(true);
    expect(isLegacyRepeatableKey(LEGACY_B)).toBe(true);
  });

  // The ids this app registers must never be mistaken for legacy keys, or the
  // prune would delete the schedulers it is about to create.
  it("does not match any id this app registers", () => {
    for (const id of [
      "appointment-status-updater-repeat",
      "idexx-reference-weekly",
      "idexx-reference-startup",
      "lab-results-poll-repeat",
      "lab-status-poll-repeat",
      "task-schedule-repeat",
      "task-recurrence-repeat",
      "task-reminder-repeat",
    ]) {
      expect(isLegacyRepeatableKey(id)).toBe(false);
    }
  });

  it("rejects near misses and non-strings", () => {
    expect(isLegacyRepeatableKey(LEGACY_A.slice(0, 31))).toBe(false);
    expect(isLegacyRepeatableKey(`${LEGACY_A}0`)).toBe(false);
    expect(isLegacyRepeatableKey(LEGACY_A.toUpperCase())).toBe(false);
    expect(isLegacyRepeatableKey("g".repeat(32))).toBe(false);
    expect(isLegacyRepeatableKey(undefined)).toBe(false);
    expect(isLegacyRepeatableKey(null)).toBe(false);
    expect(isLegacyRepeatableKey(32)).toBe(false);
  });
});

describe("pruneLegacyRepeatables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes the bullmq 5 entries and leaves the modern ones alone", async () => {
    const queue = makeQueue("appointments", [
      LEGACY_A,
      "appointment-status-updater-repeat",
      LEGACY_B,
    ]);

    const removed = await pruneLegacyRepeatables(queue);

    expect(removed).toEqual([LEGACY_A, LEGACY_B]);
    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith(LEGACY_A);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith(LEGACY_B);
    expect(queue.removeJobScheduler).not.toHaveBeenCalledWith(
      "appointment-status-updater-repeat",
    );
  });

  it("does nothing on a queue that has already been migrated", async () => {
    const queue = makeQueue("appointments", [
      "appointment-status-updater-repeat",
    ]);

    await expect(pruneLegacyRepeatables(queue)).resolves.toEqual([]);
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("tolerates an empty or malformed scheduler list", async () => {
    const empty = makeQueue("empty", []);
    await expect(pruneLegacyRepeatables(empty)).resolves.toEqual([]);

    const malformed: SchedulerCapableQueue = {
      name: "malformed",
      getJobSchedulers: jest
        .fn()
        .mockResolvedValue([null, undefined, { key: LEGACY_A }]),
      removeJobScheduler: jest.fn().mockResolvedValue(true),
    };
    await expect(pruneLegacyRepeatables(malformed)).resolves.toEqual([
      LEGACY_A,
    ]);
  });

  // Leaving one stale entry costs a duplicate job; throwing here would take the
  // whole API down, because initQueues is awaited before the server listens.
  it("does not fail the boot when a removal errors", async () => {
    const removeJobScheduler = jest
      .fn()
      .mockRejectedValueOnce(new Error("redis unavailable"))
      .mockResolvedValueOnce(true);
    const queue = makeQueue(
      "appointments",
      [LEGACY_A, LEGACY_B],
      removeJobScheduler,
    );

    const removed = await pruneLegacyRepeatables(queue);

    expect(removed).toEqual([LEGACY_B]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("redis unavailable"),
    );
  });

  it("tolerates a driver that returns no scheduler list at all", async () => {
    const nothing: SchedulerCapableQueue = {
      name: "nothing",
      getJobSchedulers: jest.fn().mockResolvedValue(undefined),
      removeJobScheduler: jest.fn().mockResolvedValue(true),
    };

    await expect(pruneLegacyRepeatables(nothing)).resolves.toEqual([]);
    expect(nothing.removeJobScheduler).not.toHaveBeenCalled();
  });

  // removeJobScheduler returns whether it actually removed anything. A false is
  // not an error - the entry was already gone - but counting it as a removal
  // would report work that never happened.
  it("does not count an entry the driver reports as not removed", async () => {
    const queue = makeQueue(
      "appointments",
      [LEGACY_A, LEGACY_B],
      jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    );

    const removed = await pruneLegacyRepeatables(queue);

    expect(removed).toEqual([LEGACY_B]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("may already be gone"),
    );
    expect(info).toHaveBeenCalledWith(expect.stringContaining("1 bullmq 5"));
  });

  it("reports nothing removed when the driver removes nothing", async () => {
    const queue = makeQueue(
      "appointments",
      [LEGACY_A],
      jest.fn().mockResolvedValue(false),
    );

    await expect(pruneLegacyRepeatables(queue)).resolves.toEqual([]);
    expect(info).not.toHaveBeenCalled();
  });

  it("logs a non-Error rejection without crashing", async () => {
    const queue = makeQueue(
      "appointments",
      [LEGACY_A],
      jest.fn().mockRejectedValue("redis said no"),
    );

    await expect(pruneLegacyRepeatables(queue)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("redis said no"));
  });

  it("reports what it removed", async () => {
    const queue = makeQueue("appointments", [LEGACY_A]);
    await pruneLegacyRepeatables(queue);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("1 bullmq 5"));

    jest.clearAllMocks();
    const two = makeQueue("appointments", [LEGACY_A, LEGACY_B]);
    await pruneLegacyRepeatables(two);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("2 bullmq 5"));
  });
});

describe("pruneLegacyRepeatablesAcross", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sweeps every queue it is given", async () => {
    const a = makeQueue("appointments", [LEGACY_A, "appointment-repeat"]);
    const b = makeQueue("lab-results", ["lab-results-poll-repeat"]);
    const c = makeQueue("tasks", [LEGACY_B]);

    const removed = await pruneLegacyRepeatablesAcross([a, b, c]);

    expect(removed).toEqual([LEGACY_A, LEGACY_B]);
    expect(a.getJobSchedulers).toHaveBeenCalledTimes(1);
    expect(b.getJobSchedulers).toHaveBeenCalledTimes(1);
    expect(c.getJobSchedulers).toHaveBeenCalledTimes(1);
    expect(b.removeJobScheduler).not.toHaveBeenCalled();
  });

  it("keeps going past a queue that fails", async () => {
    const failing = makeQueue(
      "appointments",
      [LEGACY_A],
      jest.fn().mockRejectedValue(new Error("nope")),
    );
    const healthy = makeQueue("tasks", [LEGACY_B]);

    await expect(
      pruneLegacyRepeatablesAcross([failing, healthy]),
    ).resolves.toEqual([LEGACY_B]);
    expect(healthy.removeJobScheduler).toHaveBeenCalledWith(LEGACY_B);
  });
});
