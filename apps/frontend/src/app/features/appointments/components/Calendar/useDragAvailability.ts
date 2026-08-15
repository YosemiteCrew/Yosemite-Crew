import { useCallback, useRef, useState } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { Team } from '@/app/features/organization/types/team';
import { Slot } from '@/app/features/appointments/types/appointments';
import { getSlotsForServiceAndDateForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import {
  DragContext,
  buildDropIntervalsFromStarts,
  collectValidMinutesForSlot,
  normalizeId,
  resolvePractitionerId,
  supportsSpeciality,
  toLocalDayKey,
} from './appointmentCalendarHelpers';

const readCachedStarts = (cache: Partial<Record<string, number[]>>, key: string): number[] =>
  cache[key] ?? [];

export const useDragAvailability = ({
  dragContext,
  allAppointments,
  teams,
}: {
  dragContext: DragContext | null;
  allAppointments: Appointment[];
  teams: Team[];
}) => {
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const slotsCacheRef = useRef<Partial<Record<string, Slot[]>>>({});
  const dragAvailabilityCacheRef = useRef<Partial<Record<string, number[]>>>({});
  const dragAvailabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});

  const resetDragAvailability = useCallback(() => {
    dragAvailabilityCacheRef.current = {};
    dragAvailabilityPendingRef.current = {};
    setAvailabilityVersion((version) => version + 1);
  }, []);

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

  const getAvailabilityKey = useCallback(
    (date: Date, targetLeadId?: string) => {
      const dayKey = toLocalDayKey(date);
      const appointment = dragContext
        ? allAppointments.find((item) => item.id === dragContext.appointmentId)
        : null;
      const defaultLeadId = appointment?.lead?.id;
      const practitionerId = resolvePractitionerId(teams, targetLeadId || defaultLeadId);
      return `${dayKey}:${normalizeId(practitionerId || '')}`;
    },
    [allAppointments, dragContext, teams]
  );

  const buildAvailableStartMinutes = useCallback(
    async (context: DragContext, date: Date, targetLeadId?: string) => {
      const appointment = allAppointments.find((item) => item.id === context.appointmentId);
      if (!appointment) return [];
      if (targetLeadId && !supportsSpeciality(teams, targetLeadId, appointment)) {
        return [];
      }
      const serviceId = context.serviceId || appointment.appointmentType?.id;
      const targetPractitionerId = resolvePractitionerId(
        teams,
        targetLeadId || appointment.lead?.id
      );
      if (!serviceId || !targetPractitionerId) return [];

      const slots = await getSlotsForMoveValidation(serviceId, date);
      const normalizedTargetPractitionerId = normalizeId(targetPractitionerId);
      const durationMs = Math.max(5 * 60 * 1000, context.durationMinutes * 60 * 1000);
      const nowMs = Date.now();
      const minutesSet = new Set<number>();

      for (const slot of slots) {
        collectValidMinutesForSlot(slot, {
          date,
          appointment,
          allAppointments,
          normalizedTargetPractitionerId,
          targetPractitionerId,
          durationMinutes: context.durationMinutes,
          durationMs,
          nowMs,
          minutesSet,
        });
      }

      return Array.from(minutesSet).sort((a, b) => a - b);
    },
    [allAppointments, getSlotsForMoveValidation, teams]
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
        return readCachedStarts(dragAvailabilityCacheRef.current, key);
      }
      const task = (async () => {
        try {
          const starts = await buildAvailableStartMinutes(dragContext, date, targetLeadId);
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
      return readCachedStarts(dragAvailabilityCacheRef.current, key);
    },
    [buildAvailableStartMinutes, dragContext, getAvailabilityKey]
  );

  const getDropAvailabilityIntervals = useCallback(
    (date: Date, targetLeadId?: string): DropAvailabilityInterval[] => {
      const key = getAvailabilityKey(date, targetLeadId);
      const starts = readCachedStarts(dragAvailabilityCacheRef.current, key);
      return buildDropIntervalsFromStarts(starts);
    },
    [getAvailabilityKey]
  );

  return {
    availabilityVersion,
    resetDragAvailability,
    ensureDragAvailability,
    getDropAvailabilityIntervals,
  };
};

// Single source of truth for the edge auto-scroll behaviour lives in useAppointmentDragAutoScroll.
export { useAppointmentDragAutoScroll as useDragEdgeAutoScroll } from '@/app/features/appointments/components/Calendar/useAppointmentDragAutoScroll';
