'use client';

import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { IoIosArrowBack } from 'react-icons/io';
import { IoAddOutline, IoCheckmarkOutline, IoPencilOutline } from 'react-icons/io5';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import PhoneCompanionRecord from '@/app/features/companionHistory/pages/phone/PhoneCompanionRecord';
import {
  useCompanionsParentsForPrimaryOrg,
  useLoadCompanionsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import {
  useAppointmentsForPrimaryOrg,
  useLoadAppointmentsForPrimaryOrg,
} from '@/app/hooks/useAppointments';
import { getLastVisitStart } from '@/app/features/companions/pages/Companions/companionsDirectory';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { useCompanionStore } from '@/app/stores/companionStore';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { buildCompanionDetails } from '@/app/lib/companionWorkspaceDetails';
import { formatDisplayDate, formatCompanionAge } from '@/app/lib/date';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import AddAlertModal from '@/app/features/appointments/pages/AppointmentWorkspace/components/AddAlertModal';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';
import {
  companionAlertsToStoredAlerts,
  storedAlertsToCompanionAlerts,
} from '@/app/features/appointments/lib/alertMapping';
import AddAppointmentCentralModal from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal';
import AddCompanionCentralModal from '@/app/features/companions/components/AddCompanionCentralModal';
import CompanionInfo from '@/app/features/companions/components/CompanionInfo';
import { updateCompanion, updateParent } from '@/app/features/companions/services/companionService';
import { Primary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useNotify } from '@/app/hooks/useNotify';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { isCompanionRevampEnabled } from '@/app/lib/featureFlags';
import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';

const FALLBACK_BACK_PATH = '/companions';
const APPOINTMENTS_BACK_PATH = '/appointments';

const HistoryTimelineSkeleton = () => (
  <div className="min-h-96 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const CompanionHistoryTimeline = dynamic(
  () => import('@/app/features/companionHistory/components/CompanionHistoryTimeline'),
  { loading: () => <HistoryTimelineSkeleton /> }
);

const PAGE_SKELETON = <PageSkeleton variant="list" />;
const SPECIES_IMAGE_TYPES = new Set<ImageType>(['dog', 'cat', 'horse', 'other']);

const resolveSafeBackPath = (candidate: string | null, source: string | null): string => {
  if (candidate?.startsWith('/') && !candidate.startsWith('//')) {
    return source === 'companions' ? removeCompanionDeepLinkParam(candidate) : candidate;
  }
  if (source === 'appointments') {
    return APPOINTMENTS_BACK_PATH;
  }
  return FALLBACK_BACK_PATH;
};

const removeCompanionDeepLinkParam = (path: string): string => {
  const url = new URL(path, 'https://yosemite.local');
  if (url.pathname !== FALLBACK_BACK_PATH) return path;

  url.searchParams.delete('companionId');
  const search = url.searchParams.toString();
  const query = search ? `?${search}` : '';
  return `${url.pathname}${query}${url.hash}`;
};

const resolveCompanionImageType = (type?: string): ImageType => {
  const candidate = type?.toLowerCase() as ImageType | undefined;
  return candidate && SPECIES_IMAGE_TYPES.has(candidate) ? candidate : 'dog';
};

const clean = (value?: string | number | null): string => {
  const text = String(value ?? '').trim();
  return text || '-';
};

const formatParentName = (parent?: StoredParent): string =>
  [parent?.firstName, parent?.lastName].filter(Boolean).join(' ').trim() || '-';

const formatAgeDob = (value?: Date | string): string => {
  if (!value) return '-';
  const ageLabel = formatCompanionAge(value, { long: true });
  const dob = formatDisplayDate(value, '-');
  if (!ageLabel) return dob;
  // A non-empty age label means `value` parsed to a valid date, so
  // formatDisplayDate never returns the '-' fallback here — always show age / dob.
  return `${ageLabel} / ${dob}`;
};

const DASH = '-';

/**
 * Insurance reads "PetSecure · active" in the design. The cover status comes
 * from the nested policy when present and falls back to the companion flag, so
 * the row only ever states what the record actually holds.
 */
const formatInsurance = (companion: StoredCompanion): string => {
  const company = String(companion.insurance?.companyName ?? '').trim();
  const isInsured = companion.insurance?.isInsured ?? companion.isInsured;
  if (!company) return isInsured ? 'Active' : DASH;
  return isInsured ? `${company} · active` : company;
};

type CompanionParentLinkLike = {
  role?: string;
  status?: string;
  parent?: { firstName?: string; lastName?: string };
};

/**
 * The co-parent's name from the companion's live parent links. Empty when no
 * link exists, so the design's "Co-parent" row stays hidden rather than
 * inventing a shared-care relationship.
 */
const getCoParentName = (companion: StoredCompanion): string => {
  const links = (companion as { parentLinks?: CompanionParentLinkLike[] }).parentLinks;
  if (!Array.isArray(links)) return '';
  const coParent = links.find(
    (link) =>
      String(link.role ?? '').toUpperCase() === 'CO_PARENT' &&
      String(link.status ?? '').toUpperCase() !== 'REVOKED'
  );
  return [coParent?.parent?.firstName, coParent?.parent?.lastName].filter(Boolean).join(' ').trim();
};

const ProfileDetail = ({
  label,
  value,
  wrapValue = false,
  labelWidth = 88,
  tone = 'default',
  suffix,
}: {
  label: string;
  value: string;
  wrapValue?: boolean;
  /** Design label-column width: 88px on the companion panel, 74px on the parent panel. */
  labelWidth?: 74 | 88;
  /** `danger` paints the value in --danger-text, matching the design's red allergy emphasis. */
  tone?: 'default' | 'danger';
  /** Trailing qualifier rendered in --pink-text (the co-parent row's "· shared care"). */
  suffix?: string;
}) => (
  <div
    className={`grid min-w-0 items-start gap-2 ${
      labelWidth === 74 ? 'grid-cols-[74px_minmax(0,1fr)]' : 'grid-cols-[88px_minmax(0,1fr)]'
    }`}
  >
    <span className="font-satoshi text-[12.5px] text-[var(--ink-faint)]">{label}:</span>
    <span
      className={`font-satoshi text-[12.5px] font-bold ${wrapValue ? 'break-words' : 'truncate'}`}
      style={{ color: tone === 'danger' ? 'var(--danger-text)' : 'var(--ink)' }}
    >
      {value}
      {suffix ? <span style={{ color: 'var(--pink-text)' }}> {suffix}</span> : null}
    </span>
  </div>
);

const CompanionProfilePanel = ({
  record,
  onEdit,
}: {
  record: CompanionParent;
  onEdit?: () => void;
}) => {
  const replaceCompanionText = useCompanionTerminologyText();
  useLoadAppointmentsForPrimaryOrg();
  const appointments = useAppointmentsForPrimaryOrg();
  const details = buildCompanionDetails(
    {
      id: record.companion.id,
      name: record.companion.name,
      species: record.companion.type,
      breed: record.companion.breed,
    },
    record.companion,
    replaceCompanionText
  );
  const idLabel = replaceCompanionText('Patient ID');
  // "Last visit" reuses the Companions directory's definition (the most recent
  // appointment that has already started) so both surfaces agree. A dash means
  // no past appointment is on record — it is not a claim about the patient.
  const lastVisitStart = useMemo(
    () => getLastVisitStart(appointments, record.companion.id),
    [appointments, record.companion.id]
  );
  const selectedDetails = [
    details.find((detail) => detail.label === 'Name'),
    details.find((detail) => detail.label === idLabel),
    details.find((detail) => detail.label === 'Breed/Species'),
    details.find((detail) => detail.label === 'Age / DOB'),
    details.find((detail) => detail.label === 'Sex'),
    details.find((detail) => detail.label === 'Weight'),
    details.find((detail) => detail.label === 'Blood Group'),
    details.find((detail) => detail.label === 'Microchip ID'),
    details.find((detail) => detail.label === 'Allergies'),
    { label: 'Insurance', value: formatInsurance(record.companion) },
    { label: 'Last visit', value: formatDisplayDate(lastVisitStart ?? undefined, DASH) },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <section
      aria-label="Companion profile"
      className="flex min-h-36 flex-col gap-4 rounded-[18px] border border-card-border bg-neutral-0 px-5 py-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] md:flex-row md:items-start"
    >
      <Image
        alt={record.companion.name}
        src={getSafeImageUrl(
          record.companion.photoUrl,
          resolveCompanionImageType(record.companion.type)
        )}
        className="size-16 shrink-0 rounded-full object-cover"
        height={64}
        width={64}
      />
      <div className="grid flex-1 grid-cols-1 gap-x-7 gap-y-2 lg:grid-cols-2">
        {selectedDetails.map((detail) => (
          <ProfileDetail
            key={detail.label}
            label={detail.label}
            value={detail.value}
            tone={detail.label === 'Allergies' && detail.value !== DASH ? 'danger' : 'default'}
          />
        ))}
      </div>
      {onEdit ? (
        <GlassTooltip content={replaceCompanionText('Edit patient details')} side="bottom">
          <button
            type="button"
            aria-label={replaceCompanionText('Edit patient details')}
            onClick={onEdit}
            className="flex size-6 shrink-0 items-center justify-center self-start rounded-full border border-neutral-500 text-neutral-700 transition-colors hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <IoPencilOutline size={13} aria-hidden="true" />
          </button>
        </GlassTooltip>
      ) : null}
    </section>
  );
};

const ParentProfilePanel = ({
  parent,
  companionId,
  coParentName,
  alerts,
  onAddAlert,
  onRemoveAlert,
}: {
  parent: StoredParent;
  companionId: string;
  coParentName: string;
  alerts: CompanionAlert[];
  onAddAlert: () => void;
  onRemoveAlert: (id: string) => void;
}) => {
  const details = [
    { label: 'Client', value: formatParentName(parent) },
    { label: 'Email', value: clean(parent.email) },
    { label: 'Age / DOB', value: formatAgeDob(parent.birthDate) },
    { label: 'Phone', value: clean(parent.phoneNumber) },
    { label: 'Client ID', value: clean(parent.id || companionId) },
  ];

  return (
    <section
      aria-label="Parent profile"
      className="flex min-h-36 flex-col gap-4 rounded-[18px] border border-card-border bg-neutral-0 px-5 py-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] md:flex-row md:items-start"
    >
      <div className="flex w-16 shrink-0 items-start">
        <Image
          alt={formatParentName(parent)}
          src={getSafeImageUrl(parent.profileImageUrl, 'person')}
          className="size-16 rounded-full object-cover"
          height={64}
          width={64}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-7 gap-y-2">
          {details.map((detail) => (
            <ProfileDetail
              key={detail.label}
              label={detail.label}
              value={detail.value}
              wrapValue
              labelWidth={74}
            />
          ))}
          {coParentName ? (
            <ProfileDetail
              label="Co-parent"
              value={coParentName}
              suffix="· shared care"
              wrapValue
              labelWidth={74}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <StatusPill
            tokens={{
              bg: 'var(--status-completed-bg)',
              text: 'var(--status-completed-text)',
              border: 'var(--status-completed-border)',
            }}
            label={
              <>
                Dues cleared
                <IoCheckmarkOutline size={11} aria-hidden="true" />
              </>
            }
          />
          <div className="flex flex-col items-start gap-1.5 md:items-end">
            {alerts.map((alert) => (
              <AlertPill
                key={alert.id}
                id={alert.id}
                label={alert.label}
                severity={alert.severity}
                onRemove={onRemoveAlert}
              />
            ))}
            <GlassTooltip content="Add alert for client" side="bottom">
              <button
                type="button"
                aria-label="Add client alert"
                onClick={onAddAlert}
                className="flex size-6 items-center justify-center rounded-full border border-dashed border-[var(--divider)] text-[var(--ink-faint)] transition-colors hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <IoAddOutline size={14} aria-hidden="true" />
              </button>
            </GlassTooltip>
          </div>
        </div>
      </div>
    </section>
  );
};

/** Applies a setState-style updater (value or callback) against the current ref value. */
const resolveRefUpdate = (value: string | ((prev: string) => string), current: string): string =>
  typeof value === 'function' ? value(current) : value;

/** Add-alert affordance beside the title. Owns its own gate so the page body stays flat. */
const AddAlertButton = ({
  show,
  tooltip,
  label,
  onClick,
}: {
  show: boolean;
  tooltip: string;
  label: string;
  onClick: () => void;
}) => {
  if (!show) return null;
  return (
    <GlassTooltip content={tooltip} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex size-6 items-center justify-center rounded-full border border-dashed border-[var(--divider)] text-[var(--ink-faint)] transition-colors hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        <IoAddOutline size={14} aria-hidden="true" />
      </button>
    </GlassTooltip>
  );
};

const useCompanionAlerts = (
  activeCompanion: CompanionParent | null,
  notify: ReturnType<typeof useNotify>['notify'],
  replaceCompanionText: (text: string) => string
) => {
  const [alertTarget, setAlertTarget] = useState<'companion' | 'client' | null>(null);

  const companionAlerts = useMemo<CompanionAlert[]>(
    () => storedAlertsToCompanionAlerts(activeCompanion?.companion.alerts, 'patient-alert'),
    [activeCompanion?.companion.alerts]
  );
  const clientAlerts = useMemo<CompanionAlert[]>(
    () => storedAlertsToCompanionAlerts(activeCompanion?.parent.alerts, 'client-alert'),
    [activeCompanion?.parent.alerts]
  );

  const persistCompanionAlerts = useCallback(
    async (nextAlerts: CompanionAlert[]) => {
      /* v8 ignore next -- activeCompanion is always set here: the add/remove alert controls only render inside the `activeCompanion` block */
      if (!activeCompanion) return;
      await updateCompanion({
        ...activeCompanion.companion,
        alerts: companionAlertsToStoredAlerts(nextAlerts),
      });
    },
    [activeCompanion]
  );

  const persistClientAlerts = useCallback(
    async (nextAlerts: CompanionAlert[]) => {
      /* v8 ignore next -- activeCompanion is always set here: the add/remove alert controls only render inside the `activeCompanion` block */
      if (!activeCompanion) return;
      await updateParent({
        ...activeCompanion.parent,
        alerts: companionAlertsToStoredAlerts(nextAlerts),
      });
    },
    [activeCompanion]
  );

  const handleAddAlert = useCallback(
    async (alert: Omit<CompanionAlert, 'id'>) => {
      try {
        if (alertTarget === 'client') {
          await persistClientAlerts([
            ...clientAlerts,
            { ...alert, id: `client-alert-${clientAlerts.length}` },
          ]);
        } else {
          await persistCompanionAlerts([
            ...companionAlerts,
            { ...alert, id: `patient-alert-${companionAlerts.length}` },
          ]);
        }
        notify('success', { title: 'Alert added', text: 'Alert has been saved.' });
        setAlertTarget(null);
      } catch {
        notify('error', { title: 'Failed to add alert', text: 'Please try again.' });
      }
    },
    [
      alertTarget,
      clientAlerts,
      companionAlerts,
      notify,
      persistClientAlerts,
      persistCompanionAlerts,
    ]
  );

  const handleRemoveCompanionAlert = useCallback(
    async (id: string) => {
      try {
        await persistCompanionAlerts(companionAlerts.filter((alert) => alert.id !== id));
        notify('success', {
          title: 'Alert removed',
          text: replaceCompanionText('Patient alert has been removed.'),
        });
      } catch {
        notify('error', { title: 'Failed to remove alert', text: 'Please try again.' });
      }
    },
    [companionAlerts, notify, persistCompanionAlerts, replaceCompanionText]
  );

  const handleRemoveClientAlert = useCallback(
    async (id: string) => {
      try {
        await persistClientAlerts(clientAlerts.filter((alert) => alert.id !== id));
        notify('success', { title: 'Alert removed', text: 'Client alert has been removed.' });
      } catch {
        notify('error', { title: 'Failed to remove alert', text: 'Please try again.' });
      }
    },
    [clientAlerts, notify, persistClientAlerts]
  );

  return {
    alertTarget,
    setAlertTarget,
    companionAlerts,
    clientAlerts,
    handleAddAlert,
    handleRemoveCompanionAlert,
    handleRemoveClientAlert,
  };
};

type CompanionHistoryContentProps = {
  isPhone: boolean;
  hasCompanionId: boolean;
  companionId: string;
  activeCompanion: CompanionParent | null;
  title: string;
  companionAlerts: CompanionAlert[];
  clientAlerts: CompanionAlert[];
  canEditCompanions: boolean;
  replaceCompanionText: (text: string) => string;
  onBack: () => void;
  onEditCompanion?: () => void;
  onAddAppointment: () => void;
  onAddCompanionAlert: () => void;
  onAddClientAlert: () => void;
  onRemoveCompanionAlert: (id: string) => void;
  onRemoveClientAlert: (id: string) => void;
};

/**
 * Desktop overview layout (title row, profile panels, timeline). Extracted so
 * the page's return renders a single branch and its conditional profile /
 * missing-id / timeline trees leave the page function's own body. It never
 * needs the phone flag or the raw edit permission (the parent resolves the
 * latter into onEditCompanion), so those are omitted from its props.
 */
type CompanionHistoryDesktopBodyProps = Omit<
  CompanionHistoryContentProps,
  'isPhone' | 'canEditCompanions'
>;

const CompanionHistoryDesktopBody = ({
  hasCompanionId,
  companionId,
  activeCompanion,
  title,
  companionAlerts,
  clientAlerts,
  replaceCompanionText,
  onBack,
  onEditCompanion,
  onAddAppointment,
  onAddCompanionAlert,
  onAddClientAlert,
  onRemoveCompanionAlert,
  onRemoveClientAlert,
}: CompanionHistoryDesktopBodyProps) => (
  <div className="flex w-full flex-col gap-6 px-4 py-5 md:px-8">
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="Go back"
            onClick={onBack}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-soft)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            <IoIosArrowBack size={16} aria-hidden="true" />
          </button>
          <h1 className="text-page-title">{title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {companionAlerts.map((alert) => (
              <AlertPill
                key={alert.id}
                id={alert.id}
                label={alert.label}
                severity={alert.severity}
                onRemove={onRemoveCompanionAlert}
              />
            ))}
            <AddAlertButton
              show={Boolean(activeCompanion)}
              tooltip={replaceCompanionText('Add alerts for patient')}
              label={replaceCompanionText('Add companion alert')}
              onClick={onAddCompanionAlert}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Primary
            icon={<IoAddOutline size={18} aria-hidden="true" />}
            text="Add appointment"
            onClick={onAddAppointment}
          />
        </div>
      </div>

      {activeCompanion ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
          <CompanionProfilePanel record={activeCompanion} onEdit={onEditCompanion} />
          <ParentProfilePanel
            parent={activeCompanion.parent}
            companionId={activeCompanion.companion.id}
            coParentName={getCoParentName(activeCompanion.companion)}
            alerts={clientAlerts}
            onAddAlert={onAddClientAlert}
            onRemoveAlert={onRemoveClientAlert}
          />
        </div>
      ) : null}

      {hasCompanionId ? null : (
        <div className="rounded-2xl border border-card-border bg-neutral-0 px-4 py-6 text-body-3 text-text-secondary">
          Companion id is missing. Please open overview from Appointments or Companions.
        </div>
      )}
    </div>

    {hasCompanionId ? (
      <CompanionHistoryTimeline companionId={companionId} showDocumentUpload />
    ) : null}
  </div>
);

/**
 * Chooses the bespoke phone record or the desktop overview. Isolating this
 * branch keeps the page function's return a single element.
 */
const CompanionHistoryContent = (props: CompanionHistoryContentProps) => {
  const { isPhone, canEditCompanions } = props;
  if (isPhone && props.hasCompanionId) {
    return (
      <PhoneCompanionRecord
        companionId={props.companionId}
        activeCompanion={props.activeCompanion}
        title={props.title}
        companionAlerts={props.companionAlerts}
        clientAlerts={props.clientAlerts}
        canEdit={canEditCompanions}
        replaceCompanionText={props.replaceCompanionText}
        onBack={props.onBack}
        onEdit={props.onEditCompanion}
        onAddAppointment={props.onAddAppointment}
        onAddCompanionAlert={props.onAddCompanionAlert}
        onRemoveCompanionAlert={props.onRemoveCompanionAlert}
      />
    );
  }
  return <CompanionHistoryDesktopBody {...props} />;
};

type CompanionHistoryModalsProps = {
  addAppointmentOpen: boolean;
  setAddAppointmentOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAppointmentFilterState: (value: string | ((prev: string) => string)) => void;
  setAppointmentStatusState: (value: string | ((prev: string) => string)) => void;
  companionId: string;
  activeCompanion: CompanionParent | null;
  canEditCompanions: boolean;
  editCompanionOpen: boolean;
  setEditCompanionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  alertTarget: 'companion' | 'client' | null;
  setAlertTarget: React.Dispatch<React.SetStateAction<'companion' | 'client' | null>>;
  onAddAlert: (alert: Omit<CompanionAlert, 'id'>) => Promise<void>;
};

/**
 * The always-mounted overlays (add appointment, edit patient, add alert).
 * Extracted so their gating conditionals leave the page function's body.
 */
const CompanionHistoryModals = ({
  addAppointmentOpen,
  setAddAppointmentOpen,
  setAppointmentFilterState,
  setAppointmentStatusState,
  companionId,
  activeCompanion,
  canEditCompanions,
  editCompanionOpen,
  setEditCompanionOpen,
  alertTarget,
  setAlertTarget,
  onAddAlert,
}: CompanionHistoryModalsProps) => (
  <>
    <AddAppointmentCentralModal
      showModal={addAppointmentOpen}
      setShowModal={setAddAppointmentOpen}
      setActiveFilter={setAppointmentFilterState}
      setActiveStatus={setAppointmentStatusState}
      initialCompanionId={companionId || null}
    />

    {/* Reuses the Companions directory's editor so the overview edits the
        patient and client through the same validated mutations. */}
    {activeCompanion &&
      canEditCompanions &&
      (isCompanionRevampEnabled() ? (
        <AddCompanionCentralModal
          showModal={editCompanionOpen}
          setShowModal={setEditCompanionOpen}
          viewCompanion={activeCompanion}
          canEditCompanionStatus={canEditCompanions}
        />
      ) : (
        <CompanionInfo
          showModal={editCompanionOpen}
          setShowModal={setEditCompanionOpen}
          activeCompanion={activeCompanion}
          canEditCompanionStatus={canEditCompanions}
        />
      ))}

    <AddAlertModal
      open={alertTarget !== null}
      companionName={
        alertTarget === 'client'
          ? formatParentName(activeCompanion?.parent)
          : (activeCompanion?.companion.name ?? '')
      }
      subject={alertTarget === 'client' ? 'client' : 'companion'}
      onClose={() => setAlertTarget(null)}
      onAdd={onAddAlert}
    />
  </>
);

const CompanionHistoryPageInner = () => {
  useLoadCompanionsForPrimaryOrg();
  const companions = useCompanionsParentsForPrimaryOrg();
  const companionsStatus = useCompanionStore((s) => s.status);
  const isPhone = useIsPhone();
  const router = useRouter();
  const searchParams = useSearchParams();
  const replaceCompanionText = useCompanionTerminologyText();
  const { notify } = useNotify();
  const permissions = usePermissions();
  const canEditCompanions = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const [editCompanionOpen, setEditCompanionOpen] = useState(false);
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false);
  const appointmentFilterStateRef = useRef('all');
  const appointmentStatusStateRef = useRef('all');
  const setAppointmentFilterState = useCallback((value: string | ((prev: string) => string)) => {
    appointmentFilterStateRef.current = resolveRefUpdate(value, appointmentFilterStateRef.current);
  }, []);
  const setAppointmentStatusState = useCallback((value: string | ((prev: string) => string)) => {
    appointmentStatusStateRef.current = resolveRefUpdate(value, appointmentStatusStateRef.current);
  }, []);

  const companionId = String(searchParams.get('companionId') ?? '').trim();
  const source = String(searchParams.get('source') ?? '')
    .trim()
    .toLowerCase();
  const backTo = String(searchParams.get('backTo') ?? '').trim();
  const backPath = resolveSafeBackPath(backTo || null, source || null);
  const hasCompanionId = Boolean(companionId);

  const activeCompanion = useMemo(
    () => companions.find((item) => item.companion.id === companionId) ?? null,
    [companions, companionId]
  );
  const historyTitle = useMemo(
    () =>
      activeCompanion
        ? `${activeCompanion.companion.name.split(' ')[0]}'s overview`
        : replaceCompanionText('Companion overview'),
    [activeCompanion, replaceCompanionText]
  );
  const {
    alertTarget,
    setAlertTarget,
    companionAlerts,
    clientAlerts,
    handleAddAlert,
    handleRemoveCompanionAlert,
    handleRemoveClientAlert,
  } = useCompanionAlerts(activeCompanion, notify, replaceCompanionText);

  const handleBack = useCallback(() => {
    startRouteLoader();
    router.push(backPath);
  }, [router, backPath]);

  if (companionsStatus === 'loading') {
    return (
      <ProtectedRoute skeleton={PAGE_SKELETON}>
        <OrgGuard skeleton={PAGE_SKELETON}>{PAGE_SKELETON}</OrgGuard>
      </ProtectedRoute>
    );
  }

  const onEditCompanion = canEditCompanions ? () => setEditCompanionOpen(true) : undefined;

  return (
    <ProtectedRoute skeleton={PAGE_SKELETON}>
      <OrgGuard skeleton={PAGE_SKELETON}>
        <CompanionHistoryContent
          isPhone={isPhone}
          hasCompanionId={hasCompanionId}
          companionId={companionId}
          activeCompanion={activeCompanion}
          title={historyTitle}
          companionAlerts={companionAlerts}
          clientAlerts={clientAlerts}
          canEditCompanions={canEditCompanions}
          replaceCompanionText={replaceCompanionText}
          onBack={handleBack}
          onEditCompanion={onEditCompanion}
          onAddAppointment={() => setAddAppointmentOpen(true)}
          onAddCompanionAlert={() => setAlertTarget('companion')}
          onAddClientAlert={() => setAlertTarget('client')}
          onRemoveCompanionAlert={handleRemoveCompanionAlert}
          onRemoveClientAlert={handleRemoveClientAlert}
        />

        <CompanionHistoryModals
          addAppointmentOpen={addAppointmentOpen}
          setAddAppointmentOpen={setAddAppointmentOpen}
          setAppointmentFilterState={setAppointmentFilterState}
          setAppointmentStatusState={setAppointmentStatusState}
          companionId={companionId}
          activeCompanion={activeCompanion}
          canEditCompanions={canEditCompanions}
          editCompanionOpen={editCompanionOpen}
          setEditCompanionOpen={setEditCompanionOpen}
          alertTarget={alertTarget}
          setAlertTarget={setAlertTarget}
          onAddAlert={handleAddAlert}
        />
      </OrgGuard>
    </ProtectedRoute>
  );
};

const CompanionHistoryPage = () => (
  <Suspense fallback={PAGE_SKELETON}>
    <CompanionHistoryPageInner />
  </Suspense>
);

export default CompanionHistoryPage;
