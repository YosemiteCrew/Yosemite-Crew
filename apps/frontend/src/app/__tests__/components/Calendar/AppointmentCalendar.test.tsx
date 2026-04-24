import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentCalendar from '@/app/features/appointments/components/Calendar/AppointmentCalendar';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { useNotify } from '@/app/hooks/useNotify';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getPreferredNextAppointmentStatus,
} from '@/app/lib/appointments';

const dayCalendarSpy = jest.fn();
const weekCalendarSpy = jest.fn();
const userCalendarSpy = jest.fn();
const headerSpy = jest.fn();
const notifyMock = jest.fn();

jest.mock(
  '@/app/features/appointments/components/Calendar/common/DayCalendar',
  () => (props: any) => {
    dayCalendarSpy(props);
    return <div data-testid="day-calendar" />;
  }
);

jest.mock(
  '@/app/features/appointments/components/Calendar/common/WeekCalendar',
  () => (props: any) => {
    weekCalendarSpy(props);
    return <div data-testid="week-calendar" />;
  }
);

jest.mock(
  '@/app/features/appointments/components/Calendar/common/UserCalendar',
  () => (props: any) => {
    userCalendarSpy(props);
    return <div data-testid="user-calendar" />;
  }
);

jest.mock('@/app/features/appointments/components/Calendar/common/Header', () => (props: any) => {
  headerSpy(props);
  return <div data-testid="calendar-header" />;
});

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
  updateAppointment: jest.fn(),
}));

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  loadTeamAvailability: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowCalendarDrag: jest.fn(),
  canAssignAppointmentRoom: jest.fn(),
  canShowStatusChangeAction: jest.fn(),
  getPreferredNextAppointmentStatus: jest.fn(),
}));

jest.mock('@/app/features/appointments/components/Calendar/weekHelpers', () => ({
  getWeekDays: jest.fn(() => [new Date('2025-01-06T00:00:00Z'), new Date('2025-01-07T00:00:00Z')]),
}));

jest.mock('@/app/lib/timezone', () => ({
  buildDateInPreferredTimeZone: jest.fn((date: Date, minuteOfDay: number) => {
    const next = new Date(date);
    next.setUTCHours(0, minuteOfDay, 0, 0);
    return next;
  }),
  formatDateInPreferredTimeZone: jest.fn((date: Date, options: Intl.DateTimeFormatOptions) => {
    if (options.weekday) {
      return 'MONDAY';
    }
    return '2025-01-06';
  }),
  isOnPreferredTimeZoneCalendarDay: jest.fn(
    (a: Date, b: Date) => a.getUTCDate() === b.getUTCDate()
  ),
  utcClockTimeToPreferredTimeZoneClock: jest.fn((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return { minutes: hours * 60 + minutes, dayOffset: 0 };
  }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector: any) => selector({ primaryOrgId: 'org-1' })),
}));

jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: jest.fn((selector: any) =>
    selector({
      availabilityIdsByOrgId: {},
      availabilitiesById: {},
      status: 'loaded',
    })
  ),
}));

jest.mock('@/app/hooks/useAvailabiities', () => ({
  useLoadAvailabilities: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({
      attributes: { sub: 'user-1', email: 'user-1@example.com' },
    })
  ),
}));

jest.mock('@/app/features/appointments/components/Calendar/availabilityIntervals', () => ({
  resolveAvailabilityIntervalsForDay: jest.fn(() => []),
}));

describe('AppointmentCalendar', () => {
  const setActiveAppointment = jest.fn();
  const setViewPopup = jest.fn();
  const setViewIntent = jest.fn();
  const setChangeStatusPopup = jest.fn();
  const setChangeStatusPreferredStatus = jest.fn();
  const setChangeRoomPopup = jest.fn();
  const setReschedulePopup = jest.fn();
  const setCurrentDate = jest.fn();
  const setWeekStart = jest.fn();
  const onCreateFromCalendarSlot = jest.fn();
  const onAddAppointment = jest.fn();

  const currentDate = new Date('2027-01-06T10:00:00Z');
  const weekStart = new Date('2027-01-06T00:00:00Z');

  const appointments: any[] = [
    {
      id: 'a1',
      status: 'REQUESTED',
      startTime: new Date('2027-01-06T09:00:00Z'),
      endTime: new Date('2027-01-06T09:30:00Z'),
      appointmentDate: new Date('2027-01-06T09:00:00Z'),
      organisationId: 'org-1',
      appointmentType: { id: 'svc-1', speciality: { id: 'spec-1', name: 'General' } },
      companion: { name: 'Buddy' },
      lead: { id: 'vet-1', name: 'Dr Vet' },
      room: { id: 'room-1' },
    },
    {
      id: 'a2',
      status: 'UPCOMING',
      startTime: new Date('2027-01-06T10:00:00Z'),
      endTime: new Date('2027-01-06T10:30:00Z'),
      appointmentDate: new Date('2027-01-06T10:00:00Z'),
      organisationId: 'org-1',
      appointmentType: { id: 'svc-1', speciality: { id: 'spec-1', name: 'General' } },
      companion: { name: 'Mochi' },
      lead: { id: 'vet-2', name: 'Dr Two' },
      room: { id: 'room-2' },
    },
  ];

  const renderCalendar = (
    overrides: Partial<React.ComponentProps<typeof AppointmentCalendar>> = {}
  ) =>
    render(
      <AppointmentCalendar
        filteredList={appointments as any}
        allAppointments={appointments as any}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setViewIntent={setViewIntent}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setChangeRoomPopup={setChangeRoomPopup}
        activeCalendar="day"
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
        onCreateFromCalendarSlot={onCreateFromCalendarSlot}
        onAddAppointment={onAddAppointment}
        {...overrides}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotify as jest.Mock).mockReturnValue({ notify: notifyMock });
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', practionerId: 'vet-1', name: 'Dr Vet' },
      { _id: 'team-2', practionerId: 'vet-2', name: 'Dr Two' },
    ]);
    (allowCalendarDrag as jest.Mock).mockImplementation(
      (status: string) => status === 'REQUESTED' || status === 'UPCOMING'
    );
    (canShowStatusChangeAction as jest.Mock).mockReturnValue(true);
    (canAssignAppointmentRoom as jest.Mock).mockReturnValue(true);
    (getPreferredNextAppointmentStatus as jest.Mock).mockReturnValue('UPCOMING');
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([
      { startTime: '09:00', endTime: '11:00', vetIds: ['vet-1', 'vet-2'] },
    ]);
    (updateAppointment as jest.Mock).mockResolvedValue({});
    (loadTeamAvailability as jest.Mock).mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'scrollBy', {
      value: jest.fn(),
      configurable: true,
    });
  });

  it('renders day calendar and forwards header props', () => {
    renderCalendar();

    expect(dayCalendarSpy).toHaveBeenCalledTimes(1);
    expect(headerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        activeCalendar: 'day',
        onAddButtonClick: onAddAppointment,
        showAddButton: true,
      })
    );
  });

  it('opens appointment view and keeps intent when child requests it', () => {
    renderCalendar();
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleViewAppointment(appointments[0], 'lab-test');
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setViewIntent).toHaveBeenCalledWith('lab-test');
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it('blocks reschedule when appointment cannot be dragged', () => {
    (allowCalendarDrag as jest.Mock).mockReturnValue(false);
    renderCalendar();
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleRescheduleAppointment(appointments[0]);
    });

    expect(setReschedulePopup).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Reschedule blocked' })
    );
  });

  it('blocks status change when appointment has no allowed next action', () => {
    (canShowStatusChangeAction as jest.Mock).mockReturnValue(false);
    renderCalendar({ activeCalendar: 'week' });
    const props = weekCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleChangeStatusAppointment(appointments[0]);
    });

    expect(setChangeStatusPopup).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Status change blocked' })
    );
  });

  it('blocks room change when appointment status disallows room assignment', () => {
    (canAssignAppointmentRoom as jest.Mock).mockReturnValue(false);
    renderCalendar();
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleChangeRoomAppointment(appointments[0]);
    });

    expect(setChangeRoomPopup).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Room update blocked' })
    );
  });

  it('opens reschedule popup for draggable appointments', () => {
    renderCalendar();
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleRescheduleAppointment(appointments[0]);
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('opens status-change popup with preferred next status', () => {
    renderCalendar({ activeCalendar: 'week' });
    const props = weekCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleChangeStatusAppointment(appointments[0]);
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setChangeStatusPreferredStatus).toHaveBeenCalledWith('UPCOMING');
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
  });

  it('opens room-change popup when status allows room assignment', () => {
    renderCalendar();
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.handleChangeRoomAppointment(appointments[0]);
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setChangeRoomPopup).toHaveBeenCalledWith(true);
  });

  it('moves appointment on valid drop and clears any previous drag error', async () => {
    renderCalendar();
    let props = dayCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart(appointments[0]);
    });

    props = dayCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onAppointmentDropAt(new Date('2027-01-06T00:00:00Z'), 600);
    });

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a1',
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          appointmentDate: expect.any(Date),
        })
      );
    });

    expect(screen.queryByText(/unable to update appointment/i)).not.toBeInTheDocument();
  });

  it('shows drag error when drop update fails', async () => {
    (updateAppointment as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Server rejected move' } },
    });
    renderCalendar();
    let props = dayCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart(appointments[0]);
    });

    props = dayCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onAppointmentDropAt(new Date('2027-01-06T00:00:00Z'), 600);
    });

    expect(await screen.findByText('Server rejected move')).toBeInTheDocument();
  });

  it('shows fallback drag error when drop update rejects with a string', async () => {
    (updateAppointment as jest.Mock).mockRejectedValue('oops');
    renderCalendar();
    let props = dayCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart(appointments[0]);
    });

    props = dayCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onAppointmentDropAt(new Date('2027-01-06T00:00:00Z'), 600);
    });

    expect(await screen.findByText(/Unable to update appointment/i)).toBeInTheDocument();
  });

  it('shows fallback drag error when drop update rejects with undefined', async () => {
    (updateAppointment as jest.Mock).mockRejectedValue(undefined);
    renderCalendar();
    let props = dayCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart(appointments[0]);
    });

    props = dayCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onAppointmentDropAt(new Date('2027-01-06T00:00:00Z'), 600);
    });

    expect(await screen.findByText(/Unable to update appointment/i)).toBeInTheDocument();
  });

  it('blocks drop when another appointment conflicts on lead or room', async () => {
    renderCalendar({
      allAppointments: [
        {
          ...appointments[0],
          lead: undefined,
        },
        {
          ...appointments[1],
          lead: undefined,
          room: { id: 'room-1' },
        },
      ] as any,
    });
    let props = dayCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart({
        ...appointments[0],
        lead: undefined,
        startTime: new Date('2027-01-06T08:00:00Z'),
        endTime: new Date('2027-01-06T08:30:00Z'),
      });
    });

    props = dayCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onAppointmentDropAt(new Date('2027-01-06T00:00:00Z'), 600);
    });

    expect(updateAppointment).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ text: 'Scheduling conflict detected with another appointment.' })
    );
  });

  it('loads team availability on team calendar mount', async () => {
    renderCalendar({ activeCalendar: 'team' });

    await waitFor(() => {
      expect(loadTeamAvailability).toHaveBeenCalledWith('org-1');
      expect(userCalendarSpy).toHaveBeenCalled();
    });
  });

  it('renders week calendar with current-user filtered appointments in week mode', () => {
    renderCalendar({ activeCalendar: 'week' });

    expect(weekCalendarSpy).toHaveBeenCalledTimes(1);
    expect(weekCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [],
      })
    );
  });

  it('prefetches drag availability on hover after drag start', async () => {
    renderCalendar();
    let props = dayCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart(appointments[0]);
    });

    props = dayCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onDragHoverTarget(new Date('2027-01-06T00:00:00Z'));
    });

    await waitFor(() => {
      expect(getSlotsForServiceAndDateForPrimaryOrg).toHaveBeenCalledWith(
        'svc-1',
        expect.any(Date)
      );
    });
  });

  it('creates appointment prefill with resolved team practitioner in team view', () => {
    renderCalendar({ activeCalendar: 'team' });
    const props = userCalendarSpy.mock.calls[0][0];

    act(() => {
      props.onCreateAppointmentAt(new Date('2027-01-06T00:00:00Z'), 615, 'team-1');
    });

    expect(onCreateFromCalendarSlot).toHaveBeenCalledWith({
      date: new Date('2027-01-06T00:00:00Z'),
      minuteOfDay: 615,
      leadId: 'vet-1',
    });
  });

  it('does not create appointment prefill when editing is disabled', () => {
    renderCalendar({ canEditAppointments: false });
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.onCreateAppointmentAt(new Date('2027-01-06T00:00:00Z'), 615);
    });

    expect(onCreateFromCalendarSlot).not.toHaveBeenCalled();
  });

  it('creates appointment prefill with current user practitioner in day view', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', practionerId: 'vet-1', userId: 'user-1', name: 'Dr Vet' },
    ]);
    renderCalendar({ activeCalendar: 'day' });
    const props = dayCalendarSpy.mock.calls[0][0];

    act(() => {
      props.onCreateAppointmentAt(new Date('2027-01-06T00:00:00Z'), 630);
    });

    expect(onCreateFromCalendarSlot).toHaveBeenCalledWith({
      date: new Date('2027-01-06T00:00:00Z'),
      minuteOfDay: 630,
      leadId: 'vet-1',
    });
  });
});
