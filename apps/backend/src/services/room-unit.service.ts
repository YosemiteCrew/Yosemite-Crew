import { type RoomType } from "@yosemite-crew/database";
import { prisma } from "src/config/prisma";
import type { RoomUnit } from "@yosemite-crew/types";
import {
  optionalNonEmptyString,
  requireNonEmptyString,
  roomTypeSupportsUnits,
  RoomValidationError,
} from "./room-management.helpers";

type RoomRow = {
  id: string;
  organisationId: string;
  type: RoomType;
};

type RoomUnitRow = {
  id: string;
  organisationId: string;
  roomId: string;
  unitGroupId: string | null;
  code: string;
  displayName: string;
  size: string | null;
  speciesConstraints: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdmissionRow = {
  unitId: string | null;
};

type RoomUnitDelegate = {
  create(args: {
    data: {
      organisationId: string;
      roomId: string;
      unitGroupId?: string | null;
      code: string;
      displayName: string;
      size: string | null;
      speciesConstraints: unknown;
      isActive: boolean;
    };
  }): Promise<RoomUnitRow>;
  findUnique(args: { where: { id: string } }): Promise<RoomUnitRow | null>;
  findMany(args: {
    where: {
      organisationId?: string;
      roomId?: string;
      unitGroupId?: string;
      isActive?: boolean;
    };
    orderBy: { displayName: "asc" };
  }): Promise<RoomUnitRow[]>;
  update(args: {
    where: { id: string };
    data: {
      roomId?: string;
      unitGroupId?: string | null;
      code?: string;
      displayName?: string;
      size?: string | null;
      speciesConstraints?: unknown;
      isActive?: boolean;
    };
  }): Promise<RoomUnitRow>;
  delete(args: { where: { id: string } }): Promise<RoomUnitRow>;
};

export class RoomUnitServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "RoomUnitServiceError";
  }
}

const normalizeOptionalString = (value?: string | null) => {
  try {
    return optionalNonEmptyString(value);
  } catch (error) {
    if (error instanceof RoomValidationError) {
      throw new RoomUnitServiceError(error.message, 400);
    }

    throw error;
  }
};

const requireString = (value: string | undefined, field: string) => {
  try {
    return requireNonEmptyString(value, field);
  } catch (error) {
    if (error instanceof RoomValidationError) {
      throw new RoomUnitServiceError(error.message, 400);
    }

    throw error;
  }
};

const toDomain = (
  row: RoomUnitRow,
  occupiedUnitIds?: ReadonlySet<string>,
): RoomUnit => ({
  id: row.id,
  organisationId: row.organisationId,
  roomId: row.roomId,
  unitGroupId: row.unitGroupId ?? undefined,
  code: row.code,
  displayName: row.displayName,
  size: row.size ?? undefined,
  speciesConstraints: Array.isArray(row.speciesConstraints)
    ? row.speciesConstraints.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : undefined,
  isActive: row.isActive,
  isOccupied: occupiedUnitIds?.has(row.id),
});

const getRoomUnitDelegate = (): RoomUnitDelegate =>
  (prisma as unknown as { roomUnit: RoomUnitDelegate }).roomUnit;

const getOccupiedUnitIds = async (
  organisationId?: string,
): Promise<Set<string> | undefined> => {
  const normalizedOrganisationId = normalizeOptionalString(organisationId);
  if (!normalizedOrganisationId) return undefined;

  const admissions = await (
    prisma as unknown as {
      admission: {
        findMany(args: {
          where: {
            organisationId: string;
            dischargedAt: null;
            unitId: { not: null };
          };
          select: { unitId: true };
        }): Promise<AdmissionRow[]>;
      };
    }
  ).admission.findMany({
    where: {
      organisationId: normalizedOrganisationId,
      dischargedAt: null,
      unitId: { not: null },
    },
    select: { unitId: true },
  });

  return new Set(
    admissions
      .map((admission) => admission.unitId)
      .filter((unitId): unitId is string => Boolean(unitId)),
  );
};

const assertRoomExists = async (roomId: string, organisationId: string) => {
  const room = (await prisma.organisationRoom.findUnique({
    where: { id: roomId },
    select: { id: true, organisationId: true, type: true },
  })) as RoomRow | null;

  if (!room) {
    throw new RoomUnitServiceError("Organisation room not found.", 404);
  }

  if (room.organisationId !== organisationId) {
    throw new RoomUnitServiceError("Room organisation mismatch.", 409);
  }

  if (!roomTypeSupportsUnits(room.type)) {
    throw new RoomUnitServiceError(
      "Units are only supported for ICU, Inpatient, Isolation and Boarding rooms.",
      409,
    );
  }
};

const assertRoomUnitGroupExists = async (
  unitGroupId: string,
  roomId: string,
  organisationId: string,
) => {
  const group = (await prisma.roomUnitGroup.findUnique({
    where: { id: unitGroupId },
    select: { id: true, roomId: true, organisationId: true },
  })) as { id: string; roomId: string; organisationId: string } | null;

  if (!group) {
    throw new RoomUnitServiceError("Room unit group not found.", 404);
  }

  if (group.organisationId !== organisationId) {
    throw new RoomUnitServiceError(
      "Room unit group organisation mismatch.",
      409,
    );
  }

  if (group.roomId !== roomId) {
    throw new RoomUnitServiceError("Room unit group room mismatch.", 409);
  }
};

export const RoomUnitService = {
  async create(input: RoomUnit): Promise<RoomUnit> {
    const organisationId = requireString(
      input.organisationId,
      "organisationId",
    );
    const roomId = requireString(input.roomId, "roomId");
    const code = requireString(input.code, "code");
    const displayName = requireString(input.displayName, "displayName");
    await assertRoomExists(roomId, organisationId);
    if (input.unitGroupId) {
      await assertRoomUnitGroupExists(
        input.unitGroupId,
        roomId,
        organisationId,
      );
    }

    const created = await getRoomUnitDelegate().create({
      data: {
        organisationId,
        roomId,
        unitGroupId: normalizeOptionalString(input.unitGroupId) ?? null,
        code,
        displayName,
        size: normalizeOptionalString(input.size) ?? null,
        speciesConstraints: input.speciesConstraints ?? [],
        isActive: input.isActive ?? true,
      },
    });

    return toDomain(created);
  },

  async update(id: string, input: Partial<RoomUnit>): Promise<RoomUnit> {
    const unitId = requireString(id, "unitId");
    const current = await getRoomUnitDelegate().findUnique({
      where: { id: unitId },
    });

    if (!current) {
      throw new RoomUnitServiceError("Room unit not found.", 404);
    }

    const roomId = normalizeOptionalString(input.roomId) ?? current.roomId;
    const unitGroupId =
      input.unitGroupId === undefined
        ? (current.unitGroupId ?? undefined)
        : (normalizeOptionalString(input.unitGroupId) ?? undefined);
    const organisationId = current.organisationId;
    await assertRoomExists(roomId, organisationId);
    if (unitGroupId) {
      await assertRoomUnitGroupExists(unitGroupId, roomId, organisationId);
    }

    const updated = await getRoomUnitDelegate().update({
      where: { id: unitId },
      data: {
        roomId,
        unitGroupId: unitGroupId ?? null,
        code:
          input.code === undefined
            ? undefined
            : requireString(input.code, "code"),
        displayName:
          input.displayName === undefined
            ? undefined
            : requireString(input.displayName, "displayName"),
        size:
          input.size === undefined
            ? undefined
            : (normalizeOptionalString(input.size) ?? null),
        speciesConstraints: input.speciesConstraints ?? undefined,
        isActive: input.isActive,
      },
    });

    return toDomain(updated);
  },

  async list(filters: {
    organisationId?: string;
    roomId?: string;
    unitGroupId?: string;
    isActive?: boolean;
  }): Promise<RoomUnit[]> {
    const rows = await getRoomUnitDelegate().findMany({
      where: {
        organisationId: normalizeOptionalString(filters.organisationId),
        roomId: normalizeOptionalString(filters.roomId),
        unitGroupId: normalizeOptionalString(filters.unitGroupId),
        isActive: filters.isActive,
      },
      orderBy: { displayName: "asc" },
    });

    const occupiedUnitIds = await getOccupiedUnitIds(filters.organisationId);

    return rows.map((row) => toDomain(row, occupiedUnitIds));
  },

  async delete(id: string, organisationId?: string): Promise<RoomUnit> {
    const unitId = requireString(id, "unitId");
    const existing = await getRoomUnitDelegate().findUnique({
      where: { id: unitId },
    });

    if (!existing) {
      throw new RoomUnitServiceError("Room unit not found.", 404);
    }

    if (organisationId && existing.organisationId !== organisationId) {
      throw new RoomUnitServiceError("Unit organisation mismatch.", 409);
    }

    const deleted = await getRoomUnitDelegate().delete({
      where: { id: unitId },
    });

    return toDomain(deleted);
  },
};
