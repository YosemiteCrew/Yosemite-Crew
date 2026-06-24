import type { KeyValueItem } from '../types.js';

export const buildKeyValue = (
  entries: Array<[string, string | undefined | null]>
): KeyValueItem[] =>
  entries
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => ({
      label,
      value: String(value),
    }));

export const buildClinicalHeaderKeyValue = (input: {
  date: Date;
  appointmentId?: string;
  leadLabel?: string;
  leadName?: string;
  patientName?: string;
  clientName?: string;
  clientId?: string;
  clientContact?: string;
  speciesBreed?: string;
  ageSex?: string;
  roomName?: string;
  unitName?: string;
  admittedAt?: string;
  admittedBy?: string;
}): KeyValueItem[] =>
  buildKeyValue([
    ['Date', input.date.toISOString().slice(0, 10)],
    ['Appointment ID', input.appointmentId],
    [input.leadLabel ?? 'Lead / Doctor', input.leadName],
    ['Patient', input.patientName],
    ['Client', input.clientName],
    ['Client ID', input.clientId],
    ['Client Contact', input.clientContact],
    ['Species / Breed', input.speciesBreed],
    ['Age / Sex', input.ageSex],
    ['Room', input.roomName],
    ['Unit', input.unitName],
    ['Admitted', input.admittedAt],
    ['Admitted By', input.admittedBy],
  ]);

export const buildKeyValueGroups = (
  groups: Array<Array<[string, string | undefined | null]>>
): KeyValueItem[][] => groups.map((group) => buildKeyValue(group));

export const formatMoney = (currency: string, value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatDateValue = (value: Date): string => value.toISOString().slice(0, 10);
