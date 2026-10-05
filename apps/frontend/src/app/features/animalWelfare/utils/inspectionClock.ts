const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type FacilityDeficiency = {
  id: string;
  classification: 'SIGNIFICANT' | 'MINOR';
  correctionDueOn: string;
  correctedOn?: string | null;
};

export type InspectionObligation =
  | { kind: 'PROGRAMME_REVIEW'; dueOn: string }
  | { kind: 'SIGNIFICANT_DEFICIENCY'; dueOn: string; deficiencyId: string };

const parseDateOnly = (value: string): Date | null => {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const addCalendarMonths = (value: Date, months: number): Date => {
  const target = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(value.getUTCDate(), lastDay));
  return target;
};

const isPast = (dueOn: string, asOf: Date): boolean => {
  const dueDate = parseDateOnly(dueOn);
  return dueDate !== null && dueDate.getTime() < asOf.getTime();
};

export const getNextProgrammeReviewDueOn = (lastCompletedOn: string): string | null => {
  const lastCompleted = parseDateOnly(lastCompletedOn);
  if (!lastCompleted) return null;
  return formatDateOnly(addCalendarMonths(lastCompleted, 6));
};

type BuildInspectionObligationsInput = {
  lastProgrammeReviewCompletedOn: string;
  deficiencies: FacilityDeficiency[];
  asOf: string;
};

export const buildInspectionObligations = ({
  lastProgrammeReviewCompletedOn,
  deficiencies,
  asOf,
}: BuildInspectionObligationsInput): InspectionObligation[] => {
  const asOfDate = parseDateOnly(asOf);
  if (!asOfDate) return [];

  const obligations: InspectionObligation[] = [];
  const programmeReviewDueOn = getNextProgrammeReviewDueOn(lastProgrammeReviewCompletedOn);
  if (programmeReviewDueOn && isPast(programmeReviewDueOn, asOfDate)) {
    obligations.push({ kind: 'PROGRAMME_REVIEW', dueOn: programmeReviewDueOn });
  }

  for (const deficiency of deficiencies) {
    const isOpenSignificantDeficiency =
      deficiency.classification === 'SIGNIFICANT' &&
      !deficiency.correctedOn &&
      isPast(deficiency.correctionDueOn, asOfDate);

    if (isOpenSignificantDeficiency) {
      obligations.push({
        kind: 'SIGNIFICANT_DEFICIENCY',
        dueOn: deficiency.correctionDueOn,
        deficiencyId: deficiency.id,
      });
    }
  }

  return obligations.sort((left, right) => left.dueOn.localeCompare(right.dueOn));
};
