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
};
