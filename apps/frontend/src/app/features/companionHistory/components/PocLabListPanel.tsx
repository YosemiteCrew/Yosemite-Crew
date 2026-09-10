'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { IoChevronDownOutline, IoChevronUpOutline, IoFlaskOutline } from 'react-icons/io5';
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
  fetchPocLabResults,
  type LabResultParameter,
  type PocTestType,
  type PointOfCareLabResult,
} from '@/app/features/companionHistory/services/pocLabService';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';

const LOAD_ERROR = 'Could not load in-house lab results. Please try again.';

const TEST_TYPE_LABEL: Record<PocTestType, string> = {
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

const RESULT_FLAG_TONE: Record<NonNullable<LabResultParameter['flag']>, StatusTone> = {
  H: 'warning',
  L: 'warning',
  HH: 'danger',
  LL: 'danger',
  N: 'success',
};

const formatReferenceRange = (result: LabResultParameter): string | null => {
  const { referenceRangeLow: low, referenceRangeHigh: high } = result;
  if (low === undefined && high === undefined) return null;
  if (low === undefined) return `Up to ${high}`;
  if (high === undefined) return `From ${low}`;
  return `${low}–${high}`;
};

const formatResultValue = (result: LabResultParameter): string =>
  result.unit ? `${result.value} ${result.unit}` : String(result.value);

const ResultParameter = ({ result }: { result: LabResultParameter }) => {
  const range = formatReferenceRange(result);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-[var(--divider)] py-2 first:border-t-0">
      <span className="min-w-0">
        <span className={clsx(titleClass, 'block')}>{result.name}</span>
        {range ? <span className={metaClass}>{`Reference ${range}`}</span> : null}
      </span>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
        <span>{formatResultValue(result)}</span>
        {result.flag ? (
          <StatusPill label={result.flag} tone={RESULT_FLAG_TONE[result.flag]} />
        ) : null}
      </span>
    </li>
  );
};

const LabResultDetails = ({ record }: { record: PointOfCareLabResult }) => (
  <div className="border-t border-[var(--divider)] bg-[var(--inset)] px-4 py-3">
    <ul aria-label={`${TEST_TYPE_LABEL[record.testType]} parameters`}>
      {record.results.map((result) => (
        <ResultParameter key={`${result.name}:${result.value}`} result={result} />
      ))}
    </ul>
    {record.overallInterpretation ? (
      <div className="mt-3 border-t border-[var(--divider)] pt-3">
        <span className={titleClass}>{'Interpretation'}</span>
        <p className={clsx(metaClass, 'mt-1 text-[var(--ink-muted)]')}>
          {record.overallInterpretation}
        </p>
      </div>
    ) : null}
    {record.notes ? (
      <div className="mt-3">
        <span className={titleClass}>{'Notes'}</span>
        <p className={clsx(metaClass, 'mt-1 text-[var(--ink-muted)]')}>{record.notes}</p>
      </div>
    ) : null}
  </div>
);

const LabResultRow = ({
  record,
  expanded,
  onToggle,
}: {
  record: PointOfCareLabResult;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const conductedAt = formatDate(record.conductedAt);
  const hasCritical = record.criticalFlags.length > 0;
  const hasAbnormal = record.abnormalFlags.length > 0;
  return (
    <li className="border-t border-[var(--divider)] first:border-t-0">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue)]"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className={clsx(titleClass, 'block')}>{TEST_TYPE_LABEL[record.testType]}</span>
          <span className={clsx(metaClass, 'mt-0.5 block')}>
            {[conductedAt, record.sampleType, record.analyzerName].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {hasCritical ? <StatusPill label="Critical" tone="danger" /> : null}
          {!hasCritical && hasAbnormal ? <StatusPill label="Abnormal" tone="warning" /> : null}
          {record.followUpRecommended ? <StatusPill label="Follow-up" tone="info" /> : null}
          {expanded ? (
            <IoChevronUpOutline size={16} aria-hidden="true" />
          ) : (
            <IoChevronDownOutline size={16} aria-hidden="true" />
          )}
        </span>
      </button>
      {expanded ? <LabResultDetails record={record} /> : null}
    </li>
  );
};

export const PocLabList = ({
  records,
  loading,
  error,
}: {
  records: PointOfCareLabResult[];
  loading: boolean;
  error: string | null;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  let body;
  if (loading) body = <ClinicalListLoadingRows />;
  else if (error) body = <ClinicalListError error={error} />;
  else if (records.length === 0)
    body = <ClinicalListEmpty message="No in-house lab results recorded." />;
  else {
    body = (
      <ul>
        {records.map((record) => (
          <LabResultRow
            key={record.id}
            record={record}
            expanded={expandedId === record.id}
            onToggle={() => setExpandedId((current) => (current === record.id ? null : record.id))}
          />
        ))}
      </ul>
    );
  }

  return (
    <section className={cardClass} aria-labelledby="poc-lab-heading">
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          <IoFlaskOutline size={17} />
        </span>
        <h2 id="poc-lab-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
          In-house lab results
        </h2>
        {!loading && !error && records.length > 0 ? (
          <StatusPill
            label={`${records.length} recorded`}
            tone="neutral"
            className="ml-2 tabular-nums"
          />
        ) : null}
      </header>
      {body}
    </section>
  );
};

const PocLabListPanelContent = ({ companionId }: { companionId: string }) => {
  const [state, setState] = useState<{
    records: PointOfCareLabResult[];
    loading: boolean;
    error: string | null;
  }>({ records: [], loading: true, error: null });

  useEffect(() => {
    if (!companionId) return;
    let active = true;
    fetchPocLabResults({ patientId: companionId })
      .then((result) => {
        if (active) setState({ records: result, loading: false, error: null });
      })
      .catch((requestError) => {
        if (!active) return;
        const error = isAuthRedirectError(requestError) ? null : LOAD_ERROR;
        setState({ records: [], loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [companionId]);

  return <PocLabList {...state} />;
};

const PocLabListPanel = ({ companionId }: { companionId: string }) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);

  if (!canView) return null;
  return <PocLabListPanelContent key={companionId} companionId={companionId} />;
};

export default PocLabListPanel;
