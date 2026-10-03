'use client';

// no-story: Exercised through InpatientMonitoringPanel.stories.tsx with the full data flow.
import type { SubmitEvent } from 'react';
import { Button, Text } from '@/app/ui';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { formatDateTimeLocal, formatDisplayDate } from '@/app/lib/date';
import { getDateKeyInPreferredTimeZone } from '@/app/lib/timezone';
import type { HospitalizationObservation } from '@/app/features/appointments/services/hospitalizationMonitoringService';
import InpatientObservationForm from './InpatientObservationForm';
import {
  useHospitalizationObservationFeed,
  useInpatientObservationEntry,
} from './useInpatientMonitoringPanel';

export type InpatientMonitoringPanelProps = {
  organisationId?: string;
  patientId?: string;
  encounterId?: string;
  readOnly: boolean;
};

type FluidPeriod = { key: string; label: string; intake: number; output: number };

// Rounded to two decimals on display, so a float sum such as 0.1 + 0.2 never reaches staff
// as 0.30000000000000004.
const mlFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const netFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const formatMl = (ml: number) => `${mlFormatter.format(ml)} mL`;
const formatNetMl = (ml: number) => `${netFormatter.format(ml)} mL`;

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

const renderFluidRow = (period: FluidPeriod, key?: string) => (
  <tr key={key}>
    <th scope="row" className="py-2 pr-3 font-medium text-text-primary">
      {period.label}
    </th>
    <td className="py-2 pr-3">{formatMl(period.intake)}</td>
    <td className="py-2 pr-3">{formatMl(period.output)}</td>
    <td className="py-2 font-semibold">{formatNetMl(period.intake - period.output)}</td>
  </tr>
);

const renderFluidBalance = (records: HospitalizationObservation[]) => {
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
          {days.map((day) => renderFluidRow(day, day.key))}
        </tbody>
        {days.length > 1 && (
          <tfoot className="border-t border-card-border">{renderFluidRow(stay)}</tfoot>
        )}
      </table>
    </div>
  );
};

const renderObservationItem = (record: HospitalizationObservation) => (
  <li key={record.id} className="py-4 first:pt-0 last:pb-0">
    <Text as="p" variant="body-3-emphasis" className="text-text-primary">
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

type PanelContentProps = {
  canRecord: boolean;
  records: HospitalizationObservation[];
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  formObservedAt: string | null;
  isSaving: boolean;
  formError: string | null;
  onOpenForm: () => void;
  onSave: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  onCloseForm: () => void;
};

const PanelContent = ({
  canRecord,
  records,
  isLoading,
  loadError,
  onRetry,
  formObservedAt,
  isSaving,
  formError,
  onOpenForm,
  onSave,
  onCloseForm,
}: PanelContentProps) => (
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
        <Button text="Refresh" variant="secondary" onClick={onRetry} />
      </div>
    )}

    {!isLoading && !loadError && records.length === 0 && (
      <Text as="p" variant="body-4" className="text-text-secondary">
        No monitoring observations recorded for this stay.
      </Text>
    )}

    {renderFluidBalance(records)}

    {records.length > 0 && (
      <ol className="divide-y divide-card-border">{records.map(renderObservationItem)}</ol>
    )}

    {canRecord && formObservedAt === null && (
      <Button text="Record observation" variant="secondary" onClick={onOpenForm} />
    )}

    {canRecord && formObservedAt !== null && (
      <InpatientObservationForm
        defaultObservedAt={formObservedAt}
        isSaving={isSaving}
        error={formError}
        onSubmit={onSave}
        onCancel={onCloseForm}
      />
    )}
  </div>
);

type ReadyContext = {
  organisationId: string;
  patientId: string;
  encounterId: string;
};

const InpatientMonitoringPanelSession = ({
  context,
  canRecord,
}: {
  context: ReadyContext;
  canRecord: boolean;
}) => {
  const feed = useHospitalizationObservationFeed(context);
  const entry = useInpatientObservationEntry({ ...context, onSaved: feed.addObservation });

  return (
    <SectionContainer title="Inpatient monitoring" className="min-w-0">
      <PanelContent
        canRecord={canRecord}
        records={feed.records}
        isLoading={feed.isLoading}
        loadError={feed.loadError}
        onRetry={feed.retry}
        formObservedAt={entry.formObservedAt}
        isSaving={entry.isSaving}
        formError={entry.formError}
        onOpenForm={entry.openForm}
        onSave={entry.saveObservation}
        onCloseForm={entry.closeForm}
      />
    </SectionContainer>
  );
};

const InpatientMonitoringPanelBody = ({
  organisationId,
  patientId,
  encounterId,
  readOnly,
}: InpatientMonitoringPanelProps) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canRecord = !readOnly && permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
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

  return (
    <InpatientMonitoringPanelSession
      context={{ organisationId, patientId, encounterId }}
      canRecord={canRecord}
    />
  );
};

export default InpatientMonitoringPanelBody;
