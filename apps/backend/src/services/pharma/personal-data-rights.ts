import { z } from "zod";

/**
 * Personal data rules for the pharma app: the processing-activity register
 * entry, the rights-request response clock, the notice clock for data
 * obtained from someone else, the breach notification clock and the itemised
 * erasure answer. Calendar dates are plain `YYYY-MM-DD` strings in the
 * organisation's own calendar; breach times are instants.
 */

/** The six lawful bases of GDPR Article 6(1), points (a) to (f). */
export const LAWFUL_BASES = [
  "consent",
  "contract",
  "legal-obligation",
  "vital-interests",
  "public-task",
  "legitimate-interests",
] as const;

export type LawfulBasis = (typeof LAWFUL_BASES)[number];

const PersonalDataFieldSchema = z
  .object({
    field: z.string().trim().min(1),
    necessityEndsAfterDays: z.number().int().positive(),
  })
  .strict();

/**
 * One register entry per activity and basis. `lawfulBasis` is a single value
 * and unknown keys are refused, so an activity resting on two bases has to be
 * entered as two activities.
 */
export const ProcessingActivitySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    lawfulBasis: z.enum(LAWFUL_BASES),
    dataSubjectClasses: z.array(z.string().trim().min(1)).min(1),
    personalDataFields: z.array(PersonalDataFieldSchema).min(1),
    likelyHighRisk: z.boolean(),
    impactAssessmentApprovedAt: z.iso.datetime().nullable(),
  })
  .strict();

export type ProcessingActivity = z.infer<typeof ProcessingActivitySchema>;

export type ActivityRunDecision =
  | { allowed: true; activity: ProcessingActivity }
  | {
      allowed: false;
      reason: "invalid-register-entry" | "impact-assessment-pending";
    };

/** An activity runs only from a valid register entry, and a likely high-risk one only after its impact assessment is approved. */
export const canActivityRun = (entry: unknown): ActivityRunDecision => {
  const parsed = ProcessingActivitySchema.safeParse(entry);
  if (!parsed.success) {
    return { allowed: false, reason: "invalid-register-entry" };
  }
  const activity = parsed.data;
  if (activity.likelyHighRisk && activity.impactAssessmentApprovedAt === null) {
    return { allowed: false, reason: "impact-assessment-pending" };
  }
  return { allowed: true, activity };
};

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const parseCalendarDate = (value: string) => {
  const match = CALENDAR_DATE.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > daysInMonth(year, monthIndex)
  ) {
    throw new RangeError(`Not a calendar date: ${value}`);
  }
  return { year, monthIndex, day };
};

const formatCalendarDate = (year: number, monthIndex: number, day: number) =>
  `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * A period of months ends on the same day of the later month, or on that
 * month's last day when it has no such day (31 January plus one month is the
 * last day of February).
 */
export const addCalendarMonths = (date: string, months: number): string => {
  const { year, monthIndex, day } = parseCalendarDate(date);
  const target = new Date(Date.UTC(year, monthIndex + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  return formatCalendarDate(
    targetYear,
    targetMonth,
    Math.min(day, daysInMonth(targetYear, targetMonth)),
  );
};

export const addCalendarDays = (date: string, days: number): string => {
  const { year, monthIndex, day } = parseCalendarDate(date);
  const target = new Date(Date.UTC(year, monthIndex, day + days));
  return formatCalendarDate(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
};

const earliest = (first: string, others: string[]): string =>
  others.reduce((min, date) => (date < min ? date : min), first);

export type RightsRequestExtension = {
  months: number;
  noticeSentOn: string;
  reasons: string;
};

export type RightsRequestClock = {
  /** First receipt by anyone acting for the organisation. */
  receivedOn: string;
  extension?: RightsRequestExtension | null;
  answeredOn?: string | null;
};

const MAX_EXTENSION_MONTHS = 2;

/**
 * One month from first receipt. An extension adds at most two further months
 * and counts only when its notice, with reasons, went out within the first
 * month.
 */
export const rightsRequestDueOn = (clock: RightsRequestClock): string => {
  const firstMonthEndsOn = addCalendarMonths(clock.receivedOn, 1);
  const { extension } = clock;
  if (!extension) return firstMonthEndsOn;
  if (
    !Number.isInteger(extension.months) ||
    extension.months < 1 ||
    extension.months > MAX_EXTENSION_MONTHS
  ) {
    throw new RangeError("An extension is one or two further months");
  }
  parseCalendarDate(extension.noticeSentOn);
  if (
    extension.noticeSentOn < clock.receivedOn ||
    extension.noticeSentOn > firstMonthEndsOn
  ) {
    throw new RangeError(
      "Extension notice must be sent within the first month",
    );
  }
  if (extension.reasons.trim() === "") {
    throw new RangeError("Extension notice must give reasons");
  }
  return addCalendarMonths(firstMonthEndsOn, extension.months);
};

export type RightsRequestStatus = "answered" | "open" | "overdue";

export const rightsRequestStatus = (
  clock: RightsRequestClock,
  today: string,
): RightsRequestStatus => {
  if (clock.answeredOn) return "answered";
  parseCalendarDate(today);
  return today > rightsRequestDueOn(clock) ? "overdue" : "open";
};

/**
 * Information about data obtained from someone else is due within one month,
 * or earlier at the first contact with the person or the first disclosure to
 * another recipient.
 */
export const obtainedDataNoticeDueOn = (input: {
  obtainedOn: string;
  firstContactOn?: string | null;
  firstDisclosureOn?: string | null;
}): string => {
  const candidates: string[] = [];
  for (const date of [input.firstContactOn, input.firstDisclosureOn]) {
    if (date) {
      parseCalendarDate(date);
      candidates.push(date);
    }
  }
  return earliest(addCalendarMonths(input.obtainedOn, 1), candidates);
};

export const BREACH_NOTIFICATION_HOURS = 72;

/** Elapsed hours, not calendar days, so a clock change cannot shorten or stretch it. */
export const breachNotificationDueAt = (awareAt: Date): Date =>
  new Date(awareAt.getTime() + BREACH_NOTIFICATION_HOURS * 60 * 60 * 1000);

export type BreachClock = {
  awareAt: Date;
  notifiedAt?: Date | null;
  /** Why the breach is unlikely to result in a risk to people, when it is not notified. */
  noRiskReason?: string | null;
  /** Reasons for a notification made after the 72 hours. */
  delayReasons?: string | null;
};

export type BreachNotificationStatus =
  | "not-required"
  | "notified"
  | "notified-late-with-reasons"
  | "overdue"
  | "pending";

const hasText = (value?: string | null): value is string =>
  typeof value === "string" && value.trim() !== "";

export const breachNotificationStatus = (
  breach: BreachClock,
  now: Date,
): BreachNotificationStatus => {
  const dueAt = breachNotificationDueAt(breach.awareAt).getTime();
  if (breach.notifiedAt) {
    if (breach.notifiedAt.getTime() <= dueAt) return "notified";
    return hasText(breach.delayReasons)
      ? "notified-late-with-reasons"
      : "overdue";
  }
  if (hasText(breach.noRiskReason)) return "not-required";
  return now.getTime() > dueAt ? "overdue" : "pending";
};

export type HeldPersonalData = {
  field: string;
  recordClass: string;
  /** A legal duty that keeps the record, such as a safety or quality retention period. */
  retentionDuty?: { duty: string; keepUntil: string } | null;
  /** An exception that keeps the data stored but stops other use, such as a pending legal claim. */
  restrictionGround?: string | null;
};

export type ErasureAnswer = {
  erased: string[];
  restricted: { field: string; ground: string }[];
  kept: { field: string; duty: string; until: string }[];
  lastBackupExpiresOn: string;
};

/**
 * Itemises an erasure request: data under a live retention duty are kept
 * under that duty, data with a recorded restriction ground are only stored,
 * and everything else is erased. Erased data leave the last backup when it
 * expires.
 */
export const evaluateErasure = (
  items: HeldPersonalData[],
  options: { today: string; backupRetentionDays: number },
): ErasureAnswer => {
  if (
    !Number.isInteger(options.backupRetentionDays) ||
    options.backupRetentionDays < 0
  ) {
    throw new RangeError("Backup retention is a whole number of days");
  }
  const answer: ErasureAnswer = {
    erased: [],
    restricted: [],
    kept: [],
    lastBackupExpiresOn: addCalendarDays(
      options.today,
      options.backupRetentionDays,
    ),
  };
  for (const item of items) {
    const duty = item.retentionDuty;
    if (duty) parseCalendarDate(duty.keepUntil);
    if (duty && duty.keepUntil > options.today) {
      answer.kept.push({
        field: item.field,
        duty: duty.duty,
        until: duty.keepUntil,
      });
    } else if (hasText(item.restrictionGround)) {
      answer.restricted.push({
        field: item.field,
        ground: item.restrictionGround,
      });
    } else {
      answer.erased.push(item.field);
    }
  }
  return answer;
};
