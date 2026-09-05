'use client';
import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { IoCheckmarkOutline, IoWarningOutline } from 'react-icons/io5';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import {
  ClinicalListEmpty,
  ClinicalListError,
  ClinicalListHeader,
  ClinicalListLoadingRows,
  cardClass,
  controlClass,
  fieldLabelClass,
  formatDate,
  metaClass,
  rowClass,
  titleClass,
} from '@/app/features/companionHistory/components/ClinicalListChrome';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type {
  AllergySeverity,
  AllergyStatus,
  AllergyType,
  PatientAllergy,
} from '@/app/features/companionHistory/services/patientAllergyService';

/** The values the create form emits. `onsetDate` is a raw `YYYY-MM-DD` (or ''). */
export type AllergyFormValues = {
  allergen: string;
  allergyType: AllergyType;
  severity: AllergySeverity;
  reaction: string;
  onsetDate: string;
  notes: string;
};

export type AllergyListProps = {
  allergies: PatientAllergy[];
  loading?: boolean;
  error?: string | null;
  /** Gates the add/resolve controls. Mirrors the backend `appointments:edit` gate. */
  canEdit?: boolean;
  /** Fired when the create form is submitted. Returns true once the record is saved. */
  onCreate?: (values: AllergyFormValues) => Promise<boolean> | boolean;
  /** Fired when an active allergy's resolve action is clicked. */
  onResolve?: (allergy: PatientAllergy) => void;
  /** Disables the create form's submit while a create is in flight. */
  creating?: boolean;
  /** Id of the allergy currently being resolved, so its row shows a pending state. */
  resolvingId?: string | null;
};

const STATUS_LABEL: Record<AllergyStatus, string> = {
  ACTIVE: 'Active',
  RESOLVED: 'Resolved',
  UNCONFIRMED: 'Unconfirmed',
};

const STATUS_TONE: Record<AllergyStatus, StatusTone> = {
  ACTIVE: 'warning',
  RESOLVED: 'success',
  UNCONFIRMED: 'neutral',
};

const SEVERITY_LABEL: Record<AllergySeverity, string> = {
  MILD: 'Mild',
  MODERATE: 'Moderate',
  SEVERE: 'Severe',
  LIFE_THREATENING: 'Life-threatening',
};

// LIFE_THREATENING reads as the most severe (danger) tone; SEVERE shares it,
// distinguished by its label.
const SEVERITY_TONE: Record<AllergySeverity, StatusTone> = {
  MILD: 'info',
  MODERATE: 'warning',
  SEVERE: 'danger',
  LIFE_THREATENING: 'danger',
};

const TYPE_LABEL: Record<AllergyType, string> = {
  DRUG: 'Drug',
  FOOD: 'Food',
  ENVIRONMENTAL: 'Environmental',
  OTHER: 'Other',
};

const SEVERITY_OPTIONS: AllergySeverity[] = ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'];
const TYPE_OPTIONS: AllergyType[] = ['DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER'];

const AllergyRow = ({
  allergy,
  canEdit,
  onResolve,
  resolving,
  resolveDisabled,
}: {
  allergy: PatientAllergy;
  canEdit: boolean;
  onResolve?: (allergy: PatientAllergy) => void;
  resolving: boolean;
  resolveDisabled: boolean;
}) => {
  const onset = formatDate(allergy.onsetDate);
  const resolved = formatDate(allergy.resolvedDate);
  const isActive = allergy.status === 'ACTIVE';
  return (
    <li className={rowClass}>
      <span className="min-w-0">
        <span className={clsx(titleClass, 'block truncate')}>{allergy.allergen}</span>
        <span className={clsx(metaClass, 'mt-0.5 block')}>
          {TYPE_LABEL[allergy.allergyType]}
          {onset ? ` · Onset ${onset}` : ''}
        </span>
        {allergy.reaction ? (
          <span className={clsx(metaClass, 'mt-1 block text-[var(--ink-muted)]')}>
            {'Reaction: '}
            {allergy.reaction}
          </span>
        ) : null}
        {allergy.notes ? (
          <span className={clsx(metaClass, 'mt-1 block line-clamp-2 text-[var(--ink-muted)]')}>
            {allergy.notes}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusPill
            label={SEVERITY_LABEL[allergy.severity]}
            tone={SEVERITY_TONE[allergy.severity]}
          />
          <StatusPill label={STATUS_LABEL[allergy.status]} tone={STATUS_TONE[allergy.status]} />
        </span>
        {isActive && canEdit ? (
          <Secondary
            size="compact"
            text={resolving ? 'Resolving…' : 'Resolve'}
            icon={<IoCheckmarkOutline size={15} aria-hidden="true" />}
            isDisabled={resolveDisabled}
            onClick={() => onResolve?.(allergy)}
            ariaLabel={`Resolve ${allergy.allergen}`}
          />
        ) : null}
        {allergy.status === 'RESOLVED' && resolved ? (
          <span className={metaClass}>
            {'Resolved '}
            {resolved}
          </span>
        ) : null}
      </span>
    </li>
  );
};

const emptyForm: AllergyFormValues = {
  allergen: '',
  allergyType: 'DRUG',
  severity: 'MILD',
  reaction: '',
  onsetDate: '',
  notes: '',
};

const CreateAllergyForm = ({
  creating,
  onCreate,
  onCancel,
}: {
  creating: boolean;
  onCreate?: NonNullable<AllergyListProps['onCreate']>;
  onCancel: () => void;
}) => {
  const [values, setValues] = useState<AllergyFormValues>(emptyForm);
  const trimmedAllergen = values.allergen.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedAllergen || creating) return;
    const ok = await onCreate?.({ ...values, allergen: trimmedAllergen });
    if (ok) {
      setValues(emptyForm);
      onCancel();
    }
  };

  return (
    <form
      className="flex flex-col gap-3 border-b border-[var(--divider)] bg-[var(--inset)] px-4 py-4"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="allergy-allergen">
          Allergen
        </label>
        <input
          id="allergy-allergen"
          className={controlClass}
          value={values.allergen}
          onChange={(e) => setValues((v) => ({ ...v, allergen: e.target.value }))}
          maxLength={200}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="allergy-type">
            Type
          </label>
          <select
            id="allergy-type"
            className={controlClass}
            value={values.allergyType}
            onChange={(e) =>
              setValues((v) => ({ ...v, allergyType: e.target.value as AllergyType }))
            }
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="allergy-severity">
            Severity
          </label>
          <select
            id="allergy-severity"
            className={controlClass}
            value={values.severity}
            onChange={(e) =>
              setValues((v) => ({ ...v, severity: e.target.value as AllergySeverity }))
            }
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="allergy-reaction">
          Reaction
        </label>
        <input
          id="allergy-reaction"
          className={controlClass}
          value={values.reaction}
          onChange={(e) => setValues((v) => ({ ...v, reaction: e.target.value }))}
          maxLength={1000}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="allergy-onset">
            Onset date
          </label>
          <input
            id="allergy-onset"
            type="date"
            className={controlClass}
            value={values.onsetDate}
            onChange={(e) => setValues((v) => ({ ...v, onsetDate: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="allergy-notes">
          Notes
        </label>
        <textarea
          id="allergy-notes"
          className={clsx(controlClass, 'min-h-16 resize-y')}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          maxLength={2000}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Secondary size="compact" text="Cancel" onClick={onCancel} />
        <Primary
          size="compact"
          type="submit"
          text="Save allergy"
          isDisabled={!trimmedAllergen || creating}
        />
      </div>
    </form>
  );
};

/**
 * Presentational clinical allergy-list panel. Renders the allergies the caller
 * supplies and surfaces create/resolve intents through callbacks; it never
 * fetches. The container (`AllergyListPanel`) owns loading, error and data.
 */
const AllergyList = ({
  allergies,
  loading = false,
  error = null,
  canEdit = false,
  onCreate,
  onResolve,
  creating = false,
  resolvingId = null,
}: AllergyListProps) => {
  const [showForm, setShowForm] = useState(false);
  const activeCount = useMemo(
    () => allergies.filter((a) => a.status === 'ACTIVE').length,
    [allergies]
  );

  const body = (() => {
    if (loading) return <ClinicalListLoadingRows />;
    if (error) return null;
    if (allergies.length === 0)
      return <ClinicalListEmpty message="No allergies recorded for this patient yet." />;
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {allergies.map((allergy) => (
          <AllergyRow
            key={allergy.id}
            allergy={allergy}
            canEdit={canEdit}
            onResolve={onResolve}
            resolving={resolvingId === allergy.id}
            resolveDisabled={resolvingId !== null}
          />
        ))}
      </ul>
    );
  })();

  return (
    <section className={cardClass} aria-labelledby="allergy-list-heading">
      <ClinicalListHeader
        icon={<IoWarningOutline size={18} />}
        headingId="allergy-list-heading"
        title="Allergies"
        activeCount={activeCount}
        loading={loading}
        canEdit={canEdit}
        showForm={showForm}
        onToggle={() => setShowForm((s) => !s)}
        addLabel="Add allergy"
      />

      <ClinicalListError error={error} />

      {showForm && canEdit ? (
        <CreateAllergyForm
          creating={creating}
          onCreate={onCreate}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {body}
    </section>
  );
};

export default AllergyList;
