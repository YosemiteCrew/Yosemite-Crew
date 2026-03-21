'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import AppointmentsTable from '@/app/ui/tables/Appointments';
import AddAppointment from '@/app/features/appointments/pages/Appointments/Sections/AddAppointment';
import AppoitmentInfo from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import TitleCalendar from '@/app/ui/widgets/TitleCalendar';
import AppointmentCalendar from '@/app/features/appointments/components/Calendar/AppointmentCalendar';
import AppointmentBoard from '@/app/features/appointments/components/AppointmentBoard';
import { startOfDay } from '@/app/features/appointments/components/Calendar/weekHelpers';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { Appointment } from '@yosemite-crew/types';
import Reschedule from '@/app/features/appointments/pages/Appointments/Sections/Reschedule';
import ChangeStatus from '@/app/features/appointments/pages/Appointments/Sections/ChangeStatus';
import ChangeRoom from '@/app/features/appointments/pages/Appointments/Sections/ChangeRoom';
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
import { normalizeAppointmentStatus, type LegacyAppointmentStatus } from '@/app/lib/appointments';

const Appointments = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditAppointments =
    can(PERMISSIONS.APPOINTMENTS_EDIT_ANY) || can(PERMISSIONS.APPOINTMENTS_EDIT_OWN);
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const plannerSectionRef = useRef<HTMLDivElement | null>(null);
  const plannerAutoLockRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const plannerLockTopOffset = 16;
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
  const [activeCalendar, setActiveCalendar] = useState('team');
  const [activeView, setActiveView] = useState<string>(resolveDefaultAppointmentsView);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(startOfDay(currentDate));

  useEffect(() => {
    if (activeCalendar === 'week') {
      setWeekStart(startOfDay(currentDate));
    }
  }, [currentDate, activeCalendar]);

  useEffect(() => {
    if (!viewPopup) {
      setViewIntent(null);
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
    const subLabelRaw = String(searchParams.get('subLabel') ?? '').trim();
    if (!appointmentId) return;

    let subLabel = subLabelRaw;
    if (!subLabel) {
      if (open === 'finance') {
        subLabel = 'summary';
      } else if (open === 'labs') {
        subLabel = 'idexx-labs';
      }
    }

    const deepLinkKey = `${appointmentId}:${open || 'details'}:${subLabel}`;
    if (handledDeepLinkRef.current === deepLinkKey) return;

    const target = appointments.find((appointment) => appointment.id === appointmentId);
    if (!target) return;

    setActiveAppointment(target);
    if (open === 'labs') {
      setViewIntent({ label: 'labs', subLabel });
    } else if (open === 'finance') {
      setViewIntent({ label: 'finance', subLabel: subLabel || 'summary' });
    } else {
      setViewIntent(null);
    }
    setViewPopup(true);
    handledDeepLinkRef.current = deepLinkKey;
  }, [appointments, searchParams]);

  useEffect(() => {
    if (activeView === 'list') return;
    if (globalThis.window === undefined) return;

    lastScrollYRef.current = globalThis.window.scrollY;

    const onScroll = () => {
      const section = plannerSectionRef.current;
      if (!section) return;

      const currentY = globalThis.window.scrollY;
      const isScrollingDown = currentY > lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      const rect = section.getBoundingClientRect();
      const shouldLockToSection =
        isScrollingDown &&
        rect.top <= 130 &&
        rect.top >= -180 &&
        rect.bottom > globalThis.window.innerHeight * 0.55;

      if (shouldLockToSection && !plannerAutoLockRef.current) {
        plannerAutoLockRef.current = true;
        globalThis.window.scrollTo({
          top: globalThis.window.scrollY + rect.top - plannerLockTopOffset,
          behavior: 'smooth',
        });
        return;
      }

      if (rect.top > 220) {
        plannerAutoLockRef.current = false;
      }
    };

    globalThis.window.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.window.removeEventListener('scroll', onScroll);
  }, [activeView, plannerLockTopOffset]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return appointments.filter((item) => {
      const status = normalizeAppointmentStatus(
        item.status as LegacyAppointmentStatus
      )?.toLowerCase();
      const filter = item.isEmergency && 'emergencies';

      const matchesStatus =
        activeView === 'board' || statusWanted === 'all' || status === statusWanted;
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const matchesQuery = !q || item.companion.name?.toLowerCase().includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [appointments, activeStatus, activeFilter, query, activeView]);

  let plannerContent: React.ReactNode;
  if (activeView === 'calendar') {
    plannerContent = (
      <AppointmentCalendar
        filteredList={filteredList}
        allAppointments={appointments}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setViewIntent={setViewIntent}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setChangeRoomPopup={setChangeRoomPopup}
        activeCalendar={activeCalendar}
        setActiveCalendar={setActiveCalendar}
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
        onAddAppointment={() => {
          setAddAppointmentPrefill(null);
          setAddPopup(true);
        }}
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
        onAddAppointment={() => {
          setAddAppointmentPrefill(null);
          setAddPopup(true);
        }}
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
      <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-3!">
        <TitleCalendar
          title="Appointments"
          description="Schedule and manage appointments across day, week, and team views, then drill into tasks, chat, and billing details for each visit."
          setAddPopup={setAddPopup}
          count={appointments.length}
          activeView={activeView}
          setActiveView={setActiveView}
          showAdd={canEditAppointments}
        />

        <PermissionGate allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]} fallback={<Fallback />}>
          <div
            className={
              activeView === 'list'
                ? 'w-full flex flex-col gap-3 h-[calc(100vh-248px)] min-h-[588px] max-h-[calc(100vh-248px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-105px)] lg:min-h-[calc(100dvh-105px)] lg:max-h-[calc(100dvh-105px)]'
                : 'w-full flex flex-col gap-3'
            }
          >
            {activeView !== 'board' && (
              <Filters
                filterOptions={AppointmentFilters}
                statusOptions={AppointmentStatusFiltersUI}
                activeFilter={activeFilter}
                activeStatus={activeStatus}
                setActiveFilter={setActiveFilter}
                setActiveStatus={setActiveStatus}
              />
            )}
            <div
              ref={plannerSectionRef}
              className={
                activeView === 'list'
                  ? 'w-full flex-1 min-h-0 overflow-hidden'
                  : 'w-full h-[calc(100vh-248px)] min-h-[588px] max-h-[calc(100vh-248px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-105px)] lg:min-h-[calc(100dvh-105px)] lg:max-h-[calc(100dvh-105px)]'
              }
            >
              {plannerContent}
            </div>
          </div>

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
              canEditAppointments={canEditAppointments}
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
        </PermissionGate>
      </div>
    </div>
  );
};

const ProtectedAppoitments = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Appointments />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedAppoitments;
