import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

/** Strict `YYYY-MM-DD` date string, validated in UTC. */
export const utcDateStringSchema = z
  .string()
  .trim()
  .refine(
    (value) => dayjs.utc(value, "YYYY-MM-DD", true).isValid(),
    "Invalid date format (use YYYY-MM-DD)",
  );

/**
 * Common calendar-prefill payload fields shared by the catalog and service
 * controllers; each controller extends it with its own id-list fields.
 */
export const calendarPrefillBaseSchema = z.object({
  organisationId: z.string().trim().min(1),
  date: utcDateStringSchema,
  minuteOfDay: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1),
  leadId: z.string().trim().min(1).optional(),
});

/**
 * Maps the query-string tri-state `"true" | "false" | undefined` (as parsed by
 * zod) onto `boolean | undefined`.
 */
export const parseTristateFlag = (
  value: "true" | "false" | undefined,
): boolean | undefined => {
  if (value === undefined) return undefined;
  return value === "true";
};
