jest.mock("src/config/prisma", () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import type { NotificationType } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  main,
  planNotificationDedupe,
} from "src/scripts/dedupe-notification-twins";

const mocked = prisma as unknown as {
  notification: { findMany: jest.Mock; updateMany: jest.Mock };
};

beforeEach(() => jest.clearAllMocks());

const row = (
  overrides: Partial<{
    id: string;
    userId: string;
    title: string;
    body: string;
    // The real column type, so a value outside the enum fails type-check
    // instead of riding along as an opaque string. The singular form, which is
    // not a member, did exactly that here.
    type: NotificationType;
    isSeen: boolean;
    createdAt: Date;
  }> = {},
) => ({
  id: "n1",
  userId: "u1",
  title: "Appointment reminder",
  body: "Your visit is at 10:00.",
  type: "APPOINTMENTS" as NotificationType,
  isSeen: false,
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  ...overrides,
});

describe("planNotificationDedupe", () => {
  it("collapses two rows written for one push by the old per-token loop", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1", isSeen: false }),
      row({ id: "n2", createdAt: new Date("2026-09-01T10:00:01.000Z") }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toEqual([
      {
        userId: "u1",
        title: "Appointment reminder",
        body: "Your visit is at 10:00.",
        type: "APPOINTMENTS",
        winnerId: "n1",
        loserIds: ["n2"],
        anySeen: false,
      },
    ]);
  });

  it("keeps the earliest row as the winner", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1", createdAt: new Date("2026-09-01T10:00:02.000Z") }),
      row({
        id: "n2",
        isSeen: false,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
      }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toHaveLength(1);
    expect(groups[0].winnerId).toBe("n2");
    expect(groups[0].loserIds).toEqual(["n1"]);
  });

  it("carries isSeen forward when any twin was seen", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1", isSeen: true }),
      row({ id: "n2", createdAt: new Date("2026-09-01T10:00:01.000Z") }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toHaveLength(1);
    expect(groups[0].anySeen).toBe(true);
  });

  it("leaves a lone row alone", async () => {
    mocked.notification.findMany.mockResolvedValue([row()]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toEqual([]);
  });

  it("leaves two rows further apart than one fan-out alone", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1" }),
      row({
        id: "n2",
        createdAt: new Date("2026-09-01T10:30:00.000Z"),
      }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toEqual([]);
  });

  // The blocker this rule exists for. Appointment.CANCELLED renders only the
  // pet name and Payment.PAYMENT_FAILED takes no arguments at all, so two
  // distinct events for one owner are byte-identical on the whole key. Only
  // the gap can tell them apart, and a retry seconds later is the worst case.
  it("leaves two distinct sends of identical text alone", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({
        id: "first-failure",
        title: "Payment Failed",
        body: "Something went wrong with your payment.",
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
      }),
      row({
        id: "retry-failure",
        title: "Payment Failed",
        body: "Something went wrong with your payment.",
        createdAt: new Date("2026-09-01T10:00:05.000Z"),
      }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toEqual([]);
  });

  it("collapses each fan-out separately when the same text recurs", async () => {
    const fanOut = (id: string, at: string) =>
      row({ id, title: "Refill ready", createdAt: new Date(at) });
    mocked.notification.findMany.mockResolvedValue([
      fanOut("jul-phone", "2026-07-01T10:00:00.000Z"),
      fanOut("jul-tablet", "2026-07-01T10:00:00.300Z"),
      fanOut("aug-phone", "2026-08-01T10:00:00.000Z"),
      fanOut("aug-tablet", "2026-08-01T10:00:00.300Z"),
    ]);

    const { groups } = await planNotificationDedupe();

    // Two pushes a month apart, one key. The whole-group span guard this
    // replaced rejected the key on those extremes and archived nothing, so the
    // owners with the MOST duplicated rows were the ones it never helped.
    expect(groups.map((g) => [g.winnerId, g.loserIds] as const)).toEqual([
      ["jul-phone", ["jul-tablet"]],
      ["aug-phone", ["aug-tablet"]],
    ]);
  });

  it("counts the rows it declined to collapse", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "pair-a", createdAt: new Date("2026-09-01T10:00:00.000Z") }),
      row({ id: "pair-b", createdAt: new Date("2026-09-01T10:00:00.200Z") }),
      row({ id: "loner", createdAt: new Date("2026-09-01T11:00:00.000Z") }),
    ]);

    const plan = await planNotificationDedupe();

    expect(plan.rowsExamined).toBe(3);
    expect(plan.groups).toHaveLength(1);
    // The lone row shares a key with the pair and was still left alone. It is
    // the only number in the dry run counted before the gap decision.
    expect(plan.rowsLeftUngrouped).toBe(1);
  });

  it("carries isSeen per fan-out rather than per key", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({
        id: "jul-phone",
        isSeen: true,
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      }),
      row({
        id: "jul-tablet",
        createdAt: new Date("2026-07-01T10:00:00.300Z"),
      }),
      row({ id: "aug-phone", createdAt: new Date("2026-08-01T10:00:00.000Z") }),
      row({
        id: "aug-tablet",
        createdAt: new Date("2026-08-01T10:00:00.300Z"),
      }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups.map((g) => [g.winnerId, g.anySeen] as const)).toEqual([
      ["jul-phone", true],
      // Read per key, a row seen in July marks August's winner seen too.
      ["aug-phone", false],
    ]);
  });

  it("groups by userId, title, body and type", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1", userId: "u1" }),
      row({
        id: "n2",
        userId: "u2",
        createdAt: new Date("2026-09-01T10:00:01.000Z"),
      }),
      row({
        id: "n3",
        title: "Refill ready",
        createdAt: new Date("2026-09-01T10:00:01.000Z"),
      }),
    ]);

    const { groups } = await planNotificationDedupe();

    expect(groups).toEqual([]);
  });

  it("queries only unarchived rows created before the #2696 merge", async () => {
    mocked.notification.findMany.mockResolvedValue([]);

    await planNotificationDedupe();

    expect(mocked.notification.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        createdAt: { lt: new Date("2026-09-05T12:46:40.000Z") },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        body: true,
        type: true,
        isSeen: true,
        createdAt: true,
      },
    });
  });
});

describe("main", () => {
  const twinRow = (id: string, createdAt: Date) => row({ id, createdAt });

  // Capture and restore the REAL argv, as dedupe-breed-codes.test.ts and
  // backfill-atc-codes.test.ts both do. Writing a fabricated value back in a
  // finally block leaves that value behind for whatever else runs in this
  // jest worker.
  let argv: string[];

  const runWith = (...args: string[]) => {
    process.argv = ["node", "dedupe-notification-twins.ts", ...args];
    return main();
  };

  beforeEach(() => {
    argv = process.argv;
    mocked.notification.findMany.mockResolvedValue([
      twinRow("n1", new Date("2026-09-01T10:00:00.000Z")),
      twinRow("n2", new Date("2026-09-01T10:00:01.000Z")),
    ]);
    mocked.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    process.argv = argv;
  });

  it("writes nothing without --apply", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith();
      expect(mocked.notification.updateMany).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("archives the losers rather than deleting them", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith("--apply");

      const given = mocked.notification.updateMany.mock.calls.find(
        ([args]) => "in" in (args.where.id ?? {}),
      );
      expect(given).toBeDefined();
      const args = given as [
        { where: { id: { in: string[] } }; data: { archivedAt: Date } },
      ];
      expect(args[0].where.id.in).toEqual(["n2"]);
      expect(args[0].data.archivedAt).toBeInstanceOf(Date);
    } finally {
      log.mockRestore();
    }
  });

  it("marks the winner seen when a twin was seen", async () => {
    mocked.notification.findMany.mockResolvedValue([
      { ...twinRow("n1", new Date("2026-09-01T10:00:00.000Z")), isSeen: true },
      twinRow("n2", new Date("2026-09-01T10:00:01.000Z")),
    ]);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith("--apply");

      const seenUpdate = mocked.notification.updateMany.mock.calls.find(
        ([args]) =>
          (args as { data?: { isSeen?: boolean } }).data?.isSeen === true,
      );
      expect(seenUpdate).toBeDefined();
    } finally {
      log.mockRestore();
    }
  });

  it("leaves a single row untouched even with --apply", async () => {
    mocked.notification.findMany.mockResolvedValue([
      twinRow("n1", new Date("2026-09-01T10:00:00.000Z")),
    ]);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith("--apply");
      expect(mocked.notification.updateMany).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("counts only the winners it actually changed", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({
        id: "winner",
        isSeen: true,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
      }),
      row({ id: "loser", createdAt: new Date("2026-09-01T10:00:00.200Z") }),
    ]);
    // Emulate the column filter. The winner here is itself the already-seen
    // row, so a WHERE carrying isSeen:false matches nothing; without that
    // clause Postgres still reports one affected row for a write of the value
    // the column already holds, and the closing line overstates the run.
    mocked.notification.updateMany.mockImplementation(
      async (args: { where: { isSeen?: boolean } }) =>
        args.where.isSeen === false ? { count: 0 } : { count: 1 },
    );
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith("--apply");

      const seenUpdate = mocked.notification.updateMany.mock.calls.find(
        ([args]) =>
          (args as { data?: { isSeen?: boolean } }).data?.isSeen === true,
      );
      expect(seenUpdate?.[0].where).toEqual({ id: "winner", isSeen: false });

      const output = log.mock.calls.map((c) => String(c[0])).join("\n");
      // Canary on a DIFFERENT number: the apply path ran and wrote something,
      // so the zero below is a real zero and not a run that did nothing.
      expect(output).toContain("1 twins archived");
      expect(output).toContain("0 winners marked seen");
    } finally {
      log.mockRestore();
    }
  });

  it("prints the rows it left outside any fan-out", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "pair-a", createdAt: new Date("2026-09-01T10:00:00.000Z") }),
      row({ id: "pair-b", createdAt: new Date("2026-09-01T10:00:00.200Z") }),
      row({ id: "loner", createdAt: new Date("2026-09-01T11:00:00.000Z") }),
    ]);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith();
      const output = log.mock.calls.map((c) => String(c[0])).join("\n");

      expect(output).toContain("3 unarchived pre-#2696 rows examined");
      expect(output).toContain("1 duplicate notification groups found");
      // Counted before the gap decision, so a tight gap cannot read as
      // "there was not much to fix".
      expect(output).toMatch(
        /1 rows share a key with another row but sit outside any fan-out window/,
      );
    } finally {
      log.mockRestore();
    }
  });

  it("prints no personal data in the group list", async () => {
    const OWNER_ID = "owner-4d1f7c2e";
    const OWNER_TITLE = "Rex bloodwork on the 3rd";
    const OWNER_BODY = "Bring the previous results.";
    const twin = (id: string, createdAt: Date) =>
      row({
        id,
        createdAt,
        userId: OWNER_ID,
        title: OWNER_TITLE,
        body: OWNER_BODY,
      });
    mocked.notification.findMany.mockResolvedValue([
      twin("twin-a", new Date("2026-09-01T10:00:00.000Z")),
      twin("twin-b", new Date("2026-09-01T10:00:01.000Z")),
    ]);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith();
      const output = log.mock.calls.map((c) => String(c[0])).join("\n");

      // Canary, and deliberately format-independent: every not.toContain
      // below also passes on a group list that printed nothing, which is a
      // different defect with a different cause. Matching the whole rendered
      // line here instead would make THIS assertion fail first on a leak, and
      // the leak would be reported as a missing line.
      expect(output).toContain("twin-a <- twin-b");

      // The reason the line is shaped that way: userId names one person, and
      // title/body are free text an owner reads. A newline inside either would
      // also let notification content forge a line of the operator log.
      expect(output).not.toContain(OWNER_ID);
      expect(output).not.toContain(OWNER_TITLE);
      expect(output).not.toContain(OWNER_BODY);

      // The enum is not owner-written, and it is what makes the line worth
      // printing at all.
      expect(output).toContain("APPOINTMENTS");
    } finally {
      log.mockRestore();
    }
  });

  it("truncates the printed group list to the first 25", async () => {
    const base = new Date("2026-09-01T10:00:00.000Z").getTime();
    const rows = Array.from({ length: 26 }, (_, i) => [
      {
        ...twinRow(`n${i}a`, new Date(base + i * 1000)),
        title: `Reminder ${i}`,
      },
      {
        ...twinRow(`n${i}b`, new Date(base + i * 1000 + 100)),
        title: `Reminder ${i}`,
      },
    ]).flat();
    mocked.notification.findMany.mockResolvedValue(rows);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runWith();
      const output = log.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toMatch(/26 duplicate notification groups found/);
      expect(output).toMatch(/and 1 more groups/);
    } finally {
      log.mockRestore();
    }
  });
});
