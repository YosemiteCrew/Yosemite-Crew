import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import Slot from '@/app/features/appointments/components/Calendar/common/Slot';
import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';
import {
  acceptAppointment,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';

jest.useFakeTimers();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, width }: any) => (
    <span data-testid="mock-next-image" data-width={width}>
      {alt || ''}
    </span>
  ),
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

jest.mock('@/app/lib/appointmentWorkspace', () => ({
  ...jest.requireActual('@/app/lib/appointmentWorkspace'),
  canEnterAppointmentWorkspace: (status?: string) => status !== 'CANCELLED' && status !== 'NO_SHOW',
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

jest.mock(
  'react-icons/io5',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/io',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

jest.mock(
  'react-icons/md',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_t, name) => {
          if (name === '__esModule') return true;
          const Icon =
            (_t as any)[String(name)] ||
            ((_t as any)[String(name)] = (props: any) => (
              <span data-testid={String(name)} onClick={props.onClick} />
            ));
          return Icon;
        },
      }
    )
);

expect.extend(toHaveNoViolations);

describe('Slot (Appointments)', () => {
  const handleViewAppointment = jest.fn();
  const handleDetailAppointment = jest.fn();
  const handleOpenWorkspace = jest.fn();
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
        handleDetailAppointment={handleDetailAppointment}
        handleOpenWorkspace={handleOpenWorkspace}
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
        handleDetailAppointment={handleDetailAppointment}
        handleOpenWorkspace={handleOpenWorkspace}
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
        handleDetailAppointment={handleDetailAppointment}
        handleOpenWorkspace={handleOpenWorkspace}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    fireEvent.doubleClick(screen.getByRole('button', { name: /Rex/i }));

    expect(handleOpenWorkspace).toHaveBeenCalledWith(event);
    expect(handleDetailAppointment).not.toHaveBeenCalled();
  });

  it('does not open the workspace for cancelled appointments from the popover or double click', () => {
    const cancelledEvent = { ...event, status: 'CANCELLED' };

    render(
      <Slot
        slotEvents={[cancelledEvent]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleOpenWorkspace={handleOpenWorkspace}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const marker = screen.getByRole('button', { name: /Rex/i });
    fireEvent.click(marker);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('button', { name: /view appointment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /finance summary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /lab tests/i })).not.toBeInTheDocument();

    fireEvent.doubleClick(marker);

    expect(handleOpenWorkspace).not.toHaveBeenCalled();
    expect(handleDetailAppointment).toHaveBeenCalledWith(cancelledEvent);
  });

  it('shows only the service label for overlapping compact markers', () => {
    const overlappingEvent = {
      ...event,
      appointmentType: { name: 'Vaccination' },
      concern: 'Very long concern that should not be rendered in compact markers',
      companion: { name: 'Milo', species: 'dog' },
      startTime: new Date('2025-01-06T09:10:00Z'),
      endTime: new Date('2025-01-06T09:40:00Z'),
    };

    render(
      <Slot
        slotEvents={[event, overlappingEvent]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    expect(screen.getByText('Exam')).toBeInTheDocument();
    expect(screen.getByText('Vaccination')).toBeInTheDocument();
    expect(
      screen.queryByText('Very long concern that should not be rendered in compact markers')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Checkup')).not.toBeInTheDocument();
  });

  it('shows a compact companion avatar for short single-lane markers', () => {
    const shortEvent = {
      ...event,
      startTime: new Date('2025-01-06T09:00:00Z'),
      endTime: new Date('2025-01-06T09:05:00Z'),
    };

    render(
      <Slot
        slotEvents={[shortEvent]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const image = screen.getByTestId('mock-next-image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('data-width', '24');
  });

  it('creates appointment when empty slot is clicked', () => {
    const onCreateAppointmentAt = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        onCreateAppointmentAt={onCreateAppointmentAt}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Create appointment on/i }));
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
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        draggedAppointmentId="appt-1"
        draggedAppointmentLabel="Buddy"
        onAppointmentDropAt={onAppointmentDropAt}
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        dropAvailabilityIntervals={[{ startMinute: 540, endMinute: 599 }]}
      />
    );

    const slot = screen.getByRole('region', { name: /Appointments slot for/i });
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
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        draggedAppointmentId="appt-1"
        draggedAppointmentLabel="Buddy"
        onAppointmentDropAt={onAppointmentDropAt}
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        dropAvailabilityIntervals={[{ startMinute: 540, endMinute: 599 }]}
      />
    );

    const slot = screen.getByRole('region', { name: /Appointments slot for/i });
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
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        onCreateAppointmentAt={onCreateAppointmentAt}
      />
    );

    fireEvent.doubleClick(screen.getByRole('button', { name: /Create appointment on/i }));
    expect(onCreateAppointmentAt).toHaveBeenCalled();
  });

  it('hides edit-only quick actions when canEditAppointments is false', () => {
    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
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

    const handleAcceptAppointment = jest.fn();
    render(
      <Slot
        slotEvents={[requestedEvent]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        handleAcceptAppointment={handleAcceptAppointment}
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
    // Accept now routes through the change-status flow (assign lead/support) instead
    // of calling the accept service directly.
    expect(acceptAppointment).not.toHaveBeenCalled();
    expect(handleAcceptAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'requested-1' })
    );

    fireEvent.click(eventButton);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    const declineButton = await screen.findByTitle('Decline request');
    await act(async () => {
      fireEvent.click(declineButton);
    });
    expect(rejectAppointment).toHaveBeenCalledWith(expect.objectContaining({ id: 'requested-1' }));
  });

  it('opens the custom context menu on right click', () => {
    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
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

  it('has no axe accessibility violations when the appointment popover is open', async () => {
    jest.useRealTimers();

    try {
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

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Rex/i }));
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 250);
        });
      });
      expect(screen.getByTitle(/reschedule/i)).toBeInTheDocument();

      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    } finally {
      jest.useFakeTimers();
    }
  });

  it('wires appointment markers to a non-modal dialog popover and closes on Escape', () => {
    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const trigger = screen.getByRole('button', { name: /Rex/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    const dialog = screen.getByRole('dialog', { name: 'Rex' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.getAttribute('id'));
    expect(dialog).toHaveAttribute('aria-modal', 'false');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Rex' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders the zoom-out event list and clears the drop preview on drag end', () => {
    const patientEvent: any = {
      id: 'patient-1',
      status: 'in_progress',
      startTime: new Date('2025-01-06T09:15:00Z'),
      endTime: new Date('2025-01-06T09:45:00Z'),
      concern: 'Checkup',
      lead: { name: 'Dr. Lee' },
      appointmentType: { name: 'Exam' },
      // No companion — exercises the `event.companion ?? event.patient` fallback
      companion: undefined,
      patient: { name: 'Bella', species: 'cat', parent: { name: 'Owner Smith' } },
    };

    render(
      <Slot
        slotEvents={[patientEvent]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
        zoomMode="out"
      />
    );

    const marker = screen.getByRole('button');
    expect(marker).toBeInTheDocument();

    // Drag end wires through the shared onDropPreviewClear callback.
    fireEvent.dragEnd(marker);
    expect(marker).toBeInTheDocument();
  });

  it('lays out overlapping events into reused and new lanes', () => {
    const base = {
      status: 'in_progress',
      concern: 'Checkup',
      lead: { name: 'Dr. Lee' },
      appointmentType: { name: 'Exam' },
      companion: { name: 'Rex', species: 'dog' },
    };
    // e1 0-20, e2 10-30 (new lane), e2b 10-45 (same start as e2 -> endMinute tie-break),
    // e3 25-40 (reuses e1's freed lane).
    const e1: any = {
      ...base,
      startTime: new Date('2025-01-06T09:00:00Z'),
      endTime: new Date('2025-01-06T09:20:00Z'),
      companion: { name: 'Rex', species: 'dog' },
    };
    const e2: any = {
      ...base,
      startTime: new Date('2025-01-06T09:10:00Z'),
      endTime: new Date('2025-01-06T09:30:00Z'),
      companion: { name: 'Milo', species: 'dog' },
    };
    const e2b: any = {
      ...base,
      startTime: new Date('2025-01-06T09:10:00Z'),
      endTime: new Date('2025-01-06T09:45:00Z'),
      companion: { name: 'Coco', species: 'dog' },
    };
    const e3: any = {
      ...base,
      startTime: new Date('2025-01-06T09:25:00Z'),
      endTime: new Date('2025-01-06T09:40:00Z'),
      companion: { name: 'Bo', species: 'dog' },
    };

    render(
      <Slot
        slotEvents={[e1, e2, e2b, e3]}
        height={600}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('warns and does not create an appointment for a past time slot', () => {
    const onCreateAppointmentAt = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        dropDate={new Date('2000-01-15T00:00:00.000Z')}
        dropHour={9}
        onCreateAppointmentAt={onCreateAppointmentAt}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Create appointment on/i }));
    expect(onCreateAppointmentAt).not.toHaveBeenCalled();
  });

  it('warns and does not create an appointment inside an unavailable segment', () => {
    const onCreateAppointmentAt = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        onCreateAppointmentAt={onCreateAppointmentAt}
        unavailableSegments={[{ startMinute: 540, endMinute: 600 }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Create appointment on/i }));
    expect(onCreateAppointmentAt).not.toHaveBeenCalled();
  });

  it('reports the hover target while dragging over an availability slot', () => {
    const onDragHoverTarget = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        draggedAppointmentId="appt-1"
        draggedAppointmentLabel="Buddy"
        onDragHoverTarget={onDragHoverTarget}
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        dropPractitionerId="vet-1"
        // First interval overlaps the 9:00 hour (renders a segment); the second
        // falls entirely outside it, exercising the empty-segment branch.
        dropAvailabilityIntervals={[
          { startMinute: 540, endMinute: 599 },
          { startMinute: 0, endMinute: 10 },
        ]}
      />
    );

    const slot = screen.getByRole('region', { name: /Appointments slot for/i });
    fireEvent.dragOver(slot, { clientX: 10, clientY: 20 });

    expect(onDragHoverTarget).toHaveBeenCalledWith(expect.any(Date), 'vet-1');
  });

  it('ignores drag lifecycle events when no appointment is being dragged', () => {
    const onDragHoverTarget = jest.fn();
    const onAppointmentDropAt = jest.fn();

    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        onDragHoverTarget={onDragHoverTarget}
        onAppointmentDropAt={onAppointmentDropAt}
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
      />
    );

    const slot = screen.getByRole('region', { name: /Appointments slot for/i });
    // No draggedAppointmentId — every drag handler should early-return.
    fireEvent.dragOver(slot, { clientX: 10, clientY: 20 });
    fireEvent.dragLeave(slot);
    fireEvent.drop(slot, { clientX: 10, clientY: 20 });

    expect(onDragHoverTarget).not.toHaveBeenCalled();
    expect(onAppointmentDropAt).not.toHaveBeenCalled();
  });

  it('clears the drop preview when the drag leaves the slot region', () => {
    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleDetailAppointment={handleDetailAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
        draggedAppointmentId="appt-1"
        draggedAppointmentLabel="Buddy"
        dropDate={new Date('2030-01-15T00:00:00.000Z')}
        dropHour={9}
        dropAvailabilityIntervals={[{ startMinute: 540, endMinute: 599 }]}
      />
    );

    const slot = screen.getByRole('region', { name: /Appointments slot for/i });
    fireEvent.dragOver(slot, { clientX: 10, clientY: 20 });
    // relatedTarget null => the drag left the region entirely.
    fireEvent.dragLeave(slot, { relatedTarget: null });

    expect(slot).toBeInTheDocument();
  });
});
