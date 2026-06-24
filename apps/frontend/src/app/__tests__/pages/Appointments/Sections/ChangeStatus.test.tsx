import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// jsdom does not include structuredClone — polyfill for tests
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

const mockChangeAppointmentStatus = jest.fn();
const mockGetSlots = jest.fn();
jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: (...args: any[]) => mockChangeAppointmentStatus(...args),
  getSlotsForServiceAndDateForPrimaryOrg: (...args: any[]) => mockGetSlots(...args),
}));

let mockTeams: any[] = [];
jest.mock('@/app/hooks/useTeam', () => ({
  useLoadTeam: () => {},
  useTeamForPrimaryOrg: () => mockTeams,
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, defaultOption, noOptionsMessage }: any) => (
    <div>
      <span data-testid={`dropdown-${placeholder}`}>{defaultOption}</span>
      {noOptionsMessage ? <span data-testid="lead-no-options">{noOptionsMessage}</span> : null}
      {options?.map((opt: any) => (
        <button key={opt.value} type="button" onClick={() => onSelect(opt)}>
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, value, onChange }: any) => (
    <div>
      <span data-testid={`multiselect-${placeholder}`}>{(value ?? []).join(',')}</span>
      {options?.map((opt: any) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange([...(value ?? []), opt.value])}
        >
          {`support-${opt.label}`}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/lib/appointments', () => ({
  normalizeAppointmentStatus: (s: string) => s,
  getAllowedAppointmentStatusTransitions: (s: string) => {
    const map: Record<string, string[]> = {
      REQUESTED: ['UPCOMING', 'CANCELLED'],
      UPCOMING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    return map[s] ?? [];
  },
  canTransitionAppointmentStatus: (from: string, to: string) => from !== to,
  getInvalidAppointmentStatusTransitionMessage: () => 'Invalid transition',
}));

jest.mock('@/app/features/appointments/types/appointments', () => ({
  AppointmentStatusOptions: [
    { value: 'REQUESTED', label: 'Requested' },
    { value: 'UPCOMING', label: 'Upcoming' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ],
}));

jest.mock('@/app/ui/overlays/Modal/ChangeStatusModal', () => ({
  __esModule: true,
  default: function MockChangeStatusModal({
    showModal,
    currentStatus,
    statusOptions,
    validateBeforeSave,
    renderExtraContent,
    onSave,
    setShowModal,
  }: any) {
    const [selectedStatus, setSelectedStatus] = React.useState(currentStatus);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    if (!showModal) return null;
    return (
      <div data-testid="change-status-modal">
        <span data-testid="current-status">{currentStatus}</span>
        {statusOptions.map((opt: any) => (
          <button key={opt.value} type="button" onClick={() => setSelectedStatus(opt.value)}>
            {opt.label}
          </button>
        ))}
        {renderExtraContent && renderExtraContent({ selectedStatus, saving })}
        {error && <span data-testid="modal-error">{error}</span>}
        <button
          type="button"
          onClick={async () => {
            const validationError = validateBeforeSave?.(selectedStatus);
            if (validationError) {
              setError(validationError);
              return;
            }
            setSaving(true);
            await onSave(selectedStatus);
            setSaving(false);
            setShowModal(false);
          }}
        >
          Save
        </button>
      </div>
    );
  },
}));

import ChangeStatus from '@/app/features/appointments/pages/Appointments/Sections/ChangeStatus';

const makeAppointment = (overrides: any = {}): any => ({
  id: 'appt-1',
  status: 'REQUESTED',
  lead: null,
  ...overrides,
});

describe('ChangeStatus (Appointments)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTeams = [];
    // Default: no service id on the appointment → availability never fetched.
    mockGetSlots.mockResolvedValue([]);
  });

  it('renders modal when showModal is true', () => {
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment()}
      />
    );
    expect(screen.getByTestId('change-status-modal')).toBeInTheDocument();
  });

  it('does not render when showModal is false', () => {
    render(
      <ChangeStatus
        showModal={false}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment()}
      />
    );
    expect(screen.queryByTestId('change-status-modal')).not.toBeInTheDocument();
  });

  it('shows only allowed status transitions for REQUESTED status', () => {
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({ status: 'REQUESTED' })}
      />
    );
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('shows lead picker when REQUESTED→UPCOMING transition is selected', () => {
    mockTeams = [{ practionerId: 'dr-1', name: 'Dr. Smith' }];
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({ status: 'REQUESTED' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(screen.getByTestId('dropdown-Select lead')).toBeInTheDocument();
  });

  it('does not show lead picker for REQUESTED→CANCELLED transition', () => {
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({ status: 'REQUESTED' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
    expect(screen.queryByTestId('dropdown-Select lead')).not.toBeInTheDocument();
  });

  it('blocks REQUESTED→UPCOMING save when no lead selected', async () => {
    mockTeams = [
      { practionerId: 'dr-1', name: 'Dr. Smith' },
      { practionerId: 'dr-2', name: 'Dr. Jones' },
    ];
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({ status: 'REQUESTED' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toHaveTextContent(
        'Select a lead before accepting this appointment.'
      );
    });
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('auto-selects single team member and allows saving REQUESTED→UPCOMING', async () => {
    mockTeams = [{ practionerId: 'dr-1', name: 'Dr. Solo' }];
    mockChangeAppointmentStatus.mockResolvedValue({});
    const setShowModal = jest.fn();
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={makeAppointment({ status: 'REQUESTED' })}
      />
    );
    // Select Upcoming to show the lead picker
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    // useEffect should auto-select the only team member
    await waitFor(() => {
      expect(screen.getByTestId('dropdown-Select lead')).toHaveTextContent('dr-1');
    });
    // Now save should succeed
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockChangeAppointmentStatus).toHaveBeenCalled();
    });
  });

  it('calls changeAppointmentStatus directly for non-REQUESTED transitions', async () => {
    mockChangeAppointmentStatus.mockResolvedValue({});
    const setShowModal = jest.fn();
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={setShowModal}
        activeAppointment={makeAppointment({ status: 'UPCOMING' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'appt-1' }),
        'COMPLETED'
      );
    });
  });

  it('pre-populates lead from appointment when it has a lead id', () => {
    mockTeams = [{ practionerId: 'dr-1', name: 'Dr. Smith' }];
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({
          status: 'REQUESTED',
          lead: { id: 'dr-1', name: 'Dr. Smith' },
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(screen.getByTestId('dropdown-Select lead')).toHaveTextContent('dr-1');
  });

  it('restricts lead options to vets available for the slot but keeps all support options', async () => {
    mockTeams = [
      { practionerId: 'dr-1', name: 'Dr. Smith' },
      { practionerId: 'dr-2', name: 'Dr. Jones' },
    ];
    mockGetSlots.mockResolvedValue([
      {
        startTime: '2026-03-16T09:00:00.000Z',
        endTime: '2026-03-16T09:30:00.000Z',
        vetIds: ['dr-1'],
      },
    ]);
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({
          status: 'REQUESTED',
          appointmentType: { id: 'svc-1' },
          startTime: new Date('2026-03-16T09:00:00.000Z'),
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    // Lead list is filtered to the available vet only.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Dr. Jones' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Dr. Smith' })).toBeInTheDocument();
    // Support list still offers everyone (minus the selected lead, which is none yet).
    expect(screen.getByRole('button', { name: 'support-Dr. Smith' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'support-Dr. Jones' })).toBeInTheDocument();
  });

  it('saves the selected lead and support staff when accepting', async () => {
    mockTeams = [
      { practionerId: 'dr-1', name: 'Dr. Smith' },
      { practionerId: 'dr-2', name: 'Dr. Jones' },
    ];
    mockChangeAppointmentStatus.mockResolvedValue({});
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({ status: 'REQUESTED' })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Smith' }));
    fireEvent.click(screen.getByRole('button', { name: 'support-Dr. Jones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          lead: expect.objectContaining({ id: 'dr-1' }),
          supportStaff: [expect.objectContaining({ id: 'dr-2', name: 'Dr. Jones' })],
        }),
        'UPCOMING'
      );
    });
  });

  it('blocks accepting when no lead is available for the slot', async () => {
    mockTeams = [{ practionerId: 'dr-1', name: 'Dr. Smith' }];
    mockGetSlots.mockResolvedValue([
      { startTime: '2026-03-16T09:00:00.000Z', endTime: '2026-03-16T09:30:00.000Z', vetIds: [] },
    ]);
    render(
      <ChangeStatus
        showModal={true}
        setShowModal={jest.fn()}
        activeAppointment={makeAppointment({
          status: 'REQUESTED',
          appointmentType: { id: 'svc-1' },
          startTime: new Date('2026-03-16T09:00:00.000Z'),
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    await waitFor(() => {
      expect(screen.getByTestId('lead-no-options')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toHaveTextContent('No lead is available');
    });
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });
});
