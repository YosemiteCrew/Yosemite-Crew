jest.mock("src/config/prisma", () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

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
    type: string;
    isSeen: boolean;
    createdAt: Date;
  }> = {},
) => ({
  id: "n1",
  userId: "u1",
  title: "Appointment reminder",
  body: "Your visit is at 10:00.",
  type: "APPOINTMENT",
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

    const groups = await planNotificationDedupe();

    expect(groups).toEqual([
      {
        userId: "u1",
        title: "Appointment reminder",
        body: "Your visit is at 10:00.",
        type: "APPOINTMENT",
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

    const groups = await planNotificationDedupe();

    expect(groups).toHaveLength(1);
    expect(groups[0].winnerId).toBe("n2");
    expect(groups[0].loserIds).toEqual(["n1"]);
  });

  it("carries isSeen forward when any twin was seen", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1", isSeen: true }),
      row({ id: "n2", createdAt: new Date("2026-09-01T10:00:01.000Z") }),
    ]);

    const groups = await planNotificationDedupe();

    expect(groups).toHaveLength(1);
    expect(groups[0].anySeen).toBe(true);
  });

  it("leaves a lone row alone", async () => {
    mocked.notification.findMany.mockResolvedValue([row()]);

    const groups = await planNotificationDedupe();

    expect(groups).toEqual([]);
  });

  it("leaves rows apart by more than the twin span alone", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1" }),
      row({
        id: "n2",
        createdAt: new Date("2026-09-01T10:30:00.000Z"),
      }),
    ]);

    const groups = await planNotificationDedupe();

    expect(groups).toEqual([]);
  });

  it("produced no groups when the query returns only single rows", async () => {
    mocked.notification.findMany.mockResolvedValue([
      row({ id: "n1" }),
      row({ id: "n2", createdAt: new Date("2026-08-01T10:00:00.000Z") }),
    ]);

    const groups = await planNotificationDedupe();

    expect(groups).toEqual([]);
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

    const groups = await planNotificationDedupe();

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

  beforeEach(() => {
    mocked.notification.findMany.mockResolvedValue([
      twinRow("n1", new Date("2026-09-01T10:00:00.000Z")),
      twinRow("n2", new Date("2026-09-01T10:00:01.000Z")),
    ]);
    mocked.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("writes nothing without --apply", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      await main();
      expect(mocked.notification.updateMany).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("archives the losers rather than deleting them", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      process.argv = ["node", "dedupe-notification-twins.ts", "--apply"];
      await main();
      process.argv = ["node", "dedupe-notification-twins.ts"];

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
      process.argv = ["node", "dedupe-notification-twins.ts"];
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
      process.argv = ["node", "dedupe-notification-twins.ts", "--apply"];
      await main();
      process.argv = ["node", "dedupe-notification-twins.ts"];

      const seenUpdate = mocked.notification.updateMany.mock.calls.find(
        ([args]) =>
          (args as { data?: { isSeen?: boolean } }).data?.isSeen === true,
      );
      expect(seenUpdate).toBeDefined();
    } finally {
      process.argv = ["node", "dedupe-notification-twins.ts"];
      log.mockRestore();
    }
  });

  it("leaves a single row untouched even with --apply", async () => {
    mocked.notification.findMany.mockResolvedValue([
      twinRow("n1", new Date("2026-09-01T10:00:00.000Z")),
    ]);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      process.argv = ["node", "dedupe-notification-twins.ts", "--apply"];
      await main();
      process.argv = ["node", "dedupe-notification-twins.ts"];
      expect(mocked.notification.updateMany).not.toHaveBeenCalled();
    } finally {
      process.argv = ["node", "dedupe-notification-twins.ts"];
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
      process.argv = ["node", "dedupe-notification-twins.ts"];
      await main();
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
      expect(output).toContain("APPOINTMENT");
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
      process.argv = ["node", "dedupe-notification-twins.ts"];
      await main();
      const output = log.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toMatch(/26 duplicate notification groups found/);
      expect(output).toMatch(/and 1 more groups/);
    } finally {
      process.argv = ["node", "dedupe-notification-twins.ts"];
      log.mockRestore();
    }
  });
});
