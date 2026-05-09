'use client';
import React, { Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
const AddAppointment = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/AddAppointment')
);
const AppoitmentInfo = React.lazy(
  () => import('@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo')
);
import TitleCalendar from '@/app/ui/widgets/TitleCalendar';
import { startOfDay } from '@/app/features/appointments/components/Calendar/weekHelpers';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
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
import Fallback from '@/app/ui/overlays/Fallback';
import { resolveDefaultAppointmentsView } from '@/app/lib/defaultAppointmentsView';
import { normalizeAppointmentStatus } from '@/app/lib/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  appointmentViewToLocal,
  normalizePmsPreferences,
} from '@/app/features/settings/utils/pmsPreferences';

const AppointmentsSkeleton = () => <PageSkeleton variant="planner" />;

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

const Appointments = () => {
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
        },
      ] as const;
    });
    return new Map(entries);
  }, [companions]);
  const appointments = useMemo(
    () =>
      rawAppointments.map((appointment) => {
        const companionMeta = companionMetaById.get(appointment.companion.id);
        if (!companionMeta) return appointment;
        const existingPhotoUrl = (
          appointment.companion as Appointment['companion'] & { photoUrl?: string }
        ).photoUrl;
        const existingParent = (appointment.companion.parent ?? {}) as {
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
            ...appointment.companion,
            photoUrl: companionMeta.photoUrl,
            parent: {
              ...existingParent,
              id: companionMeta.parentId || existingParent.id || '',
              firstName: companionMeta.parentFirstName,
              lastName: companionMeta.parentLastName,
              name: companionMeta.parentFullName || existingParent.name || '',
            },
          } as Appointment['companion'],
        };
      }),
    [rawAppointments, companionMetaById]
  );
  const { can } = usePermissions();
  const canEditAny = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const canEditOwn = can(PERMISSIONS.APPOINTMENTS_EDIT_OWN);
  const canEditAppointments = canEditAny || canEditOwn;

  const team = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const normalizeLeadId = (value?: string | null) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';
  const currentUserLeadId = useMemo(() => {
    const normalizedCurrentUser = normalizeLeadId(authUserId);
    if (!normalizedCurrentUser) return '';
    const member = team.find(
      (item) =>
        normalizeLeadId(item.practionerId) === normalizedCurrentUser ||
        normalizeLeadId(item._id) === normalizedCurrentUser
    );
    return normalizeLeadId(member?.practionerId || member?._id);
  }, [authUserId, team]);

  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [addPopup, setAddPopup] = useState(false);
  const [addAppointmentPrefill, setAddAppointmentPrefill] =
    useState<AppointmentDraftPrefill | null>(null);
  const [viewPopup, setViewPopup] = useState(false);
  const [viewIntent, setViewIntent] = useState<AppointmentViewIntent | null>(null);
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
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(startOfDay(currentDate));
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

  useEffect(() => {
    if (activeCalendar !== 'week') return;
    const nextWeekStart = startOfDay(currentDate);
    setWeekStart((previous) =>
      previous.getTime() === nextWeekStart.getTime() ? previous : nextWeekStart
    );
  }, [currentDate, activeCalendar]);

  useEffect(() => {
    if (!viewPopup) {
      setViewIntent(null);
      handledDeepLinkRef.current = null;
    }
  }, [viewPopup]);

  useEffect(() => {
    if (!changeStatusPopup) {
      setChangeStatusPreferredStatus(null);
    }
  }, [changeStatusPopup]);

  useEffect(() => {
    setActiveAppointment((prev) => {
      if (appointments.length === 0) return null;
      if (prev?.id) {
        const updated = appointments.find((s) => s.id === prev.id);
        if (updated) return updated;
      }
      return appointments[0];
    });
  }, [appointments]);

  useEffect(() => {
    const appointmentId = String(searchParams.get('appointmentId') ?? '').trim();
    const open = String(searchParams.get('open') ?? '')
      .trim()
      .toLowerCase();
    const subLabelRaw = String(searchParams.get('subLabel') ?? '')
      .trim()
      .toLowerCase();
    if (!appointmentId) return;

    const normalizedSubLabel = subLabelRaw === 'overview' ? 'history' : subLabelRaw;
    const labelBySubLabel: Record<string, AppointmentViewIntent['label']> = {
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

    let initialIntent: AppointmentViewIntent | null = null;
    if (open === 'labs') {
      initialIntent = { label: 'labs', subLabel: normalizedSubLabel || 'idexx-labs' };
    } else if (open === 'finance') {
      initialIntent = { label: 'finance', subLabel: normalizedSubLabel || 'summary' };
    } else if (
      open === 'info' ||
      open === 'details' ||
      open === 'tasks' ||
      open === 'prescription' ||
      open === 'care'
    ) {
      const fallbackSubLabel = open === 'info' || open === 'details' ? 'appointment' : '';
      initialIntent = {
        label: (open === 'details' ? 'info' : open) as AppointmentViewIntent['label'],
        subLabel: normalizedSubLabel || fallbackSubLabel || undefined,
      };
    } else if (normalizedSubLabel && labelBySubLabel[normalizedSubLabel]) {
      initialIntent = { label: labelBySubLabel[normalizedSubLabel], subLabel: normalizedSubLabel };
    }

    const resolvedSubLabel = initialIntent?.subLabel ?? normalizedSubLabel;

    const deepLinkKey = `${appointmentId}:${open || 'details'}:${resolvedSubLabel}`;
    if (handledDeepLinkRef.current === deepLinkKey) return;

    const target = appointments.find((appointment) => appointment.id === appointmentId);
    if (!target) return;

    setActiveAppointment(target);
    setViewIntent(initialIntent);
    setViewPopup(true);
    handledDeepLinkRef.current = deepLinkKey;
  }, [appointments, searchParams]);

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

      const matchesStatus =
        activeView === 'board' || statusWanted === 'all' || status === statusWanted;
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const companionDisplayName = formatCompanionNameWithOwnerLastName(
        item.companion.name,
        item.companion.parent,
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

  let plannerContent: React.ReactNode;
  if (activeView === 'calendar') {
    plannerContent = (
      <AppointmentCalendar
        filteredList={filteredList.filter((a) => a.status !== 'CANCELLED')}
        allAppointments={appointments}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setViewIntent={setViewIntent}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setChangeRoomPopup={setChangeRoomPopup}
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
      <div className="flex flex-col gap-3 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-4! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-4! lg:pb-3!">
        <TitleCalendar
          title="Appointments"
          description="Schedule and manage appointments across day, week, and team views, then drill into tasks, chat, and billing details for each visit."
          setAddPopup={setAddPopup}
          count={appointments.length}
          activeView={activeView}
          setActiveView={setActiveView}
          showAdd={false}
        />

        <PermissionGate allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]} fallback={<Fallback />}>
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
            <AddAppointment
              showModal={addPopup}
              setShowModal={setAddPopup}
              setActiveFilter={setActiveFilter}
              setActiveStatus={setActiveStatus}
              prefill={addAppointmentPrefill}
              onPrefillConsumed={() => setAddAppointmentPrefill(null)}
            />
            {activeAppointment && (
              <AppoitmentInfo
                showModal={viewPopup}
                setShowModal={setViewPopup}
                activeAppointment={activeAppointment}
                initialViewIntent={viewIntent}
                canEditAppointments={canEditActiveAppointment}
                onReschedule={(appointment) => {
                  setActiveAppointment(appointment);
                  setViewPopup(false);
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

const ProtectedAppoitments = () => {
  return (
    <ProtectedRoute skeleton={<AppointmentsSkeleton />}>
      <OrgGuard skeleton={<AppointmentsSkeleton />}>
        <Suspense fallback={<AppointmentsSkeleton />}>
          <Appointments />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedAppoitments;
