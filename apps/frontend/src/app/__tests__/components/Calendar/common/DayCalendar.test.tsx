import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DayCalendar from '@/app/features/appointments/components/Calendar/common/DayCalendar';

jest.useFakeTimers();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="mock-next-image">{alt || ''}</span>,
}));

const mockGetDayWindow = jest.fn((events: any[]) => {
  void events;
  return {
    windowStart: 0,
    windowEnd: 120,
  };
});
const mockGetTotalWindowHeightPx = jest.fn((start: number, end: number) => {
  void start;
  void end;
  return 200;
});
const mockIsAllDayForDate = jest.fn();
const mockLayoutDayEvents = jest.fn();
const mockGetNowTopPxForWindow = jest.fn<any, any[]>(() => null);
const mockGetFirstRelevantTimedEventStart = jest.fn<any, any[]>(() => null);
const mockMinutesSinceStartOfDay = jest.fn<any, any[]>(() => 0);
const mockScrollContainerToTarget = jest.fn<any, any[]>();

jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  DEFAULT_CALENDAR_FOCUS_MINUTES: 540,
  EVENT_HORIZONTAL_GAP_PX: 4,
  EVENT_VERTICAL_GAP_PX: 2,
  DAY_START_MINUTES: 0,
  DAY_END_MINUTES: 24 * 60,
  MINUTES_PER_STEP: 5,
  PIXELS_PER_STEP: 20,
  getDayWindow: (events: any[]) => mockGetDayWindow(events),
  getTotalWindowHeightPx: (start: number, end: number) => mockGetTotalWindowHeightPx(start, end),
  isAllDayForDate: (event: any, date: Date) => mockIsAllDayForDate(event, date),
  layoutDayEvents: (events: any[], start: number, end: number) =>
    mockLayoutDayEvents(events, start, end),
  getNowTopPxForWindow: (date: Date, windowStart: number, windowEnd: number) =>
    mockGetNowTopPxForWindow(date, windowStart, windowEnd),
  getFirstRelevantTimedEventStart: (events: any[], rangeStart: Date, rangeEnd: Date, now?: Date) =>
    mockGetFirstRelevantTimedEventStart(events, rangeStart, rangeEnd, now),
  minutesSinceStartOfDay: (date: Date) => mockMinutesSinceStartOfDay(date),
  nextDay: (date: Date) => new Date(date.getTime() + 24 * 60 * 60 * 1000),
  scrollContainerToTarget: (container: HTMLElement, targetTopPx: number) =>
    mockScrollContainerToTarget(container, targetTopPx),
}));

jest.mock('@/app/features/appointments/components/Calendar/common/TimeLabels', () => () => (
  <div data-testid="time-labels" />
));

jest.mock('@/app/features/appointments/components/Calendar/common/HorizontalLines', () => () => (
  <div data-testid="horizontal-lines" />
));

jest.mock('@/app/ui/tables/Appointments', () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: 'purple', color: 'white' })),
}));

jest.mock('@/app/lib/appointments', () => ({
  allowReschedule: jest.fn(() => true),
  canAssignAppointmentRoom: jest.fn(() => true),
  canShowStatusChangeAction: jest.fn(() => true),
  getAllowedAppointmentStatusTransitions: jest.fn(() => ['CHECKED_IN', 'CANCELLED']),
  getAppointmentCompanionPhotoUrl: jest.fn(() => ''),
  getClinicalNotesIntent: jest.fn(() => ({ label: 'prescription', subLabel: 'subjective' })),
  getClinicalNotesLabel: jest.fn(() => 'Medical Records'),
  isRequestedLikeStatus: jest.fn(
    (status: string) => status === 'REQUESTED' || status === 'NO_PAYMENT'
  ),
  normalizeAppointmentStatus: (status: string) => (status === 'NO_PAYMENT' ? 'REQUESTED' : status),
  toStatusLabel: (status: string) => status,
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: jest.fn(),
  updateAppointment: jest.fn(),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => 'image'),
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Prev
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Next', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Next
    </button>
  ),
}));

jest.mock('react-icons/io', () => ({
  IoIosCalendar: () => <span>reschedule</span>,
}));

jest.mock('react-icons/io5', () => ({
  IoChevronForward: () => <span>chevron</span>,
  IoEyeOutline: () => <span>view</span>,
  IoCalendarOutline: () => <span>reschedule</span>,
  IoDocumentTextOutline: () => <span>soap</span>,
  IoCardOutline: () => <span>finance</span>,
  IoFlaskOutline: () => <span>lab</span>,
}));

jest.mock('react-icons/md', () => ({
  MdMeetingRoom: () => <span>room</span>,
  MdOutlineAutorenew: () => <span>change-status</span>,
}));

describe('DayCalendar (Appointments)', () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const setCurrentDate = jest.fn();
  const originalConsoleError = console.error;

  const baseDate = new Date('2025-01-06T10:00:00Z');

  const allDayEvent: any = {
    id: 'all-day',
    status: 'completed',
    startTime: new Date('2025-01-06T00:00:00Z'),
    companion: {
      name: 'Buddy',
      species: 'dog',
      parent: { name: 'Sam' },
    },
    concern: 'Checkup',
  };

  const timedEvent: any = {
    id: 'timed',
    status: 'in_progress',
    startTime: new Date('2025-01-06T09:00:00Z'),
    endTime: new Date('2025-01-06T10:00:00Z'),
    appointmentType: { id: 'service-1', name: 'Grooming', speciality: { name: 'Wellness' } },
    companion: {
      name: 'Rex',
      species: 'dog',
      parent: { name: 'Alex' },
    },
    concern: 'Grooming',
    lead: { name: 'Dr. Lee' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAllDayForDate.mockImplementation((event: any) => event.id === 'all-day');
    mockLayoutDayEvents.mockReturnValue([
      {
        ...timedEvent,
        topPx: 10,
        heightPx: 80,
        columnIndex: 0,
        columnsCount: 1,
      },
    ]);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it('renders all-day events and opens quick actions on single click', () => {
    render(
      <DayCalendar
        events={[allDayEvent, timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments={false}
      />
    );

    expect(screen.getByText('All-day')).toBeInTheDocument();
    const allDayButton = screen.getByText('Buddy').closest('button');
    expect(allDayButton).toBeInTheDocument();

    fireEvent.click(allDayButton!);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(handleViewAppointment).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Appointment quick actions' })).toBeInTheDocument();
  });

  it('renders timed events and handles reschedule clicks from the single-click popover', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((message: any, ...args: any[]) => {
        const text = typeof message === 'string' ? message : message?.message || '';
        if (text.includes('concurrent rendering') || text.includes('validateDOMNesting')) {
          return;
        }
        originalConsoleError(message, ...args);
      });

    render(
      <DayCalendar
        events={[timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    const eventButton = screen.getByRole('button', { name: /Rex/i });
    fireEvent.click(eventButton);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getAllByText('Grooming').length).toBeGreaterThan(0);
    expect(screen.getByText('Speciality')).toBeInTheDocument();
    expect(screen.getAllByText('Wellness').length).toBeGreaterThan(0);
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('Dr. Lee')).toBeInTheDocument();

    const rescheduleButton = screen.getByTitle(/reschedule/i);
    fireEvent.click(rescheduleButton);

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'timed' })
    );
    expect(handleViewAppointment).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('opens the appointment on marker double click', () => {
    render(
      <DayCalendar
        events={[timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    fireEvent.doubleClick(screen.getByRole('button', { name: /Rex/i }));

    expect(handleViewAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'timed' }));
  });

  it('opens the custom context menu on right click', () => {
    render(
      <DayCalendar
        events={[timedEvent]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /Rex/i }));

    expect(screen.getByRole('menu', { name: 'Appointment context actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open companion overview' })).toBeInTheDocument();
  });

  it('updates current date with navigation', () => {
    render(
      <DayCalendar
        events={[]}
        date={baseDate}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        setCurrentDate={setCurrentDate}
        canEditAppointments={false}
      />
    );

    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Prev'));

    const nextFn = setCurrentDate.mock.calls[0][0];
    const prevFn = setCurrentDate.mock.calls[1][0];

    expect(nextFn(new Date(2025, 0, 6)).getDate()).toBe(7);
    expect(prevFn(new Date(2025, 0, 6)).getDate()).toBe(5);
  });
});
