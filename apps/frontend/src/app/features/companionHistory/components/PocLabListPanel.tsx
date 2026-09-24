'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { IoChevronDownOutline, IoChevronUpOutline, IoFlaskOutline } from 'react-icons/io5';
import {
  ClinicalListEmpty,
  ClinicalListError,
  ClinicalListHeader,
  ClinicalListLoadingRows,
  cardClass,
  metaClass,
  titleClass,
} from '@/app/features/companionHistory/components/ClinicalListChrome';
import PocLabResultForm from '@/app/features/companionHistory/components/PocLabResultForm';
import {
  TEST_TYPE_LABEL,
  formatConductedAt,
  type PocLabFormValues,
} from '@/app/features/companionHistory/components/pocLabForm';
import { usePocLabList } from '@/app/features/companionHistory/components/usePocLabList';
import type {
  LabResultParameter,
  PointOfCareLabResult,
} from '@/app/features/companionHistory/services/pocLabService';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';

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
  const conductedAt = formatConductedAt(record.conductedAt);
  const hasCritical = record.criticalFlags.length > 0;
  const hasAbnormal = record.abnormalFlags.length > 0;
  const hasPills = hasCritical || hasAbnormal || Boolean(record.followUpRecommended);
  const Chevron = expanded ? IoChevronUpOutline : IoChevronDownOutline;
  // Phone: the pills drop onto their own line under the meta and the chevron
  // stays top-right. From 768px they sit in one row beside the chevron.
  return (
    <li className="border-t border-[var(--divider)] first:border-t-0">
      <button
        type="button"
        className={clsx(
          'grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue)] md:gap-x-1.5 md:gap-y-0',
          hasPills && 'md:grid-cols-[minmax(0,1fr)_auto_auto]'
        )}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="col-start-1 row-start-1 min-w-0 md:mr-1.5">
          <span className={clsx(titleClass, 'block')}>{TEST_TYPE_LABEL[record.testType]}</span>
          <span
            className={clsx(
              metaClass,
              'mt-1.5 block max-md:text-[12px] max-md:leading-4 md:mt-0.5'
            )}
          >
            {[conductedAt, record.sampleType, record.analyzerName].filter(Boolean).join(' · ')}
          </span>
        </span>
        {hasPills ? (
          <span className="col-start-1 row-start-2 flex flex-wrap items-center gap-1.5 md:col-start-2 md:row-start-1 md:flex-nowrap">
            {hasCritical ? <StatusPill label="Critical" tone="danger" /> : null}
            {!hasCritical && hasAbnormal ? <StatusPill label="Abnormal" tone="warning" /> : null}
            {record.followUpRecommended ? <StatusPill label="Follow-up" tone="info" /> : null}
          </span>
        ) : null}
        <Chevron
          size={16}
          aria-hidden="true"
          className={clsx(
            'col-start-2 row-start-1 mt-0.5 text-[var(--ink-muted)] md:mt-[3px]',
            hasPills && 'md:col-start-3'
          )}
        />
      </button>
      {expanded ? <LabResultDetails record={record} /> : null}
    </li>
  );
};

export type PocLabListProps = {
  records: PointOfCareLabResult[];
  loading: boolean;
  error: string | null;
  /** Shows the add control and form. Mirrors the backend `appointments:edit:any` gate. */
  canEdit?: boolean;
  /** Fired with validated form values. Resolves true once the record is saved. */
  onCreate?: (values: PocLabFormValues) => Promise<boolean> | boolean;
  /** Disables Save while a create is in flight. */
  creating?: boolean;
  /** A record this member just saved; it opens expanded. */
  createdId?: string | null;
};

export const PocLabList = ({
  records,
  loading,
  error,
  canEdit = false,
  onCreate,
  creating = false,
  createdId = null,
}: PocLabListProps) => {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(createdId);
  const [openedCreatedId, setOpenedCreatedId] = useState(createdId);
  if (createdId !== openedCreatedId) {
    setOpenedCreatedId(createdId);
    if (createdId) setExpandedId(createdId);
  }

  let body;
  if (loading) body = <ClinicalListLoadingRows />;
  else if (error) body = <ClinicalListError error={error} />;
  else if (records.length === 0)
    body = <ClinicalListEmpty message="No in-house lab results recorded for this patient yet." />;
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
      <ClinicalListHeader
        icon={<IoFlaskOutline size={17} />}
        headingId="poc-lab-heading"
        title="In-house lab results"
        activeCount={records.length}
        countLabel="recorded"
        countTone="neutral"
        loading={loading}
        error={error}
        canEdit={canEdit}
        showForm={showForm}
        onToggle={() => setShowForm((open) => !open)}
        addLabel="Add lab result"
      />
      {showForm && canEdit ? (
        <PocLabResultForm
          creating={creating}
          onCreate={onCreate}
          onClose={() => setShowForm(false)}
        />
      ) : null}
      {body}
    </section>
  );
};

/**
 * Data container for {@link PocLabList}. State lives in {@link usePocLabList};
 * this renders nothing when the member cannot view appointments. Keyed by
 * companion so an open form never carries one patient's entries to the next.
 */
const PocLabListPanel = ({ companionId }: { companionId: string }) => {
  const { canView, canEdit, records, loading, error, createdId, creating, create } =
    usePocLabList(companionId);

  if (!canView) return null;
  return (
    <PocLabList
      key={companionId}
      records={records}
      loading={loading}
      error={error}
      canEdit={canEdit}
      onCreate={create}
      creating={creating}
      createdId={createdId}
    />
  );
};

export default PocLabListPanel;
