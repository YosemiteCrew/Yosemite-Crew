import BaseAvailabilityModel, {
  type BaseAvailabilityDocument,
  type BaseAvailabilityMongo,
  type AvailabilitySlotMongo,
} from "../models/base-availability";
import type { UserAvailability, DayOfWeek } from "@yosemite-crew/types";

export class BaseAvailabilityServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BaseAvailabilityServiceError";
  }
}

type UnknownRecord = Record<string, unknown>;

const forbidQueryOperators = (value: string, field: string) => {
  if (value.includes("$")) {
    throw new BaseAvailabilityServiceError(
      `Invalid character in ${field}.`,
      400,
    );
  }
};

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new BaseAvailabilityServiceError(`${field} is required.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new BaseAvailabilityServiceError(`${field} cannot be empty.`, 400);
  }

  forbidQueryOperators(trimmed, field);

  return trimmed;
};

const requireUserId = (value: unknown): string => {
  const identifier = requireString(value, "User id");

  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(identifier)) {
    throw new BaseAvailabilityServiceError("Invalid user id format.", 400);
  }

  return identifier;
};

const isValidTime = (value: string): boolean =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const assertPlainObject = (value: unknown, field: string): UnknownRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BaseAvailabilityServiceError(`${field} must be an object.`, 400);
  }

  return value as UnknownRecord;
};

const sanitizeSlot = (value: unknown, index: number): AvailabilitySlotMongo => {
  const record = assertPlainObject(value, `Slot[${index}]`);
  const startTime = requireString(record.startTime, `Slot[${index}].startTime`);
  const endTime = requireString(record.endTime, `Slot[${index}].endTime`);

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new BaseAvailabilityServiceError(
      `Slot[${index}] times must be in HH:MM format.`,
      400,
    );
  }

  if (startTime >= endTime) {
    throw new BaseAvailabilityServiceError(
      `Slot[${index}].startTime must be before endTime.`,
      400,
    );
  }

  const isAvailable =
    "isAvailable" in record
      ? typeof record.isAvailable === "boolean"
        ? record.isAvailable
        : (() => {
            throw new BaseAvailabilityServiceError(
              `Slot[${index}].isAvailable must be a boolean.`,
              400,
            );
          })()
      : true;

  return {
    startTime,
    endTime,
    isAvailable,
  };
};

const sanitizeAvailabilityEntry = (
  value: unknown,
  index: number,
): BaseAvailabilityMongo => {
  const record = assertPlainObject(value, `Availability[${index}]`);
  const dayOfWeekValue = requireString(
    record.dayOfWeek,
    `Availability[${index}].dayOfWeek`,
  );

  const allowedDays: DayOfWeek[] = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];

  if (!allowedDays.includes(dayOfWeekValue as DayOfWeek)) {
    throw new BaseAvailabilityServiceError(
      `Availability[${index}].dayOfWeek must be one of ${allowedDays.join(", ")}.`,
      400,
    );
  }

  const rawSlots = record.slots ?? [];

  if (!Array.isArray(rawSlots)) {
    throw new BaseAvailabilityServiceError(
      `Availability[${index}].slots must be an array.`,
      400,
    );
  }

  const slots = rawSlots.map((slot, slotIndex) =>
    sanitizeSlot(slot, slotIndex),
  );

  if (!slots.length) {
    throw new BaseAvailabilityServiceError(
      `Availability[${index}] must contain at least one slot.`,
      400,
    );
  }

  const recordUserId =
    "userId" in record
      ? requireString(record.userId, `Availability[${index}].userId`)
      : undefined;

  return {
    userId: recordUserId ?? "",
    dayOfWeek: dayOfWeekValue as DayOfWeek,
    slots,
  };
};

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const arrayValue = value as unknown[];

    for (let index = arrayValue.length - 1; index >= 0; index -= 1) {
      const next = pruneUndefined(arrayValue[index]);

      if (next === undefined) {
        arrayValue.splice(index, 1);
      } else {
        arrayValue[index] = next;
      }
    }

    return value;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    const record = value as UnknownRecord;

    for (const key of Object.keys(record)) {
      const next = pruneUndefined(record[key]);

      if (next === undefined) {
        delete record[key];
      } else {
        record[key] = next;
      }
    }

    return value;
  }

  return value;
};

const buildDomainAvailability = (
  document: BaseAvailabilityDocument,
): UserAvailability => {
  const raw = document.toObject({
    virtuals: false,
  }) as BaseAvailabilityMongo & { _id: unknown };

  const idSource = raw._id ?? document._id;
  const id =
    typeof idSource === "string"
      ? idSource
      : typeof idSource === "object" &&
          idSource !== null &&
          "toString" in idSource
        ? String((idSource as { toString: () => string }).toString())
        : undefined;

  return pruneUndefined({
    _id: id,
    userId: raw.userId,
    dayOfWeek: raw.dayOfWeek,
    slots: raw.slots,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });
};

export type CreateBaseAvailabilityPayload = {
  userId: unknown;
  availability: unknown;
};

export type UpdateBaseAvailabilityPayload = {
  availability: unknown;
};

const sanitizeCreatePayload = (
  payload: CreateBaseAvailabilityPayload,
): {
  userId: string;
  availability: BaseAvailabilityMongo[];
} => {
  const userId = requireUserId(payload.userId);

  if (!payload.availability || !Array.isArray(payload.availability)) {
    throw new BaseAvailabilityServiceError(
      "Availability must be an array.",
      400,
    );
  }

  const entries = payload.availability.map((entry, index) => {
    const sanitized = sanitizeAvailabilityEntry(entry, index);
    return {
      ...sanitized,
      userId,
    };
  });

  if (!entries.length) {
    throw new BaseAvailabilityServiceError(
      "Availability cannot be empty.",
      400,
    );
  }

  return { userId, availability: entries };
};

const sanitizeUpdatePayload = (
  userId: unknown,
  payload: UpdateBaseAvailabilityPayload,
): {
  userId: string;
  availability: BaseAvailabilityMongo[];
} => {
  const identifier = requireUserId(userId);

  if (!payload.availability || !Array.isArray(payload.availability)) {
    throw new BaseAvailabilityServiceError(
      "Availability must be an array.",
      400,
    );
  }

  const entries = payload.availability.map((entry, index) => {
    const sanitized = sanitizeAvailabilityEntry(entry, index);
    return {
      ...sanitized,
      userId: identifier,
    };
  });

  if (!entries.length) {
    throw new BaseAvailabilityServiceError(
      "Availability cannot be empty.",
      400,
    );
  }

  return { userId: identifier, availability: entries };
};

const sortByDayOrder = (
  availabilities: UserAvailability[],
): UserAvailability[] => {
  const order: Record<DayOfWeek, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
    SUNDAY: 7,
  };

  return [...availabilities].sort(
    (a, b) => (order[a.dayOfWeek] ?? 0) - (order[b.dayOfWeek] ?? 0),
  );
};

export const BaseAvailabilityService = {
  async create(
    payload: CreateBaseAvailabilityPayload,
  ): Promise<UserAvailability[]> {
    const { userId, availability } = sanitizeCreatePayload(payload);

    const existing = await BaseAvailabilityModel.findOne({ userId }, null, {
      sanitizeFilter: true,
    });

    if (existing) {
      throw new BaseAvailabilityServiceError(
        "Base availability already exists for this user.",
        409,
      );
    }

    const documents = await BaseAvailabilityModel.insertMany(availability);

    const domain = documents.map((doc) => buildDomainAvailability(doc));
    return sortByDayOrder(domain);
  },

  async update(
    userId: unknown,
    payload: UpdateBaseAvailabilityPayload,
  ): Promise<UserAvailability[]> {
    const { userId: identifier, availability } = sanitizeUpdatePayload(
      userId,
      payload,
    );

    await BaseAvailabilityModel.deleteMany({ userId: identifier });
    const documents = await BaseAvailabilityModel.insertMany(availability);

    const domain = documents.map((doc) => buildDomainAvailability(doc));
    return sortByDayOrder(domain);
  },

  async getByUserId(userId: unknown): Promise<UserAvailability[]> {
    const identifier = requireUserId(userId);

    const documents = await BaseAvailabilityModel.find({
      userId: identifier,
    }).sort({ dayOfWeek: 1 });

    return documents.map((doc) => buildDomainAvailability(doc));
  },
};
