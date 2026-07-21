'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  IoArrowBack,
  IoAddOutline,
  IoCallOutline,
  IoChatbubbleOutline,
  IoCheckmarkOutline,
  IoChevronDownOutline,
  IoCloudUploadOutline,
  IoPencilOutline,
} from 'react-icons/io5';
import CompanionHistoryTimeline from '@/app/features/companionHistory/components/CompanionHistoryTimeline';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';
import type {
  CompanionParent,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { buildCompanionDetails } from '@/app/lib/companionWorkspaceDetails';
import { formatCompanionAge } from '@/app/lib/date';
import { getSafeImageUrl, type ImageType } from '@/app/lib/urls';

type PhoneCompanionRecordProps = {
  companionId: string;
  activeCompanion: CompanionParent | null;
  title: string;
  companionAlerts: CompanionAlert[];
  clientAlerts: CompanionAlert[];
  canEdit: boolean;
  replaceCompanionText: (text: string) => string;
  onBack: () => void;
  onEdit?: () => void;
  onAddAppointment: () => void;
  onAddCompanionAlert: () => void;
  onRemoveCompanionAlert: (id: string) => void;
};

const SPECIES_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const resolveImageType = (type?: string): ImageType => {
  const candidate = type?.toLowerCase() as ImageType | undefined;
  return candidate && SPECIES_IMAGE_TYPES.has(candidate) ? candidate : 'dog';
};

const formatParentName = (parent?: StoredParent): string =>
  [parent?.firstName, parent?.lastName].filter(Boolean).join(' ').trim();

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const joinMeta = (parts: Array<string | undefined>): string =>
  parts
    .flatMap((part) => {
      const value = String(part ?? '').trim();
      return value && value !== '-' ? [value] : [];
    })
    .join(' · ');

/** Compact contextual header: back circle, record title, edit affordance. */
const PhoneRecordHeader = ({
  title,
  onBack,
  onEdit,
}: {
  title: string;
  onBack: () => void;
  onEdit?: () => void;
}) => (
  <div className="flex flex-none items-center gap-2.5 border-b border-(--hairline) px-3.5 py-2.5">
    <button
      type="button"
      aria-label="Go back"
      onClick={onBack}
      className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-(--hairline) text-(--ink-soft) transition-colors duration-150 hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
    >
      <IoArrowBack size={15} aria-hidden="true" />
    </button>
    <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.02em] text-(--ink)">
      {title}
    </span>
    {onEdit ? (
      <button
        type="button"
        aria-label="Edit patient details"
        onClick={onEdit}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-(--hairline) text-(--ink-soft) transition-colors duration-150 hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
      >
        <IoPencilOutline size={15} aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

/** Avatar + name + signalment line, then the patient alert pills row. */
const PhoneRecordIdentity = ({
  name,
  photoUrl,
  speciesType,
  meta,
  alerts,
  onAddAlert,
  onRemoveAlert,
  addAlertLabel,
}: {
  name: string;
  photoUrl?: string;
  speciesType?: string;
  meta: string;
  alerts: CompanionAlert[];
  onAddAlert: () => void;
  onRemoveAlert: (id: string) => void;
  addAlertLabel: string;
}) => (
  <>
    <div className="flex items-center gap-3">
      <Image
        src={getSafeImageUrl(photoUrl, resolveImageType(speciesType))}
        alt={name}
        width={58}
        height={58}
        className="size-[58px] shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-newsreader text-[22px] leading-tight tracking-[-0.015em] text-(--ink)">
          {name}
        </span>
        {meta ? (
          <span className="block truncate text-[11.5px] text-(--ink-faint)">{meta}</span>
        ) : null}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      {alerts.map((alert) => (
        <AlertPill
          key={alert.id}
          id={alert.id}
          label={alert.label}
          severity={alert.severity}
          onRemove={onRemoveAlert}
        />
      ))}
      <span className="inline-flex items-center gap-1 rounded-full border border-(--status-completed-border) bg-(--status-completed-bg) px-2.5 py-1 text-[9.5px] font-bold text-(--status-completed-text)">
        Dues cleared
        <IoCheckmarkOutline size={10} aria-hidden="true" />
      </span>
      <button
        type="button"
        aria-label={addAlertLabel}
        onClick={onAddAlert}
        className="flex size-6 items-center justify-center rounded-full border border-dashed border-(--divider) text-(--ink-faint) transition-colors hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <IoAddOutline size={14} aria-hidden="true" />
      </button>
    </div>
  </>
);

/** Parent contact card: avatar, name (+ preference note), tap-to-call / message. */
const PhoneParentContact = ({
  name,
  initials,
  photoUrl,
  phone,
  note,
}: {
  name: string;
  initials: string;
  photoUrl?: string;
  phone?: string;
  note?: string;
}) => {
  const detail = joinMeta([phone, note]);
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-(--hairline) bg-(--screen) px-3.5 py-2.5 shadow-[0_1px_2px_var(--sh03)]">
      {photoUrl ? (
        <Image
          src={getSafeImageUrl(photoUrl, 'person')}
          alt={name}
          width={34}
          height={34}
          className="size-[34px] shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-(--avatar-violet-bg) text-[12px] font-bold text-(--avatar-violet-ink)">
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-(--ink)">{name}</span>
        {detail ? (
          <span className="block truncate text-[11px] text-(--ink-faint)">{detail}</span>
        ) : null}
      </div>
      {phone ? (
        <>
          <a
            href={`tel:${phone}`}
            aria-label={`Call ${name}`}
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-(--hairline) text-(--ink-soft) transition-colors hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
          >
            <IoCallOutline size={15} aria-hidden="true" />
          </a>
          <a
            href={`sms:${phone}`}
            aria-label={`Message ${name}`}
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-(--hairline) text-(--ink-soft) transition-colors hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
          >
            <IoChatbubbleOutline size={15} aria-hidden="true" />
          </a>
        </>
      ) : null}
    </div>
  );
};

/** Collapsible secondary-details row (microchip, insurance, blood group …). */
const PhoneRecordDetails = ({ rows }: { rows: Array<{ label: string; value: string }> }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[14px] bg-(--inset)">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <span className="text-[12.5px] font-bold text-(--ink)">
          Details{' '}
          <span className="font-medium text-(--ink-faint)">
            · microchip, insurance, blood group
          </span>
        </span>
        <IoChevronDownOutline
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-(--ink-faint) transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <dl className="grid grid-cols-1 gap-2 px-3.5 pb-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 text-[12px]">
              <dt className="text-(--ink-faint)">{row.label}</dt>
              <dd className="min-w-0 break-words font-bold text-(--ink)">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
};

/** Sticky bottom action bar: upload document + Book appointment. */
const PhoneRecordActionBar = ({
  onUpload,
  onBook,
}: {
  onUpload: () => void;
  onBook: () => void;
}) => (
  <div className="flex flex-none items-center gap-2 border-t border-(--hairline) bg-(--screen) px-4 pt-2.5 pb-2">
    <button
      type="button"
      aria-label="Upload document"
      onClick={onUpload}
      className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-(--hairline) text-(--ink-soft) transition-colors duration-150 hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
    >
      <IoCloudUploadOutline size={17} aria-hidden="true" />
    </button>
    <button
      type="button"
      onClick={onBook}
      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-(--cta) text-[13.5px] font-bold text-(--cta-text) transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)"
    >
      <IoAddOutline size={15} aria-hidden="true" />
      Book appointment
    </button>
  </div>
);

/**
 * Bespoke phone (< 768px) companion record. Reproduces the designed phone
 * screen: a contextual header, a compact patient identity + alert pills, a
 * tap-to-call parent card, a collapsible details drawer, the reused history
 * timeline (phone variant), and a sticky Book-appointment action bar. Rendered
 * only on phone; the desktop/tablet overview is untouched. Presentation only —
 * every handler and the timeline data flow come from the page unchanged.
 */
const PhoneCompanionRecord = ({
  companionId,
  activeCompanion,
  title,
  companionAlerts,
  clientAlerts,
  canEdit,
  replaceCompanionText,
  onBack,
  onEdit,
  onAddAppointment,
  onAddCompanionAlert,
  onRemoveCompanionAlert,
}: PhoneCompanionRecordProps) => {
  const [uploadSignal, setUploadSignal] = useState(0);

  const companion = activeCompanion?.companion;
  const parent = activeCompanion?.parent;

  const details = useMemo(
    () =>
      companion
        ? buildCompanionDetails(
            {
              id: companion.id,
              name: companion.name,
              species: companion.type,
              breed: companion.breed,
            },
            companion,
            replaceCompanionText
          )
        : [],
    [companion, replaceCompanionText]
  );

  const detailValue = (label: string): string | undefined =>
    details.find((detail) => detail.label === label)?.value;

  const idLabel = replaceCompanionText('Patient ID');
  const metaLine = joinMeta([
    companion?.breed,
    detailValue('Sex'),
    companion?.dateOfBirth ? formatCompanionAge(companion.dateOfBirth) : undefined,
    companion?.currentWeight == null ? undefined : `${companion.currentWeight} kg`,
    companion?.id,
  ]);

  const detailRows = useMemo(
    () =>
      details.flatMap((detail) =>
        ['Blood Group', 'Microchip ID', 'Allergies', 'Age / DOB', 'Weight', idLabel].includes(
          detail.label
        )
          ? [{ label: detail.label, value: detail.value }]
          : []
      ),
    [details, idLabel]
  );

  const parentName = formatParentName(parent);
  const clientNote = clientAlerts[0]?.label;

  return (
    <div className="flex h-[calc(100dvh-54px-72px-env(safe-area-inset-bottom,0px))] min-h-[480px] flex-col bg-(--screen)">
      <PhoneRecordHeader title={title} onBack={onBack} onEdit={canEdit ? onEdit : undefined} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-4">
        {companion ? (
          <>
            <PhoneRecordIdentity
              name={companion.name}
              photoUrl={companion.photoUrl}
              speciesType={companion.type}
              meta={metaLine}
              alerts={companionAlerts}
              onAddAlert={onAddCompanionAlert}
              onRemoveAlert={onRemoveCompanionAlert}
              addAlertLabel={replaceCompanionText('Add companion alert')}
            />
            {parentName ? (
              <PhoneParentContact
                name={parentName}
                initials={getInitials(parentName)}
                photoUrl={parent?.profileImageUrl}
                phone={parent?.phoneNumber?.trim() || undefined}
                note={clientNote}
              />
            ) : null}
            {detailRows.length > 0 ? <PhoneRecordDetails rows={detailRows} /> : null}
          </>
        ) : null}

        <CompanionHistoryTimeline
          companionId={companionId}
          variant="phone"
          showDocumentUpload
          openMedicalRecordsSignal={uploadSignal}
        />
      </div>
      <PhoneRecordActionBar
        onUpload={() => setUploadSignal((value) => value + 1)}
        onBook={onAddAppointment}
      />
    </div>
  );
};

export default PhoneCompanionRecord;
