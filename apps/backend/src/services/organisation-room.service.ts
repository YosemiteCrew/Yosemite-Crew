import { RoomOccupancyStatus, RoomType } from "@yosemite-crew/database";
import type { RoomReferenceMapping } from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import {
  normalizeRoomOccupancyStatus,
  normalizeRoomType,
  normalizeReferenceMappings,
  normalizeStrictStringList,
  requireNonEmptyString,
  RoomValidationError,
} from "./room-management.helpers";

export type OrganisationRoomInput = {
  organisationId: string;
  name: string;
  code?: string;
  description?: string | null;
  type: RoomType;
  occupancyStatus?: RoomOccupancyStatus;
  assignedSpecialiteis?: RoomReferenceMapping[];
  assignedStaffs?: RoomReferenceMapping[];
  availableNow?: boolean;
  availabilityMode?: "WORKING_HOURS" | "ALL_DAY" | "CUSTOM";
  availabilityDays?: string[];
  availabilityStartTime?: string | null;
  availabilityEndTime?: string | null;
  capabilities?: string[];
};

export type OrganisationRoomRecord = {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  description?: string;
  type: RoomType;
  occupancyStatus: RoomOccupancyStatus;
  assignedSpecialiteis: RoomReferenceMapping[];
  assignedStaffs: RoomReferenceMapping[];
  availableNow: boolean;
  availabilityMode: "WORKING_HOURS" | "ALL_DAY" | "CUSTOM";
  availabilityDays: string[];
  availabilityStartTime?: string;
  availabilityEndTime?: string;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type OrganisationRoomSummaryUnit = {
  id: string;
  code: string;
  displayName: string;
  size: string | null;
  speciesConstraints: string[];
  isActive: boolean;
  isOccupied: boolean;
};

export type OrganisationRoomSummaryGroup = {
  id: string;
  name: string;
  size: string | null;
  unitCount: number;
  occupiedCount: number;
  vacantCount: number;
  speciesConstraints: string[];
  capabilities: string[];
  isActive: boolean;
};

export type OrganisationRoomSummaryItem = OrganisationRoomRecord & {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyDisplay: string;
  unitGroups: OrganisationRoomSummaryGroup[];
  units: OrganisationRoomSummaryUnit[];
};

export type OrganisationRoomDetail = OrganisationRoomSummaryItem & {
  occupancySource: "UNITS" | "ROOM";
};

export class OrganisationRoomServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OrganisationRoomServiceError";
  }
}

type RoomRow = {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  description: string | null;
  type: RoomType;
  occupancyStatus: RoomOccupancyStatus;
  availableNow: boolean;
  availabilityMode: "WORKING_HOURS" | "ALL_DAY" | "CUSTOM";
  availabilityDays: string[];
  availabilityStartTime: string | null;
  availabilityEndTime: string | null;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
};

type RoomSpecialityRow = {
  roomId: string;
  specialityId: string;
};

type RoomStaffRow = {
  roomId: string;
  staffUserId: string;
};

type SpecialityRow = {
  id: string;
  name: string;
};

type UserRow = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
};

type RoomUnitRow = {
  id: string;
  roomId: string;
  unitGroupId: string | null;
  code: string;
  displayName: string;
  size: string | null;
  speciesConstraints: unknown;
  isActive: boolean;
};

type RoomUnitGroupRow = {
  id: string;
  roomId: string;
  name: string;
  size: string | null;
  unitCount: number;
  speciesConstraints: unknown;
  capabilities: string[];
  isActive: boolean;
};

type AdmissionRow = {
  unitId: string | null;
};

const normalizeAvailabilityMode = (
  value: unknown,
): OrganisationRoomRecord["availabilityMode"] | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RoomValidationError("Availability mode must be a string.");
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (!["WORKING_HOURS", "ALL_DAY", "CUSTOM"].includes(normalized)) {
    throw new RoomValidationError("Invalid availability mode.");
  }

  return normalized as OrganisationRoomRecord["availabilityMode"];
};

const normalizeOptionalString = (value: unknown) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RoomValidationError("Invalid string value.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalCode = (value: unknown) => {
  const normalized = normalizeOptionalString(value);

  if (normalized && normalized.includes("$")) {
    throw new RoomValidationError("Invalid character in code.");
  }

  return normalized;
};

const slugifyRoomCode = (value: string) => {
  const lower = value.trim().toLowerCase();
  let slug = "";
  let pendingDash = false;

  for (const char of lower) {
    const isAlphaNumeric =
      (char >= "a" && char <= "z") || (char >= "0" && char <= "9");

    if (isAlphaNumeric) {
      if (pendingDash && slug.length > 0) {
        slug += "-";
      }
      slug += char;
      pendingDash = false;
      continue;
    }

    pendingDash = true;
  }

  return slug;
};

const buildGeneratedRoomCode = (name: string) => {
  const slug = slugifyRoomCode(name);
  return slug.length > 0 ? slug : "room";
};

const normalizeSpeciesConstraints = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((entry) =>
          typeof entry === "string" ? entry.trim().toLowerCase() : "",
        )
        .filter((entry) => entry.length > 0),
    ),
  ];
};

const wrapValidationError = (error: unknown): never => {
  if (error instanceof RoomValidationError) {
    throw new OrganisationRoomServiceError(error.message, 400);
  }

  throw error;
};

const displayNameFromUser = (user: UserRow) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
  user.userId;

const uniqueById = <T extends { id: string }>(values: T[]) => {
  const deduped = new Map<string, T>();
  for (const value of values) {
    deduped.set(value.id, value);
  }
  return [...deduped.values()];
};

const toRecord = (
  row: RoomRow,
  specialities: RoomReferenceMapping[] = [],
  staff: RoomReferenceMapping[] = [],
): OrganisationRoomRecord => ({
  id: row.id,
  organisationId: row.organisationId,
  name: row.name,
  code: row.code,
  description: row.description ?? undefined,
  type: row.type,
  occupancyStatus: row.occupancyStatus,
  assignedSpecialiteis: specialities,
  assignedStaffs: staff,
  availableNow: row.availableNow,
  availabilityMode: row.availabilityMode,
  availabilityDays: row.availabilityDays ?? [],
  availabilityStartTime: row.availabilityStartTime ?? undefined,
  availabilityEndTime: row.availabilityEndTime ?? undefined,
  capabilities: row.capabilities ?? [],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const getOrganisationRoomDelegate = () =>
  (
    prisma as unknown as {
      organisationRoom: {
        create(args: {
          data: Omit<RoomRow, "id" | "createdAt" | "updatedAt">;
        }): Promise<RoomRow>;
        findUnique(args: {
          where: { id: string };
          select?: Record<string, unknown>;
        }): Promise<RoomRow | null>;
        findFirst(args: {
          where: Record<string, unknown>;
          select?: Record<string, unknown>;
        }): Promise<RoomRow | null>;
        findMany(args: {
          where: Record<string, unknown>;
          orderBy?:
            | Record<string, "asc" | "desc">
            | Array<Record<string, "asc" | "desc">>;
          select?: Record<string, unknown>;
        }): Promise<RoomRow[]>;
        update(args: {
          where: { id: string };
          data: Partial<
            Omit<RoomRow, "id" | "organisationId" | "createdAt" | "updatedAt">
          >;
        }): Promise<RoomRow>;
        delete(args: { where: { id: string } }): Promise<RoomRow>;
        deleteMany(args: { where: { organisationId: string } }): Promise<{
          count: number;
        }>;
      };
      organisationRoomSpeciality: {
        createMany(args: {
          data: Array<{
            organisationId: string;
            roomId: string;
            specialityId: string;
          }>;
        }): Promise<unknown>;
        deleteMany(args: {
          where: { organisationId?: string; roomId?: string };
        }): Promise<{ count: number }>;
        findMany(args: {
          where: { organisationId: string };
          orderBy: Array<Record<string, "asc" | "desc">>;
        }): Promise<RoomSpecialityRow[]>;
      };
      organisationRoomStaff: {
        createMany(args: {
          data: Array<{
            organisationId: string;
            roomId: string;
            staffUserId: string;
          }>;
        }): Promise<unknown>;
        deleteMany(args: {
          where: { organisationId?: string; roomId?: string };
        }): Promise<{ count: number }>;
        findMany(args: {
          where: { organisationId: string };
          orderBy: Array<Record<string, "asc" | "desc">>;
        }): Promise<RoomStaffRow[]>;
      };
      speciality: {
        findMany(args: {
          where: { id: { in: string[] } };
          select: { id: true; name: true };
        }): Promise<SpecialityRow[]>;
      };
      user: {
        findMany(args: {
          where: { userId: { in: string[] } };
          select: { userId: true; firstName: true; lastName: true };
        }): Promise<UserRow[]>;
      };
      roomUnit: {
        findMany(args: {
          where: { organisationId: string };
          orderBy: Array<Record<string, "asc" | "desc">>;
        }): Promise<RoomUnitRow[]>;
      };
      roomUnitGroup: {
        findMany(args: {
          where: { organisationId: string };
          orderBy: Array<Record<string, "asc" | "desc">>;
        }): Promise<RoomUnitGroupRow[]>;
      };
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
  ).organisationRoom;

const assertOrganisationRoomExists = async (
  id: string,
  organisationId: string,
) => {
  const room = await getOrganisationRoomDelegate().findUnique({
    where: { id },
    select: { id: true, organisationId: true },
  });

  if (!room) {
    throw new OrganisationRoomServiceError("Organisation room not found.", 404);
  }

  if (room.organisationId !== organisationId) {
    throw new OrganisationRoomServiceError(
      "Organisation room does not belong to the requested organisation.",
      403,
    );
  }
};

const assertRoomCodeIsUnique = async (
  organisationId: string,
  code: string,
  excludeId?: string,
) => {
  const room = await getOrganisationRoomDelegate().findFirst({
    where: {
      organisationId,
      code,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (room) {
    throw new OrganisationRoomServiceError(
      "Room code must be unique within the organisation.",
      409,
    );
  }
};

const isRoomCodeAvailable = async (
  organisationId: string,
  code: string,
  excludeId?: string,
) => {
  const room = await getOrganisationRoomDelegate().findFirst({
    where: {
      organisationId,
      code,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  return !room;
};

const resolveRoomCode = async (args: {
  organisationId: string;
  name: string;
  code?: unknown;
  excludeId?: string;
}) => {
  const explicitCode = normalizeOptionalCode(args.code);

  if (explicitCode) {
    await assertRoomCodeIsUnique(
      args.organisationId,
      explicitCode,
      args.excludeId,
    );
    return explicitCode;
  }

  const baseCode = buildGeneratedRoomCode(args.name);

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? baseCode : `${baseCode}-${suffix + 1}`;
    if (
      await isRoomCodeAvailable(args.organisationId, candidate, args.excludeId)
    ) {
      return candidate;
    }
  }

  throw new OrganisationRoomServiceError(
    "Unable to generate a unique room code.",
    409,
  );
};

type BuiltRoomInput = {
  room: Omit<RoomRow, "id" | "createdAt" | "updatedAt">;
  assignedSpecialiteis: RoomReferenceMapping[];
  assignedStaffs: RoomReferenceMapping[];
};

const buildRoomInput = async (
  input: Partial<OrganisationRoomInput>,
  excludeId?: string,
): Promise<BuiltRoomInput> => {
  try {
    const organisationId = requireNonEmptyString(
      input.organisationId,
      "organisationId",
    );
    const name = requireNonEmptyString(input.name, "name");
    const type = normalizeRoomType(input.type);
    const code = await resolveRoomCode({
      organisationId,
      name,
      code: input.code,
      excludeId,
    });

    return {
      room: {
        organisationId,
        name,
        code,
        description: normalizeOptionalString(input.description) ?? null,
        type,
        occupancyStatus:
          input.occupancyStatus == null
            ? "VACANT"
            : normalizeRoomOccupancyStatus(input.occupancyStatus),
        availableNow:
          typeof input.availableNow === "boolean" ? input.availableNow : true,
        availabilityMode:
          normalizeAvailabilityMode(input.availabilityMode) ?? "ALL_DAY",
        availabilityDays: normalizeStrictStringList(
          input.availabilityDays,
          "availabilityDays",
        ),
        availabilityStartTime:
          normalizeOptionalString(input.availabilityStartTime) ?? null,
        availabilityEndTime:
          normalizeOptionalString(input.availabilityEndTime) ?? null,
        capabilities: normalizeStrictStringList(
          input.capabilities,
          "capabilities",
        ),
      },
      assignedSpecialiteis: normalizeReferenceMappings(
        input.assignedSpecialiteis,
        "assignedSpecialiteis",
      ),
      assignedStaffs: normalizeReferenceMappings(
        input.assignedStaffs,
        "assignedStaffs",
      ),
    };
  } catch (error) {
    return wrapValidationError(error);
  }
};

const groupRowsByRoom = <T extends { roomId: string }>(rows: T[]) => {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const current = grouped.get(row.roomId) ?? [];
    current.push(row);
    grouped.set(row.roomId, current);
  }

  return grouped;
};

const normalizeSummaryStringList = (value: unknown): string[] =>
  normalizeSpeciesConstraints(value);

const resolveSpecialityMappings = (
  links: RoomSpecialityRow[],
  specialities: Array<{ id: string; name: string }>,
): RoomReferenceMapping[] => {
  const byId = new Map(specialities.map((row) => [row.id, row]));

  return uniqueById(
    links.map((link) => {
      const row = byId.get(link.specialityId);
      return row
        ? { id: row.id, name: row.name }
        : { id: link.specialityId, name: link.specialityId };
    }),
  );
};

const resolveStaffMappings = (
  links: RoomStaffRow[],
  users: UserRow[],
): RoomReferenceMapping[] => {
  const byUserId = new Map(users.map((user) => [user.userId, user]));

  return uniqueById(
    links.map((link) => {
      const user = byUserId.get(link.staffUserId);
      if (!user) {
        return {
          id: link.staffUserId,
          name: link.staffUserId,
        };
      }

      return {
        id: user.userId,
        name: displayNameFromUser(user),
      };
    }),
  );
};

const syncRoomReferenceLinks = async (params: {
  roomId: string;
  organisationId: string;
  specialities: RoomReferenceMapping[];
  staff: RoomReferenceMapping[];
}): Promise<{
  specialities: RoomReferenceMapping[];
  staff: RoomReferenceMapping[];
}> => {
  const orgId = params.organisationId;
  const roomId = params.roomId;

  await prisma.organisationRoomSpeciality.deleteMany({
    where: { roomId, organisationId: orgId },
  });
  await prisma.organisationRoomStaff.deleteMany({
    where: { roomId, organisationId: orgId },
  });

  const specialityIds = params.specialities.map((entry) => entry.id);
  let resolvedSpecialities: RoomReferenceMapping[] = [];
  if (specialityIds.length) {
    const specialityRows = await prisma.speciality.findMany({
      where: { id: { in: specialityIds } },
      select: { id: true, name: true, organisationId: true },
    });

    const specialityById = new Map(specialityRows.map((row) => [row.id, row]));
    const invalidSpecialities = specialityIds.filter(
      (id) => !specialityById.has(id),
    );
    if (invalidSpecialities.length) {
      throw new OrganisationRoomServiceError(
        `Invalid speciality reference(s): ${invalidSpecialities.join(", ")}`,
        400,
      );
    }

    const invalidOrgSpecialities = specialityRows.filter(
      (row) => row.organisationId !== orgId,
    );
    if (invalidOrgSpecialities.length) {
      throw new OrganisationRoomServiceError(
        `Speciality must belong to the organisation: ${invalidOrgSpecialities
          .map((row) => row.id)
          .join(", ")}`,
        400,
      );
    }

    await prisma.organisationRoomSpeciality.createMany({
      data: specialityRows.map((row) => ({
        organisationId: orgId,
        roomId,
        specialityId: row.id,
      })),
    });

    resolvedSpecialities = resolveSpecialityMappings(
      specialityRows.map((row) => ({ roomId, specialityId: row.id })),
      specialityRows.map((row) => ({ id: row.id, name: row.name })),
    );
  }

  const staffIds = params.staff.map((entry) => entry.id);
  let resolvedStaff: RoomReferenceMapping[] = [];
  if (staffIds.length) {
    const users = await prisma.user.findMany({
      where: { userId: { in: staffIds } },
      select: { userId: true, firstName: true, lastName: true },
    });

    const userById = new Map(users.map((user) => [user.userId, user]));
    const invalidStaff = staffIds.filter((id) => !userById.has(id));
    if (invalidStaff.length) {
      throw new OrganisationRoomServiceError(
        `Invalid staff reference(s): ${invalidStaff.join(", ")}`,
        400,
      );
    }

    const orgMemberships = await prisma.userOrganization.findMany({
      where: {
        organizationReference: {
          in: [orgId, `Organization/${orgId}`],
        },
        practitionerReference: {
          in: staffIds.flatMap((id) => [
            id,
            `Practitioner/${id}`,
            `User/${id}`,
          ]),
        },
        active: true,
      },
      select: { practitionerReference: true },
    });

    const activeStaffIds = new Set(
      orgMemberships
        .map((membership) => membership.practitionerReference)
        .map((reference) => reference.split("/").pop() ?? reference),
    );

    const invalidMemberships = staffIds.filter((id) => !activeStaffIds.has(id));
    if (invalidMemberships.length) {
      throw new OrganisationRoomServiceError(
        `Staff must belong to the organisation: ${invalidMemberships.join(", ")}`,
        400,
      );
    }

    await prisma.organisationRoomStaff.createMany({
      data: users.map((user) => ({
        organisationId: orgId,
        roomId,
        staffUserId: user.userId,
      })),
    });

    resolvedStaff = resolveStaffMappings(
      users.map((user) => ({ roomId, staffUserId: user.userId })),
      users,
    );
  }

  return {
    specialities: resolvedSpecialities,
    staff: resolvedStaff,
  };
};

const loadRoomReferenceMaps = async (organisationId: string) => {
  const [specialityLinks, staffLinks] = await Promise.all([
    prisma.organisationRoomSpeciality.findMany({
      where: { organisationId },
      orderBy: [{ roomId: "asc" }, { specialityId: "asc" }],
    }),
    prisma.organisationRoomStaff.findMany({
      where: { organisationId },
      orderBy: [{ roomId: "asc" }, { staffUserId: "asc" }],
    }),
  ]);

  const specialityIds = [
    ...new Set(specialityLinks.map((link) => link.specialityId)),
  ];
  const staffIds = [...new Set(staffLinks.map((link) => link.staffUserId))];

  const [specialities, users] = await Promise.all([
    specialityIds.length
      ? prisma.speciality.findMany({
          where: { id: { in: specialityIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    staffIds.length
      ? prisma.user.findMany({
          where: { userId: { in: staffIds } },
          select: { userId: true, firstName: true, lastName: true },
        })
      : Promise.resolve([] as UserRow[]),
  ]);

  const specialitiesByRoom = new Map<string, RoomReferenceMapping[]>();
  const staffByRoom = new Map<string, RoomReferenceMapping[]>();

  const specialityById = new Map(specialities.map((row) => [row.id, row]));
  for (const link of specialityLinks) {
    const roomMappings = specialitiesByRoom.get(link.roomId) ?? [];
    const speciality = specialityById.get(link.specialityId);
    roomMappings.push({
      id: link.specialityId,
      name: speciality?.name ?? link.specialityId,
    });
    specialitiesByRoom.set(link.roomId, roomMappings);
  }

  const userById = new Map(users.map((row) => [row.userId, row]));
  for (const link of staffLinks) {
    const roomMappings = staffByRoom.get(link.roomId) ?? [];
    const user = userById.get(link.staffUserId);
    roomMappings.push({
      id: link.staffUserId,
      name: user ? displayNameFromUser(user) : link.staffUserId,
    });
    staffByRoom.set(link.roomId, roomMappings);
  }

  return {
    specialitiesByRoom,
    staffByRoom,
  };
};

const buildSummary = (
  room: RoomRow,
  roomUnits: RoomUnitRow[],
  roomGroups: RoomUnitGroupRow[],
  occupiedUnitIds: Set<string>,
  specialities: RoomReferenceMapping[] = [],
  staff: RoomReferenceMapping[] = [],
): OrganisationRoomSummaryItem => {
  const totalUnits = roomGroups.length
    ? roomGroups.reduce(
        (total, group) => total + Math.max(group.unitCount, 0),
        0,
      )
    : roomUnits.length;

  const occupiedUnits = roomUnits.filter((unit) =>
    occupiedUnitIds.has(unit.id),
  ).length;
  const vacantUnits = Math.max(totalUnits - occupiedUnits, 0);
  const occupancyDisplay =
    totalUnits > 0
      ? vacantUnits === 0
        ? "Occupied"
        : `Vacant (${vacantUnits})`
      : room.occupancyStatus;

  return {
    ...toRecord(room, specialities, staff),
    totalUnits,
    occupiedUnits,
    vacantUnits,
    occupancyDisplay,
    unitGroups: roomGroups.map((group) => {
      const occupiedCount = roomUnits.filter(
        (unit) =>
          unit.unitGroupId === group.id &&
          unit.isActive &&
          occupiedUnitIds.has(unit.id),
      ).length;

      return {
        id: group.id,
        name: group.name,
        size: group.size,
        unitCount: group.unitCount,
        occupiedCount,
        vacantCount: Math.max(group.unitCount - occupiedCount, 0),
        speciesConstraints: normalizeSummaryStringList(
          group.speciesConstraints,
        ),
        capabilities: group.capabilities ?? [],
        isActive: group.isActive,
      };
    }),
    units: roomUnits.map((unit) => ({
      id: unit.id,
      code: unit.code,
      displayName: unit.displayName,
      size: unit.size,
      speciesConstraints: normalizeSummaryStringList(unit.speciesConstraints),
      isActive: unit.isActive,
      isOccupied: occupiedUnitIds.has(unit.id),
    })),
  };
};

export const OrganisationRoomService = {
  async create(
    input: Partial<OrganisationRoomInput>,
  ): Promise<OrganisationRoomRecord> {
    const roomInput = await buildRoomInput(input);

    const created = await getOrganisationRoomDelegate().create({
      data: roomInput.room,
    });

    const resolvedLinks = await syncRoomReferenceLinks({
      roomId: created.id,
      organisationId: created.organisationId,
      specialities: roomInput.assignedSpecialiteis,
      staff: roomInput.assignedStaffs,
    });

    return toRecord(created, resolvedLinks.specialities, resolvedLinks.staff);
  },

  async update(
    id: string,
    input: Partial<OrganisationRoomInput>,
  ): Promise<OrganisationRoomRecord> {
    const roomId = requireNonEmptyString(id, "id");
    const existing = await getOrganisationRoomDelegate().findUnique({
      where: { id: roomId },
    });

    if (!existing) {
      throw new OrganisationRoomServiceError(
        "Organisation room not found.",
        404,
      );
    }

    const currentLinks = await loadRoomReferenceMaps(existing.organisationId);
    const next = await buildRoomInput(
      {
        organisationId: existing.organisationId,
        name: input.name ?? existing.name,
        code: input.code,
        description:
          input.description === undefined
            ? existing.description
            : input.description,
        type: input.type ?? existing.type,
        occupancyStatus: input.occupancyStatus ?? existing.occupancyStatus,
        assignedSpecialiteis:
          input.assignedSpecialiteis ??
          currentLinks.specialitiesByRoom.get(existing.id) ??
          [],
        assignedStaffs:
          input.assignedStaffs ??
          currentLinks.staffByRoom.get(existing.id) ??
          [],
        availableNow: input.availableNow ?? existing.availableNow,
        availabilityMode: input.availabilityMode ?? existing.availabilityMode,
        availabilityDays: input.availabilityDays ?? existing.availabilityDays,
        availabilityStartTime:
          input.availabilityStartTime ?? existing.availabilityStartTime,
        availabilityEndTime:
          input.availabilityEndTime ?? existing.availabilityEndTime,
        capabilities: input.capabilities ?? existing.capabilities,
      },
      existing.id,
    );

    const updated = await getOrganisationRoomDelegate().update({
      where: { id: roomId },
      data: next.room,
    });

    const resolvedLinks = await syncRoomReferenceLinks({
      roomId: updated.id,
      organisationId: updated.organisationId,
      specialities: next.assignedSpecialiteis,
      staff: next.assignedStaffs,
    });

    return toRecord(updated, resolvedLinks.specialities, resolvedLinks.staff);
  },

  async getAllByOrganizationId(organisationId: string) {
    return this.getSummaryByOrganizationId(organisationId);
  },

  async getSummaryByOrganizationId(
    organisationId: string,
  ): Promise<OrganisationRoomSummaryItem[]> {
    const orgId = requireNonEmptyString(organisationId, "organisationId");
    const referenceMaps = await loadRoomReferenceMaps(orgId);

    const [rooms, units, groups, admissions] = (await Promise.all([
      getOrganisationRoomDelegate().findMany({
        where: { organisationId: orgId },
        orderBy: [{ name: "asc" }],
      }),
      (
        prisma as unknown as {
          roomUnit: { findMany: typeof prisma.roomUnit.findMany };
        }
      ).roomUnit.findMany({
        where: { organisationId: orgId },
        orderBy: [{ roomId: "asc" }, { displayName: "asc" }],
      }),
      (
        prisma as unknown as {
          roomUnitGroup: { findMany: typeof prisma.roomUnitGroup.findMany };
        }
      ).roomUnitGroup.findMany({
        where: { organisationId: orgId },
        orderBy: [{ roomId: "asc" }, { name: "asc" }],
      }),
      (
        prisma as unknown as {
          admission: { findMany: typeof prisma.admission.findMany };
        }
      ).admission.findMany({
        where: {
          organisationId: orgId,
          dischargedAt: null,
          unitId: { not: null },
        },
        select: { unitId: true },
      }),
    ])) as [RoomRow[], RoomUnitRow[], RoomUnitGroupRow[], AdmissionRow[]];

    const occupiedUnitIds = new Set(
      admissions
        .map((admission) => admission.unitId)
        .filter((unitId): unitId is string => Boolean(unitId)),
    );

    const unitsByRoomId = groupRowsByRoom(units);
    const groupsByRoomId = groupRowsByRoom(groups);

    return rooms.map((room) =>
      buildSummary(
        room,
        unitsByRoomId.get(room.id) ?? [],
        groupsByRoomId.get(room.id) ?? [],
        occupiedUnitIds,
        referenceMaps.specialitiesByRoom.get(room.id) ?? [],
        referenceMaps.staffByRoom.get(room.id) ?? [],
      ),
    );
  },

  async getById(
    id: string,
    organisationId: string,
  ): Promise<OrganisationRoomDetail> {
    const roomId = requireNonEmptyString(id, "id");
    const orgId = requireNonEmptyString(organisationId, "organisationId");
    const referenceMaps = await loadRoomReferenceMaps(orgId);
    const [room, summary] = await Promise.all([
      getOrganisationRoomDelegate().findUnique({
        where: { id: roomId },
      }),
      this.getSummaryByOrganizationId(orgId),
    ]);

    if (!room) {
      throw new OrganisationRoomServiceError(
        "Organisation room not found.",
        404,
      );
    }

    if (room.organisationId !== orgId) {
      throw new OrganisationRoomServiceError(
        "Organisation room does not belong to the requested organisation.",
        403,
      );
    }

    const detail = summary.find((item) => item.id === roomId);

    if (!detail) {
      return {
        ...buildSummary(
          room,
          [],
          [],
          new Set(),
          referenceMaps.specialitiesByRoom.get(roomId) ?? [],
          referenceMaps.staffByRoom.get(roomId) ?? [],
        ),
        occupancySource: "ROOM",
      };
    }

    return {
      ...detail,
      occupancySource: detail.totalUnits > 0 ? "UNITS" : "ROOM",
    };
  },

  async toggleAvailability(
    id: string,
    organisationId: string,
  ): Promise<OrganisationRoomRecord> {
    const roomId = requireNonEmptyString(id, "id");
    const orgId = requireNonEmptyString(organisationId, "organisationId");
    await assertOrganisationRoomExists(roomId, orgId);

    const room = await getOrganisationRoomDelegate().findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new OrganisationRoomServiceError(
        "Organisation room not found.",
        404,
      );
    }

    const updated = await getOrganisationRoomDelegate().update({
      where: { id: roomId },
      data: {
        availableNow: !room.availableNow,
      },
    });

    const referenceMaps = await loadRoomReferenceMaps(orgId);
    return toRecord(
      updated,
      referenceMaps.specialitiesByRoom.get(roomId) ?? [],
      referenceMaps.staffByRoom.get(roomId) ?? [],
    );
  },

  async delete(
    id: string,
    organisationId: string,
  ): Promise<OrganisationRoomRecord> {
    const roomId = requireNonEmptyString(id, "id");
    const orgId = requireNonEmptyString(organisationId, "organisationId");
    const room = await getOrganisationRoomDelegate().findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new OrganisationRoomServiceError(
        "Organisation room not found.",
        404,
      );
    }

    if (room.organisationId !== orgId) {
      throw new OrganisationRoomServiceError(
        "Organisation room does not belong to the requested organisation.",
        403,
      );
    }

    const deleted = await getOrganisationRoomDelegate().delete({
      where: { id: roomId },
    });

    return toRecord(deleted, [], []);
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireNonEmptyString(organisationId, "organisationId");
    await getOrganisationRoomDelegate().deleteMany({
      where: { organisationId: orgId },
    });
  },
};
