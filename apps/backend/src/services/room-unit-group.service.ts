import { type RoomType } from "@yosemite-crew/database";
import { prisma } from "src/config/prisma";
import type { RoomUnitGroup } from "@yosemite-crew/types";
import {
  normalizeStrictStringList,
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

type RoomUnitGroupRow = {
  id: string;
  organisationId: string;
  roomId: string;
  name: string;
  size: string | null;
  unitCount: number;
  speciesConstraints: unknown;
  capabilities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RoomUnitGroupDelegate = {
  create(args: {
    data: {
      organisationId: string;
      roomId: string;
      name: string;
      size?: string | null;
      unitCount: number;
      speciesConstraints?: unknown;
      capabilities?: string[];
      isActive: boolean;
    };
  }): Promise<RoomUnitGroupRow>;
  findUnique(args: { where: { id: string } }): Promise<RoomUnitGroupRow | null>;
  findFirst(args: {
    where: { id: string; organisationId: string };
  }): Promise<RoomUnitGroupRow | null>;
  findMany(args: {
    where: {
      organisationId: string;
      roomId?: string;
      isActive?: boolean;
    };
    orderBy: [{ roomId: "asc" }, { name: "asc" }];
  }): Promise<RoomUnitGroupRow[]>;
  update(args: {
    where: { id: string };
    data: {
      roomId?: string;
      name?: string;
      size?: string | null;
      unitCount?: number;
      speciesConstraints?: unknown;
      capabilities?: string[];
      isActive?: boolean;
    };
  }): Promise<RoomUnitGroupRow>;
  delete(args: { where: { id: string } }): Promise<RoomUnitGroupRow>;
};

export class RoomUnitGroupServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "RoomUnitGroupServiceError";
  }
}

const requireString = (value: string | undefined, field: string) => {
  try {
    return requireNonEmptyString(value, field);
  } catch (error) {
    if (error instanceof RoomValidationError) {
      throw new RoomUnitGroupServiceError(error.message, 400);
    }

    throw error;
  }
};

const normalizeOptionalString = (value?: string | null) => {
  try {
    return optionalNonEmptyString(value);
  } catch (error) {
    if (error instanceof RoomValidationError) {
      throw new RoomUnitGroupServiceError(error.message, 400);
    }

    throw error;
  }
};

const toDomain = (row: RoomUnitGroupRow): RoomUnitGroup => ({
  id: row.id,
  organisationId: row.organisationId,
  roomId: row.roomId,
  name: row.name,
  size: row.size ?? undefined,
  unitCount: row.unitCount,
  speciesConstraints: Array.isArray(row.speciesConstraints)
    ? row.speciesConstraints.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : undefined,
  capabilities: row.capabilities ?? [],
  isActive: row.isActive,
});

const getRoomUnitGroupDelegate = (): RoomUnitGroupDelegate =>
  (prisma as unknown as { roomUnitGroup: RoomUnitGroupDelegate }).roomUnitGroup;

const assertRoomBelongsToOrganisation = async (
  roomId: string,
  organisationId: string,
): Promise<RoomRow> => {
  const room = await prisma.organisationRoom.findUnique({
    where: { id: roomId },
    select: { id: true, organisationId: true, type: true },
  });

  if (!room) {
    throw new RoomUnitGroupServiceError("Organisation room not found.", 404);
  }

  if (room.organisationId !== organisationId) {
    throw new RoomUnitGroupServiceError("Room organisation mismatch.", 409);
  }

  return room;
};

const assertRoomSupportsUnits = (room: RoomRow) => {
  if (!roomTypeSupportsUnits(room.type)) {
    throw new RoomUnitGroupServiceError(
      "Units are only supported for ICU, Inpatient, Isolation and Boarding rooms.",
      409,
    );
  }
};

// Used by create (and by update when actually moving a group to a different
// room) - a brand-new group-room association must target a room that
// currently supports units.
const assertRoomExists = async (roomId: string, organisationId: string) => {
  const room = await assertRoomBelongsToOrganisation(roomId, organisationId);
  assertRoomSupportsUnits(room);
};

export const RoomUnitGroupService = {
  async create(input: RoomUnitGroup): Promise<RoomUnitGroup> {
    try {
      const organisationId = requireString(
        input.organisationId,
        "organisationId",
      );
      const roomId = requireString(input.roomId, "roomId");
      const name = requireString(input.name, "name");
      const unitCount = Number.isInteger(input.unitCount) ? input.unitCount : 0;

      if (unitCount <= 0) {
        throw new RoomUnitGroupServiceError(
          "unitCount must be greater than 0.",
          400,
        );
      }

      await assertRoomExists(roomId, organisationId);

      const created = await getRoomUnitGroupDelegate().create({
        data: {
          organisationId,
          roomId,
          name,
          size: optionalNonEmptyString(input.size) ?? null,
          unitCount,
          speciesConstraints: normalizeStrictStringList(
            input.speciesConstraints,
            "speciesConstraints",
          ),
          capabilities: normalizeStrictStringList(
            input.capabilities,
            "capabilities",
          ),
          isActive: input.isActive ?? true,
        },
      });

      return toDomain(created);
    } catch (error) {
      if (error instanceof RoomValidationError) {
        throw new RoomUnitGroupServiceError(error.message, 400);
      }

      throw error;
    }
  },

  async update(
    id: string,
    organisationIdInput: string,
    input: Partial<RoomUnitGroup>,
  ): Promise<RoomUnitGroup> {
    try {
      const groupId = requireString(id, "groupId");
      const organisationId = requireString(
        organisationIdInput,
        "organisationId",
      );
      const current = await getRoomUnitGroupDelegate().findFirst({
        where: { id: groupId, organisationId },
      });

      if (!current) {
        throw new RoomUnitGroupServiceError("Room unit group not found.", 404);
      }

      const roomId = optionalNonEmptyString(input.roomId) ?? current.roomId;
      const room = await assertRoomBelongsToOrganisation(
        roomId,
        organisationId,
      );
      // Only exempt a same-room *deactivation* from the room-type check -
      // otherwise a type change away from a unit-capable room could never be
      // cleaned up (every cleanup request would 409). Any other same-room
      // update (reactivating, renaming, resizing) must still be rejected
      // while the room doesn't support units, or it recreates the exact
      // invalid state - an active group on a non-unit-capable room - that
      // create and move operations are meant to prevent.
      const isDeactivating = input.isActive === false;
      if (roomId !== current.roomId || !isDeactivating) {
        assertRoomSupportsUnits(room);
      }

      const unitCount =
        input.unitCount == null
          ? undefined
          : Number.isInteger(input.unitCount)
            ? input.unitCount
            : current.unitCount;

      if (unitCount !== undefined && unitCount <= 0) {
        throw new RoomUnitGroupServiceError(
          "unitCount must be greater than 0.",
          400,
        );
      }

      const updated = await getRoomUnitGroupDelegate().update({
        where: { id: groupId },
        data: {
          roomId,
          name:
            input.name === undefined
              ? undefined
              : requireString(input.name, "name"),
          size:
            input.size === undefined
              ? undefined
              : (optionalNonEmptyString(input.size) ?? null),
          unitCount,
          speciesConstraints:
            input.speciesConstraints === undefined
              ? undefined
              : normalizeStrictStringList(
                  input.speciesConstraints,
                  "speciesConstraints",
                ),
          capabilities:
            input.capabilities === undefined
              ? undefined
              : normalizeStrictStringList(input.capabilities, "capabilities"),
          isActive: input.isActive,
        },
      });

      return toDomain(updated);
    } catch (error) {
      if (error instanceof RoomValidationError) {
        throw new RoomUnitGroupServiceError(error.message, 400);
      }

      throw error;
    }
  },

  async list(filters: {
    organisationId: string;
    roomId?: string;
    isActive?: boolean;
  }): Promise<RoomUnitGroup[]> {
    const rows = await getRoomUnitGroupDelegate().findMany({
      where: {
        organisationId: requireString(filters.organisationId, "organisationId"),
        roomId: normalizeOptionalString(filters.roomId),
        isActive: filters.isActive,
      },
      orderBy: [{ roomId: "asc" }, { name: "asc" }],
    });

    return rows.map(toDomain);
  },

  async delete(
    id: string,
    organisationIdInput: string,
  ): Promise<RoomUnitGroup> {
    const groupId = requireString(id, "groupId");
    const organisationId = requireString(organisationIdInput, "organisationId");
    const existing = await getRoomUnitGroupDelegate().findUnique({
      where: { id: groupId },
    });

    if (!existing) {
      throw new RoomUnitGroupServiceError("Room unit group not found.", 404);
    }

    if (existing.organisationId !== organisationId) {
      throw new RoomUnitGroupServiceError("Room organisation mismatch.", 409);
    }

    const deleted = await getRoomUnitGroupDelegate().delete({
      where: { id: groupId },
    });

    return toDomain(deleted);
  },
};
