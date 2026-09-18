/**
 * Collapse duplicate mobile Notification rows written by the old per-token
 * sendToUser loop.
 *
 * Before #2696 (merged 2026-09-05), `NotificationService.sendToUser` wrote a
 * `Notification` row inside its `for (const record of tokens)` loop, one
 * `createNotificationRecord` call per device token. A pet owner signed in on a
 * phone and a tablet got two identical rows for one push, and the mobile list
 * showed both. Marking one seen or archiving it left the other unread and
 * visible, so the list and the unread badge both stayed wrong.
 *
 * #2696 moved the write ahead of the token fan-out, so new notifications get
 * one row. Nothing cleans up the rows the old loop had already written. This
 * script collapses every surviving twin group onto its earliest row:
 *
 *   - the winner keeps its place in the list, so the owner's history reads
 *     exactly one notification for one push;
 *   - `isSeen` is carried forward - if any unarchived twin was seen, the
 *     winner is marked seen, so a badge is not left standing on a notification
 *     the owner already dealt with;
 *   - each loser is ARCHIVED (stamped `archivedAt`), never deleted: per the
 *     schema comment on `Notification.archivedAt`, archiving never deletes and
 *     the row survives for audit.
 *
 * Only rows created before the #2696 merge can be twins: everything written
 * since fans out to exactly one row per push.
 *
 * WHAT MAKES A SET OF ROWS ONE PUSH. The key `(userId, title, body, type)`
 * carries no event identity, so identical text is NOT on its own evidence of
 * duplication. Several templates render the same bytes for genuinely different
 * events: `Appointment.CANCELLED(companionName)` varies only by pet name, and
 * `Payment.PAYMENT_FAILED()` takes no arguments at all, so every failed card
 * retry produces one identical row. What the old bug actually left behind is
 * DEVICE FAN-OUT - one push, one row per device token, written from inside a
 * loop whose `sendToDevice` call was awaited. So the rows of one push are
 * separated by a single FCM round trip, and two distinct events are separated
 * by however long apart the events were.
 *
 * Rows of a key are therefore CLUSTERED on the gap between adjacent rows, and
 * each cluster of two or more is collapsed on its own. A key whose text recurs
 * over months yields one cluster per push instead of being rejected outright,
 * and two sends far enough apart to be distinct events stay distinct.
 *
 * Idempotent by construction: it only ever looks at unarchived rows, and it
 * archives every loser. Re-running after an apply finds no group with two
 * unarchived members, so it is safe to re-run to pick up stragglers or resume
 * from an interrupted apply.
 *
 * Dry run by default. Pass --apply to write:
 *
 *   pnpm --filter backend exec tsx src/scripts/dedupe-notification-twins.ts
 *   pnpm --filter backend exec tsx src/scripts/dedupe-notification-twins.ts --apply
 */
import { prisma } from "src/config/prisma";

/**
 * Merge time of #2696 (2026-09-05T12:46:40Z). The per-token write left the
 * codebase at that commit, so any Notification row older than this could have
 * been written once per device token; anything newer is guaranteed single-row
 * by the post-#2696 write-ahead-of-fan-out.
 */
const REFACTOR_2696_MERGED_AT = Date.parse("2026-09-05T12:46:40Z");

/**
 * How far apart two ADJACENT rows of one key may be and still belong to the
 * same fan-out.
 *
 * This is a chosen bound, not a measured one: nothing in the table records
 * which push a row came from, and this desk has no production data to fit it
 * to. What bounds it from below is the old loop - it awaited one FCM round
 * trip per device token, so consecutive rows of one push are a round trip
 * apart, which is hundreds of milliseconds. What bounds it from above is the
 * shortest gap between two distinct events carrying identical text; a card
 * retry is the worst case and is still seconds. Two seconds sits between them.
 *
 * The previous value was five minutes, justified as "network latency". Five
 * minutes is around a thousand FCM round trips, and it is wide enough to merge
 * two failed-payment retries into one group and archive one of them.
 *
 * Both error directions are real and they are NOT symmetric in cost:
 *   - too tight splits one fan-out in two, and its duplicate rows survive -
 *     the bug simply stays unfixed for that push, and a re-run after widening
 *     this constant still finds them;
 *   - too loose archives a row that belongs to a different event, which is the
 *     direction that loses something.
 * So it is deliberately tight, and `rowsLeftUngrouped` below exists to make
 * the cost of that choice visible on the dry run instead of silent.
 */
const FAN_OUT_ADJACENT_GAP_MS = 2 * 1000;

export interface DedupeNotificationGroup {
  userId: string;
  title: string;
  body: string;
  type: string;
  winnerId: string;
  loserIds: string[];
  /** True when any member of THIS CLUSTER (winner or loser) was already seen. */
  anySeen: boolean;
}

export interface DedupeNotificationPlan {
  groups: DedupeNotificationGroup[];
  /** Unarchived pre-#2696 rows read from the table, before any grouping. */
  rowsExamined: number;
  /**
   * Rows that share a key with another row and still ended up alone in their
   * cluster. These are the rows the fan-out gap declined to collapse. Reported
   * because every other number in the dry run is counted AFTER that decision,
   * so without this one a confident small total reads as the whole population.
   */
  rowsLeftUngrouped: number;
}

const groupKey = (row: {
  userId: string;
  title: string;
  body: string;
  type: string;
}) => `${row.userId}\u0000${row.title}\u0000${row.body}\u0000${row.type}`;

/**
 * Split rows already sorted by `createdAt` wherever the gap to the previous row
 * exceeds one fan-out. Adjacent gaps, never the span of the whole run: a key
 * whose text recurs for months has a span of months, and rejecting it on that
 * span is what left the most-duplicated rows untouched.
 */
const clusterByAdjacentGap = <T extends { createdAt: Date }>(
  sorted: readonly T[],
): T[][] => {
  const clusters: T[][] = [];
  let current: T[] = [];

  for (const row of sorted) {
    const previous = current[current.length - 1];
    const gapMs = previous
      ? row.createdAt.getTime() - previous.createdAt.getTime()
      : 0;

    if (previous && gapMs > FAN_OUT_ADJACENT_GAP_MS) {
      clusters.push(current);
      current = [];
    }
    current.push(row);
  }

  if (current.length > 0) clusters.push(current);
  return clusters;
};

/**
 * Find twin groups among unarchived pre-#2696 Notification rows. Members of a
 * group are identical on (userId, title, body, type) AND adjacent within
 * FAN_OUT_ADJACENT_GAP_MS, so one key can yield several groups - one per push.
 */
export const planNotificationDedupe =
  async (): Promise<DedupeNotificationPlan> => {
    const notifications = await prisma.notification.findMany({
      where: {
        archivedAt: null,
        createdAt: { lt: new Date(REFACTOR_2696_MERGED_AT) },
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

    const byKey = new Map<string, Array<(typeof notifications)[number]>>();
    for (const row of notifications) {
      const key = groupKey(row);
      const rows = byKey.get(key) ?? [];
      rows.push(row);
      byKey.set(key, rows);
    }

    const groups: DedupeNotificationGroup[] = [];
    let rowsLeftUngrouped = 0;

    for (const [key, rows] of byKey) {
      if (rows.length < 2) continue;

      const sorted = [...rows].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const [userId, title, body, type] = key.split("\u0000");

      for (const cluster of clusterByAdjacentGap(sorted)) {
        if (cluster.length < 2) {
          rowsLeftUngrouped += cluster.length;
          continue;
        }

        groups.push({
          userId,
          title,
          body,
          type,
          winnerId: cluster[0].id,
          // Per cluster, not per key: a row seen in June must not mark a
          // different push's winner seen in August.
          anySeen: cluster.some((row) => row.isSeen),
          loserIds: cluster.slice(1).map((row) => row.id),
        });
      }
    }

    return { groups, rowsExamined: notifications.length, rowsLeftUngrouped };
  };

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const { groups, rowsExamined, rowsLeftUngrouped } =
    await planNotificationDedupe();

  const twinCount = groups.reduce((sum, g) => sum + g.loserIds.length, 0);
  console.log(`${rowsExamined} unarchived pre-#2696 rows examined`);
  console.log(`${groups.length} duplicate notification groups found`);
  console.log(`${twinCount} twin rows to archive`);
  // Counted BEFORE the gap decision, unlike the two numbers above. Without it
  // a tight FAN_OUT_ADJACENT_GAP_MS reads as "there was not much to fix".
  console.log(
    `${rowsLeftUngrouped} rows share a key with another row but sit outside ` +
      `any fan-out window, and are left alone`,
  );

  /**
   * Row ids and the `NotificationType` enum only. `userId` names one person,
   * and `title`/`body` are free text written for an owner to read - neither
   * belongs in an operator log, and free text carrying a newline could forge a
   * line of it. The ids are the audit handle: look the row up when you need
   * its content. Pinned by "prints no personal data in the group list" in
   * apps/backend/test/scripts/dedupe-notification-twins.test.ts.
   */
  for (const group of groups.slice(0, 25)) {
    console.log(
      `  ${group.type}: ${group.winnerId} <- ${group.loserIds.join(", ")}`,
    );
  }
  if (groups.length > 25) {
    console.log(`  … and ${groups.length - 25} more groups`);
  }

  if (!apply) {
    console.log("\ndry run; pass --apply to write");
    return;
  }

  let seenCarried = 0;
  let twinsArchived = 0;

  for (const group of groups) {
    if (group.anySeen) {
      // `isSeen: false` in the WHERE, so the count is rows CHANGED and not rows
      // matched. Without it the winner that was itself the already-seen row is
      // updated to the value it already holds, Postgres reports 1 affected row,
      // and the closing line overstates what the run did to production data.
      const { count } = await prisma.notification.updateMany({
        where: { id: group.winnerId, isSeen: false },
        data: { isSeen: true },
      });
      if (count > 0) {
        seenCarried += 1;
      }
    }

    const { count } = await prisma.notification.updateMany({
      where: { id: { in: group.loserIds } },
      data: { archivedAt: new Date() },
    });
    twinsArchived += count;
  }

  console.log(
    `\nwrote: ${seenCarried} winners marked seen, ${twinsArchived} twins archived`,
  );
};

/**
 * Only run when this file IS the command, not when a test imports
 * planNotificationDedupe. argv[1] rather than require.main, which is not
 * defined under ESM.
 */
const invokedDirectly = (process.argv[1] ?? "").includes(
  "dedupe-notification-twins",
);

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
