import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AppointmentCalendar from '@/app/features/appointments/components/Calendar/AppointmentCalendar';
import {
  filterAppointmentsForWeek,
  resolveAvailabilityIntervalsForDay,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  getSlotsForServiceAndDateForPrimaryOrg,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadTeamAvailability } from '@/app/features/organization/services/availabilityService';
import { useNotify } from '@/app/hooks/useNotify';
import { allowCalendarDrag, canAssignAppointmentRoom } from '@/app/lib/appointments';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useOrgStore } from '@/app/stores/orgStore';

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
  ...jest.requireActual('@/app/features/appointments/components/Calendar/availabilityIntervals'),
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
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
    (useAvailabilityStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: {},
        availabilitiesById: {},
        status: 'loaded',
      })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', practionerId: 'vet-1', name: 'Dr Vet' },
      { _id: 'team-2', practionerId: 'vet-2', name: 'Dr Two' },
    ]);
    (allowCalendarDrag as jest.Mock).mockImplementation(
      (status: string) => status === 'REQUESTED' || status === 'UPCOMING'
    );
    (canAssignAppointmentRoom as jest.Mock).mockReturnValue(true);
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

  const getLatestDayCalendarProps = () => dayCalendarSpy.mock.calls.at(-1)![0];
  const dropDate = new Date('2027-01-06T00:00:00Z');

  const renderDayCalendarProps = (
    overrides: Partial<React.ComponentProps<typeof AppointmentCalendar>> = {}
  ) => {
    renderCalendar(overrides);
    return getLatestDayCalendarProps();
  };

  const startAppointmentDrag = async (appointment = appointments[0]) => {
    let props = getLatestDayCalendarProps();
    await act(async () => {
      props.onAppointmentDragStart(appointment);
    });
    props = getLatestDayCalendarProps();
    return props;
  };

  const runLatestDayCalendarAction = async (action: (props: any) => void) => {
    const props = getLatestDayCalendarProps();
    await act(async () => {
      action(props);
    });
  };

  const dropLatestAppointment = async (minute = 600) => {
    await runLatestDayCalendarAction((props) => props.onAppointmentDropAt(dropDate, minute));
  };

  const hoverLatestAppointment = async () => {
    await runLatestDayCalendarAction((props) => props.onDragHoverTarget(dropDate));
  };

  it('renders day calendar and forwards header props', () => {
    renderCalendar();

    expect(dayCalendarSpy).toHaveBeenCalledTimes(1);
    const dayProps = dayCalendarSpy.mock.calls[0][0];
    expect(dayProps.events.map((event: { id: string }) => event.id)).toEqual(['a1', 'a2']);

    const headerProps = headerSpy.mock.calls[0][0];
    expect(headerProps.activeCalendar).toBe('day');
    expect(headerProps.onAddButtonClick).toBe(onAddAppointment);
    expect(headerProps.showAddButton).toBe(true);
  });

  it('opens appointment view and keeps intent when child requests it', () => {
    const props = renderDayCalendarProps();

    act(() => {
      props.handleViewAppointment(appointments[0], 'lab-test');
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setViewIntent).toHaveBeenCalledWith('lab-test');
    expect(setViewPopup).toHaveBeenCalledWith(true);
  });

  it('blocks reschedule when appointment cannot be dragged', () => {
    (allowCalendarDrag as jest.Mock).mockReturnValue(false);
    const props = renderDayCalendarProps();

    act(() => {
      props.handleRescheduleAppointment(appointments[0]);
    });

    expect(setReschedulePopup).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Reschedule blocked' })
    );
  });

  it('opens accept modal for requested appointments', () => {
    const props = renderDayCalendarProps();

    act(() => {
      props.handleAcceptAppointment(appointments[0]);
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setChangeStatusPreferredStatus).toHaveBeenCalledWith('UPCOMING');
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
    expect(notifyMock).not.toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Status change blocked' })
    );
  });

  it('blocks room change when appointment status disallows room assignment', () => {
    (canAssignAppointmentRoom as jest.Mock).mockReturnValue(false);
    const props = renderDayCalendarProps();

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
    const props = renderDayCalendarProps();

    act(() => {
      props.handleRescheduleAppointment(appointments[0]);
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it('opens room-change popup when status allows room assignment', () => {
    const props = renderDayCalendarProps();

    act(() => {
      props.handleChangeRoomAppointment(appointments[0]);
    });

    expect(setActiveAppointment).toHaveBeenCalledWith(appointments[0]);
    expect(setChangeRoomPopup).toHaveBeenCalledWith(true);
  });

  it('moves appointment on valid drop and clears any previous drag error', async () => {
    renderCalendar();
    await startAppointmentDrag();
    await dropLatestAppointment();

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
    await startAppointmentDrag();
    await dropLatestAppointment();

    expect(await screen.findByText('Server rejected move')).toBeInTheDocument();
  });

  it('shows fallback drag error when drop update rejects with a string', async () => {
    (updateAppointment as jest.Mock).mockRejectedValue('oops');
    renderCalendar();
    await startAppointmentDrag();
    await dropLatestAppointment();

    expect(await screen.findByText(/Unable to update appointment/i)).toBeInTheDocument();
  });

  it('shows fallback drag error when drop update rejects with undefined', async () => {
    (updateAppointment as jest.Mock).mockRejectedValue(undefined);
    renderCalendar();
    await startAppointmentDrag();
    await dropLatestAppointment();

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
    await startAppointmentDrag({
      ...appointments[0],
      lead: undefined,
      startTime: new Date('2027-01-06T08:00:00Z'),
      endTime: new Date('2027-01-06T08:30:00Z'),
    });
    await dropLatestAppointment();

    expect(updateAppointment).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ text: 'Scheduling conflict detected with another appointment.' })
    );
  });

  it('blocks drop when the dragged appointment is unavailable', async () => {
    renderCalendar();
    await startAppointmentDrag({ ...appointments[0], id: undefined });
    await dropLatestAppointment();

    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it('warns when dragged appointment cannot be found for drop', async () => {
    renderCalendar({ allAppointments: [] });
    await startAppointmentDrag();
    await dropLatestAppointment();

    expect(updateAppointment).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ text: 'Unable to move this appointment.' })
    );
  });

  it('blocks drop to a past time', async () => {
    const dateSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2027-01-07T00:00:00Z').getTime());
    renderCalendar();
    await startAppointmentDrag();
    await dropLatestAppointment();

    expect(updateAppointment).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ text: 'Cannot move an appointment to a past time.' })
    );
    dateSpy.mockRestore();
  });

  it('blocks drop when selected team member cannot support the speciality', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      {
        _id: 'team-1',
        practionerId: 'vet-1',
        name: 'Dr Vet',
        speciality: [{ id: 'other-spec', name: 'Surgery' }],
      },
    ]);
    renderCalendar({ activeCalendar: 'team' });
    let props = userCalendarSpy.mock.calls[0][0];

    await act(async () => {
      props.onAppointmentDragStart(appointments[0]);
    });

    props = userCalendarSpy.mock.calls.at(-1)![0];
    await act(async () => {
      props.onAppointmentDropAt(new Date('2027-01-06T00:00:00Z'), 600, 'team-1');
    });

    expect(updateAppointment).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({
        text: 'Selected team member is not configured for this speciality.',
      })
    );
  });

  it('blocks drop when no matching service slot is available', async () => {
    (getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([
      { startTime: '12:00', endTime: '13:00', vetIds: ['vet-1'] },
    ]);
    renderCalendar();
    await startAppointmentDrag();
    await dropLatestAppointment();

    expect(updateAppointment).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({
        text: 'No available slot for this service at the selected position.',
      })
    );
  });

  it('builds contiguous drop availability intervals from valid service slots', async () => {
    renderCalendar();
    await startAppointmentDrag();
    await hoverLatestAppointment();

    const props = getLatestDayCalendarProps();
    expect(props.getDropAvailabilityIntervals(new Date('2027-01-06T00:00:00Z'))).toEqual([
      { startMinute: 540, endMinute: 630 },
    ]);
  });

  it('auto-scrolls while dragging near a calendar edge', async () => {
    const scrollContainer = document.createElement('div');
    scrollContainer.dataset.calendarScroll = 'true';
    scrollContainer.scrollBy = jest.fn();
    scrollContainer.getBoundingClientRect = jest.fn(() => ({
      bottom: 200,
      height: 200,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
    document.body.appendChild(scrollContainer);
    const elementFromPointMock = jest.fn().mockReturnValue(scrollContainer);
    Object.defineProperty(document, 'elementFromPoint', {
      value: elementFromPointMock,
      configurable: true,
    });
    renderCalendar();
    await startAppointmentDrag();

    const event = new Event('dragover');
    Object.defineProperty(event, 'clientX', { value: 10 });
    Object.defineProperty(event, 'clientY', { value: 10 });
    globalThis.dispatchEvent(event);

    expect(globalThis.scrollBy).toHaveBeenCalledWith({ left: -28 });
    expect(globalThis.scrollBy).toHaveBeenCalledWith({ top: -28 });
    expect(scrollContainer.scrollBy).toHaveBeenCalledWith({ left: -28, top: -28 });
    scrollContainer.remove();
  });

  it('returns visible availability intervals for a team member', () => {
    (useAvailabilityStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['availability-1'] },
        availabilitiesById: { 'availability-1': { id: 'availability-1' } },
        status: 'loaded',
      })
    );
    renderCalendar({ activeCalendar: 'team' });
    const props = userCalendarSpy.mock.calls[0][0];

    props.getVisibleAvailabilityIntervals(new Date('2027-01-06T00:00:00Z'), 'vet-1');

    expect(resolveAvailabilityIntervalsForDay).toHaveBeenCalledWith(
      expect.objectContaining({
        allEntries: [expect.objectContaining({ id: 'availability-1' })],
        dayKey: 'MONDAY',
        targetIds: expect.any(Set),
      })
    );
  });

  it('returns no visible availability when organisation is missing', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null })
    );
    renderCalendar({ activeCalendar: 'team' });
    const props = userCalendarSpy.mock.calls[0][0];

    expect(
      props.getVisibleAvailabilityIntervals(new Date('2027-01-06T00:00:00Z'), 'vet-1')
    ).toEqual([]);
    expect(resolveAvailabilityIntervalsForDay).not.toHaveBeenCalled();
  });

  it('loads team availability on team calendar mount', async () => {
    renderCalendar({ activeCalendar: 'team' });

    await waitFor(() => {
      expect(loadTeamAvailability).toHaveBeenCalledWith('org-1');
      expect(userCalendarSpy).toHaveBeenCalled();
    });
  });

  it('renders week calendar with all filtered appointments in week mode', () => {
    const weekAppointments = appointments.map((appointment, index) => ({
      ...appointment,
      startTime: new Date(`2025-01-0${6 + index}T10:00:00Z`),
      endTime: new Date(`2025-01-0${6 + index}T10:30:00Z`),
      appointmentDate: new Date(`2025-01-0${6 + index}T10:00:00Z`),
    }));
    renderCalendar({
      activeCalendar: 'week',
      filteredList: weekAppointments as any,
      allAppointments: weekAppointments as any,
      weekStart: new Date('2025-01-06T00:00:00Z'),
    });

    expect(weekCalendarSpy).toHaveBeenCalledTimes(1);
    expect(weekCalendarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ id: 'a1' }),
          expect.objectContaining({ id: 'a2' }),
        ]),
      })
    );
  });

  it('filters week appointments to only overlapping events', () => {
    const mockedWeekStart = new Date('2025-01-06T00:00:00Z');
    const result = filterAppointmentsForWeek(
      [
        {
          ...appointments[0],
          startTime: new Date('2025-01-06T09:00:00Z'),
          endTime: new Date('2025-01-06T09:30:00Z'),
        },
        {
          ...appointments[1],
          id: 'a3',
          startTime: new Date('2025-02-10T10:00:00Z'),
          endTime: new Date('2025-02-10T10:30:00Z'),
        },
      ] as any,
      mockedWeekStart
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'a1',
      }),
    ]);
  });

  it('prefetches drag availability on hover after drag start', async () => {
    renderCalendar();
    await startAppointmentDrag();
    await hoverLatestAppointment();

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
