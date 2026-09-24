'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { IoPulseOutline } from 'react-icons/io5';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isAuthRedirectError } from '@/app/services/axios';
import {
  ClinicalListEmpty,
  ClinicalListError,
  ClinicalListLoadingRows,
  cardClass,
  formatDate,
  metaClass,
  titleClass,
} from '@/app/features/companionHistory/components/ClinicalListChrome';
import {
  fetchPatientVitalsHistory,
  type VitalMeasurement,
  type VitalsHistory,
  type VitalsHistoryEntry,
} from '@/app/features/companionHistory/services/patientVitalsService';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

const LOAD_ERROR = 'Could not load weight and vitals. Please try again.';

const MEASUREMENT_LABEL: Record<string, string> = {
  weightKg: 'Weight',
  weightLbs: 'Weight',
  tempC: 'Temperature',
  tempF: 'Temperature',
  temp: 'Temperature',
  heartRateBpm: 'Heart rate',
  respRateBpm: 'Respiratory rate',
  crtSec: 'CRT',
  bcs: 'Body condition',
  painScore: 'Pain score',
  spo2: 'SpO2',
  bloodPressureSystolic: 'Systolic BP',
  bloodPressureDiastolic: 'Diastolic BP',
  etco2: 'EtCO2',
};

const WEIGHT_CODES = new Set(['weightKg', 'weightLbs']);

const labelFor = (code: string) =>
  Object.prototype.hasOwnProperty.call(MEASUREMENT_LABEL, code) ? MEASUREMENT_LABEL[code] : code;

const formatValue = (m: VitalMeasurement) => (m.unit ? `${m.value} ${m.unit}` : String(m.value));

const sourceLabel = (entry: VitalsHistoryEntry) =>
  entry.source.type === 'INPATIENT_MONITORING' ? 'Inpatient observation' : 'Visit vitals';

type WeightReading = { value: number; unit: string | null; measuredAt: string };

const weightReadings = (entries: VitalsHistoryEntry[]): WeightReading[] =>
  entries.flatMap((entry) =>
    entry.measurements
      .filter((m) => WEIGHT_CODES.has(m.code) && typeof m.value === 'number')
      .map((m) => ({ value: m.value as number, unit: m.unit, measuredAt: entry.measuredAt }))
  );

const formatChange = (latest: WeightReading, previous: WeightReading | undefined) => {
  if (previous?.unit !== latest.unit) return null;
  const delta = Math.round((latest.value - previous.value) * 100) / 100;
  const sign = delta > 0 ? '+' : '';
  const since = formatDate(previous.measuredAt);
  return `${sign}${delta} ${latest.unit ?? ''}`.trim() + (since ? ` since ${since}` : '');
};

const WeightSummary = ({ entries }: { entries: VitalsHistoryEntry[] }) => {
  const [latest, previous] = weightReadings(entries);
  if (!latest) return null;
  const change = formatChange(latest, previous);
  return (
    <p className="border-b border-[var(--divider)] px-4 py-3 text-[13px] text-[var(--ink)]">
      <span className="font-bold">{`Latest weight ${formatValue({ code: 'weight', value: latest.value, unit: latest.unit })}`}</span>
      {change ? <span className={clsx(metaClass, 'ml-2')}>{change}</span> : null}
    </p>
  );
};

const VitalsRow = ({ entry }: { entry: VitalsHistoryEntry }) => {
  const measuredAt = formatDate(entry.measuredAt);
  return (
    <li className="border-t border-[var(--divider)] px-4 py-3 first:border-t-0">
      <span className={clsx(titleClass, 'block')}>{measuredAt ?? 'Unknown date'}</span>
      <span className={clsx(metaClass, 'mt-0.5 block')}>
        {[sourceLabel(entry), entry.recordedByDisplay].filter(Boolean).join(' · ')}
      </span>
      <dl className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-1">
        {entry.measurements.map((m) => (
          <div key={m.code} className="flex min-w-0 items-baseline gap-1.5">
            <dt className={metaClass}>{labelFor(m.code)}</dt>
            <dd className="text-[13px] font-semibold tabular-nums text-[var(--ink)]">
              {formatValue(m)}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
};

export const VitalsHistoryList = ({
  history,
  loading,
  error,
}: {
  history: VitalsHistory;
  loading: boolean;
  error: string | null;
}) => {
  const { entries, truncated } = history;
  let body;
  if (loading) body = <ClinicalListLoadingRows />;
  else if (error) body = <ClinicalListError error={error} />;
  else if (entries.length === 0)
    body = <ClinicalListEmpty message="No weight or vitals recorded." />;
  else {
    body = (
      <>
        <WeightSummary entries={entries} />
        <ul>
          {entries.map((entry) => (
            <VitalsRow key={`${entry.source.type}:${entry.source.id}`} entry={entry} />
          ))}
        </ul>
        {truncated ? (
          <p className={clsx(metaClass, 'border-t border-[var(--divider)] px-4 py-2')}>
            {`Showing the ${entries.length} most recent readings.`}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <section className={cardClass} aria-labelledby="vitals-history-heading">
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          <IoPulseOutline size={17} />
        </span>
        <h2 id="vitals-history-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
          Weight and vitals
        </h2>
        {!loading && !error && entries.length > 0 ? (
          <StatusPill
            label={`${entries.length} recorded`}
            tone="neutral"
            className="ml-2 tabular-nums"
          />
        ) : null}
      </header>
      {body}
    </section>
  );
};

const EMPTY: VitalsHistory = { entries: [], truncated: false };

const VitalsHistoryPanelContent = ({ companionId }: { companionId: string }) => {
  const [state, setState] = useState<{
    history: VitalsHistory;
    loading: boolean;
    error: string | null;
  }>({ history: EMPTY, loading: true, error: null });

  useEffect(() => {
    if (!companionId) return;
    let active = true;
    fetchPatientVitalsHistory(companionId)
      .then((history) => {
        if (active) setState({ history, loading: false, error: null });
      })
      .catch((requestError) => {
        if (!active) return;
        const error = isAuthRedirectError(requestError) ? null : LOAD_ERROR;
        setState({ history: EMPTY, loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [companionId]);

  return <VitalsHistoryList {...state} />;
};

const VitalsHistoryPanel = ({ companionId }: { companionId: string }) => {
  const permissions = usePermissions();
  const canView =
    permissions.can(PERMISSIONS.COMPANIONS_VIEW_ANY) && permissions.can(PERMISSIONS.FORMS_VIEW_ANY);

  if (!canView) return null;
  return <VitalsHistoryPanelContent key={companionId} companionId={companionId} />;
};

export default VitalsHistoryPanel;
