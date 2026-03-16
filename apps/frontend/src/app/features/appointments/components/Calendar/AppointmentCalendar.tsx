import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DayCalendar from '@/app/features/appointments/components/Calendar/common/DayCalendar';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import WeekCalendar from '@/app/features/appointments/components/Calendar/common/WeekCalendar';
import { Appointment } from '@yosemite-crew/types';
import UserCalendar from '@/app/features/appointments/components/Calendar/common/UserCalendar';
import {
  AppointmentViewIntent,
  AppointmentDraftPrefill,
} from '@/app/features/appointments/types/calendar';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getPreferredNextAppointmentStatus,
} from '@/app/lib/appointments';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
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
type AppointmentCalendarProps = {
  filteredList: Appointment[];
  allAppointments: Appointment[];
  setActiveAppointment?: (inventory: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<AppointmentStatus | null>>;
  setChangeRoomPopup?: (open: boolean) => void;
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
};

type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

type DragContext = {
  appointmentId: string;
  serviceId?: string;
  durationMinutes: number;
};

const getErrorMessageFromCandidate = (
  candidate: { response?: { data?: unknown } } | { data?: unknown } | { message?: string },
  fallback: string
) => {
  const getTrimmedMessage = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const getResponseMessage = (value: unknown) => {
    if (typeof value === 'string') return getTrimmedMessage(value);
    if (!value || typeof value !== 'object') return null;
    const data = value as Record<string, unknown>;
    return (
      getTrimmedMessage(data.message) ||
      getTrimmedMessage(data.error) ||
      getTrimmedMessage(data.details)
    );
  };

  const responseData = candidate && 'response' in candidate ? candidate.response?.data : undefined;
  return (
    getResponseMessage(responseData) ||
    ('message' in candidate ? getTrimmedMessage(candidate.message) : null) ||
    fallback
  );
};

const AppointmentCalendar = ({
  filteredList,
  allAppointments,
  setActiveAppointment,
  setViewPopup,
  setViewIntent,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setChangeRoomPopup,
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
}: AppointmentCalendarProps) => {
  const { notify } = useNotify();
  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    return getErrorMessageFromCandidate(
      error as { response?: { data?: unknown } } | { data?: unknown } | { message?: string },
      fallback
    );
  }, []);

  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [draggedAppointmentLabel, setDraggedAppointmentLabel] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [dragContext, setDragContext] = useState<DragContext | null>(null);
  const [zoomMode, setZoomMode] = useState<CalendarZoomMode>('in');
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const slotsCacheRef = useRef<Partial<Record<string, Slot[]>>>({});
  const dragAvailabilityCacheRef = useRef<Partial<Record<string, number[]>>>({});
  const dragAvailabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const teams = useTeamForPrimaryOrg();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  useLoadAvailabilities();
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
  const isAppointmentDraggable = (appointment: Appointment) =>
    !!appointment.id && canEditAppointments && allowCalendarDrag(appointment.status);

  const hasConflict = (
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

  const toLocalClockFromUtcTime = (utcTime: string) => {
    return utcClockTimeToPreferredTimeZoneClock(utcTime);
  };

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
      setDragError(message);
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
      if (availableStartMinutes.length > 0 && !availableStartMinutes.includes(snappedMinutes)) {
        warnDrag('No available slot for this service at the selected position.');
        return;
      }
    }
    if (hasConflict(appointment, nextStart, nextEnd, allAppointments, targetPractitionerId)) {
      warnDrag('Scheduling conflict detected with another appointment.');
      return;
    }

    try {
      setDragError(null);
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
      setDragError(getErrorMessage(error, 'Unable to update appointment. Please try again.'));
    }
  };

  const getAvailabilityKey = useCallback(
    (date: Date, targetLeadId?: string) => {
      const dayKey = toLocalDayKey(date);
      const appointment = dragContext
        ? allAppointments.find((item) => item.id === dragContext.appointmentId)
        : null;
      const defaultLeadId = appointment?.lead?.id;
      const practitionerId = resolvePractitionerId(targetLeadId || defaultLeadId);
      return `${dayKey}:${normalizeId(practitionerId || '')}`;
    },
    [allAppointments, dragContext, normalizeId, resolvePractitionerId]
  );

  const getViewAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] => {
      if (!primaryOrgId) return [];
      const dayKey = getDayOfWeekKey(date);
      const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
      const dayAvailabilities = ids
        .map((id) => availabilitiesById[id])
        .filter((item) => item?.dayOfWeek === dayKey);
      if (!dayAvailabilities.length) return [];

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
        : null;
      const employeeAvailabilities = dayAvailabilities.filter(
        (item) => item.userId && String(item.userId).trim()
      );
      const orgLevelAvailabilities = dayAvailabilities.filter(
        (item) => !item.userId || !String(item.userId).trim()
      );

      // If a specific employee is targeted, scope strictly to that employee.
      // For day/week personal views, caller provides current user practitioner id.
      const scoped = normalizedTarget
        ? employeeAvailabilities.filter((item) => targetIds?.has(normalizeId(item.userId)))
        : employeeAvailabilities;
      let source = scoped;
      if (normalizedTarget) {
        source = scoped;
      } else if (scoped.length === 0) {
        source = orgLevelAvailabilities;
      }
      if (source.length) {
        return source
          .flatMap((item) =>
            (item.slots ?? [])
              .filter((slot) => slot?.isAvailable)
              .map((slot) => {
                const startClock = utcClockTimeToPreferredTimeZoneClock(slot.startTime);
                const endClock = utcClockTimeToPreferredTimeZoneClock(slot.endTime);
                const startMinute = Math.max(
                  0,
                  Math.min(24 * 60, startClock.dayOffset * 24 * 60 + startClock.minutes)
                );
                let endMinute = endClock.dayOffset * 24 * 60 + endClock.minutes;
                if (endMinute <= startMinute) endMinute += 24 * 60;
                endMinute = Math.max(0, Math.min(24 * 60, endMinute));
                if (endMinute <= startMinute) {
                  endMinute = startMinute + 5;
                }
                return {
                  startMinute,
                  endMinute,
                };
              })
          )
          .filter((interval) => interval.endMinute > interval.startMinute);
      }

      return [];
    },
    [availabilityIdsByOrgId, availabilitiesById, normalizeId, primaryOrgId, teams]
  );

  const getCurrentUserViewAvailabilityIntervals = useCallback(
    (date: Date): DropAvailabilityInterval[] =>
      getViewAvailabilityIntervals(date, getCurrentUserPractitionerId()),
    [getCurrentUserPractitionerId, getViewAvailabilityIntervals]
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
    [allAppointments, buildAppointmentStartFromCalendarMinutes, normalizeId]
  );

  const buildAvailableStartMinutes = useCallback(
    async (date: Date, targetLeadId?: string) => {
      if (!dragContext) return [];
      const appointment = allAppointments.find((item) => item.id === dragContext.appointmentId);
      if (!appointment) return [];
      if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) {
        return [];
      }
      const serviceId = dragContext.serviceId || appointment.appointmentType?.id;
      const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);
      if (!serviceId || !targetPractitionerId) return [];

      const slots = await getSlotsForMoveValidation(serviceId, date);
      const normalizedTargetPractitionerId = normalizeId(targetPractitionerId);
      const durationMs = Math.max(5 * 60 * 1000, dragContext.durationMinutes * 60 * 1000);
      const nowMs = Date.now();
      const minutesSet = new Set<number>();

      for (const slot of slots) {
        collectValidMinutesForSlot(slot, {
          date,
          appointment,
          normalizedTargetPractitionerId,
          targetPractitionerId,
          durationMinutes: dragContext.durationMinutes,
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
      dragContext,
      getSlotsForMoveValidation,
      normalizeId,
      resolvePractitionerId,
      supportsSpeciality,
    ]
  );

  const ensureDragAvailability = useCallback(
    async (date: Date, targetLeadId?: string): Promise<number[]> => {
      if (!dragContext) return [];
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
          setAvailabilityVersion((version) => version + 1);
        } catch {
          dragAvailabilityCacheRef.current[key] = [];
          setAvailabilityVersion((version) => version + 1);
        }
      })();
      dragAvailabilityPendingRef.current[key] = task;
      await task;
      delete dragAvailabilityPendingRef.current[key];
      return dragAvailabilityCacheRef.current[key] ?? [];
    },
    [buildAvailableStartMinutes, dragContext, getAvailabilityKey]
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

  useEffect(() => {
    if (!dragContext) return;
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
    ).catch(() => undefined);
  }, [activeCalendar, currentDate, dragContext, ensureDragAvailability, teams, weekStart]);

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
    setViewPopup?.(true);
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

  const handleChangeStatusAppointment = (appointment: Appointment) => {
    if (!canShowStatusChangeAction(appointment.status)) {
      notify('warning', {
        title: 'Status change blocked',
        text: 'No status changes are available for this appointment.',
      });
      return;
    }
    setActiveAppointment?.(appointment);
    setChangeStatusPreferredStatus?.(
      getPreferredNextAppointmentStatus(appointment.status as AppointmentStatus)
    );
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

  const myAppointments = useMemo(() => {
    const currentLeadId = normalizeId(getCurrentUserPractitionerId() || authUserId);
    if (!currentLeadId) return filteredList;
    return filteredList.filter(
      (appointment) => normalizeId(appointment.lead?.id) === currentLeadId
    );
  }, [authUserId, filteredList, getCurrentUserPractitionerId, normalizeId]);

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isOnPreferredTimeZoneCalendarDay(event.startTime, currentDate)
      ),
    [filteredList, currentDate]
  );

  const myDayEvents = useMemo(
    () =>
      myAppointments.filter((event) =>
        isOnPreferredTimeZoneCalendarDay(event.startTime, currentDate)
      ),
    [myAppointments, currentDate]
  );

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
      />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          events={myDayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeStatusAppointment={handleChangeStatusAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
          draggedAppointmentId={draggedAppointmentId}
          draggedAppointmentLabel={draggedAppointmentLabel}
          canDragAppointment={isAppointmentDraggable}
          onAppointmentDragStart={(appointment) => {
            if (!isAppointmentDraggable(appointment)) return;
            setDraggedAppointmentId(appointment.id ?? null);
            setDraggedAppointmentLabel(appointment.companion?.name ?? 'Appointment');
            setDragError(null);
            dragAvailabilityCacheRef.current = {};
            dragAvailabilityPendingRef.current = {};
            setAvailabilityVersion((version) => version + 1);
            setDragContext({
              appointmentId: appointment.id ?? '',
              serviceId: appointment.appointmentType?.id,
              durationMinutes: Math.max(
                5,
                Math.round(
                  (new Date(appointment.endTime).getTime() -
                    new Date(appointment.startTime).getTime()) /
                    60000
                )
              ),
            });
          }}
          onAppointmentDragEnd={() => {
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
          onDragHoverTarget={(dropDate, targetLeadId) => {
            ensureDragAvailability(dropDate, targetLeadId).catch(() => undefined);
          }}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          getVisibleAvailabilityIntervals={getCurrentUserViewAvailabilityIntervals}
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={(dropDate, minute) => {
            moveAppointment(dropDate, minute).catch(() => undefined);
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
          onCreateAppointmentAt={handleCreateFromCalendarSlot}
          slotStepMinutes={15}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          events={myAppointments}
          zoomMode={zoomMode}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeStatusAppointment={handleChangeStatusAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
          draggedAppointmentId={draggedAppointmentId}
          draggedAppointmentLabel={draggedAppointmentLabel}
          canDragAppointment={isAppointmentDraggable}
          onAppointmentDragStart={(appointment) => {
            if (!isAppointmentDraggable(appointment)) return;
            setDraggedAppointmentId(appointment.id ?? null);
            setDraggedAppointmentLabel(appointment.companion?.name ?? 'Appointment');
            setDragError(null);
            dragAvailabilityCacheRef.current = {};
            dragAvailabilityPendingRef.current = {};
            setAvailabilityVersion((version) => version + 1);
            setDragContext({
              appointmentId: appointment.id ?? '',
              serviceId: appointment.appointmentType?.id,
              durationMinutes: Math.max(
                5,
                Math.round(
                  (new Date(appointment.endTime).getTime() -
                    new Date(appointment.startTime).getTime()) /
                    60000
                )
              ),
            });
          }}
          onAppointmentDragEnd={() => {
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
          onDragHoverTarget={(dropDate, targetLeadId) => {
            ensureDragAvailability(dropDate, targetLeadId).catch(() => undefined);
          }}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          getVisibleAvailabilityIntervals={getCurrentUserViewAvailabilityIntervals}
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={(dropDate, minute) => {
            moveAppointment(dropDate, minute).catch(() => undefined);
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
          onCreateAppointmentAt={handleCreateFromCalendarSlot}
          slotStepMinutes={15}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          zoomMode={zoomMode}
          forceFullDayInZoomIn
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeStatusAppointment={handleChangeStatusAppointment}
          handleChangeRoomAppointment={handleChangeRoomAppointment}
          setCurrentDate={setCurrentDate}
          canEditAppointments={canEditAppointments}
          draggedAppointmentId={draggedAppointmentId}
          draggedAppointmentLabel={draggedAppointmentLabel}
          canDragAppointment={isAppointmentDraggable}
          onAppointmentDragStart={(appointment) => {
            if (!isAppointmentDraggable(appointment)) return;
            setDraggedAppointmentId(appointment.id ?? null);
            setDraggedAppointmentLabel(appointment.companion?.name ?? 'Appointment');
            setDragError(null);
            dragAvailabilityCacheRef.current = {};
            dragAvailabilityPendingRef.current = {};
            setAvailabilityVersion((version) => version + 1);
            setDragContext({
              appointmentId: appointment.id ?? '',
              serviceId: appointment.appointmentType?.id,
              durationMinutes: Math.max(
                5,
                Math.round(
                  (new Date(appointment.endTime).getTime() -
                    new Date(appointment.startTime).getTime()) /
                    60000
                )
              ),
            });
          }}
          onAppointmentDragEnd={() => {
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
          onDragHoverTarget={(dropDate, targetLeadId) => {
            ensureDragAvailability(dropDate, targetLeadId).catch(() => undefined);
          }}
          getDropAvailabilityIntervals={getDropAvailabilityIntervals}
          getVisibleAvailabilityIntervals={getViewAvailabilityIntervals}
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={(dropDate, minute, targetLeadId) => {
            moveAppointment(dropDate, minute, targetLeadId).catch(() => undefined);
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
          onCreateAppointmentAt={handleCreateFromCalendarSlot}
          slotStepMinutes={15}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
