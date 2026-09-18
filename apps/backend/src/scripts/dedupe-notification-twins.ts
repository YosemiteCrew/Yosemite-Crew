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
 * since fans out to exactly one row per push. The `createdAt`-span guard keeps
 * a deliberate pair of near-identical sends (same title/body/type within the
 * window) from being misread as old-loop twins - anything a real user chain
 * produced landed within seconds, and two sends from the (single-row) writer
 * do not exist yet because the cutoff predates it.
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
 * How far apart two rows may be and still be counted as twins of one push.
 * The old loop awaited each FCM `send` before calling the next
 * `createNotificationRecord`, so real twins can be spaced by network latency,
 * not just a tick - a few minutes covers that without becoming willing to
 * collapse two genuinely distinct notifications sharing a title/body/type.
 */
const TWIN_SPAN_MS = 5 * 60 * 1000;

export interface DedupeNotificationGroup {
  userId: string;
  title: string;
  body: string;
  type: string;
  winnerId: string;
  loserIds: string[];
  /** True when any member of the group (winner or loser) was already seen. */
  anySeen: boolean;
}

const groupKey = (row: {
  userId: string;
  title: string;
  body: string;
  type: string;
}) => `${row.userId}\u0000${row.title}\u0000${row.body}\u0000${row.type}`;

/**
 * Find twin groups among unarchived pre-#2696 Notification rows. Members of a
 * group are identical on (userId, title, body, type) and all createdAt values
 * fall within TWIN_SPAN_MS of the earliest.
 */
export const planNotificationDedupe = async (): Promise<
  DedupeNotificationGroup[]
> => {
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
  for (const [key, rows] of byKey) {
    if (rows.length < 2) continue;

    const sorted = [...rows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const spanMs =
      sorted[sorted.length - 1].createdAt.getTime() -
      sorted[0].createdAt.getTime();
    if (spanMs > TWIN_SPAN_MS) continue;

    const anySeen = rows.some((row) => row.isSeen);
    const winner = sorted[0];
    const [userId, title, body, type] = key.split("\u0000");

    groups.push({
      userId,
      title,
      body,
      type,
      winnerId: winner.id,
      loserIds: sorted.slice(1).map((row) => row.id),
      anySeen,
    });
  }

  return groups;
};

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const groups = await planNotificationDedupe();

  const twinCount = groups.reduce((sum, g) => sum + g.loserIds.length, 0);
  console.log(`${groups.length} duplicate notification groups found`);
  console.log(`${twinCount} twin rows to archive`);

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
      const { count } = await prisma.notification.updateMany({
        where: { id: group.winnerId },
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
