import type {
  CreatePocLabResultInput,
  LabResultFlag,
  LabResultParameter,
  PocTestType,
} from '@/app/features/companionHistory/services/pocLabService';

export const TEST_TYPE_LABEL: Record<PocTestType, string> = {
  CBC: 'Complete blood count',
  BLOOD_CHEMISTRY: 'Blood chemistry',
  URINALYSIS: 'Urinalysis',
  FECAL_FLOAT: 'Faecal float',
  CYTOLOGY: 'Cytology',
  COAGULATION: 'Coagulation',
  ELECTROLYTES: 'Electrolytes',
  THYROID_PANEL: 'Thyroid panel',
  CORTISOL: 'Cortisol',
  GLUCOSE_CURVE: 'Glucose curve',
  BLOOD_GAS: 'Blood gas',
  OTHER: 'Other test',
};

/** Enum order, the order the backend declares them in. */
export const TEST_TYPE_OPTIONS = (Object.keys(TEST_TYPE_LABEL) as PocTestType[]).map((value) => ({
  value,
  label: TEST_TYPE_LABEL[value],
}));

export const FLAG_OPTIONS: Array<{ value: '' | LabResultFlag; label: string }> = [
  { value: '', label: 'No flag' },
  { value: 'N', label: 'Normal' },
  { value: 'H', label: 'High' },
  { value: 'L', label: 'Low' },
  { value: 'HH', label: 'Critical high' },
  { value: 'LL', label: 'Critical low' },
];

export type PocLabRowValues = {
  /** Stable React key; never sent. */
  id: string;
  name: string;
  value: string;
  unit: string;
  low: string;
  high: string;
  flag: '' | LabResultFlag;
};

export type PocLabFormValues = {
  testType: '' | PocTestType;
  /** Raw `YYYY-MM-DDTHH:mm` from the datetime-local control, in local time. */
  performedAt: string;
  sampleType: string;
  analyzerName: string;
  rows: PocLabRowValues[];
  interpretation: string;
  notes: string;
  followUp: boolean;
};

export type PocLabRowErrors = Partial<Record<'name' | 'value' | 'low' | 'high', string>>;

export type PocLabFormErrors = {
  testType?: string;
  performedAt?: string;
  /** Keyed by row id. */
  rows: Record<string, PocLabRowErrors>;
};

/** The backend refuses a result with more parameters than this. */
export const MAX_PARAMETERS = 100;

export const PARAMETER_REQUIRED = 'Enter a parameter name.';
export const VALUE_REQUIRED = 'Enter a value.';

const NUMBER = /^-?\d+(\.\d+)?$/;

let rowSequence = 0;

export const newRow = (): PocLabRowValues => {
  rowSequence += 1;
  return {
    id: `lab-row-${rowSequence}`,
    name: '',
    value: '',
    unit: '',
    low: '',
    high: '',
    flag: '',
  };
};

const pad = (n: number) => String(n).padStart(2, '0');

/** A local `YYYY-MM-DDTHH:mm`, the only shape a datetime-local control accepts. */
export const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;

export const emptyPocLabForm = (now: Date): PocLabFormValues => ({
  testType: '',
  performedAt: toDateTimeLocal(now),
  sampleType: '',
  analyzerName: '',
  rows: [newRow()],
  interpretation: '',
  notes: '',
  followUp: false,
});

export const isBlankRow = (row: PocLabRowValues): boolean =>
  !row.flag && [row.name, row.value, row.unit, row.low, row.high].every((v) => !v.trim());

/**
 * A reading is sent as a number only when the number prints back as exactly
 * what was typed ("7.2", "-1"). Anything a number would change stays text:
 * "1.50" would lose its trailing zero, "007" its leading zeros, and a long
 * digit string would be rounded.
 */
export const parseResultValue = (text: string): number | string => {
  const trimmed = text.trim();
  const number = Number(trimmed);
  return NUMBER.test(trimmed) && String(number) === trimmed ? number : trimmed;
};

const validateRow = (row: PocLabRowValues): PocLabRowErrors => {
  const errors: PocLabRowErrors = {};
  if (!row.name.trim()) errors.name = PARAMETER_REQUIRED;
  if (!row.value.trim()) errors.value = VALUE_REQUIRED;
  const low = row.low.trim();
  const high = row.high.trim();
  const lowIsNumber = NUMBER.test(low);
  if (low && !lowIsNumber) errors.low = 'Enter a number.';
  if (high && !NUMBER.test(high)) errors.high = 'Enter a number.';
  else if (high && lowIsNumber && Number(high) < Number(low))
    errors.high = 'Must be at least the reference low.';
  return errors;
};

/**
 * Blank rows are dropped before anything is checked, so a spare row never
 * blocks a save. With none left, the first row carries both required errors.
 */
export const validatePocLabForm = (values: PocLabFormValues, now: Date): PocLabFormErrors => {
  const errors: PocLabFormErrors = { rows: {} };
  if (!values.testType) errors.testType = 'Choose a test type.';
  if (!values.performedAt) errors.performedAt = 'Enter when the test was performed.';
  else if (new Date(values.performedAt).getTime() > now.getTime())
    errors.performedAt = "Performed at can't be in the future.";

  const filled = values.rows.filter((row) => !isBlankRow(row));
  if (filled.length === 0) {
    const first = values.rows[0];
    if (first) errors.rows[first.id] = { name: PARAMETER_REQUIRED, value: VALUE_REQUIRED };
    return errors;
  }
  for (const row of filled) {
    const rowErrors = validateRow(row);
    if (Object.keys(rowErrors).length > 0) errors.rows[row.id] = rowErrors;
  }
  return errors;
};

export const hasErrors = (errors: PocLabFormErrors): boolean =>
  Boolean(errors.testType || errors.performedAt || Object.keys(errors.rows).length > 0);

const optionalText = <K extends string>(key: K, text: string) => {
  const trimmed = text.trim();
  return trimmed ? ({ [key]: trimmed } as Record<K, string>) : {};
};

const toParameter = (row: PocLabRowValues): LabResultParameter => ({
  name: row.name.trim(),
  value: parseResultValue(row.value),
  ...optionalText('unit', row.unit),
  ...(row.low.trim() ? { referenceRangeLow: Number(row.low.trim()) } : {}),
  ...(row.high.trim() ? { referenceRangeHigh: Number(row.high.trim()) } : {}),
  ...(row.flag ? { flag: row.flag } : {}),
});

const namesFlagged = (rows: PocLabRowValues[], flags: LabResultFlag[]): string[] =>
  rows.filter((row) => row.flag && flags.includes(row.flag)).map((row) => row.name.trim());

/**
 * Maps validated form values onto the POST body. The abnormal and critical
 * lists drive the list's Abnormal and Critical pills, so they are derived from
 * the per-row flags rather than asked for twice.
 */
export const buildPocLabPayload = (
  patientId: string,
  values: PocLabFormValues
): CreatePocLabResultInput => {
  const rows = values.rows.filter((row) => !isBlankRow(row));
  const abnormal = namesFlagged(rows, ['H', 'L']);
  const critical = namesFlagged(rows, ['HH', 'LL']);
  return {
    patientId,
    testType: values.testType as PocTestType,
    conductedAt: new Date(values.performedAt).toISOString(),
    ...optionalText('sampleType', values.sampleType),
    ...optionalText('analyzerName', values.analyzerName),
    results: rows.map(toParameter),
    ...(abnormal.length > 0 ? { abnormalFlags: abnormal } : {}),
    ...(critical.length > 0 ? { criticalFlags: critical } : {}),
    ...optionalText('overallInterpretation', values.interpretation),
    ...optionalText('notes', values.notes),
    ...(values.followUp ? { followUpRecommended: true } : {}),
  };
};

/**
 * Local date and time. Not the shared `formatDate`: that one reads the UTC day
 * and drops the time, so a test run late in the evening showed on the next day.
 */
export const formatConductedAt = (value: string): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
