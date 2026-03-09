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
import { useSearchStore } from '@/app/stores/searchStore';
import Filters from '@/app/ui/filters/Filters';
import {
  AppointmentFilters,
  AppointmentStatusFiltersUI,
} from '@/app/features/appointments/types/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { resolveDefaultAppointmentsView } from '@/app/lib/defaultAppointmentsView';

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
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [addPopup, setAddPopup] = useState(false);
  const [addAppointmentPrefill, setAddAppointmentPrefill] =
    useState<AppointmentDraftPrefill | null>(null);
  const [viewPopup, setViewPopup] = useState(false);
  const [viewIntent, setViewIntent] = useState<AppointmentViewIntent | null>(null);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
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

    const subLabel =
      subLabelRaw || (open === 'finance' ? 'summary' : open === 'labs' ? 'idexx-labs' : '');

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
    if (typeof window === 'undefined') return;

    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      const section = plannerSectionRef.current;
      if (!section) return;

      const currentY = window.scrollY;
      const isScrollingDown = currentY > lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      const rect = section.getBoundingClientRect();
      const shouldLockToSection =
        isScrollingDown &&
        rect.top <= 140 &&
        rect.top >= -220 &&
        rect.bottom > window.innerHeight * 0.55;

      if (shouldLockToSection && !plannerAutoLockRef.current) {
        plannerAutoLockRef.current = true;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (rect.top > 220) {
        plannerAutoLockRef.current = false;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeView]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return appointments.filter((item) => {
      const status = item.status?.toLowerCase();
      const filter = item.isEmergency && 'emergencies';

      const matchesStatus =
        activeView === 'board' ||
        statusWanted === 'all' ||
        status === statusWanted ||
        (statusWanted === 'requested' && status === 'no_payment');
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const matchesQuery = !q || item.companion.name?.toLowerCase().includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [appointments, activeStatus, activeFilter, query, activeView]);

  return (
    <div className="flex flex-col relative min-w-0">
      <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:pt-12! sm:pb-0!">
        <TitleCalendar
          activeCalendar={activeCalendar}
          title="Appointments"
          description="Schedule and manage appointments across day, week, and team views, then drill into tasks, chat, and billing details for each visit."
          setActiveCalendar={setActiveCalendar}
          setAddPopup={setAddPopup}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          count={appointments.length}
          activeView={activeView}
          setActiveView={setActiveView}
          showAdd={canEditAppointments}
        />

        <PermissionGate allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY]} fallback={<Fallback />}>
          <div className="w-full flex flex-col gap-3">
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
                  ? 'w-full'
                  : 'w-full h-[calc(100vh-248px)] min-h-[588px] max-h-[calc(100vh-248px)] lg:sticky lg:top-2 lg:mb-3 lg:h-[calc(100dvh-105px)] lg:min-h-[calc(100dvh-105px)] lg:max-h-[calc(100dvh-105px)]'
              }
            >
              {activeView === 'calendar' ? (
                <AppointmentCalendar
                  filteredList={filteredList}
                  allAppointments={appointments}
                  setActiveAppointment={setActiveAppointment}
                  setViewPopup={setViewPopup}
                  setViewIntent={setViewIntent}
                  setChangeStatusPopup={setChangeStatusPopup}
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
              ) : activeView === 'board' ? (
                <AppointmentBoard
                  appointments={filteredList}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  canEditAppointments={canEditAppointments}
                  setActiveAppointment={setActiveAppointment}
                  setViewPopup={setViewPopup}
                  setViewIntent={setViewIntent}
                  onAddAppointment={() => {
                    setAddAppointmentPrefill(null);
                    setAddPopup(true);
                  }}
                />
              ) : (
                <AppointmentsTable
                  filteredList={filteredList}
                  setActiveAppointment={setActiveAppointment}
                  setViewPopup={setViewPopup}
                  setViewIntent={setViewIntent}
                  setReschedulePopup={setReschedulePopup}
                  setChangeStatusPopup={setChangeStatusPopup}
                  canEditAppointments={canEditAppointments}
                />
              )}
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
