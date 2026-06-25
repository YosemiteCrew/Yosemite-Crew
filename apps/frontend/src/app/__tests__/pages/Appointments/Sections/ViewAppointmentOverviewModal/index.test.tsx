import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewAppointmentOverviewModal from '@/app/features/appointments/pages/Appointments/Sections/ViewAppointmentOverviewModal';
import { Appointment } from '@yosemite-crew/types';

jest.mock('next/image', () => {
  const MockImage = ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  );
  MockImage.displayName = 'Image';
  return MockImage;
});

jest.mock('@/app/hooks/useRooms', () => ({
  useRoomsForPrimaryOrg: jest.fn(() => [
    { id: 'room-1', name: 'Room A' },
    { id: 'room-2', name: 'Room B' },
  ]),
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useInvoicesForPrimaryOrg: jest.fn(() => []),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector) => selector({ orgsById: { 'org-1': { type: 'HOSPITAL' } } })),
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

jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: jest.fn(() => [
        {
          id: 'serv-1',
          name: 'Consultation',
          cost: '80',
          maxDiscount: '10',
        },
      ]),
    }),
  },
}));

jest.mock('@/app/lib/timezone', () => ({
  formatDateInPreferredTimeZone: jest.fn(() => 'January 15, 2026'),
}));

jest.mock('@/app/lib/forms', () => ({
  formatTimeLabel: jest.fn(() => '10:00 AM'),
}));

jest.mock('@/app/lib/paymentStatus', () => ({
  createInvoiceByAppointmentId: jest.fn(() => ({})),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(() => ({ notify: jest.fn() })),
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
    };
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
});
