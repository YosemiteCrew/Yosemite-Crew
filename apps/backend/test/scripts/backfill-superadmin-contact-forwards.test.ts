jest.mock("src/config/prisma", () => ({
  prisma: {
    contactRequest: { findMany: jest.fn(), count: jest.fn() },
    superadminContactForward: { createMany: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  countPerDay,
  main,
  PAGE_SIZE,
  parseArgs,
  selectRows,
  USAGE,
} from "src/scripts/backfill-superadmin-contact-forwards";

const findMany = (
  prisma as unknown as { contactRequest: { findMany: jest.Mock } }
).contactRequest.findMany;
const count = (prisma as unknown as { contactRequest: { count: jest.Mock } })
  .contactRequest.count;
const createMany = (
  prisma as unknown as { superadminContactForward: { createMany: jest.Mock } }
).superadminContactForward.createMany;

type Row = {
  id: string;
  createdAt: Date;
  complaintContext: unknown;
  forwarded: boolean;
};

const row = (
  id: string,
  createdAt: string,
  overrides: Partial<Row> = {},
): Row => ({
  id,
  createdAt: new Date(createdAt),
  complaintContext: { fullName: "Ada Lovelace" },
  forwarded: false,
  ...overrides,
});

const matchesCreatedAt = (value: Date, filter: any): boolean => {
  if (filter instanceof Date) return value.getTime() === filter.getTime();
  const operators = Object.keys(filter).filter(
    (key) => !["gt", "gte", "lt"].includes(key),
  );
  if (operators.length > 0) throw new Error(`unhandled ${operators}`);
  const time = value.getTime();
  return (
    (filter.gt === undefined || time > filter.gt.getTime()) &&
    (filter.gte === undefined || time >= filter.gte.getTime()) &&
    (filter.lt === undefined || time < filter.lt.getTime())
  );
};

const WHERE_KEYS = [
  "complaintContext",
  "superadminForward",
  "createdAt",
  "id",
  "OR",
  "AND",
  "NOT",
];

const matches = (candidate: Row, where: any): boolean => {
  // A key this engine does not evaluate would silently match everything.
  const unhandled = Object.keys(where).filter((k) => !WHERE_KEYS.includes(k));
  if (unhandled.length > 0) throw new Error(`unhandled ${unhandled}`);
  if (
    where.complaintContext?.not !== undefined &&
    candidate.complaintContext === null
  ) {
    return false;
  }
  if (where.superadminForward?.is === null && candidate.forwarded) return false;
  if (
    where.createdAt !== undefined &&
    !matchesCreatedAt(candidate.createdAt, where.createdAt)
  ) {
    return false;
  }
  if (where.id?.gt !== undefined && !(candidate.id > where.id.gt)) return false;
  if (where.OR && !where.OR.some((clause: any) => matches(candidate, clause))) {
    return false;
  }
  if (where.AND && !where.AND.every((c: any) => matches(candidate, c))) {
    return false;
  }
  if (where.NOT !== undefined) {
    if (Array.isArray(where.NOT)) throw new Error("unhandled NOT array");
    if (matches(candidate, where.NOT)) return false;
  }
  return true;
};

/**
 * A findMany that actually EVALUATES the where and orderBy the command passes,
 * over an in-memory table.
 *
 * A mock that ignores the predicate would return the same rows for a correct
 * keyset and for a broken one, so the paging tests below could not fail. This
 * is deliberately a small query engine rather than a canned answer.
 */
const fakeTable = (rows: Row[]) => {
  return jest.fn(async (args: any) => {
    const selected = rows.filter((candidate) => matches(candidate, args.where));
    for (const key of [...args.orderBy].reverse()) {
      const [field, direction] = Object.entries(key)[0] as [string, string];
      selected.sort((a, b) => {
        const left = field === "createdAt" ? a.createdAt.getTime() : a.id;
        const right = field === "createdAt" ? b.createdAt.getTime() : b.id;
        const order = left < right ? -1 : left > right ? 1 : 0;
        return direction === "asc" ? order : -order;
      });
    }
    return selected
      .slice(0, args.take)
      .map(({ id, createdAt }) => ({ id, createdAt }));
  });
};

/** The same engine behind count, so the excluded totals are evaluated too. */
const fakeCount = (rows: Row[]) =>
  jest.fn(
    async (args: any) =>
      rows.filter((candidate) => matches(candidate, args.where)).length,
  );

const useTable = (rows: Row[]) => {
  findMany.mockImplementation(fakeTable(rows));
  count.mockImplementation(fakeCount(rows));
};

let logged: string[];
let errored: string[];
let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  logged = [];
  errored = [];
  logSpy = jest
    .spyOn(console, "log")
    .mockImplementation((...args) => void logged.push(args.join(" ")));
  errorSpy = jest
    .spyOn(console, "error")
    .mockImplementation((...args) => void errored.push(args.join(" ")));
  createMany.mockResolvedValue({ count: 0 });
  process.exitCode = undefined;
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.exitCode = undefined;
});

describe("selectRows", () => {
  /**
   * The reason the cursor is a tuple. A burst of submissions shares a
   * millisecond routinely, and a page boundary landing inside that run is
   * where a single-column cursor either skips the remainder or repeats it.
   */
  it("returns every row of a tied run exactly once across page boundaries", async () => {
    const tied = Array.from({ length: 1001 }, (_, index) =>
      row(`req-${String(index).padStart(4, "0")}`, "2026-08-01T09:30:00.000Z"),
    );
    findMany.mockImplementation(fakeTable(tied));

    const rows = await selectRows();

    expect(rows).toHaveLength(1001);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1001);
    expect(rows.map((r) => r.id)).toEqual(tied.map((r) => r.id));
    // Three pages: 500, 500, 1. The short last page ends the walk.
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany.mock.calls[0][0].take).toBe(PAGE_SIZE);
  });

  it("advances across distinct timestamps as well", async () => {
    const rows = Array.from({ length: 1200 }, (_, index) =>
      row(
        `req-${String(index).padStart(4, "0")}`,
        new Date(Date.UTC(2026, 7, 1) + index * 1000).toISOString(),
      ),
    );
    findMany.mockImplementation(fakeTable(rows));

    const selected = await selectRows();

    expect(selected).toHaveLength(1200);
    expect(new Set(selected.map((r) => r.id)).size).toBe(1200);
  });

  it("selects only web submissions that have no forward row", async () => {
    findMany.mockImplementation(
      fakeTable([
        row("req-0001", "2026-08-01T09:30:00.000Z"),
        // The authenticated mobile path writes no complaintContext, and the
        // mirror does not cover it.
        row("req-0002", "2026-08-01T09:31:00.000Z", {
          complaintContext: null,
        }),
        // Already queued by the live forward - queuing it again would be a
        // duplicate send.
        row("req-0003", "2026-08-01T09:32:00.000Z", { forwarded: true }),
      ]),
    );

    const rows = await selectRows();

    expect(rows.map((r) => r.id)).toEqual(["req-0001"]);
    const where = findMany.mock.calls[0][0].where;
    // Identity, not a structural match: Prisma's three Json null sentinels are
    // structurally indistinguishable and mean different things. JsonNull here
    // would select the mobile rows this filter exists to exclude.
    expect(where.complaintContext.not).toBe(Prisma.DbNull);
    expect(where.superadminForward).toEqual({ is: null });
  });

  it("reads no message, name, address or phone out of the table", async () => {
    findMany.mockImplementation(
      fakeTable([row("req-0001", "2026-08-01T09:30:00.000Z")]),
    );

    await selectRows();

    // The command exists to queue ids. Selecting the body would put personal
    // data into a console session for no purpose.
    expect(findMany.mock.calls[0][0].select).toEqual({
      id: true,
      createdAt: true,
    });
  });

  it("stops on an empty first page", async () => {
    findMany.mockImplementation(fakeTable([]));
    await expect(selectRows()).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe("countPerDay", () => {
  it("buckets by UTC day", () => {
    const perDay = countPerDay([
      { id: "a", createdAt: new Date("2026-08-22T23:59:59.000Z") },
      { id: "b", createdAt: new Date("2026-08-23T00:00:01.000Z") },
      { id: "c", createdAt: new Date("2026-08-23T12:00:00.000Z") },
    ]);

    expect([...perDay]).toEqual([
      ["2026-08-22", 1],
      ["2026-08-23", 2],
    ]);
  });
});

describe("main", () => {
  const threeRows = [
    row("req-0001", "2026-08-22T10:00:00.000Z"),
    row("req-0002", "2026-08-22T11:00:00.000Z"),
    row("req-0003", "2026-08-30T11:00:00.000Z"),
  ];

  it("writes nothing on a dry run and prints counts only", async () => {
    findMany.mockImplementation(fakeTable(threeRows));

    await main([]);

    expect(createMany).not.toHaveBeenCalled();
    expect(logged).toContain("3 web submission(s) with no forward row");
    expect(logged).toContain("  2026-08-22: 2");
    expect(logged).toContain("  2026-08-30: 1");
    // The per-day counts are the #2645 spam check, and they must stay counts:
    // no id, no address, no name, no message reaches the console.
    const output = logged.join("\n");
    expect(output).not.toContain("req-0001");
    expect(output).not.toContain("Ada Lovelace");
    expect(process.exitCode).toBeUndefined();
    expect(count).not.toHaveBeenCalled();
  });

  it("queues exactly the selected rows under --apply, skipping duplicates", async () => {
    findMany.mockImplementation(fakeTable(threeRows));
    createMany.mockResolvedValue({ count: 3 });

    await main(["--apply"]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { contactRequestId: "req-0001" },
        { contactRequestId: "req-0002" },
        { contactRequestId: "req-0003" },
      ],
      // Without this an interrupted run cannot be resumed: the second run
      // collides on the primary key of the rows it already queued.
      skipDuplicates: true,
    });
    expect(logged).toContain("queued 3 forward row(s)");
  });

  it("queues nothing on a second apply", async () => {
    findMany.mockImplementation(
      fakeTable(threeRows.map((r) => ({ ...r, forwarded: true }))),
    );

    await main(["--apply"]);

    expect(logged).toContain("0 web submission(s) with no forward row");
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [] }),
    );
    expect(logged).toContain("queued 0 forward row(s)");
  });

  it("rejects an unknown argument without reading or writing anything", async () => {
    await main(["-apply"]);

    // A typo must not read as a dry run and must not read as an apply.
    expect(findMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(errored[0]).toContain("unknown argument(s): -apply");
    expect(errored[1]).toBe(USAGE);
  });

  it("rejects an unknown argument even alongside a valid --apply", async () => {
    await main(["--apply", "--force"]);

    expect(findMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});

const span = (from: string, to: string) => ({
  from: new Date(from),
  to: new Date(to),
});

describe("parseArgs", () => {
  it("defaults to a dry run with nothing excluded", () => {
    expect(parseArgs([])).toEqual({ apply: false, windows: [] });
    expect(parseArgs(["--apply"])).toEqual({ apply: true, windows: [] });
  });

  it("reads a bare date as the start of that UTC day, on both ends", () => {
    // So 2026-09-12 as the end includes all of 11 September and none of 12.
    expect(parseArgs(["--exclude", "2026-09-08..2026-09-12"])).toEqual({
      apply: false,
      windows: [span("2026-09-08T00:00:00.000Z", "2026-09-12T00:00:00.000Z")],
    });
  });

  it("reads datetimes as UTC, with or without a trailing Z", () => {
    expect(
      parseArgs(["--exclude", "2026-08-22T06:30..2026-08-30T23:59:59.999Z"])
        .windows,
    ).toEqual([span("2026-08-22T06:30:00.000Z", "2026-08-30T23:59:59.999Z")]);
    expect(
      parseArgs(["--exclude", "2026-08-22T06:30:15Z..2026-08-22T06:30:15.5"])
        .windows,
    ).toEqual([span("2026-08-22T06:30:15.000Z", "2026-08-22T06:30:15.500Z")]);
  });

  it("collects repeated windows in order, with --apply in any position", () => {
    expect(
      parseArgs([
        "--exclude",
        "2026-08-22..2026-08-31",
        "--apply",
        "--exclude",
        "2026-09-08..2026-09-12",
      ]),
    ).toEqual({
      apply: true,
      windows: [
        span("2026-08-22T00:00:00.000Z", "2026-08-31T00:00:00.000Z"),
        span("2026-09-08T00:00:00.000Z", "2026-09-12T00:00:00.000Z"),
      ],
    });
  });

  it.each([
    "2026-08-31..2026-08-22",
    // Half-open, so an equal pair is an empty window: almost surely a typo.
    "2026-08-22..2026-08-22",
    "2026-08-22T12:00..2026-08-22T11:59:59.999",
  ])("rejects the reversed or empty window %s", (value) => {
    expect(() => parseArgs(["--exclude", value])).toThrow(
      `invalid --exclude window "${value}": from must be before to`,
    );
  });

  it.each([
    "2026-08-22",
    "2026-08-22..",
    "..2026-08-31",
    "2026-08-22...2026-08-31",
    "2026-08-22..2026-08-25..2026-08-31",
    "22/08/2026..31/08/2026",
    "2026-8-22..2026-8-31",
    // Date would roll these over to a real day instead of refusing them.
    "2026-02-30..2026-03-05",
    "2026-09-11T24:00..2026-09-12T01:00",
    "2026-09-11T23:60..2026-09-12",
    // UTC only: an offset is refused rather than silently reinterpreted.
    "2026-09-11T10:00+02:00..2026-09-12",
    "2026-09-11 10:00..2026-09-12",
    // `--exclude --apply` must not swallow the flag as a window.
    "--apply",
  ])("rejects the malformed window %j", (value) => {
    expect(() => parseArgs(["--exclude", value])).toThrow(
      `invalid --exclude window "${value}": expected <from>..<to>`,
    );
  });

  it("rejects --exclude with no value", () => {
    expect(() => parseArgs(["--apply", "--exclude"])).toThrow(
      'invalid --exclude window ""',
    );
  });

  it("rejects the --exclude=<window> spelling as an unknown argument", () => {
    expect(() =>
      parseArgs(["--exclude=2026-08-22..2026-08-31", "--apply"]),
    ).toThrow("unknown argument(s): --exclude=2026-08-22..2026-08-31");
  });
});

describe("selectRows with excluded windows", () => {
  const windows = [
    span("2026-08-22T00:00:00.000Z", "2026-08-31T00:00:00.000Z"),
    span("2026-09-08T00:00:00.000Z", "2026-09-12T00:00:00.000Z"),
  ];

  it("drops rows inside a window and keeps the rows on either side of it", async () => {
    useTable([
      row("before-first", "2026-08-21T23:59:59.999Z"),
      row("first-from", "2026-08-22T00:00:00.000Z"),
      row("first-inside", "2026-08-26T12:00:00.000Z"),
      row("first-last-ms", "2026-08-30T23:59:59.999Z"),
      row("first-to", "2026-08-31T00:00:00.000Z"),
      row("between", "2026-09-01T09:00:00.000Z"),
      row("second-from", "2026-09-08T00:00:00.000Z"),
      row("second-last-day", "2026-09-11T18:00:00.000Z"),
      row("second-to", "2026-09-12T00:00:00.000Z"),
    ]);

    const rows = await selectRows(windows);

    // [from, to): the first instant is excluded, the end instant is kept.
    expect(rows.map((r) => r.id)).toEqual([
      "before-first",
      "first-to",
      "between",
      "second-to",
    ]);
  });

  it("filters in the query, alongside the web and unforwarded conditions", async () => {
    useTable([]);

    await selectRows(windows);

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([
      { NOT: { createdAt: { gte: windows[0].from, lt: windows[0].to } } },
      { NOT: { createdAt: { gte: windows[1].from, lt: windows[1].to } } },
    ]);
    expect(where.complaintContext.not).toBe(Prisma.DbNull);
    expect(where.superadminForward).toEqual({ is: null });
  });

  it("adds no exclusion to the query when no window is given", async () => {
    useTable([]);

    await selectRows();

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("AND");
  });

  it("pages across a window without skipping or repeating a kept row", async () => {
    // 1500 rows one second apart. The window removes rows 400 to 999, so the
    // first page is rows 0-399 plus 1000-1099 and its cursor lands past the
    // window. Filtering after the query would need four pages, not two.
    const start = Date.UTC(2026, 7, 22);
    const table = Array.from({ length: 1500 }, (_, index) =>
      row(
        `req-${String(index).padStart(4, "0")}`,
        new Date(start + index * 1000).toISOString(),
      ),
    );
    useTable(table);

    const rows = await selectRows([
      { from: new Date(start + 400_000), to: new Date(start + 1_000_000) },
    ]);

    expect(rows.map((r) => r.id)).toEqual(
      [...table.slice(0, 400), ...table.slice(1000)].map((r) => r.id),
    );
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

describe("main with excluded windows", () => {
  const table = [
    row("req-0001", "2026-08-20T10:00:00.000Z"),
    row("req-0002", "2026-08-22T10:00:00.000Z"),
    row("req-0003", "2026-08-23T10:00:00.000Z"),
    row("req-0004", "2026-09-09T10:00:00.000Z"),
    row("req-0005", "2026-09-12T10:00:00.000Z"),
    // Already queued, and not a web submission: neither is kept nor counted
    // as excluded, because neither would have been queued anyway.
    row("req-0006", "2026-08-24T10:00:00.000Z", { forwarded: true }),
    row("req-0007", "2026-09-10T10:00:00.000Z", { complaintContext: null }),
  ];
  const excludeBoth = [
    "--exclude",
    "2026-08-22..2026-08-31",
    "--exclude",
    "2026-09-08..2026-09-12",
  ];

  it("prints per-day counts for the kept rows and one total per window", async () => {
    useTable(table);

    await main(excludeBoth);

    expect(createMany).not.toHaveBeenCalled();
    expect(logged).toEqual([
      "2 web submission(s) with no forward row outside the excluded window(s)",
      "  2026-08-20: 1",
      "  2026-09-12: 1",
      "excluded [2026-08-22T00:00:00.000Z, 2026-08-31T00:00:00.000Z): 2",
      "excluded [2026-09-08T00:00:00.000Z, 2026-09-12T00:00:00.000Z): 1",
      "dry run - pass --apply to queue these for the forward drain",
    ]);
    const output = logged.join("\n");
    expect(output).not.toContain("req-");
    expect(output).not.toContain("Ada Lovelace");
    expect(process.exitCode).toBeUndefined();
  });

  it("queues only the rows outside every window under --apply", async () => {
    useTable(table);
    createMany.mockResolvedValue({ count: 2 });

    await main(["--apply", ...excludeBoth]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { contactRequestId: "req-0001" },
        { contactRequestId: "req-0005" },
      ],
      skipDuplicates: true,
    });
    expect(logged).toContain(
      "excluded [2026-08-22T00:00:00.000Z, 2026-08-31T00:00:00.000Z): 2",
    );
    expect(logged).toContain("queued 2 forward row(s)");
  });

  it.each([
    {
      argv: ["--apply", "--exclude", "2026-08-31..2026-08-22"],
      message: "from must be before to",
    },
    {
      argv: [
        "--exclude",
        "2026-08-22..2026-08-31",
        "--apply",
        "--exclude",
        "a..b",
      ],
      message: "expected <from>..<to>",
    },
    { argv: ["--apply", "--exclude"], message: 'invalid --exclude window ""' },
  ])(
    "rejects $argv before reading or writing anything",
    async ({ argv, message }) => {
      useTable(table);

      await main(argv);

      expect(findMany).not.toHaveBeenCalled();
      expect(count).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(errored[0]).toContain(message);
      expect(errored[1]).toBe(USAGE);
      expect(logged).toEqual([]);
    },
  );
});
