import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { allowCalendarDrag } from '@/app/lib/appointments';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  buildDateInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useLoadAvailabilities } from '@/app/hooks/useAvailabiities';
import {
  DropAvailabilityInterval,
  resolveAvailabilityIntervalsForDay,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { logger } from '@/app/lib/logger';

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

type UseAppointmentCalendarDragOptions = {
  activeCalendar: string;
  allAppointments: Appointment[];
  authUserId: string;
  canEditAppointments: boolean;
  currentDate: Date;
  notify: (kind: 'warning', value: { title: string; text: string }) => void;
  teams: ReturnType<typeof useTeamForPrimaryOrg>;
  weekStart: Date;
};

type ErrorCandidate = { response?: { data?: unknown } } | { data?: unknown } | { message?: string };

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

const getErrorMessageFromCandidate = (candidate: ErrorCandidate, fallback: string) => {
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
) =>
  sourceAppointments.some((existing) => {
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

export const useAppointmentCalendarDrag = ({
  activeCalendar,
  allAppointments,
  authUserId,
  canEditAppointments,
  currentDate,
  notify,
  teams,
  weekStart,
}: UseAppointmentCalendarDragOptions) => {
  const [dragState, dispatchDrag] = useReducer(dragReducer, initialDragState);
  const [suppressAutoScroll, setSuppressAutoScroll] = useState(false);
  const dragContextRef = useRef<DragContext | null>(null);
  const suppressAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotsCacheRef = useRef<Partial<Record<string, Slot[]>>>({});
  const dragAvailabilityCacheRef = useRef<Partial<Record<string, number[]>>>({});
  const dragAvailabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const teamAvailabilityFetchedRef = useRef<string | null>(null);
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
    if (slotsCacheRef.current[cacheKey]) return slotsCacheRef.current[cacheKey];
    const slots = await getSlotsForServiceAndDateForPrimaryOrg(serviceId, date);
    slotsCacheRef.current[cacheKey] = slots;
    return slots;
  }, []);

  const buildAppointmentStartFromCalendarMinutes = useCallback(
    (date: Date, minuteOfDay: number) => {
      const clampedMinute = clampMinutes(minuteOfDay);
      return buildDateInPreferredTimeZone(date, clampedMinute);
    },
    []
  );

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
        toLocalClockFromUtcTime,
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
      if (slotEndAbsoluteMinute <= slotStartAbsoluteMinute) slotEndAbsoluteMinute += 1440;
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
          hasAppointmentConflict(
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
    [allAppointments, buildAppointmentStartFromCalendarMinutes, normalizeId]
  );

  const buildAvailableStartMinutes = useCallback(
    async (date: Date, targetLeadId?: string) => {
      const activeDragContext = dragContextRef.current;
      if (!activeDragContext) return [];
      const appointment = allAppointments.find(
        (item) => item.id === activeDragContext.appointmentId
      );
      if (!appointment) return [];
      if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) return [];
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
      if (dragAvailabilityCacheRef.current[key]) return dragAvailabilityCacheRef.current[key];
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
      prefetchTargets.push(...getWeekDays(weekStart).map((date) => ({ date })));
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
    if (!dragState.appointmentId) return;
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
      if (deltaX !== 0 || deltaY !== 0) scrollContainer.scrollBy({ left: deltaX, top: deltaY });
    };

    globalThis.addEventListener('dragover', handleDragOver);
    return () => globalThis.removeEventListener('dragover', handleDragOver);
  }, [dragState.appointmentId, dragState.availabilityVersion]);

  const markDropped = useCallback(() => {
    if (suppressAutoScrollTimerRef.current) clearTimeout(suppressAutoScrollTimerRef.current);
    setSuppressAutoScroll(true);
    suppressAutoScrollTimerRef.current = setTimeout(() => setSuppressAutoScroll(false), 4000);
  }, []);

  const moveAppointment = useCallback(
    async (date: Date, minutesSinceMidnight: number, targetLeadId?: string) => {
      const warnDrag = (message: string) => {
        dispatchDrag({ type: 'setError', error: message });
        notify('warning', { title: 'Move blocked', text: message });
      };

      if (!dragState.appointmentId) return;
      const appointment = allAppointments.find((item) => item.id === dragState.appointmentId);
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
      if (
        hasAppointmentConflict(
          appointment,
          nextStart,
          nextEnd,
          allAppointments,
          targetPractitionerId
        )
      ) {
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
                      normalizeId(member.practionerId || '') ===
                        normalizeId(targetPractitionerId) ||
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
          error: getErrorMessageFromCandidate(
            error as ErrorCandidate,
            'Unable to update appointment. Please try again.'
          ),
        });
      }
    },
    [
      allAppointments,
      buildAppointmentStartFromCalendarMinutes,
      dragState.appointmentId,
      ensureDragAvailability,
      isAppointmentDraggable,
      normalizeId,
      notify,
      resolvePractitionerId,
      supportsSpeciality,
      teams,
    ]
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

  const handleAppointmentDropAt = useCallback(
    (dropDate: Date, minute: number, targetLeadId?: string) => {
      markDropped();
      moveAppointment(dropDate, minute, targetLeadId).catch((error: unknown) => {
        logger.warn('Failed to move appointment from calendar drop.', error);
      });
      handleAppointmentDragEnd();
    },
    [handleAppointmentDragEnd, markDropped, moveAppointment]
  );

  return {
    availabilityLoaded,
    dragContext: dragState.context,
    draggedAppointmentId: dragState.appointmentId,
    draggedAppointmentLabel: dragState.label,
    dragError: dragState.error,
    getCurrentUserPractitionerId,
    getCurrentUserViewAvailabilityIntervals,
    getDropAvailabilityIntervals,
    getViewAvailabilityIntervals,
    handleAppointmentDragEnd,
    handleAppointmentDragStart,
    handleAppointmentDropAt,
    handleDragHoverTarget,
    isAppointmentDraggable,
    resolvePractitionerId,
    skipAutoScroll: suppressAutoScroll,
  };
};
