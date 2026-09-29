'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Text, Textarea } from '@/app/ui';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { formatDateTimeLocal, formatDisplayDate } from '@/app/lib/date';
import {
  buildDateInPreferredTimeZone,
  buildPreferredTimeZoneDayInstant,
  getDateKeyInPreferredTimeZone,
  getDatePartsInPreferredTimeZone,
} from '@/app/lib/timezone';
import {
  listHospitalizationObservations,
  recordHospitalizationObservation,
  type HospitalizationObservation,
} from '@/app/features/appointments/services/hospitalizationMonitoringService';

type InpatientMonitoringPanelProps = {
  organisationId?: string;
  patientId?: string;
  encounterId?: string;
  readOnly: boolean;
};

type MeasurementName =
  'temperature' | 'heartRate' | 'respiratoryRate' | 'painScore' | 'inputMl' | 'outputMl';

// Bounds are physical-plausibility limits for any species, not normal ranges: they stop a
// Fahrenheit reading typed into the Celsius field or a slipped digit, nothing narrower.
const MEASUREMENT_FIELDS: Array<{
  name: MeasurementName;
  label: string;
  min: number;
  max?: number;
  step: string;
}> = [
  { name: 'temperature', label: 'Temperature (°C)', min: 0, max: 50, step: '0.1' },
  { name: 'heartRate', label: 'Heart rate (bpm)', min: 1, max: 1500, step: '1' },
  { name: 'respiratoryRate', label: 'Respiratory rate (/min)', min: 1, max: 400, step: '1' },
  { name: 'painScore', label: 'Pain score (0–10)', min: 0, max: 10, step: '1' },
  { name: 'inputMl', label: 'Fluid intake (mL)', min: 0, step: '0.01' },
  { name: 'outputMl', label: 'Fluid output (mL)', min: 0, step: '0.01' },
];

type FluidPeriod = { key: string; label: string; intake: number; output: number };

const pad2 = (value: number) => String(value).padStart(2, '0');

// A datetime-local control carries no zone, so it is written and read in the clinic's
// preferred zone: the time staff type is the time the timeline shows back to them.
const toClinicDateTimeInput = (date: Date) => {
  const { year, month, day, hour, minute } = getDatePartsInPreferredTimeZone(date);
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
};

const fromClinicDateTimeInput = (value: FormDataEntryValue | null): Date | null => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return buildDateInPreferredTimeZone(
    buildPreferredTimeZoneDayInstant(year, month, day),
    hour * 60 + minute
  );
};

// Rounded to two decimals on display, so a float sum such as 0.1 + 0.2 never reaches staff
// as 0.30000000000000004.
const mlFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const netFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const formatMl = (ml: number) => `${mlFormatter.format(ml)} mL`;
const formatNetMl = (ml: number) => `${netFormatter.format(ml)} mL`;

const sortedNewestFirst = (records: HospitalizationObservation[]) =>
  [...records].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

const display = (value: number | null, unit: string) => (value === null ? '—' : `${value}${unit}`);

const displayMl = (ml: number | null) => (ml === null ? '—' : formatMl(ml));

const measurementRows = (record: HospitalizationObservation): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    [
      'Temperature',
      display(record.temperature, record.temperatureUnit ? ` °${record.temperatureUnit}` : ''),
    ],
    ['Heart rate', display(record.heartRate, ' bpm')],
    ['Respiratory rate', display(record.respiratoryRate, ' /min')],
    ['Pain score', display(record.painScore, ' /10')],
    ['Intake', displayMl(record.inputMl)],
    ['Output', displayMl(record.outputMl)],
  ];
  // A net is only arithmetic on this entry when both sides were measured.
  if (record.inputMl !== null && record.outputMl !== null) {
    rows.push(['Net', formatNetMl(record.inputMl - record.outputMl)]);
  }
  return rows;
};

// Recorded intake and output summed per calendar day in the clinic's zone, newest day first
// (records arrive newest first). A missing side counts as nothing recorded, not as zero measured.
const fluidBalanceByDay = (records: HospitalizationObservation[]): FluidPeriod[] => {
  const days = new Map<string, FluidPeriod>();
  for (const record of records) {
    if (record.inputMl === null && record.outputMl === null) continue;
    const observedAt = new Date(record.observedAt);
    const key = getDateKeyInPreferredTimeZone(observedAt);
    const day = days.get(key) ?? {
      key,
      label: formatDisplayDate(observedAt),
      intake: 0,
      output: 0,
    };
    day.intake += record.inputMl ?? 0;
    day.output += record.outputMl ?? 0;
    days.set(key, day);
  }
  return [...days.values()];
};

const readMeasurements = (form: FormData) => {
  const values: Partial<Record<MeasurementName, number>> = {};
  for (const { name } of MEASUREMENT_FIELDS) {
    const value = form.get(name);
    if (typeof value === 'string' && value.trim()) values[name] = Number(value);
  }
  return values;
};

const FluidRow = ({ period }: { period: FluidPeriod }) => (
  <tr>
    <th scope="row" className="py-2 pr-3 font-medium text-text-primary">
      {period.label}
    </th>
    <td className="py-2 pr-3">{formatMl(period.intake)}</td>
    <td className="py-2 pr-3">{formatMl(period.output)}</td>
    <td className="py-2 font-semibold">{formatNetMl(period.intake - period.output)}</td>
  </tr>
);

const FluidBalance = ({ records }: { records: HospitalizationObservation[] }) => {
  const days = fluidBalanceByDay(records);
  if (days.length === 0) return null;
  const stay: FluidPeriod = {
    key: 'stay',
    label: 'Whole stay',
    intake: days.reduce((sum, day) => sum + day.intake, 0),
    output: days.reduce((sum, day) => sum + day.output, 0),
  };
  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-card-border p-4">
      <table className="w-full text-left text-body-4 tabular-nums text-text-primary">
        <caption className="pb-2 text-left">
          <Text as="span" variant="body-3-emphasis" className="text-text-primary">
            Fluid balance
          </Text>
          <Text as="span" variant="caption-1" className="block text-text-secondary">
            Sums of recorded intake and output per day, in the clinic time zone.
          </Text>
        </caption>
        <thead className="text-caption-2 text-text-tertiary">
          <tr>
            <th scope="col" className="py-1 pr-3 font-normal">
              Day
            </th>
            <th scope="col" className="py-1 pr-3 font-normal">
              Intake
            </th>
            <th scope="col" className="py-1 pr-3 font-normal">
              Output
            </th>
            <th scope="col" className="py-1 font-normal">
              Net
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {days.map((day) => (
            <FluidRow key={day.key} period={day} />
          ))}
        </tbody>
        {days.length > 1 && (
          <tfoot className="border-t border-card-border">
            <FluidRow period={stay} />
          </tfoot>
        )}
      </table>
    </div>
  );
};

const ObservationItem = ({ record }: { record: HospitalizationObservation }) => (
  <li className="py-4 first:pt-0 last:pb-0">
    <Text as="h3" variant="body-3-emphasis" className="text-text-primary">
      <time dateTime={record.observedAt}>{formatDateTimeLocal(record.observedAt)}</time>
    </Text>
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {measurementRows(record).map(([label, value]) => (
        <div key={label} className="rounded-lg bg-card-bg px-3 py-2">
          <dt className="text-caption-2 text-text-tertiary">{label}</dt>
          <dd className="mt-0.5 text-body-4 font-semibold tabular-nums text-text-primary">
            {value}
          </dd>
        </div>
      ))}
    </dl>
    {record.notes && (
      <Text as="p" variant="body-4" className="mt-3 whitespace-pre-wrap text-text-secondary">
        {record.notes}
      </Text>
    )}
  </li>
);

type ObservationFormProps = {
  isSaving: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel: () => void;
};

const ObservationForm = ({ isSaving, error, onSubmit, onCancel }: ObservationFormProps) => (
  <form
    onSubmit={onSubmit}
    className="grid grid-cols-1 gap-3 rounded-xl border border-card-border p-4 sm:grid-cols-2"
  >
    <label className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary sm:col-span-2">
      <span>Observed at</span>
      <input
        required
        name="observedAt"
        type="datetime-local"
        defaultValue={toClinicDateTimeInput(new Date())}
        className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
      />
    </label>
    {MEASUREMENT_FIELDS.map(({ name, label, min, max, step }) => (
      <label
        key={name}
        className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary"
      >
        {label}
        <input
          name={name}
          type="number"
          min={min}
          max={max}
          step={step}
          className="min-h-11 rounded-xl border border-card-border bg-[var(--screen)] px-3 text-body-4"
        />
      </label>
    ))}
    <label className="flex min-w-0 flex-col gap-1 text-body-4 font-medium text-text-primary sm:col-span-2">
      {'Notes'}
      <Textarea name="notes" maxLength={2000} rows={3} className="bg-[var(--screen)] text-body-4" />
    </label>
    {error && (
      <Text as="p" variant="body-4" role="alert" className="text-text-error sm:col-span-2">
        {error}
      </Text>
    )}
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <Button
        text={isSaving ? 'Saving…' : 'Save observation'}
        type="submit"
        isDisabled={isSaving}
      />
      <Button text="Cancel" variant="secondary" onClick={onCancel} isDisabled={isSaving} />
    </div>
  </form>
);

const MonitoringPanelBody = ({
  organisationId,
  patientId,
  encounterId,
  readOnly,
}: InpatientMonitoringPanelProps) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canRecord = !readOnly && permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const [records, setRecords] = useState<HospitalizationObservation[]>([]);
  const [loadedRefresh, setLoadedRefresh] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const isLoading = loadedRefresh !== refresh;

  useEffect(() => {
    if (!canView || !organisationId || !patientId || !encounterId) {
      return;
    }
    let active = true;
    listHospitalizationObservations(organisationId, patientId, encounterId)
      .then((items) => {
        if (active) {
          setRecords(sortedNewestFirst(items));
          setLoadError(null);
        }
      })
      .catch(() => {
        if (active) setLoadError('Unable to load observations. Please try again.');
      })
      .finally(() => {
        if (active) setLoadedRefresh(refresh);
      });
    return () => {
      active = false;
    };
  }, [canView, encounterId, organisationId, patientId, refresh]);

  if (!canView) return null;

  if (!organisationId || !patientId || !encounterId) {
    return (
      <SectionContainer title="Inpatient monitoring" className="min-w-0">
        <Text as="p" variant="body-4" className="text-text-secondary">
          Monitoring is available when the patient and inpatient encounter are loaded.
        </Text>
      </SectionContainer>
    );
  }

  const saveObservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const observedAt = fromClinicDateTimeInput(form.get('observedAt'));
    if (!observedAt) return;
    // One minute of grace for a clock that has not ticked over to the minute staff typed.
    if (observedAt.getTime() > Date.now() + 60_000) {
      setFormError('The observation time cannot be in the future.');
      return;
    }
    const measurements = readMeasurements(form);
    const notesEntry = form.get('notes');
    const notes = typeof notesEntry === 'string' ? notesEntry.trim() : '';
    if (Object.keys(measurements).length === 0 && !notes) {
      setFormError('Enter at least one measurement or a note.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const entry = await recordHospitalizationObservation({
        organisationId,
        patientId,
        encounterId,
        observedAt: observedAt.toISOString(),
        ...measurements,
        ...(measurements.temperature === undefined ? {} : { temperatureUnit: 'C' as const }),
        ...(notes ? { notes } : {}),
      });
      setRecords((current) => sortedNewestFirst([entry, ...current]));
      setShowForm(false);
    } catch {
      setFormError('Unable to save this observation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeForm = () => {
    setFormError(null);
    setShowForm(false);
  };

  return (
    <SectionContainer title="Inpatient monitoring" className="min-w-0">
      <div className="flex flex-col gap-4">
        {isLoading && (
          <Text as="p" variant="body-4" role="status" className="text-text-secondary">
            Loading observations…
          </Text>
        )}

        {loadError && (
          <div className="flex flex-wrap items-center gap-3">
            <Text as="p" variant="body-4" role="alert" className="text-text-error">
              {loadError}
            </Text>
            <Button
              text="Refresh"
              variant="secondary"
              onClick={() => {
                setLoadError(null);
                setRefresh((value) => value + 1);
              }}
            />
          </div>
        )}

        {!isLoading && !loadError && records.length === 0 && (
          <Text as="p" variant="body-4" className="text-text-secondary">
            No monitoring observations recorded for this stay.
          </Text>
        )}

        <FluidBalance records={records} />

        {records.length > 0 && (
          <ol className="divide-y divide-card-border">
            {records.map((record) => (
              <ObservationItem key={record.id} record={record} />
            ))}
          </ol>
        )}

        {canRecord && !showForm && (
          <Button text="Record observation" variant="secondary" onClick={() => setShowForm(true)} />
        )}

        {canRecord && showForm && (
          <ObservationForm
            isSaving={isSaving}
            error={formError}
            onSubmit={saveObservation}
            onCancel={closeForm}
          />
        )}
      </div>
    </SectionContainer>
  );
};

// Remounted for every patient stay, so no loaded observation, open form or typed value can
// carry over from one patient to another while the workspace reuses this component.
const InpatientMonitoringPanel = (props: InpatientMonitoringPanelProps) => (
  <MonitoringPanelBody
    key={[props.organisationId, props.patientId, props.encounterId].join(':')}
    {...props}
  />
);

export default InpatientMonitoringPanel;
