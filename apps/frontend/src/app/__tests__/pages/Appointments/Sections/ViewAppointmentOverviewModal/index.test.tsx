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
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ onSelect, options }: any) => (
    <button data-testid="room-dropdown" onClick={() => options?.[0] && onSelect(options[0])}>
      Select Room
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

const baseAppointment: Appointment = {
  id: 'appt-1',
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

  it('renders read-only room for COMPLETED status', () => {
    render(
      <ViewAppointmentOverviewModal
        {...defaultProps}
        activeAppointment={{ ...baseAppointment, status: 'COMPLETED' }}
      />
    );
    expect(screen.queryByTestId('room-dropdown')).not.toBeInTheDocument();
  });

  it('does not render modal content when showModal is false', () => {
    render(<ViewAppointmentOverviewModal {...defaultProps} showModal={false} />);
    expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();
  });
});
