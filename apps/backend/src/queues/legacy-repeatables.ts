import logger from "src/utils/logger";

/**
 * Remove the repeatable-job entries bullmq 5 left behind.
 *
 * bullmq 5 registered recurring work with `Queue.add(name, data, { repeat,
 * jobId })`, and did NOT key that entry by `jobId`: it built
 * `name:jobId:endDate:tz:every` and stored the entry under the md5 of that
 * string. bullmq 6 replaced the API with `Queue.upsertJobScheduler(id, ...)`,
 * which keys by the plain id.
 *
 * Both live in the same `repeat` sorted set, so carrying the same id string
 * across the migration is not enough: the upsert writes a new entry beside the
 * md5 one rather than replacing it, and bullmq 6 still recognises the legacy
 * shape and keeps scheduling from it. Left alone, every recurring job in the
 * app would fire twice, for as long as the old entry survives in Redis.
 *
 * This prunes the legacy entries once, at boot, before the schedulers are
 * upserted. It only removes keys that are exactly a 32 character hex digest,
 * which is the md5 shape bullmq 5 produced and which none of the ids this app
 * registers can collide with, so a scheduler this app owns is never removed
 * even if the expected list is ever incomplete.
 */

const LEGACY_MD5_KEY = /^[0-9a-f]{32}$/;

export interface SchedulerCapableQueue {
  name: string;
  getJobSchedulers(): Promise<Array<{ key: string } | null | undefined>>;
  removeJobScheduler(key: string): Promise<boolean>;
}

export function isLegacyRepeatableKey(key: unknown): key is string {
  return typeof key === "string" && LEGACY_MD5_KEY.test(key);
}

export async function pruneLegacyRepeatables(
  queue: SchedulerCapableQueue,
): Promise<string[]> {
  const schedulers = await queue.getJobSchedulers();
  const removed: string[] = [];

  for (const scheduler of schedulers ?? []) {
    const key = scheduler?.key;
    if (!isLegacyRepeatableKey(key)) {
      continue;
    }

    // A failure here must not stop the boot: the worst case of leaving one
    // entry behind is a duplicate job, whereas throwing takes the API down.
    // removeJobScheduler reports whether it actually removed anything, and a
    // false is not an error - it means the entry was already gone - but it must
    // not be counted as a removal either.
    try {
      const wasRemoved = await queue.removeJobScheduler(key);

      if (wasRemoved) {
        removed.push(key);
      } else {
        logger.warn(
          `Legacy repeatable ${key} on queue ${queue.name} was not removed; it may already be gone`,
        );
      }
    } catch (error) {
      logger.warn(
        `Could not remove legacy repeatable ${key} on queue ${queue.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (removed.length > 0) {
    logger.info(
      `🧹 Removed ${removed.length} bullmq 5 repeatable entr${
        removed.length === 1 ? "y" : "ies"
      } from queue ${queue.name}`,
    );
  }

  return removed;
}

export async function pruneLegacyRepeatablesAcross(
  queues: SchedulerCapableQueue[],
): Promise<string[]> {
  const removed: string[] = [];

  for (const queue of queues) {
    removed.push(...(await pruneLegacyRepeatables(queue)));
  }

  return removed;
}
