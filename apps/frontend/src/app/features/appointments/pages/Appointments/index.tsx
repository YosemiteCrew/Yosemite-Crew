'use client';
import React, { Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { redirect, useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import {
  buildWorkspaceHref,
  buildWorkspaceHrefForIntent,
  canEnterAppointmentWorkspace,
} from '@/app/lib/appointmentWorkspace';
import { startRouteLoader } from '@/app/lib/routeLoader';
const AddAppointmentCentralModal = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal')
);
const AppoitmentInfo = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo')
);
const ViewAppointmentOverviewModal = React.lazy(
  () =>
    import('@/app/features/appointments/pages/Appointments/Sections/ViewAppointmentOverviewModal')
);
import TitleCalendar from '@/app/ui/widgets/TitleCalendar';
import { startOfDay } from '@/app/features/appointments/components/Calendar/weekHelpers';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import {
  useAppointmentsForPrimaryOrg,
  useLoadAppointmentsForPrimaryOrg,
} from '@/app/hooks/useAppointments';
import {
  useCompanionsParentsForPrimaryOrg,
  useLoadCompanionsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { Appointment } from '@yosemite-crew/types';
const Reschedule = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/Reschedule')
);
const ChangeStatus = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/ChangeStatus')
);
const ChangeRoom = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/ChangeRoom')
);
const WaitlistPanel = React.lazy(
  () => import('@/app/features/appointments/components/Waitlist/WaitlistPanel')
);
import { useSearchStore } from '@/app/stores/searchStore';
import Filters from '@/app/ui/filters/Filters';
import {
  AppointmentFilters,
  AppointmentStatus,
  AppointmentStatusFiltersUI,
} from '@/app/features/appointments/types/appointments';
import {
  AppointmentViewIntent,
  AppointmentDraftPrefill,
} from '@/app/features/appointments/types/calendar';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { resolveDefaultAppointmentsView } from '@/app/lib/defaultAppointmentsView';
import { allowReschedule, normalizeAppointmentStatus } from '@/app/lib/appointments';
import { useNotify } from '@/app/hooks/useNotify';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  appointmentViewToLocal,
  normalizePmsPreferences,
} from '@/app/features/settings/utils/pmsPreferences';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import { usePhonePrimaryAction } from '@/app/ui/layout/PhoneShell/usePhonePrimaryAction';

const AppointmentsSkeleton = () => <PageSkeleton variant="planner" />;
const APPOINTMENTS_SKELETON = <AppointmentsSkeleton />;

const PlannerViewSkeleton = () => (
  <div className="h-full min-h-125 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const AppointmentsTable = dynamic(() => import('@/app/ui/tables/Appointments'), {
  loading: () => <PlannerViewSkeleton />,
});
const AppointmentCalendar = dynamic(
  () => import('@/app/features/appointments/components/Calendar/AppointmentCalendar'),
  { loading: () => <PlannerViewSkeleton /> }
);
const AppointmentBoard = dynamic(
  () => import('@/app/features/appointments/components/AppointmentBoard'),
  { loading: () => <PlannerViewSkeleton /> }
);

const AppointmentWorkspaceRedirect = ({ href }: { href: string }) => {
  redirect(href);
};

// Preload all three view chunks immediately so switching views is instant.
const preloadDynamic = (c: unknown) => (c as { preload?: () => void }).preload?.();
preloadDynamic(AppointmentsTable);
preloadDynamic(AppointmentCalendar);
preloadDynamic(AppointmentBoard);

const normalizeLeadId = (value?: string | null): string => {
  const lastSegment = String(value ?? '')
    .trim()
    .split('/')
    .pop();
  /* v8 ignore next -- String().split('/') always yields a non-empty array, so pop() is never undefined */
  return lastSegment?.toLowerCase() ?? '';
};

const getNextSelectedAppointment = (
  current: Appointment | null,
  appointments: Appointment[]
): Appointment | null => {
  if (appointments.length === 0) return null;
  if (current?.id) {
    const updated = appointments.find((appointment) => appointment.id === current.id);
    if (updated) return updated;
  }
  return appointments[0];
};

const LABEL_BY_SUB_LABEL: Record<string, AppointmentViewIntent['label']> = {
  appointment: 'info',
  companion: 'info',
  history: 'info',
  summary: 'finance',
  'payment-details': 'finance',
  'idexx-labs': 'labs',
  'parent-chat': 'tasks',
  task: 'tasks',
  'parent-task': 'tasks',
  forms: 'prescription',
  documents: 'prescription',
  'audit-trail': 'prescription',
  subjective: 'prescription',
  objective: 'prescription',
  assessment: 'prescription',
  plan: 'prescription',
  'discharge-summary': 'prescription',
  'merck-manuals': 'prescription',
};

const PRIMARY_OPEN_LABELS = new Set(['info', 'details', 'tasks', 'prescription', 'care']);

const resolveInitialIntent = (
  open: string,
  normalizedSubLabel: string
): AppointmentViewIntent | null => {
  if (open === 'labs') {
    return { label: 'labs', subLabel: normalizedSubLabel || 'idexx-labs' };
  }
  if (open === 'finance') {
    return { label: 'finance', subLabel: normalizedSubLabel || 'summary' };
  }
  if (PRIMARY_OPEN_LABELS.has(open)) {
    const fallbackSubLabel = open === 'info' || open === 'details' ? 'appointment' : '';
    return {
      label: (open === 'details' ? 'info' : open) as AppointmentViewIntent['label'],
      subLabel: normalizedSubLabel || fallbackSubLabel || undefined,
    };
  }
  if (normalizedSubLabel && LABEL_BY_SUB_LABEL[normalizedSubLabel]) {
    return { label: LABEL_BY_SUB_LABEL[normalizedSubLabel], subLabel: normalizedSubLabel };
  }
  return null;
};

// Runs `onChange` during render on the commit where `value` first differs from
// its previous value — the null-sentinel derived-state pattern, factored out so
// each call site stays a single statement rather than an inline prev-compare.
const useOnValueChange = <T,>(value: T, onChange: () => void): void => {
  const [prev, setPrev] = useState<{ value: T } | undefined>(undefined);
  if (prev?.value !== value) {
    setPrev({ value });
    onChange();
  }
};

type StoredCompanionMeta = {
  photoUrl: string;
  parentFirstName: string;
  parentLastName: string;
  parentFullName: string;
  parentId: string;
  gender: unknown;
  dateOfBirth: unknown;
  isneutered: unknown;
};

const mergeCompanionMeta = (
  appointment: Appointment,
  companionMeta: StoredCompanionMeta | undefined
): Appointment => {
  const { companion } = appointment;
  if (!companionMeta || !companion) return appointment;
  const existingPhotoUrl = (companion as Appointment['companion'] & { photoUrl?: string }).photoUrl;
  const existingParent = (companion.parent ?? {}) as {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
  const isSamePhoto = (existingPhotoUrl?.trim() || '') === companionMeta.photoUrl;
  const isSameParent =
    (existingParent.id || '') === companionMeta.parentId &&
    (existingParent.firstName || '') === companionMeta.parentFirstName &&
    (existingParent.lastName || '') === companionMeta.parentLastName &&
    (existingParent.name || '') === companionMeta.parentFullName;
  if (isSamePhoto && isSameParent) return appointment;
  return {
    ...appointment,
    companion: {
      ...companion,
      photoUrl: companionMeta.photoUrl,
      gender: companionMeta.gender,
      dateOfBirth: companionMeta.dateOfBirth,
      isneutered: companionMeta.isneutered,
      parent: {
        ...existingParent,
        id: companionMeta.parentId || existingParent.id || '',
        firstName: companionMeta.parentFirstName,
        lastName: companionMeta.parentLastName,
        name: companionMeta.parentFullName || existingParent.name || '',
      },
    } as Appointment['companion'],
  };
};

const useEnrichedAppointments = (): Appointment[] => {
  useLoadAppointmentsForPrimaryOrg();
  const rawAppointments = useAppointmentsForPrimaryOrg();
  useLoadCompanionsForPrimaryOrg();
  const companions = useCompanionsParentsForPrimaryOrg();

  const companionMetaById = useMemo(() => {
    const entries = companions.map((item) => {
      const photoUrl = item.companion.photoUrl?.trim() || '';
      const parentFirstName = item.parent.firstName?.trim() || '';
      const parentLastName = item.parent.lastName?.trim() || '';
      const parentFullName = [parentFirstName, parentLastName].filter(Boolean).join(' ').trim();
      return [
        item.companion.id,
        {
          photoUrl,
          parentFirstName,
          parentLastName,
          parentFullName,
          parentId: item.parent.id,
          gender: item.companion.gender,
          dateOfBirth: item.companion.dateOfBirth,
          isneutered: item.companion.isneutered,
        },
      ] as const;
    });
    return new Map(entries);
  }, [companions]);

  return useMemo(
    () =>
      rawAppointments.map((appointment) =>
        mergeCompanionMeta(appointment, companionMetaById.get(appointment.companion?.id ?? ''))
      ),
    [rawAppointments, companionMetaById]
  );
};

const useCurrentUserLeadId = (): string => {
  const team = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );

  return useMemo(() => {
    const normalizedCurrentUser = normalizeLeadId(authUserId);
    if (!normalizedCurrentUser) return '';
    const member = team.find(
      (item) =>
        normalizeLeadId(item.practionerId) === normalizedCurrentUser ||
        normalizeLeadId(item._id) === normalizedCurrentUser
    );
    return normalizeLeadId(member?.practionerId || member?._id);
  }, [authUserId, team]);
};

const resolveDeepLinkState = (
  searchParams: ReturnType<typeof useSearchParams>,
  appointments: Appointment[],
  handledDeepLink: string | null
) => {
  const appointmentId = String(searchParams.get('appointmentId') ?? '').trim();
  if (!appointmentId) return null;

  const open = String(searchParams.get('open') ?? '')
    .trim()
    .toLowerCase();
  const subLabelRaw = String(searchParams.get('subLabel') ?? '')
    .trim()
    .toLowerCase();
  const normalizedSubLabel = subLabelRaw === 'overview' ? 'history' : subLabelRaw;
  const initialIntent = resolveInitialIntent(open, normalizedSubLabel);
  const resolvedSubLabel = initialIntent?.subLabel ?? normalizedSubLabel;
  const deepLinkKey = `${appointmentId}:${open || 'details'}:${resolvedSubLabel}`;
  if (handledDeepLink === deepLinkKey) return null;

  const target = appointments.find((appointment) => appointment.id === appointmentId);
  return target ? { appointmentId, deepLinkKey, initialIntent, target } : null;
};

const useAppointmentsView = () => {
  const router = useRouter();
  const { notify } = useNotify();
  const appointments = useEnrichedAppointments();
  const permissions = usePermissions();
  const canEditAny = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const canEditOwn = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_OWN);
  const canEditAppointments = canEditAny || canEditOwn;

  const currentUserLeadId = useCurrentUserLeadId();

  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const [handledDeepLink, setHandledDeepLink] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [addPopup, setAddPopup] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [addAppointmentPrefill, setAddAppointmentPrefill] =
    useState<AppointmentDraftPrefill | null>(null);
  const [viewPopup, setViewPopup] = useState(false);
  const [viewIntent, setViewIntent] = useState<AppointmentViewIntent | null>(null);
  const [deepLinkWorkspaceHref, setDeepLinkWorkspaceHref] = useState<string | null>(null);
  const [detailPopup, setDetailPopup] = useState(false);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
  const [changeStatusPreferredStatus, setChangeStatusPreferredStatus] =
    useState<AppointmentStatus | null>(null);
  const [changeRoomPopup, setChangeRoomPopup] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(
    appointments[0] ?? null
  );
  const canEditActiveAppointment = useMemo(() => {
    if (!canEditOwn && !canEditAny) return false;
    if (canEditAny) return true;
    if (!activeAppointment) return false;
    return normalizeLeadId(activeAppointment.lead?.id) === currentUserLeadId;
  }, [canEditAny, canEditOwn, activeAppointment, currentUserLeadId]);

  const profile = usePrimaryOrgProfile();
  const primaryOrgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );

  const [activeCalendar, setActiveCalendar] = useState('team');
  const handleActiveCalendarChange: React.Dispatch<React.SetStateAction<string>> = (
    nextCalendar
  ) => {
    startTransition(() => {
      setActiveCalendar(nextCalendar);
    });
  };

  const [activeView, setActiveView] = useState<string>(resolveDefaultAppointmentsView);
  const handleActiveViewChange: React.Dispatch<React.SetStateAction<string>> = (next) => {
    startTransition(() => {
      setActiveView(next);
    });
  };
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfDay(currentDate));
  const { plannerSectionRef } = usePlannerAutoLock({
    activeView,
    topOffset: activeView === 'list' ? 72 : 16,
  });

  const viewInitializedFromProfileRef = useRef(false);
  useEffect(() => {
    if (viewInitializedFromProfileRef.current || !profile) return;
    const prefs = normalizePmsPreferences(profile.personalDetails?.pmsPreferences, primaryOrgType);
    const profileView = appointmentViewToLocal(prefs.appointmentView);
    setActiveView(profileView);
    viewInitializedFromProfileRef.current = true;
  }, [profile, primaryOrgType]);

  // Derive weekStart from currentDate whenever the team-week calendar is active.
  // Render-time prev-comparison (see the null-sentinel note above) instead of an
  // effect, so the derived value is correct on the same commit as the change.
  const weekKey = `${activeCalendar}:${currentDate.getTime()}`;
  useOnValueChange(weekKey, () => {
    const nextWeekStart = activeCalendar === 'week' ? startOfDay(currentDate) : weekStart;
    if (nextWeekStart.getTime() !== weekStart.getTime()) {
      setWeekStart(nextWeekStart);
    }
  });

  // Clear the deep-link view intent once both popups are closed.
  useOnValueChange(`${viewPopup}:${detailPopup}`, () => {
    if (!viewPopup && !detailPopup) {
      setViewIntent(null);
    }
  });

  // Clear the preferred status once the change-status popup closes.
  useOnValueChange(changeStatusPopup, () => {
    if (!changeStatusPopup) {
      setChangeStatusPreferredStatus(null);
    }
  });

  useOnValueChange(appointments, () => {
    setActiveAppointment((prev) => getNextSelectedAppointment(prev, appointments));
  });

  // Render-phase adjustment: open the deep-linked appointment once per
  // deep-link key; a new searchParams instance (fresh navigation) re-arms it.
  useOnValueChange(searchParams, () => {
    setHandledDeepLink(null);
  });
  {
    const deepLink = resolveDeepLinkState(searchParams, appointments, handledDeepLink);
    if (deepLink) {
      setHandledDeepLink(deepLink.deepLinkKey);
      setActiveAppointment(deepLink.target);
      setViewIntent(deepLink.initialIntent);
      const workspaceHref = canEnterAppointmentWorkspace(deepLink.target.status)
        ? buildWorkspaceHrefForIntent(deepLink.appointmentId, deepLink.initialIntent)
        : null;
      setDeepLinkWorkspaceHref(workspaceHref);
      if (!workspaceHref) setViewPopup(true);
    }
  }

  const hasEmergency = useMemo(() => {
    const now = new Date();
    return appointments.some(
      (a) =>
        a.isEmergency &&
        a.startTime > now &&
        a.status !== 'CANCELLED' &&
        a.status !== 'COMPLETED' &&
        a.status !== 'NO_SHOW'
    );
  }, [appointments]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return appointments.filter((item) => {
      const status = normalizeAppointmentStatus(item.status)?.toLowerCase();
      const filter = item.isEmergency && 'emergencies';
      const companion = item.companion ?? item.patient;

      const matchesStatus =
        activeView === 'board' || statusWanted === 'all' || status === statusWanted;
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const companionDisplayName = formatCompanionNameWithOwnerLastName(
        companion.name,
        companion.parent,
        ''
      ).toLowerCase();
      const matchesQuery = !q || companionDisplayName.includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [appointments, activeStatus, activeFilter, query, activeView]);
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView,
    listWrapperClassName:
      'w-full flex flex-col gap-3 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName:
      'w-full h-[calc(100vh-236px)] min-h-[500px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
  });

  const openAddAppointment = () => {
    setAddAppointmentPrefill(null);
    setAddPopup(true);
  };

  // The phone shell's FAB has no reference to this page's create flow; opt in so
  // "New appointment" opens the same modal the desktop button does.
  usePhonePrimaryAction('appointment', openAddAppointment);

  const openWorkspace = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    if (!appointment.id) return;
    if (!canEnterAppointmentWorkspace(appointment.status)) {
      setActiveAppointment(appointment);
      setViewIntent(intent ?? null);
      setViewPopup(true);
      return;
    }
    startRouteLoader();
    router.push(buildWorkspaceHrefForIntent(appointment.id, intent));
  };

  let plannerContent: React.ReactNode;
  if (activeView === 'calendar') {
    plannerContent = (
      <AppointmentCalendar
        filteredList={filteredList.filter((a) => a.status !== 'CANCELLED')}
        allAppointments={appointments}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setDetailPopup={setDetailPopup}
        setViewIntent={setViewIntent}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setChangeRoomPopup={setChangeRoomPopup}
        onOpenWorkspace={openWorkspace}
        activeCalendar={activeCalendar}
        setActiveCalendar={handleActiveCalendarChange}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments={canEditAppointments}
        onCreateFromCalendarSlot={(prefill) => {
          setAddAppointmentPrefill(prefill);
          setAddPopup(true);
        }}
        onAddAppointment={openAddAppointment}
        filterOptions={AppointmentFilters}
        statusOptions={AppointmentStatusFiltersUI}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        activeStatus={activeStatus}
        setActiveStatus={setActiveStatus}
        hasEmergency={hasEmergency}
      />
    );
  } else if (activeView === 'board') {
    plannerContent = (
      <AppointmentBoard
        appointments={filteredList}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        canEditAppointments={canEditAppointments}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setDetailPopup={setDetailPopup}
        setViewIntent={setViewIntent}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setReschedulePopup={setReschedulePopup}
        setChangeRoomPopup={setChangeRoomPopup}
        onAddAppointment={openAddAppointment}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        hasEmergency={hasEmergency}
      />
    );
  } else {
    plannerContent = (
      <div className="h-full min-h-0 overflow-hidden">
        <AppointmentsTable
          filteredList={filteredList}
          setActiveAppointment={setActiveAppointment}
          setViewPopup={setViewPopup}
          setDetailPopup={setDetailPopup}
          setViewIntent={setViewIntent}
          setReschedulePopup={setReschedulePopup}
          setChangeStatusPopup={setChangeStatusPopup}
          setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
          setChangeRoomPopup={setChangeRoomPopup}
          canEditAppointments={canEditAppointments}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col relative min-w-0">
      {deepLinkWorkspaceHref && <AppointmentWorkspaceRedirect href={deepLinkWorkspaceHref} />}
      <div className="yc-page-content">
        <TitleCalendar
          title="Appointments"
          description="Schedule and manage appointments across day, week, and team views"
          setAddPopup={setAddPopup}
          count={appointments.length}
          activeView={activeView}
          setActiveView={handleActiveViewChange}
          showAdd={false}
        />
        <MobileSearchBar placeholder="Search appointments" />

        <PermissionGate
          allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]}
          deniedResource="Appointments"
          deniedDetail="the appointment schedule"
        >
          <section aria-labelledby="appointments-waitlist-heading" className="mb-3">
            <button
              type="button"
              onClick={() => setShowWaitlist((open) => !open)}
              aria-expanded={showWaitlist}
              aria-controls="appointments-waitlist-panel"
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-4 py-2.5 text-left shadow-[0_1px_2px_var(--sh03)] transition-colors hover:bg-[var(--inset)]"
            >
              <span
                id="appointments-waitlist-heading"
                className="text-[13.5px] font-bold text-[var(--ink)]"
              >
                Waitlist
              </span>
              <span className="text-[12px] font-semibold text-[var(--ink-muted)]">
                {showWaitlist ? 'Hide' : 'Show'}
              </span>
            </button>
            {showWaitlist && (
              <div id="appointments-waitlist-panel" className="mt-3">
                <React.Suspense fallback={<PlannerViewSkeleton />}>
                  <WaitlistPanel />
                </React.Suspense>
              </div>
            )}
          </section>
          <div className={wrapperClassName}>
            {activeView === 'list' && (
              <Filters
                filterOptions={AppointmentFilters}
                statusOptions={AppointmentStatusFiltersUI}
                activeFilter={activeFilter}
                activeStatus={activeStatus}
                setActiveFilter={setActiveFilter}
                setActiveStatus={setActiveStatus}
                hasEmergency={hasEmergency}
                showAddButton={canEditAppointments}
                onAddButtonClick={openAddAppointment}
              />
            )}
            <div ref={plannerSectionRef} className={plannerSectionClassName}>
              {plannerContent}
            </div>
          </div>

          <React.Suspense fallback={null}>
            <AddAppointmentCentralModal
              showModal={addPopup}
              setShowModal={setAddPopup}
              setActiveFilter={setActiveFilter}
              setActiveStatus={setActiveStatus}
              prefill={addAppointmentPrefill}
              onPrefillConsumed={() => setAddAppointmentPrefill(null)}
            />
            {activeAppointment && (
              <ViewAppointmentOverviewModal
                showModal={viewPopup}
                setShowModal={setViewPopup}
                activeAppointment={activeAppointment}
                canEditAppointments={canEditActiveAppointment}
                onOpenDetails={(appointment, intent) => {
                  setActiveAppointment(appointment);
                  setViewIntent(intent ?? null);
                  setViewPopup(false);
                  if (appointment.id) {
                    startRouteLoader();
                    router.push(buildWorkspaceHref(appointment.id));
                  }
                }}
              />
            )}
            {activeAppointment && (
              <AppoitmentInfo
                showModal={detailPopup}
                setShowModal={setDetailPopup}
                activeAppointment={activeAppointment}
                initialViewIntent={viewIntent}
                canEditAppointments={canEditActiveAppointment}
                onReschedule={(appointment) => {
                  setActiveAppointment(appointment);
                  setDetailPopup(false);
                  if (!allowReschedule(appointment.status as any)) {
                    notify('warning', {
                      title: 'Reschedule blocked',
                      text: 'Checked-in, in-progress, completed, cancelled, and no-show appointments cannot be rescheduled.',
                    });
                    return;
                  }
                  setReschedulePopup(true);
                }}
              />
            )}
            {canEditAppointments && activeAppointment && (
              <Reschedule
                showModal={reschedulePopup}
                setShowModal={setReschedulePopup}
                activeAppointment={activeAppointment}
              />
            )}
            {canEditAppointments && activeAppointment && (
              <ChangeStatus
                showModal={changeStatusPopup}
                setShowModal={setChangeStatusPopup}
                activeAppointment={activeAppointment}
                preferredStatus={changeStatusPreferredStatus}
              />
            )}
            {canEditAppointments && activeAppointment && (
              <ChangeRoom
                showModal={changeRoomPopup}
                setShowModal={setChangeRoomPopup}
                activeAppointment={activeAppointment}
              />
            )}
          </React.Suspense>
        </PermissionGate>
      </div>
    </div>
  );
};

const Appointments = () => useAppointmentsView();

const ProtectedAppoitments = () => {
  return (
    <ProtectedRoute skeleton={APPOINTMENTS_SKELETON}>
      <OrgGuard skeleton={APPOINTMENTS_SKELETON}>
        <Suspense fallback={<AppointmentsSkeleton />}>
          <Appointments />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedAppoitments;
