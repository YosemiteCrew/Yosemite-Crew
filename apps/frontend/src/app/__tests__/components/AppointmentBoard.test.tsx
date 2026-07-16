import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentBoard from '@/app/features/appointments/components/AppointmentBoard';
import {
  acceptAppointment,
  changeAppointmentStatus,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';

const pushMock = jest.fn();
const mockAutoScrollBoardOnDrag = jest.fn();
const mockNotify = jest.fn();
const mockStartRouteLoader = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: () => mockStartRouteLoader(),
  stopRouteLoader: jest.fn(),
}));

jest.mock('@/app/hooks/useBoardDragScroll', () => ({
  useBoardDragScroll: () => ({
    autoScrollBoardOnDrag: (...args: unknown[]) => mockAutoScrollBoardOnDrag(...args),
  }),
}));

jest.mock('@/app/lib/buildDragPreview', () => ({
  buildDragPreview: () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    return element;
  },
}));

jest.mock('@/app/config/statusConfig', () => ({
  getStatusStyle: () => ({ backgroundColor: '#f5f5f5', color: '#111111' }),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  acceptAppointment: jest.fn(),
  changeAppointmentStatus: jest.fn(),
  rejectAppointment: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  isOnPreferredTimeZoneCalendarDay: () => true,
  formatDateInPreferredTimeZone: (value: Date, opts?: Intl.DateTimeFormatOptions) => {
    if (opts?.hour) return '9:00 AM';
    return 'Monday, Mar 16, 2026';
  },
}));

jest.mock('@/app/ui/primitives/Icons/Back', () => (props: any) => (
  <button type="button" onClick={props.onClick}>
    Back
  </button>
));

jest.mock('@/app/ui/primitives/Icons/Next', () => (props: any) => (
  <button type="button" onClick={props.onClick}>
    Next
  </button>
));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) => selector({ attributes: {} })),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => () => <div data-testid="datepicker" />);

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrg: () => [],
}));

jest.mock('@/app/lib/paymentStatus', () => ({
  createInvoiceByAppointmentId: () => ({}),
  getAppointmentPaymentDisplay: () => ({
    label: 'Unpaid',
    badgeBackgroundColor: '#eee',
    badgeTextColor: '#111',
  }),
}));

jest.mock('next/image', () => (props: any) => (
  <div data-testid="mock-image" data-src={props.src} data-alt={props.alt ?? ''} />
));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => '/dog.png',
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ orgsById: {} }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({
    notify: (...args: unknown[]) => mockNotify(...args),
  }),
}));

jest.mock(
  '@/app/ui/primitives/AppointmentScopeToggle/AppointmentScopeToggle',
  () => (props: any) => (
    <button type="button" onClick={() => props.onChange(!props.showMineOnly)}>
      Toggle scope
    </button>
  )
);

describe('AppointmentBoard', () => {
  const setCurrentDate = jest.fn();
  const setActiveAppointment = jest.fn();
  const setViewPopup = jest.fn();
  const setDetailPopup = jest.fn();

  const baseAppointment = {
    organisationId: 'org-1',
    startTime: new Date('2026-03-16T09:00:00.000Z'),
    companion: {
      name: 'Buddy',
      species: 'dog',
      parent: { name: 'Sam' },
    },
    lead: { name: 'Dr. Lee' },
    room: { name: 'Room 1' },
    concern: 'Checkup',
    appointmentType: { name: 'Consultation', speciality: { name: 'Wellness' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ attributes: {} })
    );
  });

  it('opens the companion overview page from the card header action', () => {
    render(
      <AppointmentBoard
        appointments={[
          {
            ...baseAppointment,
            id: 'appt-completed',
            status: 'COMPLETED',
            companion: { ...baseAppointment.companion, id: 'comp-1' },
          } as any,
        ]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setDetailPopup={setDetailPopup}
      />
    );

    fireEvent.click(screen.getByTitle('Open appointment overview'));

    expect(pushMock).toHaveBeenCalledWith(
      '/companions/history?companionId=comp-1&source=appointments&appointmentId=appt-completed&backTo=%2Fappointments'
    );
  });

  it('opens the central view modal on click when the card is not draggable', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-completed', status: 'COMPLETED' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setDetailPopup={setDetailPopup}
      />
    );

    fireEvent.click(screen.getByLabelText('Open appointment Buddy'));

    // Design card anatomy: "Service · Lead" line plus a "Breed · Owner" sub-line.
    expect(screen.getByText('Consultation · Dr. Lee')).toBeInTheDocument();
    expect(screen.getByText('dog · Sam')).toBeInTheDocument();
    expect(setActiveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-completed' })
    );
    expect(setViewPopup).toHaveBeenCalledWith(true);
    expect(setDetailPopup).not.toHaveBeenCalled();
  });

  it('falls back to the side modal when no central view setter is provided', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-completed', status: 'COMPLETED' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setDetailPopup={setDetailPopup}
      />
    );

    fireEvent.click(screen.getByLabelText('Open appointment Buddy'));

    expect(setDetailPopup).toHaveBeenCalledWith(true);
  });

  it('does not render a full-card click target when the card is draggable', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Open appointment Buddy' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Draggable appointment Buddy')).toHaveAttribute(
      'draggable',
      'true'
    );
  });

  it('shows room and unit on inpatient status board cards', () => {
    render(
      <AppointmentBoard
        appointments={[
          {
            ...baseAppointment,
            id: 'appt-inpatient',
            status: 'UPCOMING',
            appointmentKind: 'INPATIENT',
            room: { name: 'Ward 1', unitName: 'Kennel A' },
          } as any,
        ]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    // Design meta row shows the room value behind a location icon, unprefixed.
    expect(screen.getByText('Ward 1 / Kennel A')).toBeInTheDocument();
  });

  it('triggers add appointment and date navigation callbacks', () => {
    const onAddAppointment = jest.fn();

    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        onAddAppointment={onAddAppointment}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Appointment' }));
    expect(onAddAppointment).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(setCurrentDate).toHaveBeenCalledTimes(2);
  });

  it('adds an appointment from a status column footer', () => {
    const onAddAppointment = jest.fn();
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        onAddAppointment={onAddAppointment}
      />
    );
    const columnAdders = screen.getAllByRole('button', { name: /Add appointment to/i });
    expect(columnAdders.length).toBeGreaterThan(0);
    fireEvent.click(columnAdders[0]);
    expect(onAddAppointment).toHaveBeenCalledTimes(1);
  });

  it('hides the column add footers when editing is disabled', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments={false}
        onAddAppointment={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Add appointment to/i })).not.toBeInTheDocument();
  });

  it('toggles the emergencies filter from the board header', () => {
    const setActiveFilter = jest.fn();

    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        activeFilter="all"
        setActiveFilter={setActiveFilter}
        hasEmergency
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Emergencies/ }));
    expect(setActiveFilter).toHaveBeenCalledWith('emergencies');
    expect(screen.getByLabelText('Emergency appointments present')).toBeInTheDocument();
  });

  it('filters to my appointments when board scope is toggled', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'team-1', practionerId: 'lead-1', userId: 'user-1' },
    ]);

    render(
      <AppointmentBoard
        appointments={[
          {
            ...baseAppointment,
            id: 'appt-my',
            status: 'UPCOMING',
            companion: { ...baseAppointment.companion, name: 'Mine' },
            lead: { id: 'lead-1', name: 'Dr. Mine' },
          } as any,
          {
            ...baseAppointment,
            id: 'appt-other',
            status: 'UPCOMING',
            companion: { ...baseAppointment.companion, name: 'Other' },
            lead: { id: 'lead-2', name: 'Dr. Other' },
          } as any,
        ]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle scope' }));

    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('opens change-status to assign a lead on accept and declines requested appointments', () => {
    const setChangeStatusPopup = jest.fn();
    const setChangeStatusPreferredStatus = jest.fn();
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-requested', status: 'REQUESTED' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        setActiveAppointment={setActiveAppointment}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        canEditAppointments
      />
    );

    const card = screen.getByLabelText('Draggable appointment Buddy');
    const cardButtons = within(card).getAllByRole('button');
    fireEvent.click(cardButtons[1]);
    fireEvent.click(cardButtons[2]);

    // Accept now routes through the change-status modal so a lead/support can be assigned.
    expect(acceptAppointment).not.toHaveBeenCalled();
    expect(setActiveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-requested' })
    );
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);
    expect(rejectAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-requested' })
    );
  });

  const createDataTransfer = () => ({
    effectAllowed: '',
    setData: jest.fn(),
    setDragImage: jest.fn(),
    getData: jest.fn(),
  });

  const getBoardRoot = (container: HTMLElement) =>
    container.querySelector('[data-board-scroll-root="true"]') as HTMLElement;

  // Column drop elements are the direct children of the horizontal flex track,
  // in BOARD_COLUMNS order: REQUESTED, UPCOMING, CHECKED_IN, IN_PROGRESS, ...
  const getColumnDropElement = (container: HTMLElement, index: number) => {
    const track = getBoardRoot(container).querySelector('.min-w-max') as HTMLElement;
    return track.children[index] as HTMLElement;
  };

  const renderUpcomingBoard = (extraProps: Record<string, unknown> = {}) =>
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        {...extraProps}
      />
    );

  it('opens reschedule and change-room modals from the board card actions', () => {
    const setReschedulePopup = jest.fn();
    const setChangeRoomPopup = jest.fn();
    renderUpcomingBoard({ setReschedulePopup, setChangeRoomPopup });

    fireEvent.click(screen.getByLabelText('Reschedule'));
    expect(setActiveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-upcoming' })
    );
    expect(setReschedulePopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText('Assign room'));
    expect(setChangeRoomPopup).toHaveBeenCalledWith(true);
  });

  it('routes into the clinical workspace when the appointment can be entered', () => {
    renderUpcomingBoard();

    fireEvent.click(screen.getByLabelText('Finance summary'));

    expect(mockStartRouteLoader).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/appointments/appt-upcoming/workspace?step=INVOICE');
  });

  it('falls back to the detail view when the appointment cannot enter the workspace', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-cancelled', status: 'CANCELLED' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setDetailPopup={setDetailPopup}
      />
    );

    fireEvent.click(screen.getByLabelText('Finance summary'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(setDetailPopup).toHaveBeenCalledWith(true);
  });

  it('does nothing when opening a workspace for an appointment without an id', () => {
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: '', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setDetailPopup={setDetailPopup}
      />
    );

    fireEvent.click(screen.getByLabelText('Finance summary'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(mockStartRouteLoader).not.toHaveBeenCalled();
  });

  it('renders the emergency filter in its active color and toggles it back to all', () => {
    const setActiveFilter = jest.fn();
    renderUpcomingBoard({ activeFilter: 'emergencies', setActiveFilter, hasEmergency: true });

    fireEvent.click(screen.getByRole('button', { name: /Emergencies/ }));
    expect(setActiveFilter).toHaveBeenCalledWith('all');
  });

  it('resolves the current user lead via a team member id match', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'user-1' }]);

    renderUpcomingBoard();
    expect(screen.getByText('Buddy')).toBeInTheDocument();
  });

  it('resolves the current user lead via a userOrganisation userId match', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { userOrganisation: { userId: 'user-1' } },
    ]);

    renderUpcomingBoard();
    expect(screen.getByText('Buddy')).toBeInTheDocument();
  });

  it('leaves the current user lead empty when no team member matches', () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-1' } })
    );
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([{ practionerId: 'someone-else' }]);

    renderUpcomingBoard();
    expect(screen.getByText('Buddy')).toBeInTheDocument();
  });

  it('starts a card drag and auto-scrolls the board only while a drag is active', () => {
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });

    const { container, rerender } = renderUpcomingBoard();
    const boardRoot = getBoardRoot(container);

    // No active drag yet: the board dragover handler bails out early.
    fireEvent.dragOver(boardRoot);
    expect(mockAutoScrollBoardOnDrag).not.toHaveBeenCalled();

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByLabelText('Draggable appointment Buddy'), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'appt-upcoming');
    expect(dataTransfer.setDragImage).toHaveBeenCalled();

    // Drag active: the board dragover handler now auto-scrolls.
    fireEvent.dragOver(boardRoot);
    expect(mockAutoScrollBoardOnDrag).toHaveBeenCalledTimes(1);

    // Editing disabled mid-drag: the handler bails out on the permission gate.
    rerender(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-upcoming', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments={false}
        setActiveAppointment={setActiveAppointment}
      />
    );
    fireEvent.dragOver(boardRoot);
    expect(mockAutoScrollBoardOnDrag).toHaveBeenCalledTimes(1);

    rafSpy.mockRestore();
  });

  it('moves a card to a new status column on a valid drop', async () => {
    const { container } = renderUpcomingBoard();

    fireEvent.dragStart(screen.getByLabelText('Draggable appointment Buddy'), {
      dataTransfer: createDataTransfer(),
    });
    // Drop onto the Checked-in column (index 2) — a valid transition from Upcoming.
    fireEvent.drop(getColumnDropElement(container, 2), { dataTransfer: createDataTransfer() });

    await waitFor(() =>
      expect(changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'appt-upcoming' }),
        'CHECKED_IN'
      )
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('warns and blocks the move on an invalid drop transition', async () => {
    const { container } = renderUpcomingBoard();

    fireEvent.dragStart(screen.getByLabelText('Draggable appointment Buddy'), {
      dataTransfer: createDataTransfer(),
    });
    // Drop onto In progress (index 3) — not allowed directly from Upcoming.
    fireEvent.drop(getColumnDropElement(container, 3), { dataTransfer: createDataTransfer() });

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'warning',
        expect.objectContaining({ title: 'Status change blocked' })
      )
    );
    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('ignores a drop back onto the same status column', async () => {
    const { container } = renderUpcomingBoard();

    fireEvent.dragStart(screen.getByLabelText('Draggable appointment Buddy'), {
      dataTransfer: createDataTransfer(),
    });
    // Drop onto Upcoming (index 1) — the card's own column.
    await act(async () => {
      fireEvent.drop(getColumnDropElement(container, 1), { dataTransfer: createDataTransfer() });
    });

    expect(changeAppointmentStatus).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('flags an emergency card with the danger treatment and badge', () => {
    render(
      <AppointmentBoard
        appointments={[
          {
            ...baseAppointment,
            id: 'appt-emergency',
            status: 'IN_PROGRESS',
            isEmergency: true,
          } as any,
        ]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByLabelText('Emergency appointment')).toBeInTheDocument();
    expect(screen.getByLabelText('Draggable appointment Buddy').className).toContain(
      'border-l-[var(--danger)]'
    );
  });

  it('mutes a completed card and keeps a live card at full strength', () => {
    const { rerender } = render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-done', status: 'COMPLETED' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByLabelText('Appointment Buddy').className).toContain('opacity-[0.72]');

    rerender(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-live', status: 'UPCOMING' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    const liveCard = screen.getByLabelText('Draggable appointment Buddy');
    expect(liveCard.className).not.toContain('opacity-[0.72]');
    expect(liveCard.className).toContain('shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]');
  });

  it('prefers the breed over the species in the card sub-line', () => {
    render(
      <AppointmentBoard
        appointments={[
          {
            ...baseAppointment,
            id: 'appt-breed',
            status: 'UPCOMING',
            companion: { ...baseAppointment.companion, breed: 'Beagle' },
          } as any,
        ]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByText('Beagle · Sam')).toBeInTheDocument();
  });

  it('omits the room chip and falls back to a dash when the card has no service or lead', () => {
    render(
      <AppointmentBoard
        appointments={[
          {
            ...baseAppointment,
            id: 'appt-bare',
            status: 'UPCOMING',
            room: undefined,
            lead: undefined,
            appointmentType: undefined,
          } as any,
        ]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText('Room 1')).not.toBeInTheDocument();
  });

  it('opens each workspace intent from the card action rail', () => {
    const setChangeStatusPopup = jest.fn();
    const setChangeStatusPreferredStatus = jest.fn();
    render(
      <AppointmentBoard
        appointments={[{ ...baseAppointment, id: 'appt-actions', status: 'IN_PROGRESS' } as any]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
      />
    );

    fireEvent.click(screen.getByLabelText('View appointment'));
    expect(setViewPopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText('Change status'));
    expect(setChangeStatusPopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText('Finance summary'));
    expect(pushMock).toHaveBeenCalledWith('/appointments/appt-actions/workspace?step=INVOICE');

    fireEvent.click(screen.getByLabelText('Lab tests'));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('/workspace?step='));
  });

  it('renders the empty column panel and the add affordance per column', () => {
    render(
      <AppointmentBoard
        appointments={[]}
        currentDate={new Date('2026-03-16T00:00:00.000Z')}
        setCurrentDate={setCurrentDate}
        canEditAppointments
      />
    );

    expect(screen.getAllByText('No appointments')).toHaveLength(7);
    expect(screen.getByLabelText('Add appointment to Requested')).toBeInTheDocument();
  });
});
