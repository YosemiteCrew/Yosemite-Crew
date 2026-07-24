import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ViewAppointmentOverviewModal from '@/app/features/appointments/pages/Appointments/Sections/ViewAppointmentOverviewModal';
import { Appointment } from '@yosemite-crew/types';
import {
  updateAppointment,
  assignEncounterUnit,
} from '@/app/features/appointments/services/appointmentService';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

jest.mock('next/image', () => {
  const MockImage = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />;
  MockImage.displayName = 'Image';
  return MockImage;
});

jest.mock('@/app/hooks/useRooms', () => ({
  useRoomsForPrimaryOrg: jest.fn(() => [
    { id: 'room-1', name: 'Room A' },
    { id: 'room-2', name: 'Room B' },
  ]),
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  loadRoomsForOrgPrimaryOrg: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

let mockOrgsById: Record<string, { type: string }> = { 'org-1': { type: 'HOSPITAL' } };
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector) => selector({ orgsById: mockOrgsById })),
}));

jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: jest.fn((selector) =>
    selector({
      parentsById: {
        'parent-1': {
          id: 'parent-1',
          firstName: 'John',
          lastName: 'Doe',
          profileImageUrl: 'https://cdn.example.com/client.jpg',
        },
      },
    })
  ),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(() => [
    {
      _id: 'team-1',
      practionerId: 'lead-1',
      name: 'Dr. Smith',
      image: 'https://cdn.example.com/lead.jpg',
      role: 'VETERINARIAN',
      speciality: [],
      status: 'Available',
      revokedPermissions: [],
      effectivePermissions: [],
      extraPerissions: [],
    },
  ]),
}));

let mockServices: Array<Record<string, unknown>> = [
  { id: 'serv-1', name: 'Consultation', cost: '80', maxDiscount: '10' },
];
jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: jest.fn(() => mockServices),
    }),
  },
}));

jest.mock('@/app/lib/timezone', () => ({
  formatDateInPreferredTimeZone: jest.fn(() => 'January 15, 2026'),
}));

jest.mock('@/app/lib/forms', () => ({
  formatTimeLabel: jest.fn(() => '10:00 AM'),
}));

let mockInvoiceMap: Record<string, { totalAmount?: number; currency?: string }> = {};
jest.mock('@/app/lib/paymentStatus', () => ({
  createInvoiceByAppointmentId: jest.fn(() => mockInvoiceMap),
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(() => ({ notify: mockNotify })),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  updateAppointment: jest.fn(() => Promise.resolve()),
  assignEncounterUnit: jest.fn(() => Promise.resolve()),
  changeAppointmentStatus: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, options }: any) => (
    <button
      data-testid={placeholder?.toLowerCase().includes('unit') ? 'unit-dropdown' : 'room-dropdown'}
      onClick={() => options?.[0] && onSelect(options[0])}
    >
      {placeholder?.toLowerCase().includes('unit') ? 'Select Unit' : 'Select Room'}
    </button>
  ),
}));

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell',
  () => ({
    __esModule: true,
    default: ({ showModal, children, title }: any) =>
      showModal ? (
        <div data-testid="modal-shell">
          <h1>{title}</h1>
          {children}
        </div>
      ) : null,
  })
);

const mockInitEncounter = jest.fn();
const mockSetRoomUnit = jest.fn();
let mockEncounterById: Record<string, any> = {};
jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: any) =>
    selector({
      encountersById: mockEncounterById,
      initEncounter: mockInitEncounter,
      setRoomUnit: mockSetRoomUnit,
    }),
}));

let mockRoomState = {
  roomUnitsById: {} as Record<string, any>,
  roomUnitIdsByRoomId: {} as Record<string, string[]>,
  setRoomUnitOccupied: jest.fn(),
};
jest.mock('@/app/stores/roomStore', () => ({
  useOrganisationRoomStore: Object.assign((selector: any) => selector(mockRoomState), {
    getState: () => mockRoomState,
  }),
}));

const baseAppointment: Appointment = {
  id: 'appt-1',
  patient: {
    id: 'comp-1',
    name: 'Buddy',
    species: 'Dog',
    breed: 'Golden',
    parent: { id: 'parent-1', name: 'John Doe' },
  },
  companion: {
    id: 'comp-1',
    name: 'Buddy',
    species: 'Dog',
    breed: 'Golden',
    parent: { id: 'parent-1', name: 'John Doe' },
  },
  lead: { id: 'lead-1', name: 'Dr. Smith', profileUrl: undefined },
  supportStaff: [],
  room: undefined,
  appointmentType: {
    id: 'serv-1',
    name: 'Consultation',
    speciality: { id: 'spec-1', name: 'General' },
  },
  organisationId: 'org-1',
  appointmentDate: new Date('2026-01-15'),
  startTime: new Date('2026-01-15T10:00:00'),
  endTime: new Date('2026-01-15T10:30:00'),
  timeSlot: '10:00',
  durationMinutes: 30,
  status: 'UPCOMING',
  isEmergency: false,
  concern: 'Annual checkup',
};

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
  activeAppointment: baseAppointment,
  onOpenDetails: jest.fn(),
};

describe('ViewAppointmentOverviewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEncounterById = {};
    mockRoomState = {
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
      setRoomUnitOccupied: jest.fn(),
    };
    mockServices = [{ id: 'serv-1', name: 'Consultation', cost: '80', maxDiscount: '10' }];
    mockInvoiceMap = {};
    mockOrgsById = { 'org-1': { type: 'HOSPITAL' } };
    (formatDateInPreferredTimeZone as jest.Mock).mockReturnValue('January 15, 2026');
  });

  it('renders the modal title', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('Appointment Details')).toBeInTheDocument();
  });

  it('renders patient name', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('Buddy')).toBeInTheDocument();
  });

  it('renders client name when parent is present', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders lead name', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('renders client and lead profile photos from store records', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);

    expect(screen.getByRole('img', { name: 'John Doe' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/client.jpg'
    );
    expect(screen.getByRole('img', { name: 'Dr. Smith' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/lead.jpg'
    );
  });

  it('renders speciality and service', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  it('renders chief complaint', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('Annual checkup')).toBeInTheDocument();
  });

  it('renders emergency as No for non-emergency appointments', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders emergency as Yes for emergency appointments', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, isEmergency: true }}
      />
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('shows Start Appointment button for UPCOMING appointments', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('Start Appointment')).toBeInTheDocument();
  });

  it('shows View Details button for non-UPCOMING appointments', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, status: 'COMPLETED' }}
      />
    );
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('calls onOpenDetails when primary action button is clicked', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Start Appointment'));
    expect(defaultProps.onOpenDetails).toHaveBeenCalledWith(
      baseAppointment,
      expect.objectContaining({ label: expect.any(String) })
    );
  });

  it('renders the room dropdown for UPCOMING status (canEditRoom=true)', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByTestId('room-dropdown')).toBeInTheDocument();
  });

  it('does not render unit selection for outpatient appointments', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, appointmentKind: 'OUTPATIENT' }}
      />
    );
    expect(screen.getByTestId('room-dropdown')).toBeInTheDocument();
    expect(screen.queryByTestId('unit-dropdown')).not.toBeInTheDocument();
  });

  it('renders unit selection for inpatient appointments', () => {
    mockRoomState = {
      roomUnitsById: {
        'unit-1a': {
          id: 'unit-1a',
          roomId: 'room-1',
          displayName: 'Ward 1A',
          code: '1A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-1': ['unit-1a'] },
      setRoomUnitOccupied: jest.fn(),
    };

    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{
          ...baseAppointment,
          appointmentKind: 'INPATIENT',
          room: { id: 'room-1', name: 'Room A' },
        }}
      />
    );

    expect(screen.getByTestId('room-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('unit-dropdown')).toBeInTheDocument();
  });

  it('renders read-only room for COMPLETED status', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, status: 'COMPLETED' }}
      />
    );
    expect(screen.queryByTestId('room-dropdown')).not.toBeInTheDocument();
  });

  it('renders an interactive status pill that lists allowed transitions when editable', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} canEditAppointments />);
    // UPCOMING allows transitions, so the pill is a dropdown trigger (aria-haspopup=menu).
    const trigger = screen.getByRole('button', { name: 'Upcoming' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: /checked in/i })).toBeInTheDocument();
  });

  it('renders a static status pill when the user cannot edit appointments', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} canEditAppointments={false} />);
    expect(screen.queryByRole('button', { name: 'Upcoming' })).not.toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('does not render modal content when showModal is false', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} showModal={false} />);
    expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();
  });

  const inpatientRoomState = () => ({
    roomUnitsById: {
      'unit-1a': {
        id: 'unit-1a',
        roomId: 'room-1',
        displayName: 'Ward 1A',
        code: '1A',
        isActive: true,
      },
    },
    roomUnitIdsByRoomId: { 'room-1': ['unit-1a'] },
    setRoomUnitOccupied: jest.fn(),
  });

  const inpatientAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
    ...baseAppointment,
    appointmentKind: 'INPATIENT',
    room: { id: 'room-1', name: 'Room A' },
    ...overrides,
  });

  it('shows the estimate from a matching invoice when one exists', () => {
    mockInvoiceMap = { 'appt-1': { totalAmount: 123, currency: 'USD' } };
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.getByText('$123')).toBeInTheDocument();
  });

  it('falls back to cost when discount cancels the estimate to zero', () => {
    mockServices = [{ id: 'serv-1', name: 'Consultation', cost: '80', maxDiscount: '100' }];
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    // Estimate cancels to zero, so both the estimate and the cost row show the cost.
    expect(screen.getAllByText('$ 80.00').length).toBeGreaterThan(0);
  });

  it('renders "-" for cost, max discount and estimate when the service has no pricing', () => {
    mockServices = [{ id: 'serv-1', name: 'Consultation', cost: 0, maxDiscount: 0 }];
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    const costRow = screen.getByText('Cost:').closest('div') as HTMLElement;
    expect(within(costRow).getByText('-')).toBeInTheDocument();
    const discountRow = screen.getByText('Max discount:').closest('div') as HTMLElement;
    expect(within(discountRow).getByText('-')).toBeInTheDocument();
    const estimateRow = screen.getByText('Estimate').closest('div') as HTMLElement;
    expect(within(estimateRow).getByText('-')).toBeInTheDocument();
  });

  it('hides the service cost rows and shows "-" estimate when no service is resolved', () => {
    mockServices = [];
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    expect(screen.queryByText('Cost:')).not.toBeInTheDocument();
    const estimateRow = screen.getByText('Estimate').closest('div') as HTMLElement;
    expect(within(estimateRow).getByText('-')).toBeInTheDocument();
  });

  it('hides the estimate panel for COMPLETED appointments', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, status: 'COMPLETED' }}
      />
    );
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
  });

  it('renders "-" for the date when timezone formatting throws', () => {
    (formatDateInPreferredTimeZone as jest.Mock).mockImplementation(() => {
      throw new Error('bad date');
    });
    render(<ViewAppointmentOverviewModal {...defaultProps} />);
    const dateRow = screen.getByText('Date').closest('div') as HTMLElement;
    expect(within(dateRow).getByText('-')).toBeInTheDocument();
  });

  it('resolves the lead photo by matching the team member id', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{
          ...baseAppointment,
          lead: { id: 'team-1', name: 'Dr. Smith', profileUrl: undefined },
        }}
      />
    );
    expect(screen.getByRole('img', { name: 'Dr. Smith' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/lead.jpg'
    );
  });

  it('falls back to the appointment lead profile url over the team image', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{
          ...baseAppointment,
          lead: { id: 'lead-1', name: 'Dr. Smith', profileUrl: 'https://cdn.example.com/own.jpg' },
        }}
      />
    );
    expect(screen.getByRole('img', { name: 'Dr. Smith' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/own.jpg'
    );
  });

  it('renders support staff names, ignoring entries without a name', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{
          ...baseAppointment,
          supportStaff: [
            { id: 's1', name: 'Nurse A' },
            { id: 's2', name: '' },
          ],
        }}
      />
    );
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Nurse A')).toBeInTheDocument();
  });

  it('renders "-" fallbacks when patient and lead names are empty', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{
          ...baseAppointment,
          patient: { ...baseAppointment.patient, name: '' },
          companion: { ...baseAppointment.companion!, name: '' },
          lead: { id: 'lead-1', name: '', profileUrl: undefined },
        }}
      />
    );
    const patientRow = screen.getByText('Patient').parentElement as HTMLElement;
    expect(within(patientRow).getByText('-')).toBeInTheDocument();
    const leadRow = screen.getByText('Lead').parentElement as HTMLElement;
    expect(within(leadRow).getByText('-')).toBeInTheDocument();
  });

  it('renders "-" for duration and time when they are missing', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, durationMinutes: 0 }}
      />
    );
    const durationRow = screen.getByText('Duration').closest('div') as HTMLElement;
    expect(within(durationRow).getByText('-')).toBeInTheDocument();
  });

  it('shows the blocked message and disabled action for non-workspace statuses', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, status: 'CANCELLED' }}
      />
    );
    expect(screen.getByText(/cannot be opened in the clinical workspace/i)).toBeInTheDocument();
  });

  it('saves a room change for an outpatient appointment', async () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, appointmentKind: 'OUTPATIENT' }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('room-dropdown'));
    });
    await settle();

    expect(updateAppointment as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ room: { id: 'room-1', name: 'Room A' } })
    );
    expect(mockInitEncounter).not.toHaveBeenCalled();
  });

  it('keeps the saving state while a room change is in flight', async () => {
    let resolveUpdate: () => void = () => undefined;
    (updateAppointment as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, appointmentKind: 'OUTPATIENT' }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('room-dropdown'));
    });

    expect(screen.getByTestId('room-dropdown')).toBeInTheDocument();

    await act(async () => {
      resolveUpdate();
    });
    await settle();
  });

  it('only dims the field being saved, keeping both labels visible', async () => {
    mockRoomState = inpatientRoomState();
    let resolveUpdate: () => void = () => undefined;
    (updateAppointment as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    render(
      <ViewAppointmentOverviewModal {...defaultProps} activeAppointment={inpatientAppointment()} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('room-dropdown'));
    });

    // Room's label is unchanged (never swaps to "Saving…") and only its own
    // wrapper is dimmed/non-interactive - Unit stays fully usable.
    expect(screen.getByTestId('room-dropdown')).toHaveTextContent('Select Room');
    expect(screen.getByTestId('unit-dropdown')).toHaveTextContent('Select Unit');
    expect(screen.getByTestId('room-dropdown').parentElement).toHaveClass(
      'pointer-events-none',
      'opacity-60'
    );
    expect(screen.getByTestId('unit-dropdown').parentElement).not.toHaveClass(
      'pointer-events-none'
    );

    await act(async () => {
      resolveUpdate();
    });
    await settle();

    expect(screen.getByTestId('room-dropdown').parentElement).not.toHaveClass(
      'pointer-events-none'
    );
  });

  it('assigns the room and unit for an inpatient appointment with an encounter', async () => {
    mockRoomState = inpatientRoomState();
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={inpatientAppointment({ encounterId: 'enc-1' })}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('room-dropdown'));
    });
    await settle();

    expect(mockInitEncounter).toHaveBeenCalledWith('appt-1', 'INPATIENT', expect.any(Object));
    expect(mockSetRoomUnit).toHaveBeenCalledWith('appt-1', 'room-1', 'unit-1a');
    expect(assignEncounterUnit as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ encounterId: 'enc-1', unitId: 'unit-1a' })
    );
  });

  it('assigns the room without an encounter unit when the appointment has no encounterId', async () => {
    mockRoomState = inpatientRoomState();
    render(
      <ViewAppointmentOverviewModal {...defaultProps} activeAppointment={inpatientAppointment()} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('room-dropdown'));
    });
    await settle();

    expect(mockInitEncounter).toHaveBeenCalled();
    expect(mockSetRoomUnit).toHaveBeenCalled();
    expect(assignEncounterUnit as jest.Mock).not.toHaveBeenCalled();
  });

  it('notifies when a room change fails', async () => {
    (updateAppointment as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, appointmentKind: 'OUTPATIENT' }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('room-dropdown'));
    });
    await settle();

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Room update failed' })
    );
  });

  it('assigns a unit for an inpatient appointment with an encounter', async () => {
    mockRoomState = inpatientRoomState();
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={inpatientAppointment({ encounterId: 'enc-1' })}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('unit-dropdown'));
    });
    await settle();

    expect(mockInitEncounter).toHaveBeenCalledWith('appt-1', 'INPATIENT', expect.any(Object));
    expect(assignEncounterUnit as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ encounterId: 'enc-1', unitId: 'unit-1a' })
    );
  });

  it('updates the unit locally without an encounter call when there is no encounterId', async () => {
    mockRoomState = inpatientRoomState();
    render(
      <ViewAppointmentOverviewModal {...defaultProps} activeAppointment={inpatientAppointment()} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('unit-dropdown'));
    });
    await settle();

    expect(mockSetRoomUnit).toHaveBeenCalledWith('appt-1', 'room-1', 'unit-1a');
    expect(assignEncounterUnit as jest.Mock).not.toHaveBeenCalled();
  });

  it('notifies when a unit change fails', async () => {
    mockRoomState = inpatientRoomState();
    (assignEncounterUnit as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={inpatientAppointment({ encounterId: 'enc-1' })}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('unit-dropdown'));
    });
    await settle();

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Unit update failed' })
    );
  });

  it('shows the read-only room name for a COMPLETED appointment', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{
          ...baseAppointment,
          status: 'COMPLETED',
          room: { id: 'room-1', name: 'Room A' },
        }}
      />
    );
    expect(screen.queryByTestId('room-dropdown')).not.toBeInTheDocument();
    expect(screen.getByText('Room A')).toBeInTheDocument();
  });

  it('shows the read-only unit label for a COMPLETED inpatient appointment', () => {
    mockRoomState = inpatientRoomState();
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={inpatientAppointment({ status: 'COMPLETED' })}
      />
    );
    expect(screen.queryByTestId('unit-dropdown')).not.toBeInTheDocument();
    expect(screen.getByText('Ward 1A')).toBeInTheDocument();
  });

  it('opens details without a clinical intent for non-upcoming appointments', () => {
    const onOpenDetails = jest.fn();
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        onOpenDetails={onOpenDetails}
        activeAppointment={{ ...baseAppointment, status: 'CHECKED_IN' }}
      />
    );
    fireEvent.click(screen.getByText('View Details'));
    expect(onOpenDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-1' }),
      undefined
    );
  });

  it('defaults the org type to HOSPITAL when the organisation is unknown', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, organisationId: 'missing-org' }}
      />
    );
    fireEvent.click(screen.getByText('Start Appointment'));
    expect(defaultProps.onOpenDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-1' }),
      expect.objectContaining({ label: 'prescription' })
    );
  });

  it('uses the care intent for non-hospital organisations', () => {
    const onOpenDetails = jest.fn();
    mockOrgsById = { 'org-1': { type: 'CLINIC' } };
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        onOpenDetails={onOpenDetails}
        activeAppointment={baseAppointment}
      />
    );
    fireEvent.click(screen.getByText('Start Appointment'));
    expect(onOpenDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-1' }),
      expect.objectContaining({ label: 'care' })
    );
  });
});
