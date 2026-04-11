import { Types } from "mongoose";

export const ensureObjectId = (
  value: unknown,
  field: string,
  onError: (message: string) => Error,
): Types.ObjectId => {
  if (value instanceof Types.ObjectId) return value;

  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }

  throw onError(`Invalid ${field}`);
};
