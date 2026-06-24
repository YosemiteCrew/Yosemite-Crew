'use client';

import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { IoIosArrowBack } from 'react-icons/io';
import { LuCheck, LuPlus } from 'react-icons/lu';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import {
  useCompanionsParentsForPrimaryOrg,
  useLoadCompanionsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { useCompanionStore } from '@/app/stores/companionStore';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { buildCompanionDetails } from '@/app/lib/companionWorkspaceDetails';
import { formatDisplayDate, getAgeInYears } from '@/app/lib/date';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import AddAlertModal from '@/app/features/appointments/pages/AppointmentWorkspace/components/AddAlertModal';
import type { CompanionAlert } from '@/app/features/appointments/types/workspace';
import {
  companionAlertsToStoredAlerts,
  storedAlertsToCompanionAlerts,
} from '@/app/features/appointments/lib/alertMapping';
import AddAppointmentCentralModal from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal';
import { updateCompanion, updateParent } from '@/app/features/companions/services/companionService';
import { Primary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useNotify } from '@/app/hooks/useNotify';
import type {
  CompanionParent,
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
    return candidate;
  }
  if (source === 'appointments') {
    return APPOINTMENTS_BACK_PATH;
  }
  return FALLBACK_BACK_PATH;
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
  const age = getAgeInYears(value);
  const dob = formatDisplayDate(value, '-');
  if (!Number.isFinite(age) || age < 0) return dob;
  const ageLabel = `${age} ${age === 1 ? 'year' : 'years'}`;
  return dob === '-' ? ageLabel : `${ageLabel} / ${dob}`;
};

const ProfileDetail = ({
  label,
  value,
  wrapValue = false,
}: {
  label: string;
  value: string;
  wrapValue?: boolean;
}) => (
  <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
    <span className="text-yc-12-r-neutral text-text-secondary">{label}:</span>
    <span
      className={wrapValue ? 'break-words text-yc-12-b-neutral' : 'truncate text-yc-12-b-neutral'}
    >
      {value}
    </span>
  </div>
);

const CompanionProfilePanel = ({ record }: { record: CompanionParent }) => {
  const details = buildCompanionDetails(
    {
      id: record.companion.id,
      name: record.companion.name,
      species: record.companion.type,
      breed: record.companion.breed,
    },
    record.companion
  );
  const selectedDetails = [
    details.find((detail) => detail.label === 'Name'),
    details.find((detail) => detail.label === 'Patient ID'),
    details.find((detail) => detail.label === 'Breed/Species'),
    details.find((detail) => detail.label === 'Age / DOB'),
    details.find((detail) => detail.label === 'Sex'),
    details.find((detail) => detail.label === 'Weight'),
    details.find((detail) => detail.label === 'Blood Group'),
    details.find((detail) => detail.label === 'Microchip ID'),
    details.find((detail) => detail.label === 'Allergies'),
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <section
      aria-label="Companion profile"
      className="flex min-h-36 flex-col gap-4 rounded-2xl border border-card-border bg-neutral-0 p-4 shadow-[0_1px_10px_0_rgba(169,163,158,0.10)] md:flex-row md:items-start"
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
      <div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-3 lg:grid-cols-2">
        {selectedDetails.map((detail, index) => (
          <ProfileDetail
            key={`${detail.label}-${index}`}
            label={detail.label}
            value={detail.value}
          />
        ))}
      </div>
    </section>
  );
};

const ParentProfilePanel = ({
  parent,
  companionId,
  alerts,
  onAddAlert,
  onRemoveAlert,
}: {
  parent: StoredParent;
  companionId: string;
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
      className="flex min-h-36 flex-col gap-3 rounded-2xl border border-card-border bg-neutral-0 p-4 shadow-[0_1px_10px_0_rgba(169,163,158,0.10)] md:flex-row md:items-start"
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
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-10 gap-y-3">
          {details.map((detail) => (
            <ProfileDetail key={detail.label} label={detail.label} value={detail.value} wrapValue />
          ))}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-3xl bg-[#15803D] px-3 py-1 text-caption-1 font-medium text-neutral-0">
            Dues cleared
            <LuCheck size={13} aria-hidden="true" />
          </span>
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
                className="flex size-6 items-center justify-center rounded-full border border-neutral-500 text-neutral-700 transition-colors hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <LuPlus size={14} aria-hidden="true" />
              </button>
            </GlassTooltip>
          </div>
        </div>
      </div>
    </section>
  );
};

const CompanionHistoryPageInner = () => {
  useLoadCompanionsForPrimaryOrg();
  const companions = useCompanionsParentsForPrimaryOrg();
  const companionsStatus = useCompanionStore((s) => s.status);
  const router = useRouter();
  const searchParams = useSearchParams();
  const replaceCompanionText = useCompanionTerminologyText();
  const { notify } = useNotify();
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false);
  const appointmentFilterStateRef = useRef('all');
  const appointmentStatusStateRef = useRef('all');
  const setAppointmentFilterState = useCallback((value: string | ((prev: string) => string)) => {
    appointmentFilterStateRef.current =
      typeof value === 'function' ? value(appointmentFilterStateRef.current) : value;
  }, []);
  const setAppointmentStatusState = useCallback((value: string | ((prev: string) => string)) => {
    appointmentStatusStateRef.current =
      typeof value === 'function' ? value(appointmentStatusStateRef.current) : value;
  }, []);
  const [alertTarget, setAlertTarget] = useState<'companion' | 'client' | null>(null);

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
        ? `${activeCompanion.companion.name.split(' ')[0]}'s Overview`
        : replaceCompanionText('Companion Overview'),
    [activeCompanion, replaceCompanionText]
  );
  const companionAlerts = useMemo<CompanionAlert[]>(
    () => storedAlertsToCompanionAlerts(activeCompanion?.companion.alerts, 'patient-alert'),
    [activeCompanion?.companion.alerts]
  );
  const clientAlerts = useMemo<CompanionAlert[]>(
    () => storedAlertsToCompanionAlerts(activeCompanion?.parent.alerts, 'client-alert'),
    [activeCompanion?.parent.alerts]
  );

  const handleBack = useCallback(() => {
    startRouteLoader();
    router.push(backPath);
  }, [router, backPath]);

  const persistCompanionAlerts = useCallback(
    async (nextAlerts: CompanionAlert[]) => {
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
        notify('success', { title: 'Alert removed', text: 'Patient alert has been removed.' });
      } catch {
        notify('error', { title: 'Failed to remove alert', text: 'Please try again.' });
      }
    },
    [companionAlerts, notify, persistCompanionAlerts]
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

  if (companionsStatus === 'loading') {
    return (
      <ProtectedRoute skeleton={PAGE_SKELETON}>
        <OrgGuard skeleton={PAGE_SKELETON}>{PAGE_SKELETON}</OrgGuard>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute skeleton={PAGE_SKELETON}>
      <OrgGuard skeleton={PAGE_SKELETON}>
        <div className="flex w-full flex-col gap-6 px-4 py-5 md:px-8">
          <div
            className="-mx-4 -mt-5 flex flex-col gap-6 px-4 pt-5 pb-5 md:-mx-8 md:px-8"
            style={{ background: 'var(--Neutrals-Neutral-100, #FAF8F6)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-label="Go back"
                  onClick={handleBack}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                >
                  <IoIosArrowBack size={22} aria-hidden="true" />
                </button>
                <h1 className="text-heading-2 text-text-primary">{historyTitle}</h1>
                <div className="flex flex-wrap items-center gap-1.5">
                  {companionAlerts.map((alert) => (
                    <AlertPill
                      key={alert.id}
                      id={alert.id}
                      label={alert.label}
                      severity={alert.severity}
                      onRemove={handleRemoveCompanionAlert}
                    />
                  ))}
                  {activeCompanion ? (
                    <GlassTooltip content="Add alerts for patient" side="bottom">
                      <button
                        type="button"
                        aria-label="Add companion alert"
                        onClick={() => setAlertTarget('companion')}
                        className="flex size-6 items-center justify-center rounded-full border border-neutral-500 text-neutral-700 transition-colors hover:border-text-brand hover:text-text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
                      >
                        <LuPlus size={14} aria-hidden="true" />
                      </button>
                    </GlassTooltip>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Primary
                  icon={<LuPlus size={18} aria-hidden="true" />}
                  text="Add appointment"
                  onClick={() => setAddAppointmentOpen(true)}
                />
              </div>
            </div>

            {activeCompanion ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
                <CompanionProfilePanel record={activeCompanion} />
                <ParentProfilePanel
                  parent={activeCompanion.parent}
                  companionId={activeCompanion.companion.id}
                  alerts={clientAlerts}
                  onAddAlert={() => setAlertTarget('client')}
                  onRemoveAlert={handleRemoveClientAlert}
                />
              </div>
            ) : null}

            {hasCompanionId ? null : (
              <div className="rounded-2xl border border-card-border bg-white px-4 py-6 text-body-3 text-text-secondary">
                Companion id is missing. Please open overview from Appointments or Companions.
              </div>
            )}
          </div>

          {hasCompanionId ? (
            <CompanionHistoryTimeline companionId={companionId} showDocumentUpload />
          ) : null}

          <AddAppointmentCentralModal
            showModal={addAppointmentOpen}
            setShowModal={setAddAppointmentOpen}
            setActiveFilter={setAppointmentFilterState}
            setActiveStatus={setAppointmentStatusState}
            initialCompanionId={companionId || null}
          />

          <AddAlertModal
            open={alertTarget !== null}
            companionName={
              alertTarget === 'client'
                ? formatParentName(activeCompanion?.parent)
                : (activeCompanion?.companion.name ?? '')
            }
            subject={alertTarget === 'client' ? 'client' : 'companion'}
            onClose={() => setAlertTarget(null)}
            onAdd={handleAddAlert}
          />
        </div>
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
