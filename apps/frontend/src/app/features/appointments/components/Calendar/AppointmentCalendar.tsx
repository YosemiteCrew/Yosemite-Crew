import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import DayCalendar from '@/app/features/appointments/components/Calendar/common/DayCalendar';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import WeekCalendar from '@/app/features/appointments/components/Calendar/common/WeekCalendar';
import { Appointment } from '@yosemite-crew/types';
import UserCalendar from '@/app/features/appointments/components/Calendar/common/UserCalendar';
import {
  AppointmentViewIntent,
  AppointmentDraftPrefill,
} from '@/app/features/appointments/types/calendar';
import { allowCalendarDrag, canAssignAppointmentRoom } from '@/app/lib/appointments';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { AppointmentStatus, Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  buildDateInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';
import { CalendarZoomMode } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useLoadAvailabilities } from '@/app/hooks/useAvailabiities';
import { useNotify } from '@/app/hooks/useNotify';
import {
  DropAvailabilityInterval,
  filterAppointmentsForWeek,
  resolveAvailabilityIntervalsForDay,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { logger } from '@/app/lib/logger';
type AppointmentCalendarProps = {
  filteredList: Appointment[];
  allAppointments: Appointment[];
  setActiveAppointment?: (inventory: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  setDetailPopup?: (open: boolean) => void;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<AppointmentStatus | null>>;
  setChangeRoomPopup?: (open: boolean) => void;
  onOpenWorkspace?: (appointment: Appointment, intent?: AppointmentViewIntent) => void;
  activeCalendar: string;
  setActiveCalendar?: React.Dispatch<React.SetStateAction<string>>;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
  canEditAppointments: boolean;
  onCreateFromCalendarSlot?: (prefill: AppointmentDraftPrefill) => void;
  onAddAppointment?: () => void;
  activeFilter?: string;
  setActiveFilter?: (v: string) => void;
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
  hasEmergency?: boolean;
  filterOptions?: { key: string; name: string }[];
  statusOptions?: { key: string; name: string; bg?: string; text?: string; border?: string }[];
};

type DragContext = {
  appointmentId: string;
  serviceId?: string;
  durationMinutes: number;
};

type DragState = {
  appointmentId: string | null;
  label: string | null;
  error: string | null;
  context: DragContext | null;
  availabilityVersion: number;
};

type DragAction =
  | { type: 'start'; appointmentId: string | null; label: string; context: DragContext }
  | { type: 'end' }
  | { type: 'setError'; error: string | null }
  | { type: 'availabilityRefreshed' };

const initialDragState: DragState = {
  appointmentId: null,
  label: null,
  error: null,
  context: null,
  availabilityVersion: 0,
};

const dragReducer = (state: DragState, action: DragAction): DragState => {
  switch (action.type) {
    case 'start':
      return {
        appointmentId: action.appointmentId,
        label: action.label,
        error: null,
        context: action.context,
        availabilityVersion: state.availabilityVersion + 1,
      };
    case 'end':
      return {
        ...state,
        appointmentId: null,
        label: null,
        context: null,
      };
    case 'setError':
      return {
        ...state,
        error: action.error,
      };
    case 'availabilityRefreshed':
      return {
        ...state,
        availabilityVersion: state.availabilityVersion + 1,
      };
    default:
      return state;
  }
};

const snapToStep = (minutes: number, step = 5) => Math.round(minutes / step) * step;
const clampMinutes = (minutes: number) => Math.max(0, Math.min(24 * 60 - 5, snapToStep(minutes)));
const toLocalDayKey = (date: Date) =>
  formatDateInPreferredTimeZone(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
const getDayOfWeekKey = (date: Date) =>
  formatDateInPreferredTimeZone(date, { weekday: 'long' }).toUpperCase();
const toLocalClockFromUtcTime = (utcTime: string) => utcClockTimeToPreferredTimeZoneClock(utcTime);

const getErrorMessageFromCandidate = (
  candidate: { response?: { data?: unknown } } | { data?: unknown } | { message?: string },
  fallback: string
) => {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const getTrimmedMessage = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const getResponseMessage = (value: unknown) => {
    const data = asRecord(value);
    if (!data) return getTrimmedMessage(value);
    return (
      getTrimmedMessage(data.message) ||
      getTrimmedMessage(data.error) ||
      getTrimmedMessage(data.details)
    );
  };

  const candidateRecord = asRecord(candidate);
  const responseRecord = asRecord(candidateRecord?.response);
  const responseData = responseRecord?.data;
  const candidateMessage = candidateRecord?.message;

  return getResponseMessage(responseData) || getTrimmedMessage(candidateMessage) || fallback;
};

const getAppointmentDurationMinutes = (appointment: Appointment) =>
  Math.max(
    5,
    Math.round(
      (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000
    )
  );

const getAppointmentDragLabel = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(
    appointment.companion?.name,
    appointment.companion?.parent,
    'Appointment'
  );

const hasAppointmentConflict = (
  moved: Appointment,
  nextStart: Date,
  nextEnd: Date,
  sourceAppointments: Appointment[],
  targetLeadId?: string
) => {
  return sourceAppointments.some((existing) => {
    if (!existing.id || existing.id === moved.id) return false;
    if (existing.status === 'CANCELLED' || existing.status === 'NO_SHOW') return false;
    const existingStart = new Date(existing.startTime);
    const existingEnd = new Date(existing.endTime);
    const overlaps =
      nextStart.getTime() < existingEnd.getTime() && nextEnd.getTime() > existingStart.getTime();
    if (!overlaps) return false;

    const movedLead = targetLeadId || moved.lead?.id;
    const existingLead = existing.lead?.id;
    const leadConflict = !!movedLead && movedLead === existingLead;

    const movedRoom = moved.room?.id;
    const existingRoom = existing.room?.id;
    const roomConflict = !!movedRoom && movedRoom === existingRoom;

    return leadConflict || roomConflict;
  });
};

const AppointmentCalendar = ({
  filteredList,
  allAppointments,
  setActiveAppointment,
  setViewPopup,
  setDetailPopup,
  setViewIntent,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setChangeRoomPopup,
  onOpenWorkspace,
  activeCalendar,
  setActiveCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  setReschedulePopup,
  canEditAppointments,
  onCreateFromCalendarSlot,
  onAddAppointment,
  activeFilter,
  setActiveFilter,
  activeStatus,
  setActiveStatus,
  hasEmergency,
  filterOptions,
  statusOptions,
}: AppointmentCalendarProps) => {
  const { notify } = useNotify();
  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    return getErrorMessageFromCandidate(
      error as { response?: { data?: unknown } } | { data?: unknown } | { message?: string },
      fallback
    );
  }, []);

  const [dragState, dispatchDrag] = useReducer(dragReducer, initialDragState);
  const dragContextRef = useRef<DragContext | null>(null);
  const draggedAppointmentId = dragState.appointmentId;
  const draggedAppointmentLabel = dragState.label;
  const dragError = dragState.error;
  const dragContext = dragState.context;
  const availabilityVersion = dragState.availabilityVersion;
  const [suppressAutoScroll, setSuppressAutoScroll] = useState(false);
  const suppressAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markDropped = useCallback(() => {
    if (suppressAutoScrollTimerRef.current) clearTimeout(suppressAutoScrollTimerRef.current);
    setSuppressAutoScroll(true);
    suppressAutoScrollTimerRef.current = setTimeout(() => setSuppressAutoScroll(false), 4000);
  }, []);
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
  const slotsCacheRef = useRef<Partial<Record<string, Slot[]>>>({});
  const dragAvailabilityCacheRef = useRef<Partial<Record<string, number[]>>>({});
  const dragAvailabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const teamAvailabilityFetchedRef = useRef<string | null>(null);
  const teams = useTeamForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const availabilityLoaded = availabilityStatus === 'loaded';
  useLoadAvailabilities();

  useEffect(() => {
    if (activeCalendar === 'team' && primaryOrgId) {
      const fetchKey = primaryOrgId;
      if (teamAvailabilityFetchedRef.current === fetchKey) return;
      teamAvailabilityFetchedRef.current = fetchKey;
      loadTeamAvailability(primaryOrgId).catch(() => {
        teamAvailabilityFetchedRef.current = null;
      });
    }
  }, [activeCalendar, primaryOrgId]);

  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const normalizeId = useCallback(
    (value?: string) =>
      String(value ?? '')
        .trim()
        .split('/')
        .pop()
        ?.toLowerCase() ?? '',
    []
  );
  const isAppointmentDraggable = useCallback(
    (appointment: Appointment) =>
      !!appointment.id && canEditAppointments && allowCalendarDrag(appointment.status),
    [canEditAppointments]
  );

  const hasConflict = hasAppointmentConflict;

  const resolvePractitionerId = useCallback(
    (candidateId?: string) => {
      if (!candidateId) return undefined;
      const normalizedCandidate = normalizeId(candidateId);
      const match = teams.find(
        (member) =>
          normalizeId(member.practionerId || '') === normalizedCandidate ||
          normalizeId(member._id || '') === normalizedCandidate
      );
      return match?.practionerId || candidateId;
    },
    [normalizeId, teams]
  );

  const getCurrentUserPractitionerId = useCallback(() => {
    const normalizedCurrentUser = normalizeId(authUserId);
    if (!normalizedCurrentUser) return undefined;
    const member = teams.find(
      (team) =>
        normalizeId(team.practionerId) === normalizedCurrentUser ||
        normalizeId(team._id) === normalizedCurrentUser ||
        normalizeId((team as any).userId) === normalizedCurrentUser ||
        normalizeId((team as any).id) === normalizedCurrentUser ||
        normalizeId((team as any).userOrganisation?.userId) === normalizedCurrentUser
    );
    return member?.practionerId || member?._id;
  }, [authUserId, normalizeId, teams]);

  const supportsSpeciality = useCallback(
    (targetLeadId: string, appointment: Appointment) => {
      const normalizedTarget = normalizeId(targetLeadId);
      const target = teams.find(
        (member) =>
          normalizeId(member.practionerId || '') === normalizedTarget ||
          normalizeId(member._id || '') === normalizedTarget
      );
      if (!target) return false;
      const appointmentSpeciality = appointment.appointmentType?.speciality;
      if (!appointmentSpeciality) return true;
      if (!Array.isArray(target.speciality) || target.speciality.length === 0) return true;
      const expectedId = String((appointmentSpeciality as any).id ?? '').toLowerCase();
      const expectedName = String((appointmentSpeciality as any).name ?? '').toLowerCase();
      return target.speciality.some((spec: any) => {
        const id = String(spec?._id ?? spec?.id ?? '').toLowerCase();
        const name = String(spec?.name ?? spec ?? '').toLowerCase();
        return (expectedId && id === expectedId) || (expectedName && name === expectedName);
      });
    },
    [normalizeId, teams]
  );

  const getSlotsForMoveValidation = useCallback(async (serviceId: string, date: Date) => {
    const cacheKey = `${serviceId}:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;
    if (slotsCacheRef.current[cacheKey]) {
      return slotsCacheRef.current[cacheKey];
    }
    const slots = await getSlotsForServiceAndDateForPrimaryOrg(serviceId, date);
    slotsCacheRef.current[cacheKey] = slots;
    return slots;
  }, []);

  const buildAppointmentStartFromCalendarMinutes = useCallback(
    (date: Date, minuteOfDay: number) => {
      const clampedMinute = Math.max(0, Math.min(24 * 60 - 5, Math.round(minuteOfDay / 5) * 5));
      return buildDateInPreferredTimeZone(date, clampedMinute);
    },
    []
  );

  const moveAppointment = async (
    date: Date,
    minutesSinceMidnight: number,
    targetLeadId?: string
  ) => {
    const warnDrag = (message: string) => {
      dispatchDrag({ type: 'setError', error: message });
      notify('warning', { title: 'Move blocked', text: message });
    };

    if (!draggedAppointmentId) return;
    const appointment = allAppointments.find((item) => item.id === draggedAppointmentId);
    if (!appointment) {
      warnDrag('Unable to move this appointment.');
      return;
    }
    if (!isAppointmentDraggable(appointment)) {
      warnDrag('Only requested and upcoming appointments can be moved.');
      return;
    }

    const snappedMinutes = clampMinutes(minutesSinceMidnight);
    const nextStart = buildAppointmentStartFromCalendarMinutes(date, snappedMinutes);
    const durationMs = Math.max(
      5 * 60 * 1000,
      new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()
    );
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const appointmentServiceId = appointment.appointmentType?.id;
    const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);

    if (nextStart.getTime() < Date.now()) {
      warnDrag('Cannot move an appointment to a past time.');
      return;
    }
    if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) {
      warnDrag('Selected team member is not configured for this speciality.');
      return;
    }
    if (appointmentServiceId && targetPractitionerId) {
      const availableStartMinutes = await ensureDragAvailability(date, targetLeadId);
      if (availableStartMinutes.length === 0 || !availableStartMinutes.includes(snappedMinutes)) {
        warnDrag('No available slot for this service at the selected position.');
        return;
      }
    }
    if (hasConflict(appointment, nextStart, nextEnd, allAppointments, targetPractitionerId)) {
      warnDrag('Scheduling conflict detected with another appointment.');
      return;
    }

    try {
      dispatchDrag({ type: 'setError', error: null });
      await updateAppointment({
        ...appointment,
        lead: targetPractitionerId
          ? {
              id: targetPractitionerId,
              name:
                teams.find(
                  (member) =>
                    normalizeId(member.practionerId || '') === normalizeId(targetPractitionerId) ||
                    normalizeId(member._id || '') === normalizeId(targetPractitionerId)
                )?.name ||
                appointment.lead?.name ||
                targetPractitionerId,
            }
          : appointment.lead,
        startTime: nextStart,
        endTime: nextEnd,
        appointmentDate: nextStart,
      });
    } catch (error) {
      dispatchDrag({
        type: 'setError',
        error: getErrorMessage(error, 'Unable to update appointment. Please try again.'),
      });
    }
  };

  const getAvailabilityKey = useCallback(
    (date: Date, targetLeadId?: string) => {
      const dayKey = toLocalDayKey(date);
      const activeDragContext = dragContextRef.current;
      const appointment = activeDragContext
        ? allAppointments.find((item) => item.id === activeDragContext.appointmentId)
        : null;
      const defaultLeadId = appointment?.lead?.id;
      const practitionerId = resolvePractitionerId(targetLeadId || defaultLeadId);
      return `${dayKey}:${normalizeId(practitionerId || '')}`;
    },
    [allAppointments, normalizeId, resolvePractitionerId]
  );

  const getViewAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] => {
      if (!primaryOrgId) return [];
      const dayKey = getDayOfWeekKey(date);
      const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
      const orgAvailabilities = ids.flatMap((id) => {
        const availability = availabilitiesById[id];
        return availability ? [availability] : [];
      });
      if (!orgAvailabilities.length) return [];

      const normalizedTarget = normalizeId(targetLeadId);
      const matchedTargetMember = normalizedTarget
        ? teams.find(
            (member) =>
              normalizeId(member.practionerId) === normalizedTarget ||
              normalizeId(member._id) === normalizedTarget ||
              normalizeId((member as any).userId) === normalizedTarget ||
              normalizeId((member as any).id) === normalizedTarget ||
              normalizeId((member as any).userOrganisation?.userId) === normalizedTarget
          )
        : null;
      const targetIds = normalizedTarget
        ? new Set(
            [
              normalizedTarget,
              normalizeId(matchedTargetMember?.practionerId),
              normalizeId(matchedTargetMember?._id),
              normalizeId((matchedTargetMember as any)?.userId),
              normalizeId((matchedTargetMember as any)?.id),
              normalizeId((matchedTargetMember as any)?.userOrganisation?.userId),
            ].filter(Boolean)
          )
        : undefined;

      return resolveAvailabilityIntervalsForDay({
        allEntries: orgAvailabilities,
        dayKey,
        targetIds,
        normalizeId,
        toLocalClockFromUtcTime: utcClockTimeToPreferredTimeZoneClock,
      });
    },
    [availabilityIdsByOrgId, availabilitiesById, normalizeId, primaryOrgId, teams]
  );

  const getCurrentUserViewAvailabilityIntervals = useCallback(
    (date: Date): DropAvailabilityInterval[] =>
      getViewAvailabilityIntervals(date, getCurrentUserPractitionerId() || authUserId),
    [authUserId, getCurrentUserPractitionerId, getViewAvailabilityIntervals]
  );

  const collectValidMinutesForSlot = useCallback(
    (
      slot: Slot,
      params: {
        date: Date;
        appointment: Appointment;
        normalizedTargetPractitionerId: string;
        targetPractitionerId: string;
        durationMinutes: number;
        durationMs: number;
        nowMs: number;
        minutesSet: Set<number>;
      }
    ) => {
      const hasTargetVet = (slot.vetIds ?? []).some(
        (vetId) => normalizeId(vetId) === params.normalizedTargetPractitionerId
      );
      if (!hasTargetVet) return;
      const slotStartClock = toLocalClockFromUtcTime(slot.startTime);
      const slotEndClock = toLocalClockFromUtcTime(slot.endTime);
      const slotStartAbsoluteMinute = slotStartClock.dayOffset * 1440 + slotStartClock.minutes;
      let slotEndAbsoluteMinute = slotEndClock.dayOffset * 1440 + slotEndClock.minutes;
      if (slotEndAbsoluteMinute <= slotStartAbsoluteMinute) {
        slotEndAbsoluteMinute += 1440;
      }
      const latestStartAbsoluteMinute = slotEndAbsoluteMinute - params.durationMinutes;
      if (latestStartAbsoluteMinute < slotStartAbsoluteMinute) return;
      const startMinute = Math.ceil(slotStartAbsoluteMinute / 5) * 5;
      const endMinute = Math.floor(latestStartAbsoluteMinute / 5) * 5;
      for (let minute = startMinute; minute <= endMinute; minute += 5) {
        if (minute < 0 || minute > 24 * 60 - 5) continue;
        const nextStart = buildAppointmentStartFromCalendarMinutes(params.date, minute);
        if (nextStart.getTime() < params.nowMs) continue;
        const nextEnd = new Date(nextStart.getTime() + params.durationMs);
        if (
          hasConflict(
            params.appointment,
            nextStart,
            nextEnd,
            allAppointments,
            params.targetPractitionerId
          )
        )
          continue;
        params.minutesSet.add(minute);
      }
    },
    [allAppointments, buildAppointmentStartFromCalendarMinutes, hasConflict, normalizeId]
  );

  const buildAvailableStartMinutes = useCallback(
    async (date: Date, targetLeadId?: string) => {
      const activeDragContext = dragContextRef.current;
      if (!activeDragContext) return [];
      const appointment = allAppointments.find(
        (item) => item.id === activeDragContext.appointmentId
      );
      if (!appointment) return [];
      if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) {
        return [];
      }
      const serviceId = activeDragContext.serviceId || appointment.appointmentType?.id;
      const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);
      if (!serviceId || !targetPractitionerId) return [];

      const slots = await getSlotsForMoveValidation(serviceId, date);
      const normalizedTargetPractitionerId = normalizeId(targetPractitionerId);
      const durationMs = Math.max(5 * 60 * 1000, activeDragContext.durationMinutes * 60 * 1000);
      const nowMs = Date.now();
      const minutesSet = new Set<number>();

      for (const slot of slots) {
        collectValidMinutesForSlot(slot, {
          date,
          appointment,
          normalizedTargetPractitionerId,
          targetPractitionerId,
          durationMinutes: activeDragContext.durationMinutes,
          durationMs,
          nowMs,
          minutesSet,
        });
      }

      return Array.from(minutesSet).sort((a, b) => a - b);
    },
    [
      allAppointments,
      collectValidMinutesForSlot,
      getSlotsForMoveValidation,
      normalizeId,
      resolvePractitionerId,
      supportsSpeciality,
    ]
  );

  const ensureDragAvailability = useCallback(
    async (date: Date, targetLeadId?: string): Promise<number[]> => {
      if (!dragContextRef.current) return [];
      const key = getAvailabilityKey(date, targetLeadId);
      if (dragAvailabilityCacheRef.current[key]) {
        return dragAvailabilityCacheRef.current[key];
      }
      if (dragAvailabilityPendingRef.current[key]) {
        await dragAvailabilityPendingRef.current[key];
        return dragAvailabilityCacheRef.current[key] ?? [];
      }
      const task = (async () => {
        try {
          const starts = await buildAvailableStartMinutes(date, targetLeadId);
          dragAvailabilityCacheRef.current[key] = starts;
          dispatchDrag({ type: 'availabilityRefreshed' });
        } catch {
          dragAvailabilityCacheRef.current[key] = [];
          dispatchDrag({ type: 'availabilityRefreshed' });
        }
      })();
      dragAvailabilityPendingRef.current[key] = task;
      await task;
      delete dragAvailabilityPendingRef.current[key];
      return dragAvailabilityCacheRef.current[key] ?? [];
    },
    [buildAvailableStartMinutes, getAvailabilityKey]
  );

  const getDropAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] => {
      const key = getAvailabilityKey(date, targetLeadId);
      const starts = dragAvailabilityCacheRef.current[key] || [];
      if (!starts.length) return [];
      const intervals: DropAvailabilityInterval[] = [];
      let rangeStart = starts[0];
      let previous = starts[0];
      for (let i = 1; i < starts.length; i++) {
        const current = starts[i];
        if (current - previous === 5) {
          previous = current;
          continue;
        }
        intervals.push({ startMinute: rangeStart, endMinute: previous });
        rangeStart = current;
        previous = current;
      }
      intervals.push({ startMinute: rangeStart, endMinute: previous });
      return intervals;
    },
    [getAvailabilityKey]
  );

  const prefetchDragAvailabilityForView = useCallback(() => {
    const prefetchTargets: Array<{ date: Date; targetLeadId?: string }> = [];
    if (activeCalendar === 'day') {
      prefetchTargets.push({ date: currentDate });
    } else if (activeCalendar === 'week') {
      prefetchTargets.push(
        ...getWeekDays(weekStart).map((date) => ({
          date,
        }))
      );
    } else if (activeCalendar === 'team') {
      prefetchTargets.push(
        ...(teams || []).map((member) => ({
          date: currentDate,
          targetLeadId: member.practionerId || member._id,
        }))
      );
    }
    Promise.all(
      prefetchTargets.map((target) => ensureDragAvailability(target.date, target.targetLeadId))
    ).catch((error: unknown) => {
      logger.warn('Failed to prefetch appointment drop availability.', error);
    });
  }, [activeCalendar, currentDate, ensureDragAvailability, teams, weekStart]);

  useEffect(() => {
    if (!draggedAppointmentId) return;
    const edgeThreshold = 72;
    const scrollAmount = 28;
    const handleDragOver = (event: DragEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      const viewportWidth = globalThis.innerWidth;
      const viewportHeight = globalThis.innerHeight;

      if (x >= 0 && x < edgeThreshold) {
        globalThis.scrollBy({ left: -scrollAmount });
      } else if (x > viewportWidth - edgeThreshold) {
        globalThis.scrollBy({ left: scrollAmount });
      }
      if (y >= 0 && y < edgeThreshold) {
        globalThis.scrollBy({ top: -scrollAmount });
      } else if (y > viewportHeight - edgeThreshold) {
        globalThis.scrollBy({ top: scrollAmount });
      }

      const hoveredElement = document.elementFromPoint(x, y) as HTMLElement | null;
      const scrollContainer = hoveredElement?.closest?.(
        "[data-calendar-scroll='true']"
      ) as HTMLElement | null;
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      let deltaX = 0;
      let deltaY = 0;
      if (x - rect.left < edgeThreshold) deltaX = -scrollAmount;
      else if (rect.right - x < edgeThreshold) deltaX = scrollAmount;
      if (y - rect.top < edgeThreshold) deltaY = -scrollAmount;
      else if (rect.bottom - y < edgeThreshold) deltaY = scrollAmount;
      if (deltaX !== 0 || deltaY !== 0) {
        scrollContainer.scrollBy({ left: deltaX, top: deltaY });
      }
    };

    globalThis.addEventListener('dragover', handleDragOver);
    return () => {
      globalThis.removeEventListener('dragover', handleDragOver);
    };
  }, [draggedAppointmentId, availabilityVersion]);

  const handleViewAppointment = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    if (setViewPopup) {
      setViewPopup(true);
      return;
    }
    setDetailPopup?.(true);
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    if (!allowCalendarDrag(appointment.status)) {
      notify('warning', {
        title: 'Reschedule blocked',
        text: 'Only requested and upcoming appointments can be rescheduled.',
      });
      return;
    }
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const handleAcceptAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeStatusPreferredStatus?.('UPCOMING');
    setChangeStatusPopup?.(true);
  };

  const handleChangeRoomAppointment = (appointment: Appointment) => {
    if (!canAssignAppointmentRoom(appointment.status)) {
      notify('warning', {
        title: 'Room update blocked',
        text: 'Room can only be changed for upcoming, checked-in, or in-progress appointments.',
      });
      return;
    }
    setActiveAppointment?.(appointment);
    setChangeRoomPopup?.(true);
  };

  const handleCreateFromCalendarSlot = useCallback(
    (date: Date, minuteOfDay: number, targetLeadId?: string) => {
      if (!onCreateFromCalendarSlot || !canEditAppointments) return;
      const defaultLeadId =
        activeCalendar === 'team'
          ? resolvePractitionerId(targetLeadId)
          : getCurrentUserPractitionerId();
      onCreateFromCalendarSlot({
        date,
        minuteOfDay,
        leadId: defaultLeadId,
      });
    },
    [
      activeCalendar,
      canEditAppointments,
      getCurrentUserPractitionerId,
      onCreateFromCalendarSlot,
      resolvePractitionerId,
    ]
  );

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isOnPreferredTimeZoneCalendarDay(event.startTime, currentDate)
      ),
    [filteredList, currentDate]
  );

  const weekEvents = useMemo(
    () => filterAppointmentsForWeek(filteredList, weekStart),
    [filteredList, weekStart]
  );

  const handleAppointmentDragStart = useCallback(
    (appointment: Appointment) => {
      if (!isAppointmentDraggable(appointment)) return;
      dragAvailabilityCacheRef.current = {};
      dragAvailabilityPendingRef.current = {};
      const context = {
        appointmentId: appointment.id ?? '',
        serviceId: appointment.appointmentType?.id,
        durationMinutes: getAppointmentDurationMinutes(appointment),
      };
      dragContextRef.current = context;
      dispatchDrag({
        type: 'start',
        appointmentId: appointment.id ?? null,
        label: getAppointmentDragLabel(appointment),
        context,
      });
      prefetchDragAvailabilityForView();
    },
    [isAppointmentDraggable, prefetchDragAvailabilityForView]
  );

  const handleAppointmentDragEnd = useCallback(() => {
    dragContextRef.current = null;
    dispatchDrag({ type: 'end' });
  }, []);

  const handleDragHoverTarget = useCallback(
    (dropDate: Date, targetLeadId?: string) => {
      ensureDragAvailability(dropDate, targetLeadId).catch((error: unknown) => {
        logger.warn('Failed to refresh appointment drop availability while dragging.', error);
      });
    },
    [ensureDragAvailability]
  );

  const handleAppointmentDropAt = (dropDate: Date, minute: number, targetLeadId?: string) => {
    markDropped();
    moveAppointment(dropDate, minute, targetLeadId).catch(() => undefined);
    handleAppointmentDragEnd();
  };

  return (
    <div className="h-full min-h-0 border border-grey-light rounded-2xl overflow-hidden w-full flex flex-col">
      <Header
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        zoomMode={zoomMode}
        setZoomMode={setZoomMode}
        activeCalendar={activeCalendar}
        setActiveCalendar={setActiveCalendar}
        showAddButton={canEditAppointments}
        onAddButtonClick={onAddAppointment}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        activeStatus={activeStatus}
        setActiveStatus={setActiveStatus}
        hasEmergency={hasEmergency}
        filterOptions={filterOptions}
        statusOptions={statusOptions}
      />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          handleViewAppointment={handleViewAppointment}
          handleDetailAppointment={handleViewAppointment}
          handleOpenWorkspace={onOpenWorkspace}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          handleAcceptAppointment={handleAcceptAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
          draggedAppointmentId={draggedAppointmentId}
          draggedAppointmentLabel={draggedAppointmentLabel}
          canDragAppointment={isAppointmentDraggable}
          onAppointmentDragStart={handleAppointmentDragStart}
          onAppointmentDragEnd={handleAppointmentDragEnd}
          onDragHoverTarget={handleDragHoverTarget}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          getVisibleAvailabilityIntervals={getCurrentUserViewAvailabilityIntervals}
          availabilityLoaded={availabilityLoaded}
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={handleAppointmentDropAt}
          onCreateAppointmentAt={handleCreateFromCalendarSlot}
          slotStepMinutes={15}
          skipAutoScroll={suppressAutoScroll}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          events={weekEvents}
          zoomMode={zoomMode}
          handleViewAppointment={handleViewAppointment}
          handleOpenWorkspace={onOpenWorkspace}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          handleAcceptAppointment={handleAcceptAppointment}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
          draggedAppointmentId={draggedAppointmentId}
          draggedAppointmentLabel={draggedAppointmentLabel}
          canDragAppointment={isAppointmentDraggable}
          onAppointmentDragStart={handleAppointmentDragStart}
          onAppointmentDragEnd={handleAppointmentDragEnd}
          onDragHoverTarget={handleDragHoverTarget}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          getVisibleAvailabilityIntervals={getCurrentUserViewAvailabilityIntervals}
          availabilityLoaded={availabilityLoaded}
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={handleAppointmentDropAt}
          onCreateAppointmentAt={handleCreateFromCalendarSlot}
          slotStepMinutes={15}
          skipAutoScroll={suppressAutoScroll}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          forceFullDayInZoomIn
          handleViewAppointment={handleViewAppointment}
          handleOpenWorkspace={onOpenWorkspace}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          handleAcceptAppointment={handleAcceptAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
          draggedAppointmentId={draggedAppointmentId}
          draggedAppointmentLabel={draggedAppointmentLabel}
          canDragAppointment={isAppointmentDraggable}
          onAppointmentDragStart={handleAppointmentDragStart}
          onAppointmentDragEnd={handleAppointmentDragEnd}
          onDragHoverTarget={handleDragHoverTarget}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          getVisibleAvailabilityIntervals={getViewAvailabilityIntervals}
          availabilityLoaded={availabilityLoaded}
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={handleAppointmentDropAt}
          onCreateAppointmentAt={handleCreateFromCalendarSlot}
          slotStepMinutes={15}
          skipAutoScroll={suppressAutoScroll}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
