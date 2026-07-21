'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { Appointment } from '@yosemite-crew/types';

import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import { getInitials } from '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils';
import { useLoadTasksForPrimaryOrg, useTasksAssignedToUser } from '@/app/hooks/useTask';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import { buildPreferredTimeZoneDayInstant, getPreferredTimeZone } from '@/app/lib/timezone';
import { useNotify } from '@/app/hooks/useNotify';
import type { Task } from '@/app/features/tasks/types/task';
import type { AppointmentDraftPrefill } from '@/app/features/appointments/types/calendar';

import PhoneDayRail from './PhoneDayRail';
import { DEFAULT_DAY_RAIL_WINDOW } from './dayRailLayout';
import PhoneDayStrip from './PhoneDayStrip';
import PhoneWeekOverview from './PhoneWeekOverview';
import PhoneMonthOverview from './PhoneMonthOverview';
import PhoneMyDayRail from './PhoneMyDayRail';
import type { DayRailFold } from './dayRailLayout';
import type { PhoneMonthCell } from './phoneMonthModel';
import type { MyDayView } from './myDayRail';

/**
 * The Day | Week | Month switcher is phone-only. The shared `activeCalendar`
 * union has no 'month', and widening it would ripple into the desktop Header,
 * DayCalendar/WeekCalendar/UserCalendar and every caller — so 'month' stays a
 * phone-local view state and is simply not pushed back up.
 */
export type PhoneClinicView = 'day' | 'week' | 'month';

const CLINIC_VIEW_OPTIONS: ReadonlyArray<SegmentedPillOption<PhoneClinicView>> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * PhoneMyDayRail owns this toggle on its own screen, but the Day/Week/Month
 * views carry no equivalent — without it here a phone user could leave My day
 * and never get back, since the desktop Header is not rendered below 768px.
 */
const MODE_OPTIONS: ReadonlyArray<SegmentedPillOption<MyDayView>> = [
  { value: 'clinic', label: 'Clinic' },
  { value: 'my-day', label: 'My day' },
];

const MY_DAY_CALENDAR = 'team';

export type PhoneCalendarProps = {
  /** Appointments already filtered by the page's search/status/type filters. */
  appointments: Appointment[];
  /** `appointments` narrowed to `currentDate` in the preferred time zone. */
  dayEvents: Appointment[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  activeCalendar: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  /** The page's "open this appointment" flow. */
  onSelectAppointment: (appointment: Appointment) => void;
  onOpenWorkspace?: (appointment: Appointment) => void;
  onCreateFromCalendarSlot?: (prefill: AppointmentDraftPrefill) => void;
  canEditAppointments: boolean;
  /** Practitioner id of the signed-in user; drives the "My day" filter. */
  currentUserPractitionerId: string;
  /** Injectable for deterministic tests. Defaults to now. */
  now?: Date;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  // Anchor at local noon in the preferred timezone so the key round-trips through
  // getDateKeyInPreferredTimeZone for every zone - a UTC-noon anchor lands on the next day
  // for zones 12+ hours ahead of UTC (e.g. Pacific/Auckland).
  return buildPreferredTimeZoneDayInstant(year, month, day);
};

const minutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

/** `activeCalendar` is a page-level string; map it onto the phone's two axes. */
const seedClinicView = (activeCalendar: string): PhoneClinicView =>
  activeCalendar === 'week' ? 'week' : 'day';

const seedMode = (activeCalendar: string): MyDayView =>
  activeCalendar === MY_DAY_CALENDAR ? 'my-day' : 'clinic';

const formatContextLabel = (date: Date, name: string): string => {
  // Pin the zone to the same preferred timezone the rest of the calendar reads
  // (isOnPreferredTimeZoneCalendarDay), so this label cannot name a different
  // day to the rail it sits above, and cannot drift between server and browser.
  const day = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: getPreferredTimeZone(),
  });
  return name ? `${day} · ${name}` : day;
};

/**
 * Phone rendering of the appointments calendar (< 768px only).
 *
 * A time grid cannot shrink to a phone, so each view gets its own shape: the day
 * becomes a proportional rail with empty hours folded, the week a load list, the
 * month a dot map, and "My day" threads the signed-in user's appointments and
 * tasks onto one rail. Tablet and desktop keep the real grids untouched.
 */
const PhoneCalendar = ({
  appointments,
  dayEvents,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  activeCalendar,
  setActiveCalendar,
  onSelectAppointment,
  onOpenWorkspace,
  onCreateFromCalendarSlot,
  canEditAppointments,
  currentUserPractitionerId,
  now,
}: PhoneCalendarProps) => {
  const { notify } = useNotify();
  const [clinicView, setClinicView] = useState<PhoneClinicView>(() =>
    seedClinicView(activeCalendar)
  );
  const [mode, setMode] = useState<MyDayView>(() => seedMode(activeCalendar));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfLocalDay(currentDate));

  useLoadTasksForPrimaryOrg();
  const myTasks = useTasksAssignedToUser(currentUserPractitionerId);
  const team = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();

  const referenceNow = useMemo(() => now ?? new Date(), [now]);

  const currentUserName = useMemo(
    () =>
      team.find((member) => member.practionerId === currentUserPractitionerId)?.name?.trim() ?? '',
    [team, currentUserPractitionerId]
  );

  const companionNameById = useMemo(
    () => Object.fromEntries(companions.map((companion) => [companion.id, companion.name])),
    [companions]
  );

  const myAppointments = useMemo(
    () =>
      currentUserPractitionerId
        ? dayEvents.filter((appointment) => appointment.lead?.id === currentUserPractitionerId)
        : dayEvents,
    [dayEvents, currentUserPractitionerId]
  );

  // The rail defaults to the 08:00-16:00 clinic day, but appointments booked
  // outside those hours would silently drop off it (the count and the rail would
  // disagree). Expand the window to cover any out-of-hours appointment.
  const dayWindow = useMemo(() => {
    let startHour = DEFAULT_DAY_RAIL_WINDOW.startHour;
    let endHour = DEFAULT_DAY_RAIL_WINDOW.endHour;
    dayEvents.forEach((appointment) => {
      const startDate = new Date(appointment.startTime);
      const endDate = new Date(appointment.endTime);
      const start = minutesOfDay(startDate);
      const rawEnd = minutesOfDay(endDate);
      // Overnight appointments (the end rolls past midnight) run to end-of-day on
      // this rail, matching dayRailLayout; a zero/negative span keeps a 1h block.
      let end = start + 60;
      if (rawEnd > start) end = rawEnd;
      else if (endDate.getTime() > startDate.getTime()) end = 24 * 60;
      startHour = Math.min(startHour, Math.floor(start / 60));
      endHour = Math.max(endHour, Math.ceil(end / 60));
    });
    return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
  }, [dayEvents]);

  // Only 'day' and 'week' exist on the shared union — 'month' stays phone-local.
  const applyClinicView = useCallback(
    (next: PhoneClinicView) => {
      setClinicView(next);
      setMode('clinic');
      if (next !== 'month') setActiveCalendar?.(next);
    },
    [setActiveCalendar]
  );

  const handleModeChange = useCallback(
    (next: MyDayView) => {
      setMode(next);
      if (next === 'my-day') {
        setActiveCalendar?.(MY_DAY_CALENDAR);
        return;
      }
      if (clinicView !== 'month') setActiveCalendar?.(clinicView);
    },
    [clinicView, setActiveCalendar]
  );

  const openDay = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      applyClinicView('day');
    },
    [setCurrentDate, applyClinicView]
  );

  const handleBookFold = useCallback(
    (fold: DayRailFold) => {
      // Pass currentDate straight through (the booking path reads its day in the PREFERRED
      // timezone via buildDateInPreferredTimeZone). Do NOT re-project through startOfLocalDay,
      // whose device-local getters shift the day when the preferred zone is ahead of the device
      // (e.g. opening 7 Jul in Pacific/Auckland from a US/Pacific browser prefilled 6 Jul).
      onCreateFromCalendarSlot?.({
        date: currentDate,
        minuteOfDay: fold.startMinutes,
      });
    },
    [onCreateFromCalendarSlot, currentDate]
  );

  const handleToggleTask = useCallback(
    (task: Task) => {
      const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      void changeTaskStatus({ ...task, status: nextStatus }).catch(() => {
        notify('warning', {
          title: 'Task not updated',
          text: 'Unable to update this task. Please try again.',
        });
      });
    },
    [notify]
  );

  if (mode === 'my-day') {
    return (
      <PhoneMyDayRail
        now={referenceNow}
        contextLabel={formatContextLabel(referenceNow, currentUserName)}
        userInitials={getInitials(currentUserName)}
        view="my-day"
        appointments={myAppointments}
        tasks={myTasks}
        // Ward rounds have no model, type or endpoint in this codebase yet, so
        // there is nothing to load. An empty list renders no round rows and no
        // Rounds chip, rather than a fake "0 due" affordance.
        rounds={[]}
        companionNameById={companionNameById}
        onViewChange={handleModeChange}
        onOpenWorkspace={onOpenWorkspace}
        onSelectAppointment={onSelectAppointment}
        onToggleTask={handleToggleTask}
      />
    );
  }

  const modePill = (
    <div className="flex flex-none justify-end pb-2">
      <SegmentedPill
        options={MODE_OPTIONS}
        value="clinic"
        onChange={handleModeChange}
        ariaLabel="Clinic or my day"
      />
    </div>
  );

  if (clinicView === 'week') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
        {modePill}
        <PhoneWeekOverview
          weekStart={weekStart}
          appointments={appointments}
          selectedDate={currentDate}
          view="week"
          onViewChange={applyClinicView}
          onSelectDay={openDay}
          onPreviousWeek={() => setWeekStart(addDays(weekStart, -7))}
          onNextWeek={() => setWeekStart(addDays(weekStart, 7))}
        />
      </div>
    );
  }

  if (clinicView === 'month') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
        {modePill}
        <PhoneMonthOverview
          monthDate={monthAnchor}
          appointments={appointments}
          today={referenceNow}
          selectedDate={currentDate}
          view="month"
          onViewChange={applyClinicView}
          onMonthChange={setMonthAnchor}
          onSelectDay={(cell: PhoneMonthCell) => setCurrentDate(cell.date)}
          onOpenDay={(dateKey: string) => openDay(parseDateKey(dateKey))}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      {modePill}
      <div className="flex flex-none items-end justify-between">
        <div className="flex flex-col gap-px">
          <h2 className="m-0 font-newsreader text-2xl font-normal tracking-[-0.015em] text-[var(--ink)]">
            Schedule
          </h2>
          <span className="text-xs text-[var(--ink-muted)]">
            {`${formatContextLabel(currentDate, currentUserName)} · ${dayEvents.length} booked`}
          </span>
        </div>
        <SegmentedPill
          options={CLINIC_VIEW_OPTIONS}
          value={clinicView}
          onChange={applyClinicView}
          ariaLabel="Calendar view"
        />
      </div>
      {/* The frame gives the phone day view its own date strip rather than a
          shrunken week header, so the week stays one tap away from the rail. */}
      <PhoneDayStrip
        weekStart={weekStart}
        appointments={appointments}
        selectedDate={currentDate}
        today={referenceNow}
        onSelectDay={setCurrentDate}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <PhoneDayRail
          appointments={dayEvents}
          dayWindow={dayWindow}
          nowMinutes={minutesOfDay(referenceNow)}
          onSelectAppointment={onSelectAppointment}
          onStartVisit={onOpenWorkspace}
          onBookFold={canEditAppointments && onCreateFromCalendarSlot ? handleBookFold : undefined}
          className="min-h-125"
        />
      </div>
    </div>
  );
};

export default PhoneCalendar;
