import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSameDay } from '@/app/features/appointments/components/Calendar/helpers';
import DayCalendar from '@/app/features/appointments/components/Calendar/common/DayCalendar';
import Header from '@/app/features/appointments/components/Calendar/common/Header';
import WeekCalendar from '@/app/features/appointments/components/Calendar/common/WeekCalendar';
import { Appointment } from '@yosemite-crew/types';
import UserCalendar from '@/app/features/appointments/components/Calendar/common/UserCalendar';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { allowCalendarDrag } from '@/app/lib/appointments';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';

type AppointmentCalendarProps = {
  filteredList: Appointment[];
  allAppointments: Appointment[];
  setActiveAppointment?: (inventory: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setChangeStatusPopup?: (open: boolean) => void;
  activeCalendar: string;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
  canEditAppointments: boolean;
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

const AppointmentCalendar = ({
  filteredList,
  allAppointments,
  setActiveAppointment,
  setViewPopup,
  setViewIntent,
  setChangeStatusPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
  setReschedulePopup,
  canEditAppointments,
}: AppointmentCalendarProps) => {
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [draggedAppointmentLabel, setDraggedAppointmentLabel] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [dragContext, setDragContext] = useState<DragContext | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const slotsCacheRef = useRef<Partial<Record<string, Slot[]>>>({});
  const dragAvailabilityCacheRef = useRef<Partial<Record<string, number[]>>>({});
  const dragAvailabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});
  const teams = useTeamForPrimaryOrg();
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
  const toLocalDayKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isAppointmentDraggable = (appointment: Appointment) =>
    !!appointment.id && canEditAppointments && allowCalendarDrag(appointment.status as any);

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

  const toLocalMinutesFromUtcTime = (utcTime: string) => {
    if (!utcTime) return 0;
    const date = new Date(`1970-01-01T${utcTime}:00Z`);
    if (Number.isNaN(date.getTime())) return 0;
    return date.getHours() * 60 + date.getMinutes();
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

  const buildAppointmentStartFromLocalMinutes = useCallback((date: Date, minuteOfDay: number) => {
    const clampedMinute = Math.max(0, Math.min(24 * 60 - 5, Math.round(minuteOfDay / 5) * 5));
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      Math.floor(clampedMinute / 60),
      clampedMinute % 60,
      0,
      0
    );
  }, []);

  const moveAppointment = async (
    date: Date,
    minutesSinceMidnight: number,
    targetLeadId?: string
  ) => {
    if (!draggedAppointmentId) return;
    const appointment = allAppointments.find((item) => item.id === draggedAppointmentId);
    if (!appointment) {
      setDragError('Unable to move this appointment.');
      return;
    }
    if (!isAppointmentDraggable(appointment)) {
      setDragError('Only no payment, requested, or upcoming appointments can be moved.');
      return;
    }

    const snappedMinutes = clampMinutes(minutesSinceMidnight);
    const nextStart = buildAppointmentStartFromLocalMinutes(date, snappedMinutes);
    const durationMs = Math.max(
      5 * 60 * 1000,
      new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()
    );
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const appointmentServiceId = appointment.appointmentType?.id;
    const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);

    if (nextStart.getTime() < Date.now()) {
      setDragError('Cannot move an appointment to a past time.');
      return;
    }
    if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) {
      setDragError('Selected team member is not configured for this speciality.');
      return;
    }
    if (appointmentServiceId && targetPractitionerId) {
      const availableStartMinutes = await ensureDragAvailability(date, targetLeadId);
      if (!availableStartMinutes.includes(snappedMinutes)) {
        setDragError('No available slot for this service at the selected position.');
        return;
      }
    }
    if (hasConflict(appointment, nextStart, nextEnd, allAppointments, targetPractitionerId)) {
      setDragError('Scheduling conflict detected with another appointment.');
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
    } catch {
      setDragError('Unable to update appointment. Please try again.');
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
      const slotStartMinutes = toLocalMinutesFromUtcTime(slot.startTime);
      const slotEndMinutes = toLocalMinutesFromUtcTime(slot.endTime);
      const latestStartMinute = slotEndMinutes - params.durationMinutes;
      if (latestStartMinute < slotStartMinutes) return;
      const startMinute = Math.ceil(slotStartMinutes / 5) * 5;
      const endMinute = Math.floor(latestStartMinute / 5) * 5;
      for (let minute = startMinute; minute <= endMinute; minute += 5) {
        const nextStart = buildAppointmentStartFromLocalMinutes(params.date, minute);
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
    [allAppointments, buildAppointmentStartFromLocalMinutes, normalizeId]
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
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const handleChangeStatusAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeStatusPopup?.(true);
  };

  const dayEvents = useMemo(
    () => filteredList.filter((event) => isSameDay(new Date(event.startTime), currentDate)),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col">
      <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
      {dragError ? (
        <div className="px-3 py-2 text-caption-1 text-text-error border-b border-card-border">
          {dragError}
        </div>
      ) : null}
      {activeCalendar === 'day' && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeStatusAppointment={handleChangeStatusAppointment}
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
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={(dropDate, minute) => {
            moveAppointment(dropDate, minute).catch(() => undefined);
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
        />
      )}
      {activeCalendar === 'week' && (
        <WeekCalendar
          events={filteredList}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeStatusAppointment={handleChangeStatusAppointment}
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
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={(dropDate, minute) => {
            moveAppointment(dropDate, minute).catch(() => undefined);
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
        />
      )}
      {activeCalendar === 'team' && (
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewAppointment}
          handleRescheduleAppointment={handleRescheduleAppointment}
          handleChangeStatusAppointment={handleChangeStatusAppointment}
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
          draggedAppointmentDurationMinutes={dragContext?.durationMinutes}
          onAppointmentDropAt={(dropDate, minute, targetLeadId) => {
            moveAppointment(dropDate, minute, targetLeadId).catch(() => undefined);
            setDraggedAppointmentId(null);
            setDraggedAppointmentLabel(null);
            setDragContext(null);
          }}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
