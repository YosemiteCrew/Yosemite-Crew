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

/**
 * Keyset on the (createdAt, id) TUPLE, not on createdAt alone.
 *
 * Millisecond ties are normal in a burst, and a single-column cursor either
 * skips the rest of a tied run or repeats it forever. `id` breaks the tie, and
 * the ordering must match the predicate for that to hold.
 */
const pageWhere = (cursor: Cursor | null) => ({
  // Only createWebRequest writes complaintContext; the authenticated mobile
  // path leaves it unset. So this selects exactly the two public forms the
  // mirror covers, and nothing from the app.
  //
  // DbNull, not null: on a Json column Prisma distinguishes SQL NULL from a
  // stored JSON `null`, and the mobile path leaves the column unset, which is
  // SQL NULL. A plain `null` here does not type-check and would not mean this.
  complaintContext: { not: Prisma.DbNull },
  superadminForward: { is: null },
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
export const selectRows = async (): Promise<SelectedRow[]> => {
  const rows: SelectedRow[] = [];
  let cursor: Cursor | null = null;

  for (;;) {
    const page: SelectedRow[] = await prisma.contactRequest.findMany({
      where: pageWhere(cursor),
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
  const apply = argv.includes("--apply");
  // Unknown arguments exit non-zero BEFORE any query: a typo like `-apply`
  // must not read as a dry run and must not read as an apply.
  const unknown = argv.filter((arg) => arg !== "--apply");
  if (unknown.length > 0) {
    console.error(`unknown argument(s): ${unknown.join(" ")}`);
    console.error("usage: backfill:superadmin-contact [--apply]");
    process.exitCode = 1;
    return;
  }

  const rows = await selectRows();
  console.log(`${rows.length} web submission(s) with no forward row`);
  for (const [day, count] of [...countPerDay(rows)].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${day}: ${count}`);
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
