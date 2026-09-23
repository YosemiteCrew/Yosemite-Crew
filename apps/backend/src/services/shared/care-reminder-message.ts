import type { CareReminderType } from "@prisma/client";

/**
 * The owner-facing wording of a care reminder, in one place.
 *
 * `care-reminder.service` composes this sentence for the push and the email.
 * The in-app "what is due" list (#2705) has to say the same thing: the whole
 * point of that list is that an owner who missed the push can still find out
 * what their animal is due for, and a list that paraphrased the notification
 * would leave them comparing two different descriptions of one reminder.
 *
 * A shared module rather than an import of `care-reminder.service`, for the
 * same reason `shared/pagination` exists: that service reaches for email,
 * push, audit and the opt-out store, and an owner-facing read has no business
 * pulling that import graph in to obtain a string.
 */
export const CARE_TYPE_LABELS: Record<CareReminderType, string> = {
  VACCINATION_BOOSTER: "a vaccination booster",
  ANNUAL_CHECKUP: "an annual health check",
  PARASITE_TREATMENT: "parasite treatment",
  DENTAL_CLEANING: "a dental cleaning",
  FOLLOW_UP: "a follow-up appointment",
  CUSTOM: "a scheduled care appointment",
};

/**
 * `customMessage` wins when the practice wrote one - it is what the parent was
 * actually told. The fallback is built from the companion's name and the type
 * label so a reminder with no custom message still reads as a sentence.
 *
 * The `??` is deliberate rather than `||`: an empty custom message is a staff
 * mistake, and falling through to the generated sentence would hide it behind
 * plausible text. An empty string is passed on, so it is visible.
 */
export const buildCareReminderMessage = (params: {
  customMessage: string | null;
  patientName: string;
  reminderType: CareReminderType;
}): string => {
  const { customMessage, patientName, reminderType } = params;
  if (customMessage !== null) {
    return customMessage;
  }
  const typeLabel = CARE_TYPE_LABELS[reminderType] ?? "care";
  return `${patientName} is due for ${typeLabel}. Please book an appointment at your earliest convenience.`;
};
