import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

export type OrgUsageCountersDoc = {
  id?: string;
  orgId: string;
  freeLimitReachedAt?: Date | null;
  usersActiveCount?: number | null;
  usersBillableCount?: number | null;
  appointmentsUsed?: number | null;
  toolsUsed?: number | null;
  freeAppointmentsLimit?: number | null;
  freeToolsLimit?: number | null;
  freeUsersLimit?: number | null;
};

const isUnderEveryFreeLimit = (usage: OrgUsageCountersDoc) =>
  (usage.usersActiveCount ?? 0) < (usage.freeUsersLimit ?? 0) &&
  (usage.appointmentsUsed ?? 0) < (usage.freeAppointmentsLimit ?? 0) &&
  (usage.toolsUsed ?? 0) < (usage.freeToolsLimit ?? 0);

/**
 * Stamp `freeLimitReachedAt` on the organisation's usage counter the first
 * time any free-plan limit is hit. `buildWhere` names the row (by `orgId` or
 * `id`); the `freeLimitReachedAt: null` guard keeps the stamp
 * first-writer-wins so callers notify at most once.
 */
export const markFreeLimitReachedAt = async (
  usage: OrgUsageCountersDoc | null,
  buildWhere: (
    counters: OrgUsageCountersDoc,
  ) => Prisma.OrganizationUsageCounterWhereInput,
): Promise<boolean> => {
  if (!usage || usage.freeLimitReachedAt || isUnderEveryFreeLimit(usage)) {
    return false;
  }

  const updated = await prisma.organizationUsageCounter.updateMany({
    where: { ...buildWhere(usage), freeLimitReachedAt: null },
    data: { freeLimitReachedAt: new Date() },
  });
  return updated.count > 0;
};
