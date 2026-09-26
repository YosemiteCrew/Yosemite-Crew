import { CalendarBlockTargetType, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

export class CalendarBlockError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CalendarBlockError";
  }
}

const select = {
  id: true,
  organisationId: true,
  targetType: true,
  targetId: true,
  startAt: true,
  endAt: true,
  reason: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CalendarBlockSelect;

const assertTarget = async (
  organisationId: string,
  targetType: CalendarBlockTargetType,
  targetId: string,
) => {
  const found =
    targetType === "STAFF"
      ? await prisma.userOrganization.findFirst({
          where: {
            organizationReference: {
              in: [organisationId, `Organization/${organisationId}`],
            },
            practitionerReference: {
              in: [targetId, `Practitioner/${targetId}`],
            },
            active: true,
          },
          select: { id: true },
        })
      : await prisma.organisationRoom.findFirst({
          where: { organisationId, id: targetId, isActive: true },
          select: { id: true },
        });
  if (!found) throw new CalendarBlockError("Calendar resource not found.", 404);
};

const assertRange = (startAt: Date, endAt: Date) => {
  if (endAt <= startAt) {
    throw new CalendarBlockError("The end must be after the start.", 400);
  }
};

export const CalendarBlockService = {
  async list(organisationId: string, from: Date, to: Date) {
    if (to <= from) throw new CalendarBlockError("Invalid date range.", 400);
    return prisma.calendarBlock.findMany({
      where: {
        organisationId,
        startAt: { lt: to },
        endAt: { gt: from },
      },
      select,
      orderBy: { startAt: "asc" },
    });
  },

  async create(input: {
    organisationId: string;
    targetType: CalendarBlockTargetType;
    targetId: string;
    startAt: Date;
    endAt: Date;
    reason: string;
    createdBy?: string;
  }) {
    assertRange(input.startAt, input.endAt);
    await assertTarget(input.organisationId, input.targetType, input.targetId);
    return prisma.calendarBlock.create({
      data: { ...input, reason: input.reason.trim() },
      select,
    });
  },

  async update(
    organisationId: string,
    id: string,
    input: {
      targetType?: CalendarBlockTargetType;
      targetId?: string;
      startAt?: Date;
      endAt?: Date;
      reason?: string;
    },
  ) {
    const existing = await prisma.calendarBlock.findFirst({
      where: { id, organisationId },
      select,
    });
    if (!existing)
      throw new CalendarBlockError("Calendar block not found.", 404);
    const targetType = input.targetType ?? existing.targetType;
    const targetId = input.targetId ?? existing.targetId;
    const startAt = input.startAt ?? existing.startAt;
    const endAt = input.endAt ?? existing.endAt;
    assertRange(startAt, endAt);
    if (input.targetType || input.targetId) {
      await assertTarget(organisationId, targetType, targetId);
    }
    return prisma.calendarBlock.update({
      where: { id },
      data: {
        ...(input.targetType ? { targetType } : {}),
        ...(input.targetId ? { targetId } : {}),
        ...(input.startAt ? { startAt } : {}),
        ...(input.endAt ? { endAt } : {}),
        ...(input.reason !== undefined ? { reason: input.reason.trim() } : {}),
      },
      select,
    });
  },

  async delete(organisationId: string, id: string) {
    const existing = await prisma.calendarBlock.findFirst({
      where: { id, organisationId },
      select: { id: true },
    });
    if (!existing)
      throw new CalendarBlockError("Calendar block not found.", 404);
    await prisma.calendarBlock.delete({ where: { id } });
  },
};
