import { Dispatch, RefObject, useCallback, useRef } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { getSlotsForServiceAndDateForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { utcClockTimeToPreferredTimeZoneClock } from '@/app/lib/timezone';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { logger } from '@/app/lib/logger';
import {
  DragAction,
  DragContext,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
import {
  DragAvailabilityCaches,
  buildAppointmentStartFromCalendarMinutes,
  buildDragPrefetchTargets,
  buildDropAvailabilityIntervals,
  computeAvailableStartMinutes,
  findTeamMemberByIdentity,
  getAvailabilityKey as buildAvailabilityKey,
  getSlotCacheKey,
  resolveDragAvailability,
} from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';
import { useAppointmentViewAvailability } from '@/app/features/appointments/components/Calendar/useAppointmentViewAvailability';

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

type UseDragAvailabilityInputsOptions = Pick<
  UseAppointmentDragAvailabilityOptions,
  | 'allAppointments'
  | 'authUserId'
  | 'dragContextRef'
  | 'normalizeId'
  | 'resolvePractitionerId'
  | 'supportsSpeciality'
  | 'teams'
>;

type UseDragAvailabilityCacheOptions = Pick<
  UseAppointmentDragAvailabilityOptions,
  'activeCalendar' | 'currentDate' | 'dispatchDrag' | 'dragContextRef' | 'teams' | 'weekStart'
> & {
  buildAvailableStartMinutes: (date: Date, targetLeadId?: string) => Promise<number[]>;
  getAvailabilityKey: (date: Date, targetLeadId?: string) => string;
};

const useDragAvailabilityInputs = ({
  allAppointments,
  authUserId,
  dragContextRef,
  normalizeId,
  resolvePractitionerId,
  supportsSpeciality,
  teams,
}: UseDragAvailabilityInputsOptions) => {
  const slotsCacheRef = useRef<Partial<Record<string, Slot[]>>>({});

  const getCurrentUserPractitionerId = useCallback(() => {
    const member = findTeamMemberByIdentity(teams, authUserId, normalizeId);
    return member?.practionerId || member?._id;
  }, [authUserId, normalizeId, teams]);

  const getSlotsForMoveValidation = useCallback(async (serviceId: string, date: Date) => {
    const cacheKey = getSlotCacheKey(serviceId, date);
    if (slotsCacheRef.current[cacheKey]) return slotsCacheRef.current[cacheKey];
    const slots = await getSlotsForServiceAndDateForPrimaryOrg(serviceId, date);
    slotsCacheRef.current[cacheKey] = slots;
    return slots;
  }, []);

  const getAvailabilityKey = useCallback(
    (date: Date, targetLeadId?: string) =>
      buildAvailabilityKey({
        allAppointments,
        date,
        dragContext: dragContextRef.current,
        normalizeId,
        resolvePractitionerId,
        targetLeadId,
      }),
    [allAppointments, dragContextRef, normalizeId, resolvePractitionerId]
  );

  const buildAvailableStartMinutes = useCallback(
    (date: Date, targetLeadId?: string) =>
      computeAvailableStartMinutes({
        allAppointments,
        buildStart: buildAppointmentStartFromCalendarMinutes,
        date,
        dragContext: dragContextRef.current,
        getSlots: getSlotsForMoveValidation,
        normalizeId,
        resolvePractitionerId,
        supportsSpeciality,
        targetLeadId,
        toLocalClockFromUtcTime: utcClockTimeToPreferredTimeZoneClock,
      }),
    [
      allAppointments,
      dragContextRef,
      getSlotsForMoveValidation,
      normalizeId,
      resolvePractitionerId,
      supportsSpeciality,
    ]
  );

  return {
    buildAppointmentStartFromCalendarMinutes,
    buildAvailableStartMinutes,
    getAvailabilityKey,
    getCurrentUserPractitionerId,
  };
};

const useDragAvailabilityCache = ({
  activeCalendar,
  buildAvailableStartMinutes,
  currentDate,
  dispatchDrag,
  dragContextRef,
  getAvailabilityKey,
  teams,
  weekStart,
}: UseDragAvailabilityCacheOptions) => {
  const dragAvailabilityCachesRef = useRef<DragAvailabilityCaches>({ results: {}, pending: {} });

  const ensureDragAvailability = useCallback(
    async (date: Date, targetLeadId?: string): Promise<number[]> => {
      if (!dragContextRef.current) return [];
      return resolveDragAvailability(
        dragAvailabilityCachesRef.current,
        getAvailabilityKey(date, targetLeadId),
        () => buildAvailableStartMinutes(date, targetLeadId),
        (error) => {
          dispatchDrag({ type: 'availabilityRefreshed' });
          if (error) logger.warn('Failed to resolve appointment drop availability.', error);
        }
      );
    },
    [buildAvailableStartMinutes, dispatchDrag, dragContextRef, getAvailabilityKey]
  );

  const getDropAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] => {
      const key = getAvailabilityKey(date, targetLeadId);
      const starts = dragAvailabilityCachesRef.current.results[key] || [];
      return buildDropAvailabilityIntervals(starts);
    },
    [getAvailabilityKey]
  );

  const prefetchDragAvailabilityForView = useCallback(() => {
    const prefetchTargets = buildDragPrefetchTargets(activeCalendar, currentDate, weekStart, teams);
    Promise.all(
      prefetchTargets.map((target) => ensureDragAvailability(target.date, target.targetLeadId))
    ).catch((error: unknown) => {
      logger.warn('Failed to prefetch appointment drop availability.', error);
    });
  }, [activeCalendar, currentDate, ensureDragAvailability, teams, weekStart]);

  const clearDragAvailability = useCallback(() => {
    dragAvailabilityCachesRef.current = { results: {}, pending: {} };
  }, []);

  return {
    clearDragAvailability,
    ensureDragAvailability,
    getDropAvailabilityIntervals,
    prefetchDragAvailabilityForView,
  };
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
  const { availabilityLoaded, getViewAvailabilityIntervals } = useAppointmentViewAvailability({
    activeCalendar,
    normalizeId,
    teams,
  });

  const {
    buildAppointmentStartFromCalendarMinutes,
    buildAvailableStartMinutes,
    getAvailabilityKey,
    getCurrentUserPractitionerId,
  } = useDragAvailabilityInputs({
    allAppointments,
    authUserId,
    dragContextRef,
    normalizeId,
    resolvePractitionerId,
    supportsSpeciality,
    teams,
  });

  const getCurrentUserViewAvailabilityIntervals = useCallback(
    (date: Date): DropAvailabilityInterval[] =>
      getViewAvailabilityIntervals(date, getCurrentUserPractitionerId() || authUserId),
    [authUserId, getCurrentUserPractitionerId, getViewAvailabilityIntervals]
  );

  const {
    clearDragAvailability,
    ensureDragAvailability,
    getDropAvailabilityIntervals,
    prefetchDragAvailabilityForView,
  } = useDragAvailabilityCache({
    activeCalendar,
    buildAvailableStartMinutes,
    currentDate,
    dispatchDrag,
    dragContextRef,
    getAvailabilityKey,
    teams,
    weekStart,
  });

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
