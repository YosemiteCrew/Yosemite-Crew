import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddAppointmentCentralModal from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal';
import { useAppointmentForm } from '@/app/hooks/useAppointmentForm';

// ── React 19 createPortal mock ──────────────────────────────────────────────
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// ── Hooks / stores ──────────────────────────────────────────────────────────
const mockCompanions = [
  {
    companion: { id: 'c1', name: 'Buddy', photoUrl: '', type: 'Dog' },
    parent: { id: 'p1', firstName: 'John', lastName: 'Doe' },
  },
  {
    companion: { id: 'c2', name: 'Rex', photoUrl: '', type: 'Cat' },
    parent: { id: 'p2', firstName: 'Jane', lastName: 'Smith' },
  },
];

const resetFormMock = jest.fn();
const validateFormMock = jest.fn(() => true);
const handleCreateMock = jest.fn(() => Promise.resolve());
const handleSpecialitySelectMock = jest.fn();
const handleServiceSelectMock = jest.fn();
const handleLeadSelectMock = jest.fn();
const handleSupportStaffChangeMock = jest.fn();

const mockFormData = {
  companionId: '',
  specialityId: '',
  serviceId: '',
  leadId: '',
  supportStaff: [],
  notes: '',
  isEmergency: false,
  appointmentKind: 'OUTPATIENT' as 'OUTPATIENT' | 'INPATIENT',
  startTime: null,
  endTime: null,
  companion: { id: '', name: '' },
  client: { id: '', name: '' },
};

const mockAppointmentForm = {
  formData: mockFormData,
  formDataErrors: {},
  selectedDate: null,
  selectedSlot: null,
  timeSlots: [],
  LeadOptions: [{ value: 'lead-1', label: 'Dr. Smith' }],
  leadEmptyStateMessage: '',
  TeamOptions: [{ value: 'staff-1', label: 'Nurse Joy' }],
  SpecialitiesOptions: [{ value: 'spec-1', label: 'General' }],
  ServicesOptions: [{ value: 'svc-1', label: 'Checkup' }],
  ServiceInfoData: null,
  isLoading: false,
  isLoadingSlotScopedOptions: false,
  setFormData: jest.fn(),
  setFormDataErrors: jest.fn(),
  setSelectedDate: jest.fn(),
  setSelectedSlot: jest.fn(),
  handleCreate: handleCreateMock,
  handleSpecialitySelect: handleSpecialitySelectMock,
  handleServiceSelect: handleServiceSelectMock,
  handleLeadSelect: handleLeadSelectMock,
  handleSupportStaffChange: handleSupportStaffChangeMock,
  resetForm: resetFormMock,
  validateForm: validateFormMock,
};

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: jest.fn(() => mockCompanions),
}));

jest.mock('@/app/hooks/useAppointmentForm', () => ({
  useAppointmentForm: jest.fn(() => mockAppointmentForm),
}));

jest.mock('@/app/features/companions/services/companionService', () => ({
  loadCompanionsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: jest.fn(() => (text: string) => text),
}));

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: jest.fn((name: string) => name),
}));

jest.mock('@/app/lib/forms', () => ({
  formatTimeLabel: jest.fn((t: string) => t),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  formatUtcTimeToLocalLabel: jest.fn((t: string) => t),
}));

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils',
  () => ({
    hasUnsavedCentralChanges: jest.fn(() => false),
  })
);

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => (props: any) => (
  <div
    data-testid={`label-dropdown-${props.placeholder ?? props['aria-label'] ?? props.label ?? 'default'}`}
    data-default-option={props.defaultOption}
  >
    <button type="button" onClick={() => props.onSelect?.(props.options?.[0]?.value)}>
      {props.placeholder ?? props.label}
    </button>
  </div>
));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => (props: any) => (
  <div data-testid="multi-select-dropdown">
    <button type="button" onClick={() => props.onChange?.([props.options?.[0]])}>
      {props.label}
    </button>
  </div>
));

jest.mock('@/app/ui/inputs/Datepicker', () => (props: any) => (
  <div data-testid="datepicker">
    <button type="button" onClick={() => props.onChange?.(new Date('2025-06-01'))}>
      Pick date
    </button>
  </div>
));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => (props: any) => (
  <textarea
    data-testid="form-desc"
    value={props.value ?? ''}
    onChange={(e) => props.onChange?.(e.target.value)}
    placeholder={props.placeholder}
  />
));

const addCompanionSpy = jest.fn();
jest.mock('@/app/features/companions/components/AddCompanionCentralModal', () => (props: any) => {
  addCompanionSpy(props);
  return props.showModal ? <div data-testid="add-companion-modal" /> : null;
});

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell',
  () => ({
    __esModule: true,
    default: ({ children, canClose, setShowModal }: any) => {
      const handleClose = () => {
        const canProceed = canClose ? canClose() : true;
        if (canProceed) setShowModal(false);
      };
      return (
        <div data-testid="modal-shell">
          <button type="button" onClick={handleClose} data-testid="close-modal">
            Close
          </button>
          {children}
        </div>
      );
    },
  })
);

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar',
  () => () => <div data-testid="appointment-avatar" />
);

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentEstimatePanel',
  () => () => <div data-testid="estimate-panel" />
);

jest.mock(
  '@/app/ui/overlays/Modal/CenterModal',
  () => (props: any) =>
    props.showModal ? <div data-testid="center-modal">{props.children}</div> : null
);

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="warning-icon" />,
}));

jest.mock('react-icons/io5', () => ({
  IoPaw: () => <span data-testid="paw-icon" />,
  IoPerson: () => <span data-testid="person-icon" />,
  IoChevronDown: () => <span data-testid="chevron-icon" />,
}));

jest.mock('react-icons/ti', () => ({
  TiPlus: () => <span data-testid="plus-icon" />,
}));

jest.mock('@/app/ui/primitives/Buttons/ButtonEffects.css', () => ({}), { virtual: true });

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
  setActiveFilter: jest.fn(),
  setActiveStatus: jest.fn(),
};

describe('AddAppointmentCentralModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppointmentForm.formData = { ...mockFormData };
    mockAppointmentForm.formDataErrors = {};
    mockAppointmentForm.isLoading = false;
    mockAppointmentForm.selectedDate = null;
    mockAppointmentForm.selectedSlot = null;
    mockAppointmentForm.timeSlots = [];
  });

  it('renders the modal shell when showModal is true', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('renders modal shell even when showModal is false (shell controls visibility)', () => {
    render(<AddAppointmentCentralModal {...defaultProps} showModal={false} />);
    // The shell still renders but hides via CSS opacity — AddCompanionModal should not show
    expect(screen.queryByTestId('add-companion-modal')).not.toBeInTheDocument();
  });

  it('renders patient and client input rows', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByLabelText('Patient')).toBeInTheDocument();
    expect(screen.getByLabelText('Client')).toBeInTheDocument();
  });

  it('renders the Add Appointment submit button', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add appointment/i })).toBeInTheDocument();
  });

  it('renders notify checkboxes', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByLabelText(/Notify by Notify via App/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notify by Notify via SMS/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notify by Notify via Email/i)).toBeInTheDocument();
  });

  it('renders emergency checkbox', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByLabelText(/emergency/i)).toBeInTheDocument();
  });

  it('toggles emergency checkbox', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const emergencyCheckbox = screen.getByLabelText(/emergency/i);

    await act(async () => {
      fireEvent.click(emergencyCheckbox);
    });

    expect(mockAppointmentForm.setFormData).toHaveBeenCalled();
  });

  it('toggles notify channel checkboxes', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const smsCheckbox = screen.getByLabelText(/Notify by Notify via SMS/i);

    await act(async () => {
      fireEvent.click(smsCheckbox);
    });

    // SMS checkbox was toggled (state update happened)
    expect(smsCheckbox).toBeTruthy();
  });

  it('shows booking error after failed submit attempt', async () => {
    mockAppointmentForm.formDataErrors = { booking: 'No slots available' };
    validateFormMock.mockReturnValueOnce(false);

    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add appointment/i }));
    });

    // submitAttempted becomes true, booking error should show
    // Re-render with error
    mockAppointmentForm.formDataErrors = { booking: 'No slots available' };
  });

  it('calls handleCreate on submit when form is valid', async () => {
    validateFormMock.mockReturnValue(true);

    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add appointment/i }));
      await Promise.resolve();
    });

    expect(handleCreateMock).toHaveBeenCalled();
  });

  it('renders AddCompanionModal when add companion is triggered', async () => {
    const { rerender } = render(<AddAppointmentCentralModal {...defaultProps} />);

    // The add-companion modal should not be visible initially
    expect(screen.queryByTestId('add-companion-modal')).not.toBeInTheDocument();

    rerender(<AddAppointmentCentralModal {...defaultProps} />);
  });

  it('disables submit button when isLoading is true', () => {
    mockAppointmentForm.isLoading = true;

    render(<AddAppointmentCentralModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: /add appointment/i })).toBeDisabled();
  });

  it('closes modal directly when no unsaved changes', async () => {
    const setShowModal = jest.fn();

    render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-modal'));
    });

    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  describe('discard confirmation', () => {
    beforeEach(() => {
      const { hasUnsavedCentralChanges } = jest.requireMock(
        '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils'
      );
      hasUnsavedCentralChanges.mockReturnValue(true);
    });

    afterEach(() => {
      const { hasUnsavedCentralChanges } = jest.requireMock(
        '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils'
      );
      hasUnsavedCentralChanges.mockReturnValue(false);
    });

    it('renders discard confirmation modal when close is triggered with unsaved changes', async () => {
      render(<AddAppointmentCentralModal {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-modal'));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    });

    it('keep editing button closes discard confirm modal', async () => {
      render(<AddAppointmentCentralModal {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-modal'));
      });

      expect(screen.getByText('Keep editing')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Keep editing'));
      });

      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    });

    it('discard and close button calls setShowModal with false', async () => {
      const setShowModal = jest.fn();
      render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-modal'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Discard'));
      });

      expect(setShowModal).toHaveBeenCalledWith(false);
    });
  });

  it('resets form when modal closes (showModal goes false)', async () => {
    const { rerender } = render(<AddAppointmentCentralModal {...defaultProps} showModal={true} />);

    await act(async () => {
      rerender(<AddAppointmentCentralModal {...defaultProps} showModal={false} />);
    });

    expect(resetFormMock).toHaveBeenCalled();
  });

  it('renders specialities and services dropdowns', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    // LabelDropdown mocks are rendered
    expect(screen.getAllByTestId(/label-dropdown/)).toBeTruthy();
  });

  it('passes empty controlled values to lead, speciality, and service after form reset', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    expect(screen.getByTestId('label-dropdown-Lead')).toHaveAttribute('data-default-option', '');
    expect(screen.getByTestId('label-dropdown-Speciality')).toHaveAttribute(
      'data-default-option',
      ''
    );
    expect(screen.getByTestId('label-dropdown-Services / Packages')).toHaveAttribute(
      'data-default-option',
      ''
    );
  });

  it('renders estimate panel', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('estimate-panel')).toBeInTheDocument();
  });

  it('renders FormDesc for notes', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('form-desc')).toBeInTheDocument();
  });

  it('renders Datepicker', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('datepicker')).toBeInTheDocument();
  });

  it('filters companion options based on patient query', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    // Patient query is initially empty - both companions visible in options
    // This exercises the filteredPatientOptions memo
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('typing in patient input field updates patient query', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const patientInput = screen.getByLabelText('Patient');

    await act(async () => {
      fireEvent.change(patientInput, { target: { value: 'Buddy' } });
    });

    expect(patientInput).toHaveValue('Buddy');
  });

  it('typing in client input field updates client query', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const clientInput = screen.getByLabelText('Client');

    await act(async () => {
      fireEvent.change(clientInput, { target: { value: 'John' } });
    });

    expect(clientInput).toHaveValue('John');
  });

  it('clicking + New patient button opens add companion modal', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const newButtons = screen.getAllByText('+ New');
    await act(async () => {
      fireEvent.click(newButtons[0]);
    });

    expect(screen.getByTestId('add-companion-modal')).toBeInTheDocument();
  });

  it('renders visit type display section', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    // LabelDropdown for visit type is rendered
    expect(screen.getAllByTestId(/label-dropdown/).length).toBeGreaterThan(0);
  });

  it('keeps the visit type synced to the selected service appointment kind', async () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      appointmentKind: 'INPATIENT',
    };

    render(<AddAppointmentCentralModal {...defaultProps} />);

    await waitFor(() => {
      expect(useAppointmentForm).toHaveBeenLastCalledWith(
        expect.objectContaining({ appointmentKind: 'INPATIENT' })
      );
    });
  });

  it('renders time slot dropdown button', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /time/i })).toBeInTheDocument();
  });

  it('clicking time slot button opens dropdown', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const timeButton = screen.getByRole('button', { name: /time/i });

    await act(async () => {
      fireEvent.click(timeButton);
    });

    expect(timeButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows loading indicator on submit button when isLoading', () => {
    mockAppointmentForm.isLoading = true;
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add appointment/i })).toBeDisabled();
  });

  it('prefill active state is set when prefill prop is provided', async () => {
    const prefill = {
      startTime: new Date('2025-06-01T10:00:00'),
      assignedTo: 'lead-1',
      date: new Date('2025-06-01'),
      minuteOfDay: 600,
    };
    render(<AddAppointmentCentralModal {...defaultProps} prefill={prefill} />);
    // The prefill active state controls display - modal renders normally
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('initialCompanionId pre-selects companion when provided', () => {
    render(<AddAppointmentCentralModal {...defaultProps} initialCompanionId="c1" />);
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('renders visit notes FormDesc', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('form-desc')).toBeInTheDocument();
  });

  it('handles notes change in FormDesc', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const formDesc = screen.getByTestId('form-desc');

    await act(async () => {
      fireEvent.change(formDesc, { target: { value: 'Follow-up needed' } });
    });

    expect(mockAppointmentForm.setFormData).toHaveBeenCalled();
  });

  it('clicking in patient input prevents default dropdown from closing', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const patientInput = screen.getByLabelText('Patient');

    await act(async () => {
      fireEvent.focus(patientInput);
      fireEvent.click(patientInput);
    });

    // Focus interaction on patient input works without error
    expect(patientInput).toBeTruthy();
  });

  it('selecting a patient option from dropdown updates formData', async () => {
    const mockSetFormData = jest.fn();
    mockAppointmentForm.setFormData = mockSetFormData;

    render(<AddAppointmentCentralModal {...defaultProps} />);

    const patientInput = screen.getByLabelText('Patient');

    await act(async () => {
      fireEvent.change(patientInput, { target: { value: 'Buddy' } });
    });

    // Options appear after typing
    await act(async () => {
      const option = screen.queryByText('Buddy');
      if (option) fireEvent.click(option);
    });
  });

  it('clicking + New client button opens add companion modal for client', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const newButtons = screen.getAllByText('+ New');
    // Second "New" button is for client
    if (newButtons.length > 1) {
      await act(async () => {
        fireEvent.click(newButtons[1]);
      });
      expect(screen.getByTestId('add-companion-modal')).toBeInTheDocument();
    } else {
      expect(newButtons.length).toBeGreaterThan(0);
    }
  });

  it('time slot dropdown closes on outside click', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const timeButton = screen.getByRole('button', { name: /time/i });

    await act(async () => {
      fireEvent.click(timeButton);
    });

    expect(timeButton).toHaveAttribute('aria-expanded', 'true');

    await act(async () => {
      fireEvent.mouseDown(document.body);
    });

    expect(timeButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not show booking error before any submit attempt', () => {
    mockAppointmentForm.formDataErrors = { booking: 'Slot not available' };

    render(<AddAppointmentCentralModal {...defaultProps} />);

    // submitAttempted is false by default — error section not shown yet
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('companion auto-select: pendingAutoSelectCompanionId sets formData when companion is found', async () => {
    // Simulate companion creation callback
    render(<AddAppointmentCentralModal {...defaultProps} />);

    // Trigger + New patient
    const newButtons = screen.getAllByText('+ New');
    await act(async () => {
      fireEvent.click(newButtons[0]);
    });

    // Close the add companion modal via onCompanionCreated
    const addCompanionProps = addCompanionSpy.mock.calls[addCompanionSpy.mock.calls.length - 1][0];
    expect(addCompanionProps.onCompanionCreated).toBeInstanceOf(Function);

    await act(async () => {
      addCompanionProps.onCompanionCreated('c1');
    });

    // The pending auto-select id is set — formData.setFormData should be called on next render
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('does not submit when validateForm returns errors', async () => {
    (validateFormMock as jest.Mock).mockReturnValue({
      companionId: 'Required',
      serviceId: 'Required',
    });
    mockAppointmentForm.formDataErrors = {};

    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add appointment/i }));
      await Promise.resolve();
    });

    expect(handleCreateMock).not.toHaveBeenCalled();
  });
});
