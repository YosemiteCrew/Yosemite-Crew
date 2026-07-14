import { useCallback, useEffect, useRef, useState } from 'react';
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
    async (date: Date, targetLeadId?: string) => {
      if (!dragContext) return [];
      const appointment = allAppointments.find((item) => item.id === dragContext.appointmentId);
      if (!appointment) return [];
      if (targetLeadId && !supportsSpeciality(teams, targetLeadId, appointment)) {
        return [];
      }
      const serviceId = dragContext.serviceId || appointment.appointmentType?.id;
      const targetPractitionerId = resolvePractitionerId(
        teams,
        targetLeadId || appointment.lead?.id
      );
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
          allAppointments,
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
    [allAppointments, dragContext, getSlotsForMoveValidation, teams]
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

export const useDragEdgeAutoScroll = (
  draggedAppointmentId: string | null,
  availabilityVersion: number
) => {
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
};
