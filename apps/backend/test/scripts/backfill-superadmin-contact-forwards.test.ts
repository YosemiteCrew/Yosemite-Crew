jest.mock("src/config/prisma", () => ({
  prisma: {
    contactRequest: { findMany: jest.fn() },
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
  selectRows,
} from "src/scripts/backfill-superadmin-contact-forwards";

const findMany = (
  prisma as unknown as { contactRequest: { findMany: jest.Mock } }
).contactRequest.findMany;
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

/**
 * A findMany that actually EVALUATES the where and orderBy the command passes,
 * over an in-memory table.
 *
 * A mock that ignores the predicate would return the same rows for a correct
 * keyset and for a broken one, so the paging tests below could not fail. This
 * is deliberately a small query engine rather than a canned answer.
 */
const fakeTable = (rows: Row[]) => {
  const matches = (candidate: Row, where: any): boolean => {
    if (
      where.complaintContext?.not !== undefined &&
      candidate.complaintContext === null
    ) {
      return false;
    }
    if (where.superadminForward?.is === null && candidate.forwarded)
      return false;
    if (where.createdAt?.gt !== undefined) {
      return candidate.createdAt.getTime() > where.createdAt.gt.getTime();
    }
    if (where.OR) {
      return where.OR.some((clause: any) => {
        if (clause.createdAt instanceof Date) {
          return (
            candidate.createdAt.getTime() === clause.createdAt.getTime() &&
            candidate.id > clause.id.gt
          );
        }
        return candidate.createdAt.getTime() > clause.createdAt.gt.getTime();
      });
    }
    return true;
  };

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
  });

  it("rejects an unknown argument even alongside a valid --apply", async () => {
    await main(["--apply", "--force"]);

    expect(findMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
