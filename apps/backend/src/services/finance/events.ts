import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

export type FinanceEventInput = {
  organisationId?: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
  processedAt?: Date | null;
};

// Resolve a staff member's display name from their Cognito user id so events can
// record WHO performed an action (e.g. marked an encounter ready for billing).
export const resolveActorDisplayName = async (
  actorUserId?: string | null,
): Promise<string | null> => {
  const id = actorUserId?.trim();
  if (!id) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { userId: id },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) {
    return null;
  }
  const name = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return name || user.email || null;
};

export const FinanceEventService = {
  async recordEvent(input: FinanceEventInput) {
    return prisma.financeEvent.create({
      data: {
        organisationId: input.organisationId ?? undefined,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        occurredAt: input.occurredAt ?? new Date(),
        processedAt: input.processedAt ?? undefined,
      },
    });
  },

  // Record a readiness transition (ready-for-billing / ready-for-discharge) with
  // the acting user's id and resolved display name so the workspace can show who
  // marked it. Stored in the event payload (no schema change required).
  async recordReadinessEvent(input: {
    organisationId?: string | null;
    eventType: string;
    entityType: string;
    entityId: string;
    actorUserId?: string | null;
  }) {
    const actorName = await resolveActorDisplayName(input.actorUserId);
    return this.recordEvent({
      organisationId: input.organisationId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: {
        actorUserId: input.actorUserId ?? null,
        actorName,
      },
    });
  },
};
