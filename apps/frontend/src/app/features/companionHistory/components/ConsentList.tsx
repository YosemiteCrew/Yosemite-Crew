'use client';
import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { IoCloseCircleOutline, IoDocumentTextOutline } from 'react-icons/io5';
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
  ConsentStatus,
  ConsentType,
  PatientConsent,
} from '@/app/features/companionHistory/services/patientConsentService';

/** The values the grant form emits. `expiresAt` is a raw `YYYY-MM-DD` (or ''). */
export type ConsentFormValues = {
  consentType: ConsentType;
  procedureDesc: string;
  consentedByName: string;
  expiresAt: string;
  witnessedBy: string;
  notes: string;
};

export type ConsentListProps = {
  consents: PatientConsent[];
  loading?: boolean;
  error?: string | null;
  /** Gates the grant/revoke controls. Mirrors the backend `appointments:edit` gate. */
  canEdit?: boolean;
  /** Fired when the grant form is submitted. Returns true once the record is saved. */
  onGrant?: (values: ConsentFormValues) => Promise<boolean> | boolean;
  /** Fired when an active consent is revoked. Returns true once the revoke lands. */
  onRevoke?: (consent: PatientConsent, revokedReason?: string) => Promise<boolean> | boolean;
  /** Disables the grant form's submit while a grant is in flight. */
  creating?: boolean;
  /** Id of the consent currently being revoked, so its row shows a pending state. */
  revokingId?: string | null;
};

const STATUS_LABEL: Record<ConsentStatus, string> = {
  ACTIVE: 'Active',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
};

const TYPE_LABEL: Record<ConsentType, string> = {
  SURGICAL: 'Surgical',
  ANESTHESIA: 'Anaesthesia',
  DIAGNOSTIC: 'Diagnostic',
  TREATMENT: 'Treatment',
  DATA_SHARING: 'Data sharing',
  DNR: 'Do not resuscitate',
  OTHER: 'Other',
};

const TYPE_OPTIONS: ConsentType[] = [
  'SURGICAL',
  'ANESTHESIA',
  'DIAGNOSTIC',
  'TREATMENT',
  'DATA_SHARING',
  'DNR',
  'OTHER',
];

/**
 * The status pill tone. An active DNR directive reads in the danger tone and an
 * expired consent in the warning tone; a revoked consent is neutral and any
 * other active consent is a positive success.
 */
const statusTone = (consent: PatientConsent): StatusTone => {
  if (consent.status === 'REVOKED') return 'neutral';
  if (consent.status === 'EXPIRED') return 'warning';
  return consent.consentType === 'DNR' ? 'danger' : 'success';
};

const RevokeConsentForm = ({
  consent,
  revoking,
  onRevoke,
  onCancel,
}: {
  consent: PatientConsent;
  revoking: boolean;
  onRevoke?: NonNullable<ConsentListProps['onRevoke']>;
  onCancel: () => void;
}) => {
  const [reason, setReason] = useState('');
  const reasonId = `consent-revoke-reason-${consent.id}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (revoking) return;
    const ok = await onRevoke?.(consent, reason.trim() || undefined);
    if (ok) {
      setReason('');
      onCancel();
    }
  };

  return (
    <form className="mt-2 flex w-full flex-col gap-2" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor={reasonId}>
          Reason for revoking
        </label>
        <textarea
          id={reasonId}
          className={clsx(controlClass, 'min-h-14 resize-y')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Secondary size="compact" text="Cancel" onClick={onCancel} isDisabled={revoking} />
        <Primary
          size="compact"
          type="submit"
          text={revoking ? 'Revoking…' : 'Revoke consent'}
          isDisabled={revoking}
        />
      </div>
    </form>
  );
};

const ConsentRow = ({
  consent,
  canEdit,
  onRevoke,
  revoking,
  revokeDisabled,
}: {
  consent: PatientConsent;
  canEdit: boolean;
  onRevoke?: ConsentListProps['onRevoke'];
  revoking: boolean;
  revokeDisabled: boolean;
}) => {
  const [showRevoke, setShowRevoke] = useState(false);
  const label = TYPE_LABEL[consent.consentType];
  const consented = formatDate(consent.consentedAt);
  const expires = formatDate(consent.expiresAt);
  const revoked = formatDate(consent.revokedAt);
  const isActive = consent.status === 'ACTIVE';
  const consentedMeta = [
    consent.consentedByName ? `Consented by ${consent.consentedByName}` : 'Consented',
    consented,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex flex-col">
      <div className={rowClass}>
        <span className="min-w-0">
          <span className={clsx(titleClass, 'block truncate')}>{label}</span>
          {consent.procedureDesc ? (
            <span className={clsx(metaClass, 'mt-0.5 block')}>{consent.procedureDesc}</span>
          ) : null}
          <span className={clsx(metaClass, 'mt-1 block text-[var(--ink-muted)]')}>
            {consentedMeta}
          </span>
          {expires ? (
            <span className={clsx(metaClass, 'mt-1 block')}>
              {'Expires '}
              {expires}
            </span>
          ) : null}
          {consent.witnessedBy ? (
            <span className={clsx(metaClass, 'mt-1 block')}>
              {'Witnessed by '}
              {consent.witnessedBy}
            </span>
          ) : null}
          {consent.notes ? (
            <span className={clsx(metaClass, 'mt-1 block line-clamp-2 text-[var(--ink-muted)]')}>
              {consent.notes}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill label={STATUS_LABEL[consent.status]} tone={statusTone(consent)} />
          {isActive && canEdit && !showRevoke ? (
            <Secondary
              size="compact"
              text="Revoke"
              icon={<IoCloseCircleOutline size={15} aria-hidden="true" />}
              isDisabled={revokeDisabled}
              onClick={() => setShowRevoke(true)}
              ariaLabel={`Revoke ${label} consent`}
            />
          ) : null}
          {consent.status === 'REVOKED' && revoked ? (
            <span className={metaClass}>
              {'Revoked '}
              {revoked}
            </span>
          ) : null}
        </span>
      </div>
      {consent.status === 'REVOKED' && consent.revokedReason ? (
        <span className={clsx(metaClass, 'block px-4 pb-3 text-[var(--ink-muted)]')}>
          {'Reason: '}
          {consent.revokedReason}
        </span>
      ) : null}
      {showRevoke && canEdit ? (
        <div className="px-4 pb-3">
          <RevokeConsentForm
            consent={consent}
            revoking={revoking}
            onRevoke={onRevoke}
            onCancel={() => setShowRevoke(false)}
          />
        </div>
      ) : null}
    </li>
  );
};

const emptyForm: ConsentFormValues = {
  consentType: 'SURGICAL',
  procedureDesc: '',
  consentedByName: '',
  expiresAt: '',
  witnessedBy: '',
  notes: '',
};

const GrantConsentForm = ({
  creating,
  onGrant,
  onCancel,
}: {
  creating: boolean;
  onGrant?: NonNullable<ConsentListProps['onGrant']>;
  onCancel: () => void;
}) => {
  const [values, setValues] = useState<ConsentFormValues>(emptyForm);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const ok = await onGrant?.(values);
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
        <label className={fieldLabelClass} htmlFor="consent-type">
          Consent type
        </label>
        <select
          id="consent-type"
          className={controlClass}
          value={values.consentType}
          onChange={(e) => setValues((v) => ({ ...v, consentType: e.target.value as ConsentType }))}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="consent-procedure">
          Procedure
        </label>
        <input
          id="consent-procedure"
          className={controlClass}
          value={values.procedureDesc}
          onChange={(e) => setValues((v) => ({ ...v, procedureDesc: e.target.value }))}
          maxLength={2000}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="consent-consented-by">
          Consented by
        </label>
        <input
          id="consent-consented-by"
          className={controlClass}
          value={values.consentedByName}
          onChange={(e) => setValues((v) => ({ ...v, consentedByName: e.target.value }))}
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="consent-expires">
            Expiry date
          </label>
          <input
            id="consent-expires"
            type="date"
            className={controlClass}
            value={values.expiresAt}
            onChange={(e) => setValues((v) => ({ ...v, expiresAt: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="consent-witness">
            Witnessed by
          </label>
          <input
            id="consent-witness"
            className={controlClass}
            value={values.witnessedBy}
            onChange={(e) => setValues((v) => ({ ...v, witnessedBy: e.target.value }))}
            maxLength={200}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="consent-notes">
          Notes
        </label>
        <textarea
          id="consent-notes"
          className={clsx(controlClass, 'min-h-16 resize-y')}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          maxLength={2000}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Secondary size="compact" text="Cancel" onClick={onCancel} />
        <Primary size="compact" type="submit" text="Save consent" isDisabled={creating} />
      </div>
    </form>
  );
};

/** The list body: loading skeleton, error's null slot, empty state, or the rows. */
const ConsentListBody = ({
  loading,
  error,
  consents,
  canEdit,
  onRevoke,
  revokingId,
}: {
  loading: boolean;
  error: string | null;
  consents: PatientConsent[];
  canEdit: boolean;
  onRevoke?: ConsentListProps['onRevoke'];
  revokingId: string | null;
}) => {
  if (loading) return <ClinicalListLoadingRows />;
  if (error) return null;
  if (consents.length === 0)
    return <ClinicalListEmpty message="No consents recorded for this patient yet." />;
  return (
    <ul className="divide-y divide-[var(--divider)]">
      {consents.map((consent) => (
        <ConsentRow
          key={consent.id}
          consent={consent}
          canEdit={canEdit}
          onRevoke={onRevoke}
          revoking={revokingId === consent.id}
          revokeDisabled={revokingId !== null}
        />
      ))}
    </ul>
  );
};

/**
 * Presentational clinical consent-list panel. Renders the consents the caller
 * supplies and surfaces grant/revoke intents through callbacks; it never
 * fetches. The container (`ConsentListPanel`) owns loading, error and data.
 */
const ConsentList = ({
  consents,
  loading = false,
  error = null,
  canEdit = false,
  onGrant,
  onRevoke,
  creating = false,
  revokingId = null,
}: ConsentListProps) => {
  const [showForm, setShowForm] = useState(false);
  const activeCount = useMemo(
    () => consents.filter((c) => c.status === 'ACTIVE').length,
    [consents]
  );

  return (
    <section className={cardClass} aria-labelledby="consent-list-heading">
      <ClinicalListHeader
        icon={<IoDocumentTextOutline size={18} />}
        headingId="consent-list-heading"
        title="Consents"
        activeCount={activeCount}
        loading={loading}
        canEdit={canEdit}
        showForm={showForm}
        onToggle={() => setShowForm((s) => !s)}
        addLabel="Record consent"
      />

      <ClinicalListError error={error} />

      {showForm && canEdit ? (
        <GrantConsentForm
          creating={creating}
          onGrant={onGrant}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      <ConsentListBody
        loading={loading}
        error={error}
        consents={consents}
        canEdit={canEdit}
        onRevoke={onRevoke}
        revokingId={revokingId}
      />
    </section>
  );
};

export default ConsentList;
