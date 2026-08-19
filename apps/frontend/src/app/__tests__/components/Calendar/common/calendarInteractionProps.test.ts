import * as calendarInteractionPropsModule from '@/app/features/appointments/components/Calendar/common/calendarInteractionProps';
import type { Appointment } from '@yosemite-crew/types';

type AppointmentCalendarInteractionProps =
  calendarInteractionPropsModule.AppointmentCalendarInteractionProps;
type AvailabilityInterval = calendarInteractionPropsModule.AvailabilityInterval;

describe('AppointmentCalendarInteractionProps contract', () => {
  it('is a type-only module with zero runtime exports', () => {
    expect(Object.keys(calendarInteractionPropsModule)).toEqual([]);
  });

  const appointment = { _id: 'appt-1' } as unknown as Appointment;
  const date = new Date('2026-08-15T10:00:00Z');
  const intervals: AvailabilityInterval[] = [{ startMinute: 540, endMinute: 1020 }];

  it('accepts a minimal object with only the required field', () => {
    const minimal: AppointmentCalendarInteractionProps = { canEditAppointments: false };
    expect(minimal.canEditAppointments).toBe(false);
    expect(minimal.draggedAppointmentId).toBeUndefined();
    expect(minimal.getDropAvailabilityIntervals).toBeUndefined();
  });

  it('accepts a fully populated object and wires every handler', () => {
    const canDragAppointment = jest.fn((appt: Appointment) => appt === appointment);
    const onAppointmentDragStart = jest.fn();
    const onAppointmentDragEnd = jest.fn();
    const onAppointmentDropAt = jest.fn();
    const onDragHoverTarget = jest.fn();
    const onCreateAppointmentAt = jest.fn();
    const getDropAvailabilityIntervals = jest.fn(() => intervals);
    const getVisibleAvailabilityIntervals = jest.fn(() => intervals);

    const props: AppointmentCalendarInteractionProps = {
      canEditAppointments: true,
      draggedAppointmentId: 'appt-1',
      draggedAppointmentLabel: 'Bella — Vaccination',
      canDragAppointment,
      onAppointmentDragStart,
      onAppointmentDragEnd,
      onAppointmentDropAt,
      onDragHoverTarget,
      onCreateAppointmentAt,
      getDropAvailabilityIntervals,
      getVisibleAvailabilityIntervals,
      draggedAppointmentDurationMinutes: 30,
      slotStepMinutes: 15,
      availabilityLoaded: true,
      skipAutoScroll: false,
    };

    expect(props.canDragAppointment?.(appointment)).toBe(true);
    props.onAppointmentDragStart?.(appointment);
    props.onAppointmentDragEnd?.();
    props.onAppointmentDropAt?.(date, 600, 'lead-1');
    props.onDragHoverTarget?.(date, 'lead-1');
    props.onCreateAppointmentAt?.(date, 615);

    expect(onAppointmentDragStart).toHaveBeenCalledWith(appointment);
    expect(onAppointmentDragEnd).toHaveBeenCalledTimes(1);
    expect(onAppointmentDropAt).toHaveBeenCalledWith(date, 600, 'lead-1');
    expect(onDragHoverTarget).toHaveBeenCalledWith(date, 'lead-1');
    expect(onCreateAppointmentAt).toHaveBeenCalledWith(date, 615);

    expect(props.getDropAvailabilityIntervals?.(date, 'lead-1')).toEqual(intervals);
    expect(props.getVisibleAvailabilityIntervals?.(date)).toEqual(intervals);
  });

  it('allows null for the dragged-appointment id and label', () => {
    const props: AppointmentCalendarInteractionProps = {
      canEditAppointments: true,
      draggedAppointmentId: null,
      draggedAppointmentLabel: null,
    };
    expect(props.draggedAppointmentId).toBeNull();
    expect(props.draggedAppointmentLabel).toBeNull();
  });

  it('shapes availability intervals as minute ranges', () => {
    const interval: AvailabilityInterval = { startMinute: 0, endMinute: 1440 };
    expect(interval.endMinute).toBeGreaterThan(interval.startMinute);
  });
});
