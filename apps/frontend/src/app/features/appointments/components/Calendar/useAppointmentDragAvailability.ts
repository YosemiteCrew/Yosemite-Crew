import { Dispatch, RefObject, useCallback, useEffect, useRef } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { getSlotsForServiceAndDateForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import {
  buildDateInPreferredTimeZone,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useLoadAvailabilities } from '@/app/hooks/useAvailabiities';
import {
  DropAvailabilityInterval,
  resolveAvailabilityIntervalsForDay,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { logger } from '@/app/lib/logger';
import {
  DragAction,
  DragContext,
  clampMinutes,
  getDayOfWeekKey,
  hasAppointmentConflict,
  toLocalDayKey,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';

type UseAppointmentDragAvailabilityOptions = {
  activeCalendar: string;
  allAppointments: Appointment[];
  authUserId: string;
  currentDate: Date;
  dispatchDrag: Dispatch<DragAction>;
  dragContextRef: RefObject<DragContext | null>;
  normalizeId: (value?: string) => string;
  resolvePractitionerId: (candidateId?: string) => string | undefined;
  supportsSpeciality: (targetLeadId: string, appointment: Appointment) => boolean;
  teams: ReturnType<typeof useTeamForPrimaryOrg>;
  weekStart: Date;
};

export const useAppointmentDragAvailability = ({
  activeCalendar,
  allAppointments,
  authUserId,
  currentDate,
  dispatchDrag,
  dragContextRef,
  normalizeId,
  resolvePractitionerId,
  supportsSpeciality,
  teams,
  weekStart,
}: UseAppointmentDragAvailabilityOptions) => {
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
    [allAppointments, dragContextRef, normalizeId, resolvePractitionerId]
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
      const slotStartClock = utcClockTimeToPreferredTimeZoneClock(slot.startTime);
      const slotEndClock = utcClockTimeToPreferredTimeZoneClock(slot.endTime);
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
      dragContextRef,
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
        } catch (error) {
          dragAvailabilityCacheRef.current[key] = [];
          dispatchDrag({ type: 'availabilityRefreshed' });
          logger.warn('Failed to resolve appointment drop availability.', error);
        }
      })();
      dragAvailabilityPendingRef.current[key] = task;
      await task;
      delete dragAvailabilityPendingRef.current[key];
      return dragAvailabilityCacheRef.current[key] ?? [];
    },
    [buildAvailableStartMinutes, dispatchDrag, dragContextRef, getAvailabilityKey]
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

  const clearDragAvailability = useCallback(() => {
    dragAvailabilityCacheRef.current = {};
    dragAvailabilityPendingRef.current = {};
  }, []);

  return {
    availabilityLoaded,
    buildAppointmentStartFromCalendarMinutes,
    clearDragAvailability,
    ensureDragAvailability,
    getCurrentUserPractitionerId,
    getCurrentUserViewAvailabilityIntervals,
    getDropAvailabilityIntervals,
    getViewAvailabilityIntervals,
    prefetchDragAvailabilityForView,
  };
};
