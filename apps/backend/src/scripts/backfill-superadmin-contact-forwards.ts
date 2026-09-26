import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

/**
 * Queues the web contact submissions taken BEFORE the durable forward (#3329)
 * shipped, so the drain delivers the history the SuperAdmin CRM never received.
 *
 * Dry run by default; --apply writes. Delivery is not this command's job: it
 * writes forward rows and the drain sends them, at the same rate and through
 * the same authenticated intake as live traffic.
 */

/**
 * A page. Small enough to keep one query's result set bounded, large enough
 * that a few thousand rows is a handful of queries.
 */
export const PAGE_SIZE = 500;

export type Cursor = { createdAt: Date; id: string };

export type SelectedRow = { id: string; createdAt: Date };

/** A half-open UTC range [from, to) of createdAt values to leave unqueued. */
export type ExcludedWindow = { from: Date; to: Date };

export type Args = { apply: boolean; windows: ExcludedWindow[] };

export const USAGE = [
  "usage: backfill:superadmin-contact [--apply] [--exclude <from>..<to>]...",
  "  --apply    queue the selected submissions (default: dry run, writes nothing)",
  "  --exclude  skip submissions created in [from, to), UTC. from and to are ISO",
  "             dates or datetimes; a bare date is the start of that day, so",
  "             2026-09-01..2026-09-03 skips 1 and 2 September. Repeatable.",
].join("\n");

const INSTANT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?)?$/;

/**
 * An ISO date or datetime, always read as UTC. A bare date is midnight at the
 * start of that day.
 */
const parseInstant = (text: string): Date | null => {
  if (!INSTANT.test(text)) return null;
  const [day, time = "00:00"] = (
    text.endsWith("Z") ? text.slice(0, -1) : text
  ).split("T");
  const instant = new Date(`${day}T${time}Z`);
  // Date rolls 2026-02-30 over to 2 March rather than rejecting it, and reads
  // 24:00 as the next midnight. A round trip catches both.
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString().startsWith(`${day}T${time}`) ? instant : null;
};

const parseWindow = (value: string): ExcludedWindow => {
  const [fromText, toText, ...rest] = value.split("..");
  const from = parseInstant(fromText);
  const to = toText === undefined ? null : parseInstant(toText);
  if (!from || !to || rest.length > 0) {
    throw new Error(
      `invalid --exclude window "${value}": expected <from>..<to> with ISO dates or datetimes`,
    );
  }
  if (from.getTime() >= to.getTime()) {
    throw new Error(
      `invalid --exclude window "${value}": from must be before to`,
    );
  }
  return { from, to };
};

/**
 * Throws on anything it does not recognise. Every argument is checked before
 * the first query, so a typo like `-apply` or a mistyped date can neither read
 * as a dry run nor as an apply over the wrong rows.
 */
export const parseArgs = (argv: string[]): Args => {
  const args: Args = { apply: false, windows: [] };
  const unknown: string[] = [];
  const rest = [...argv];
  for (let arg = rest.shift(); arg !== undefined; arg = rest.shift()) {
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--exclude") {
      args.windows.push(parseWindow(rest.shift() ?? ""));
    } else {
      unknown.push(arg);
    }
  }
  if (unknown.length > 0) {
    throw new Error(`unknown argument(s): ${unknown.join(" ")}`);
  }
  return args;
};

const unforwarded = {
  // Only createWebRequest writes complaintContext; the authenticated mobile
  // path leaves it unset. So this selects exactly the two public forms the
  // mirror covers, and nothing from the app.
  //
  // DbNull, not null: on a Json column Prisma distinguishes SQL NULL from a
  // stored JSON `null`, and the mobile path leaves the column unset, which is
  // SQL NULL. A plain `null` here does not type-check and would not mean this.
  complaintContext: { not: Prisma.DbNull },
  superadminForward: { is: null },
};

const inRange = ({ from, to }: ExcludedWindow) => ({
  createdAt: { gte: from, lt: to },
});

/**
 * Keyset on the (createdAt, id) TUPLE, not on createdAt alone.
 *
 * Millisecond ties are normal in a burst, and a single-column cursor either
 * skips the rest of a tied run or repeats it forever. `id` breaks the tie, and
 * the ordering must match the predicate for that to hold.
 */
const pageWhere = (cursor: Cursor | null, windows: ExcludedWindow[]) => ({
  ...unforwarded,
  // In the query, not filtered afterwards: the keyset below then walks only
  // the rows that are kept, in the same (createdAt, id) order.
  ...(windows.length > 0
    ? { AND: windows.map((range) => ({ NOT: inRange(range) })) }
    : {}),
  ...(cursor
    ? {
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      }
    : {}),
});

/** Every selected row, in one ordered pass. */
export const selectRows = async (
  windows: ExcludedWindow[] = [],
): Promise<SelectedRow[]> => {
  const rows: SelectedRow[] = [];
  let cursor: Cursor | null = null;

  for (;;) {
    const page: SelectedRow[] = await prisma.contactRequest.findMany({
      where: pageWhere(cursor, windows),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: PAGE_SIZE,
      select: { id: true, createdAt: true },
    });
    if (page.length === 0) break;
    rows.push(...page);
    const last = page[page.length - 1];
    cursor = { createdAt: last.createdAt, id: last.id };
    // A short page is the last page. Checking this rather than looping until
    // an empty one saves a query and, more importantly, terminates even if a
    // caller hands back a page longer than it asked for.
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
};

/**
 * Counts per UTC day. This is the whole dry-run report: it is enough to spot
 * the #2645 spam spike still being present, and it names no one.
 */
export const countPerDay = (rows: SelectedRow[]): Map<string, number> => {
  const perDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return perDay;
};

export const main = async (argv: string[] = process.argv.slice(2)) => {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const { apply, windows } = args;

  const rows = await selectRows(windows);
  const scope = windows.length > 0 ? " outside the excluded window(s)" : "";
  console.log(`${rows.length} web submission(s) with no forward row${scope}`);
  for (const [day, count] of [...countPerDay(rows)].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${day}: ${count}`);
  }
  for (const range of windows) {
    const excluded = await prisma.contactRequest.count({
      where: { ...unforwarded, ...inRange(range) },
    });
    console.log(
      `excluded [${range.from.toISOString()}, ${range.to.toISOString()}): ${excluded}`,
    );
  }

  if (!apply) {
    console.log("dry run - pass --apply to queue these for the forward drain");
    return;
  }

  // skipDuplicates, so a run interrupted halfway is resumed by running it
  // again: the rows already queued are skipped rather than colliding on the
  // primary key.
  const { count } = await prisma.superadminContactForward.createMany({
    data: rows.map((row) => ({ contactRequestId: row.id })),
    skipDuplicates: true,
  });
  console.log(`queued ${count} forward row(s)`);
};

if (
  process.argv[1] &&
  process.argv[1].endsWith("backfill-superadmin-contact-forwards.ts")
) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
