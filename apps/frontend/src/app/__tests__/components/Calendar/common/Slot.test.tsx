import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Slot from '@/app/features/appointments/components/Calendar/common/Slot';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import {
  acceptAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';

jest.useFakeTimers();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="mock-next-image">{alt || ''}</span>,
}));

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

jest.mock('@/app/features/appointments/components/Calendar/calendarDrop', () => ({
  calcNearestAvailableMinute: jest.fn((minute: number) => minute),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  acceptAppointment: jest.fn(),
  changeAppointmentStatus: jest.fn(),
  rejectAppointment: jest.fn(),
  updateAppointment: jest.fn(),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => 'image'),
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

describe('Slot (Appointments)', () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const originalConsoleError = console.error;

  const event: any = {
    status: 'in_progress',
    startTime: new Date('2025-01-06T09:00:00Z'),
    endTime: new Date('2025-01-06T10:00:00Z'),
    concern: 'Checkup',
    lead: { name: 'Dr. Lee' },
    appointmentType: { name: 'Exam' },
    companion: { name: 'Rex', species: 'dog' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (calcNearestAvailableMinute as jest.Mock).mockImplementation((minute: number) => minute);
    (acceptAppointment as jest.Mock).mockResolvedValue({});
    (rejectAppointment as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it('shows empty state when no appointments exist', () => {
    const { container } = render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveStyle({ height: '120px' });
  });

  it('renders appointments and opens quick actions on single click', () => {
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
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const viewButton = screen.getByRole('button', { name: /Rex/i });
    fireEvent.click(viewButton);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(handleViewAppointment).not.toHaveBeenCalled();
    expect(screen.getByTitle(/reschedule/i)).toBeInTheDocument();

    const rescheduleButton = screen.getByTitle(/reschedule/i);
    fireEvent.click(rescheduleButton);

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(event);

    consoleSpy.mockRestore();
  });

  it('opens the appointment on marker double click', () => {
    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    fireEvent.doubleClick(screen.getByRole('button', { name: /Rex/i }));

    expect(handleViewAppointment).toHaveBeenCalledWith(event);
  });

  it('creates appointment when empty slot is clicked', () => {
    const onCreateAppointmentAt = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        dropHour={9}
        onCreateAppointmentAt={onCreateAppointmentAt}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Create appointment in this calendar slot' })
    );
    expect(onCreateAppointmentAt).toHaveBeenCalled();
  });

  it('drops dragged appointment into nearest available minute', () => {
    const onAppointmentDropAt = jest.fn();
    (calcNearestAvailableMinute as jest.Mock).mockReturnValue(575);

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        draggedAppointmentId="appt-1"
        draggedAppointmentLabel="Buddy"
        onAppointmentDropAt={onAppointmentDropAt}
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        dropHour={9}
        dropAvailabilityIntervals={[{ startMinute: 540, endMinute: 599 }]}
      />
    );

    const slot = screen.getByRole('application');
    fireEvent.dragOver(slot, { clientX: 10, clientY: 20 });
    fireEvent.drop(slot, { clientX: 10, clientY: 20 });

    expect(onAppointmentDropAt).toHaveBeenCalledWith(expect.any(Date), 575, undefined);
  });

  it('does not drop appointment when nearest available minute is null', () => {
    const onAppointmentDropAt = jest.fn();
    (calcNearestAvailableMinute as jest.Mock).mockReturnValue(null);

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        draggedAppointmentId="appt-1"
        draggedAppointmentLabel="Buddy"
        onAppointmentDropAt={onAppointmentDropAt}
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        dropHour={9}
        dropAvailabilityIntervals={[{ startMinute: 540, endMinute: 599 }]}
      />
    );

    const slot = screen.getByRole('application');
    fireEvent.dragOver(slot, { clientX: 10, clientY: 20 });
    fireEvent.drop(slot, { clientX: 10, clientY: 20 });

    expect(onAppointmentDropAt).not.toHaveBeenCalled();
  });

  it('creates appointment on slot double click when create handler exists', () => {
    const onCreateAppointmentAt = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        dropDate={new Date('2026-03-16T00:00:00.000Z')}
        dropHour={9}
        onCreateAppointmentAt={onCreateAppointmentAt}
      />
    );

    fireEvent.doubleClick(
      screen.getByRole('button', { name: 'Create appointment in this calendar slot' })
    );
    expect(onCreateAppointmentAt).toHaveBeenCalled();
  });

  it('hides edit-only quick actions when canEditAppointments is false', () => {
    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments={false}
      />
    );

    const viewButton = screen.getByRole('button', { name: /Rex/i });
    fireEvent.click(viewButton);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByTitle(/reschedule/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/change status/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/change room/i)).not.toBeInTheDocument();
  });

  it('accepts and declines requested-like appointments from quick actions', async () => {
    const requestedEvent = {
      ...event,
      id: 'requested-1',
      status: 'REQUESTED',
      companion: { ...event.companion, parent: { name: 'Sam' }, breed: 'Labrador' },
      appointmentType: { ...event.appointmentType, name: 'Consult' },
      room: { name: 'Room 2' },
      lead: { name: 'Dr. Lee' },
      endTime: new Date('2025-01-06T09:30:00Z'),
    } as any;

    render(
      <Slot
        slotEvents={[requestedEvent]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const eventButton = screen.getByRole('button', { name: /Rex/i });
    fireEvent.click(eventButton);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle('Accept request'));
    });
    expect(acceptAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'requested-1' }));

    fireEvent.click(eventButton);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    await act(async () => {
      fireEvent.click(screen.getByTitle('Decline request'));
    });
    expect(rejectAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'requested-1' }));
  });

  it('opens the custom context menu on right click', () => {
    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: /Rex/i }));

    expect(screen.getByRole('menu', { name: 'Appointment context actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open companion overview' })).toBeInTheDocument();
  });
});
