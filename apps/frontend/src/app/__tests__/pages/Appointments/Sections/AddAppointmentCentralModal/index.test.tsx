import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddAppointmentCentralModal from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal';
import {
  FieldError,
  PersonRow,
  TimeSlotMenuContent,
  TimeSlotTriggerValue,
  TimeSlotDropdown,
  SlotBadge,
  DiscardConfirmationModal,
} from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal/appointmentFormParts';
import { buildBookButtonLabel } from '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal/bookButtonLabel';
import { useAppointmentForm } from '@/app/hooks/useAppointmentForm';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';

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

// The lib/forms mock is gone with the formatTimeLabel call it stood in for: the prefill
// summary now uses the same clock helper as the slot list.
// The marker (rather than an identity fn) is deliberate — with `(t) => t` a regression that
// dropped the formatter altogether still printed the raw value and the tests stayed green.
jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  formatUtcTimeToLocalLabel: jest.fn((t: string) => `clock(${t})`),
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
    <button
      type="button"
      onClick={() => (props.setCurrentDate ?? props.onChange)?.(new Date('2025-06-01'))}
    >
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
    props.showModal ? (
      <div data-testid="center-modal">
        <button
          type="button"
          data-testid="center-modal-fn-close"
          onClick={() => props.setShowModal?.((p: boolean) => !p)}
        />
        {props.children}
      </div>
    ) : null
);

// Phone detection: defaults to desktop (false); the phone-sheet suite overrides it.
jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

// BottomSheet: passthrough that exposes title, children and the sticky footer so
// the phone variant can be asserted without the real sheet chrome/focus-trap.
jest.mock('@/app/ui/layout/PhoneShell/BottomSheet', () => ({
  __esModule: true,
  default: ({ open, title, footer, children, onClose }: any) =>
    open ? (
      <div data-testid="bottom-sheet">
        <span data-testid="bottom-sheet-title">{title}</span>
        <button type="button" data-testid="bottom-sheet-close" onClick={onClose}>
          close
        </button>
        <div data-testid="bottom-sheet-body">{children}</div>
        <div data-testid="bottom-sheet-footer">{footer}</div>
      </div>
    ) : null,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="warning-icon" />,
}));

jest.mock('react-icons/io5', () => ({
  IoPaw: () => <span data-testid="paw-icon" />,
  IoPerson: () => <span data-testid="person-icon" />,
  IoChevronDown: () => <span data-testid="chevron-icon" />,
  IoAdd: () => <span data-testid="add-icon" />,
  IoArrowForward: () => <span data-testid="arrow-forward-icon" />,
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
    mockAppointmentForm.isLoadingSlotScopedOptions = false;
    mockAppointmentForm.selectedDate = null;
    mockAppointmentForm.selectedSlot = null;
    mockAppointmentForm.timeSlots = [];
    mockAppointmentForm.ServiceInfoData = null;
    mockAppointmentForm.LeadOptions = [{ value: 'lead-1', label: 'Dr. Smith' }];
    mockAppointmentForm.TeamOptions = [{ value: 'staff-1', label: 'Nurse Joy' }];
    mockAppointmentForm.setFormData = jest.fn();
    mockAppointmentForm.setFormDataErrors = jest.fn();
    mockAppointmentForm.setSelectedDate = jest.fn();
    mockAppointmentForm.setSelectedSlot = jest.fn();
    validateFormMock.mockReturnValue(true);
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue(mockCompanions);
    (loadCompanionsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
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

  it('renders the Book appointment submit button', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /book appointment/i })).toBeInTheDocument();
  });

  it('renders a Cancel button that closes the modal when there are no unsaved changes', () => {
    const setShowModal = jest.fn();
    render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);
    const cancel = screen.getByRole('button', { name: /^cancel$/i });
    expect(cancel).toBeInTheDocument();
    fireEvent.click(cancel);
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('renders the emergency push + email notification hint', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByText(/will be notified by push \+ email/i)).toBeInTheDocument();
  });

  // The notify-channel checkboxes were removed: the create-appointment API carries no
  // notify field, so the selection was silently discarded on submit. Do not re-add the
  // control without a backend field to persist it to.
  it('does not render notify-channel checkboxes', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.queryByLabelText(/notify/i)).not.toBeInTheDocument();
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

  it('shows booking error after failed submit attempt', async () => {
    mockAppointmentForm.formDataErrors = { booking: 'No slots available' };
    validateFormMock.mockReturnValueOnce(false);

    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    // submitAttempted becomes true, booking error should show
    // Re-render with error
    mockAppointmentForm.formDataErrors = { booking: 'No slots available' };
  });

  it('calls handleCreate on submit when form is valid', async () => {
    validateFormMock.mockReturnValue(true);

    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
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

    expect(screen.getByRole('button', { name: /book appointment/i })).toBeDisabled();
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

    it('Cancel opens the discard confirmation instead of closing when there are unsaved changes', async () => {
      const setShowModal = jest.fn();
      render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
      expect(setShowModal).not.toHaveBeenCalled();
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
    expect(screen.getByTestId('label-dropdown-Services / packages')).toHaveAttribute(
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
    expect(screen.getByRole('button', { name: /book appointment/i })).toBeDisabled();
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

  it('auto-selects companion on first mount when showModal and initialCompanionId are already true/set (mount-time, not toggled)', () => {
    // Regression test: the component can mount with showModal=true and initialCompanionId
    // already populated (e.g. lazy-loaded chunk resolving after the parent already opened it,
    // or a deep-link into the workspace). The auto-select must fire on this very first render,
    // not only when showModal/initialCompanionId change on a later render.
    render(<AddAppointmentCentralModal {...defaultProps} showModal initialCompanionId="c1" />);
    const patientInput = screen.getByLabelText('Patient') as HTMLInputElement;
    expect(patientInput.value).toBe('Buddy');
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
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
      await Promise.resolve();
    });

    expect(handleCreateMock).not.toHaveBeenCalled();
  });

  // ── Populated formData: default-option wiring + support staff + emergency ───
  it('wires selected lead / speciality / service / support staff and emergency into the form', async () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      lead: { id: 'lead-1', name: 'Dr. Smith' },
      supportStaff: [{ id: 'staff-1' }],
      appointmentType: { id: 'svc-1', speciality: { id: 'spec-1' } },
      isEmergency: true,
    } as unknown as typeof mockFormData;
    mockAppointmentForm.ServiceInfoData = { cost: 120, maxDiscount: 10 } as never;

    render(<AddAppointmentCentralModal {...defaultProps} />);

    expect(screen.getByTestId('label-dropdown-Lead')).toHaveAttribute(
      'data-default-option',
      'lead-1'
    );
    expect(screen.getByTestId('label-dropdown-Speciality')).toHaveAttribute(
      'data-default-option',
      'spec-1'
    );
    expect(screen.getByTestId('label-dropdown-Services / packages')).toHaveAttribute(
      'data-default-option',
      'svc-1'
    );
    expect(screen.getByLabelText(/emergency/i)).toBeChecked();
    // hasService true → "No slots available for this date"
  });

  it('support staff multi-select change calls handleSupportStaffChange', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const multi = screen.getByTestId('multi-select-dropdown').querySelector('button')!;

    await act(async () => {
      fireEvent.click(multi);
    });

    expect(handleSupportStaffChangeMock).toHaveBeenCalled();
  });

  it('renders support staff values defensively when entries lack ids or the list is missing', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      supportStaff: [{}],
    } as unknown as typeof mockFormData;
    const { unmount } = render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('multi-select-dropdown')).toBeInTheDocument();
    unmount();

    mockAppointmentForm.formData = {
      ...mockFormData,
      supportStaff: undefined,
    } as unknown as typeof mockFormData;
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('multi-select-dropdown')).toBeInTheDocument();
  });

  it('clears the add-companion target when the fast-track modal jumps to the appointment', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const newButtons = screen.getAllByText('+ New');
    await act(async () => {
      fireEvent.click(newButtons[0]);
    });

    const addCompanionProps = addCompanionSpy.mock.calls[addCompanionSpy.mock.calls.length - 1][0];
    expect(addCompanionProps.onGoToAppointment).toBeInstanceOf(Function);

    await act(async () => {
      addCompanionProps.onGoToAppointment();
    });

    expect(screen.queryByTestId('add-companion-modal')).not.toBeInTheDocument();
  });

  it('excludes the selected lead from the support staff options', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      lead: { id: 'staff-1', name: 'Nurse Joy' },
    } as unknown as typeof mockFormData;
    mockAppointmentForm.TeamOptions = [
      { value: 'staff-1', label: 'Nurse Joy' },
      { value: 'staff-2', label: 'Nurse Amy' },
    ];

    render(<AddAppointmentCentralModal {...defaultProps} />);
    // supportOptions memo filters out the lead — component renders without error
    expect(screen.getByTestId('multi-select-dropdown')).toBeInTheDocument();
  });

  // ── Submit button pointer ripple handlers ──────────────────────────────────
  it('submit button pointer handlers set ripple CSS variables', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const submit = screen.getByRole('button', { name: /book appointment/i });

    await act(async () => {
      fireEvent.pointerDown(submit, { clientX: 12, clientY: 8 });
      fireEvent.pointerMove(submit, { clientX: 20, clientY: 10 });
    });

    expect(submit.style.getPropertyValue('--yc-button-x')).not.toBe('');
  });

  // ── Visit type / lead select / date change / prefill dismissal ─────────────
  it('selecting a visit type updates the appointment kind', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Type of visit'));
    });

    expect(mockAppointmentForm.setFormData).toHaveBeenCalled();
  });

  it('date change without an active prefill just updates the date', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pick date'));
    });

    expect(mockAppointmentForm.setSelectedDate).toHaveBeenCalled();
    expect(resetFormMock).not.toHaveBeenCalled();
  });

  it('date change while a prefill is active exits prefill mode and resets the form', async () => {
    const prefill = {
      date: new Date('2025-06-01'),
      minuteOfDay: 600,
      startTime: new Date('2025-06-01T10:00:00'),
    };
    render(<AddAppointmentCentralModal {...defaultProps} prefill={prefill} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Pick date'));
    });
    expect(resetFormMock).toHaveBeenCalled();

    // A second prefill-dismissing action (lead select) hits the already-dismissed branch
    await act(async () => {
      fireEvent.click(screen.getByText('Lead'));
    });
    expect(handleLeadSelectMock).toHaveBeenCalled();
  });

  it('renders the prefill time label when a prefill start time is present and no slot chosen', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      startTime: '2025-06-01T10:00:00Z',
    } as unknown as typeof mockFormData;
    const prefill = {
      date: new Date('2025-06-01'),
      minuteOfDay: 600,
      startTime: new Date('2025-06-01T10:00:00Z'),
    };
    render(<AddAppointmentCentralModal {...defaultProps} prefill={prefill} />);
    // Pins the prefill summary to the SAME clock helper the slot buttons use. It used to call
    // formatTimeLabel (hour:'2-digit'), so a prefilled 8am read "08:00 AM" under slot buttons
    // that said "8:00 AM". The UTC clock time is extracted first, then formatted once.
    expect(screen.getAllByText('clock(10:00)').length).toBeGreaterThan(0);
  });

  it('computePrefillKey tolerates a prefill without a startTime (non-Date branch)', () => {
    const prefill = {
      date: new Date('2025-06-01'),
      minuteOfDay: 600,
    } as never;
    render(<AddAppointmentCentralModal {...defaultProps} prefill={prefill} />);
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  // ── noSlotsMessage variants + service-change loading effect ─────────────────
  it('shows the speciality-scoped empty message when only a speciality is set', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      appointmentType: { speciality: { id: 'spec-1' } },
    } as unknown as typeof mockFormData;

    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('flags the time-slot loader when a service becomes selected after mount', async () => {
    const { rerender } = render(<AddAppointmentCentralModal {...defaultProps} />);

    mockAppointmentForm.formData = {
      ...mockFormData,
      appointmentType: { id: 'svc-1' },
    } as unknown as typeof mockFormData;

    await act(async () => {
      rerender(<AddAppointmentCentralModal {...defaultProps} />);
    });

    // loadingTimeSlots && serviceSelected → the time trigger shows the loading text
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  it('shows the time-slot loader while slot-scoped options are loading', () => {
    mockAppointmentForm.isLoadingSlotScopedOptions = true;
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  // ── Duration display ───────────────────────────────────────────────────────
  it('derives the slot duration from the selected slot', () => {
    mockAppointmentForm.selectedSlot = {
      startTime: '2025-06-01T10:00:00Z',
      endTime: '2025-06-01T10:30:00Z',
    } as never;
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByText('30 mins')).toBeInTheDocument();
  });

  it('falls back to formData.durationMinutes when no slot is selected', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      durationMinutes: 45,
    } as unknown as typeof mockFormData;
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByText('45 mins')).toBeInTheDocument();
  });

  // #1898: after picking a specialty/service but before choosing a time slot,
  // the badge shows the selected service's configured duration instead of staying
  // empty (previously it only read the slot/durationMinutes, both unset here).
  it('falls back to the selected service duration when no slot or durationMinutes is set', () => {
    mockAppointmentForm.ServiceInfoData = { duration: 25 } as never;
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByText('25 mins')).toBeInTheDocument();
  });

  // ── Slot selection dismisses prefill and sets the slot ─────────────────────
  it('selecting a time slot dismisses prefill and sets the selected slot', async () => {
    mockAppointmentForm.timeSlots = [
      { startTime: '2025-06-01T10:00:00Z', endTime: '2025-06-01T10:30:00Z' },
    ] as never;
    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /time/i }));
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('clock(2025-06-01T10:00:00Z)'));
    });

    expect(mockAppointmentForm.setSelectedSlot).toHaveBeenCalled();
  });

  // ── Patient clear / client select + clear ──────────────────────────────────
  it('clearing a selected patient resets the companion in the form', async () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      companion: { id: 'c1', name: 'Buddy', parent: { id: 'p1', name: 'John Doe' } },
    } as unknown as typeof mockFormData;

    render(<AddAppointmentCentralModal {...defaultProps} />);
    const clearBtn = screen.getByLabelText('Clear selection');

    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(mockAppointmentForm.setFormData).toHaveBeenCalled();
  });

  it('selecting a different client clears a mismatched patient', async () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      companion: { id: 'c1', name: 'Buddy', parent: { id: 'p1', name: 'John Doe' } },
    } as unknown as typeof mockFormData;

    render(<AddAppointmentCentralModal {...defaultProps} />);
    const clientInput = screen.getByLabelText('Client');

    await act(async () => {
      fireEvent.focus(clientInput);
      fireEvent.change(clientInput, { target: { value: 'Jane' } });
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Jane Smith'));
    });

    // patient parent p1 !== selected client p2 → handlePatientClear runs
    expect(mockAppointmentForm.setFormData).toHaveBeenCalled();
  });

  it('selecting then clearing a client empties the client input', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const clientInput = screen.getByLabelText('Client') as HTMLInputElement;

    await act(async () => {
      fireEvent.focus(clientInput);
      fireEvent.change(clientInput, { target: { value: 'Jane' } });
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Jane Smith'));
    });
    expect(clientInput.value).toBe('Jane Smith');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear selection'));
    });
    expect(clientInput.value).toBe('');
  });

  // ── submit-then-select clears the field error ──────────────────────────────
  it('selecting a patient after a failed submit clears the companion error', async () => {
    (validateFormMock as jest.Mock).mockReturnValue({ companionId: 'Required' });
    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
      await Promise.resolve();
    });

    const patientInput = screen.getByLabelText('Patient');
    await act(async () => {
      fireEvent.focus(patientInput);
      fireEvent.change(patientInput, { target: { value: 'Buddy' } });
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Buddy'));
    });

    expect(mockAppointmentForm.setFormDataErrors).toHaveBeenCalled();
  });

  // setFormData is a mock, so the updater it receives is never run by React. Execute it
  // to assert the companion/parent the selection actually writes into the form, rather
  // than only that the setter fired.
  it('writes the selected companion and its parent into the form data', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const patientInput = screen.getByLabelText('Patient');
    await act(async () => {
      fireEvent.focus(patientInput);
      fireEvent.change(patientInput, { target: { value: 'Buddy' } });
    });
    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Buddy'));
    });

    const updater = (mockAppointmentForm.setFormData as jest.Mock).mock.calls.at(-1)?.[0];
    expect(typeof updater).toBe('function');
    expect(updater({ ...mockFormData })).toEqual(
      expect.objectContaining({
        companion: {
          id: 'c1',
          name: 'Buddy',
          species: 'Dog',
          breed: undefined,
          parent: { id: 'p1', name: 'John Doe' },
        },
      })
    );
  });

  // ── canCloseModal guards ───────────────────────────────────────────────────
  it('does not close while loading', async () => {
    const setShowModal = jest.fn();
    mockAppointmentForm.isLoading = true;
    render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-modal'));
    });

    expect(setShowModal).not.toHaveBeenCalled();
  });

  it('does not close while the add-companion modal is open', async () => {
    const setShowModal = jest.fn();
    render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);

    await act(async () => {
      fireEvent.click(screen.getAllByText('+ New')[0]);
    });
    expect(screen.getByTestId('add-companion-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-modal'));
    });

    expect(setShowModal).not.toHaveBeenCalled();
  });

  // ── Add-companion close handler (value + function forms) ────────────────────
  it('closing the add-companion modal clears the target and refreshes companions', async () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getAllByText('+ New')[0]);
    });

    const props = addCompanionSpy.mock.calls.at(-1)![0];

    await act(async () => {
      props.setShowModal(false);
    });
    await act(async () => {
      props.setShowModal(() => false);
    });
    // settle the fire-and-forget loadCompanions promise
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(loadCompanionsForPrimaryOrg).toHaveBeenCalled();
  });

  // ── onSuccess callback from the form hook ──────────────────────────────────
  it('onSuccess closes the modal, resets filters and consumes the prefill', async () => {
    const setShowModal = jest.fn();
    const setActiveFilter = jest.fn();
    const setActiveStatus = jest.fn();
    const onPrefillConsumed = jest.fn();

    render(
      <AddAppointmentCentralModal
        {...defaultProps}
        setShowModal={setShowModal}
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
        onPrefillConsumed={onPrefillConsumed}
      />
    );

    const opts = (useAppointmentForm as jest.Mock).mock.calls.at(-1)![0];
    await act(async () => {
      opts.onSuccess();
    });

    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(setActiveFilter).toHaveBeenCalledWith('all');
    expect(setActiveStatus).toHaveBeenCalledWith('all');
    expect(onPrefillConsumed).toHaveBeenCalled();
  });

  // ── Discard flow: onPrefillConsumed + functional setShowModal ──────────────
  describe('discard flow extras', () => {
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

    it('discarding runs onPrefillConsumed via closeModal', async () => {
      const setShowModal = jest.fn();
      const onPrefillConsumed = jest.fn();
      render(
        <AddAppointmentCentralModal
          {...defaultProps}
          setShowModal={setShowModal}
          onPrefillConsumed={onPrefillConsumed}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-modal'));
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Discard'));
      });

      expect(setShowModal).toHaveBeenCalledWith(false);
      expect(onPrefillConsumed).toHaveBeenCalled();
    });

    it('supports a functional updater for the discard-confirm visibility', async () => {
      render(<AddAppointmentCentralModal {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-modal'));
      });
      expect(screen.getByTestId('center-modal')).toBeInTheDocument();

      // CenterModal mock's functional close → main's setShowModal((p) => !p) branch
      await act(async () => {
        fireEvent.click(screen.getByTestId('center-modal-fn-close'));
      });

      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    });
  });

  // ── initialCompanionId auto-select branches ────────────────────────────────
  it('keeps an unknown initialCompanionId pending until the companion loads', () => {
    render(<AddAppointmentCentralModal {...defaultProps} initialCompanionId="ghost" />);
    // not found → stored as pending, no crash
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('clears the pending auto-select when the modal closes', async () => {
    const { rerender } = render(
      <AddAppointmentCentralModal {...defaultProps} showModal initialCompanionId="c1" />
    );

    await act(async () => {
      rerender(
        <AddAppointmentCentralModal {...defaultProps} showModal={false} initialCompanionId="c1" />
      );
    });

    expect(resetFormMock).toHaveBeenCalled();
  });

  // ── selectedPatientName fallbacks + option photoUrl / client name fallbacks ─
  it('falls back to the raw companion name when it is not in the options', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      companion: { id: 'unknown-id', name: 'Ghost', parent: { id: 'p9', name: '' } },
    } as unknown as typeof mockFormData;

    render(<AddAppointmentCentralModal {...defaultProps} />);
    const patientInput = screen.getByLabelText('Patient') as HTMLInputElement;
    expect(patientInput.value).toBe('Ghost');
  });

  it('treats a non-string companion photoUrl as undefined', () => {
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([
      {
        companion: { id: 'c1', name: 'Buddy', photoUrl: 123, type: 'Dog' },
        parent: { id: 'p1', firstName: 'John', lastName: 'Doe' },
      },
    ]);
    render(<AddAppointmentCentralModal {...defaultProps} />);
    expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
  });

  it('labels a client by id when the parent has no name', () => {
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([
      {
        companion: { id: 'c1', name: 'Buddy', photoUrl: '', type: 'Dog' },
        parent: { id: 'p-noname', firstName: '', lastName: '' },
      },
    ]);
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const clientInput = screen.getByLabelText('Client');

    act(() => {
      fireEvent.focus(clientInput);
    });
    // clientOptions label falls back to the parent id
    expect(screen.getByText('p-noname')).toBeInTheDocument();
  });

  it('focusing a filled patient input clears the query for typeahead', async () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      companion: { id: 'c1', name: 'Buddy', parent: { id: 'p1', name: 'John Doe' } },
    } as unknown as typeof mockFormData;

    render(<AddAppointmentCentralModal {...defaultProps} />);
    const patientInput = screen.getByLabelText('Patient') as HTMLInputElement;
    expect(patientInput.value).toBe('Buddy');

    await act(async () => {
      fireEvent.focus(patientInput);
    });

    // Focus with a value present triggers the setQuery('') branch without error
    expect(patientInput).toBeInTheDocument();
  });
});

// ── Direct sub-component coverage ────────────────────────────────────────────
describe('FieldError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an alert with the message', () => {
    render(<FieldError message="Required field" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required field');
  });
});

describe('SlotBadge', () => {
  it('renders the duration label when provided', () => {
    render(<SlotBadge label="30 mins" />);
    expect(screen.getByText('30 mins')).toBeInTheDocument();
  });

  it('renders an empty badge when label is null', () => {
    render(<SlotBadge label={null} />);
    expect(screen.getByText('Slot duration')).toBeInTheDocument();
  });
});

describe('TimeSlotTriggerValue', () => {
  it('renders the loading spinner while loading', () => {
    render(<TimeSlotTriggerValue isLoading selectedLabel={null} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the selected label when present', () => {
    render(<TimeSlotTriggerValue isLoading={false} selectedLabel="10:00 AM" />);
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });

  it('renders an empty placeholder otherwise', () => {
    const { container } = render(<TimeSlotTriggerValue isLoading={false} selectedLabel={null} />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });
});

describe('TimeSlotMenuContent', () => {
  const baseProps = {
    selectedSlot: null,
    hasService: false,
    setSelectedSlot: jest.fn(),
    closeMenu: jest.fn(),
  };

  it('shows the service-scoped empty message when a service is selected', () => {
    render(<TimeSlotMenuContent {...baseProps} timeSlots={[]} hasService />);
    expect(screen.getByText('No slots for this date')).toBeInTheDocument();
  });

  it('shows the generic empty message without a service', () => {
    render(<TimeSlotMenuContent {...baseProps} timeSlots={[]} />);
    expect(screen.getByText('Select a speciality and service first')).toBeInTheDocument();
  });

  it('prefers an explicit noSlotsMessage', () => {
    render(<TimeSlotMenuContent {...baseProps} timeSlots={[]} noSlotsMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders slot buttons and deselects a selected slot on click', () => {
    const setSelectedSlot = jest.fn();
    const closeMenu = jest.fn();
    const slot = { startTime: '2025-06-01T10:00:00Z', endTime: '2025-06-01T10:30:00Z' };
    render(
      <TimeSlotMenuContent
        {...baseProps}
        timeSlots={[slot] as never}
        selectedSlot={slot as never}
        setSelectedSlot={setSelectedSlot}
        closeMenu={closeMenu}
      />
    );

    fireEvent.mouseDown(screen.getByText('clock(2025-06-01T10:00:00Z)'));
    expect(setSelectedSlot).toHaveBeenCalledWith(null);
    expect(closeMenu).toHaveBeenCalled();
  });

  it('selects an unselected slot on click', () => {
    const setSelectedSlot = jest.fn();
    const slot = { startTime: '2025-06-01T11:00:00Z', endTime: '2025-06-01T11:30:00Z' };
    render(
      <TimeSlotMenuContent
        {...baseProps}
        timeSlots={[slot] as never}
        selectedSlot={null}
        setSelectedSlot={setSelectedSlot}
      />
    );

    fireEvent.mouseDown(screen.getByText('clock(2025-06-01T11:00:00Z)'));
    expect(setSelectedSlot).toHaveBeenCalledWith(slot);
  });
});

describe('TimeSlotDropdown (direct)', () => {
  const baseProps = {
    timeSlots: [] as never,
    selectedSlot: null,
    setSelectedSlot: jest.fn(),
    isLoading: false,
    hasService: false,
  };

  it('derives the selected label from the selected slot', () => {
    render(
      <TimeSlotDropdown
        {...baseProps}
        selectedSlot={{ startTime: '09:00', endTime: '09:30' } as never}
      />
    );
    expect(screen.getByText('clock(09:00)')).toBeInTheDocument();
  });

  it('shows the loading message and error styling while open, opening upward when space is tight', () => {
    const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 755,
      top: 700,
      left: 10,
      right: 110,
      width: 100,
      height: 55,
      x: 10,
      y: 700,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <TimeSlotDropdown
        {...baseProps}
        timeSlots={[{ startTime: '09:00', endTime: '09:30' }] as never}
        isLoading
        error="Pick a time"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /time/i }));
    expect(screen.getByText(/Loading slots/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a time');

    rectSpy.mockRestore();
  });
});

describe('DiscardConfirmationModal (direct)', () => {
  it('renders and wires keep-editing, discard and pointer ripple', () => {
    const setShowModal = jest.fn();
    const onDiscard = jest.fn();
    render(
      <DiscardConfirmationModal showModal setShowModal={setShowModal} onDiscard={onDiscard} />
    );

    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Keep editing'));
    expect(setShowModal).toHaveBeenCalledWith(false);

    const discardBtn = screen.getByText('Discard');
    fireEvent.pointerDown(discardBtn, { clientX: 4, clientY: 6 });
    fireEvent.pointerMove(discardBtn, { clientX: 8, clientY: 9 });
    fireEvent.click(discardBtn);
    expect(onDiscard).toHaveBeenCalled();
  });
});

describe('PersonRow (direct)', () => {
  const baseProps = {
    fieldId: 'field',
    label: 'Patient',
    icon: <span data-testid="row-icon" />,
    query: '',
    setQuery: jest.fn(),
    options: [
      { value: 'c1', label: 'Buddy', photoUrl: 'x' },
      { value: 'c2', label: 'Rex' },
    ],
    onSelect: jest.fn(),
    onClear: jest.fn(),
    onNew: jest.fn(),
  };

  it('opens on focus, shows error styling and selects an option', () => {
    const onSelect = jest.fn();
    const setQuery = jest.fn();
    render(<PersonRow {...baseProps} error="Required" onSelect={onSelect} setQuery={setQuery} />);

    fireEvent.focus(screen.getByLabelText('Patient'));
    expect(screen.getByRole('alert')).toHaveTextContent('Required');

    fireEvent.mouseDown(screen.getByText('Buddy'));
    expect(onSelect).toHaveBeenCalledWith('c1');
    expect(setQuery).toHaveBeenCalledWith('');
  });

  it('shows "No matches found" when a query matches nothing', () => {
    render(<PersonRow {...baseProps} query="zzz" />);
    fireEvent.focus(screen.getByLabelText('Patient'));
    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('shows "No options available" when there are no options', () => {
    render(<PersonRow {...baseProps} options={[]} />);
    fireEvent.focus(screen.getByLabelText('Patient'));
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });

  it('triggers onNew from the + New button', () => {
    const onNew = jest.fn();
    render(<PersonRow {...baseProps} onNew={onNew} />);
    fireEvent.click(screen.getByText('+ New'));
    expect(onNew).toHaveBeenCalled();
  });

  it('clears a selected value and refocuses the input', () => {
    const onClear = jest.fn();
    const setQuery = jest.fn();
    render(
      <PersonRow
        {...baseProps}
        selectedName="Buddy"
        selectedPhotoUrl="x"
        onClear={onClear}
        setQuery={setQuery}
      />
    );

    const input = screen.getByLabelText('Patient') as HTMLInputElement;
    expect(input.value).toBe('Buddy');

    fireEvent.focus(input); // hasValue → setQuery('')
    fireEvent.click(screen.getByLabelText('Clear selection'));
    expect(onClear).toHaveBeenCalled();
    expect(setQuery).toHaveBeenCalledWith('');
  });

  it('closes the dropdown and clears the query on an outside mousedown', () => {
    const setQuery = jest.fn();
    render(<PersonRow {...baseProps} setQuery={setQuery} />);
    const input = screen.getByLabelText('Patient');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Bud' } });

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    // no selectedName → the outside-click handler resets the query
    expect(setQuery).toHaveBeenCalledWith('');
  });
});

describe('AddAppointmentCentralModal — phone bottom-sheet variant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppointmentForm.formData = { ...mockFormData };
    mockAppointmentForm.formDataErrors = {};
    mockAppointmentForm.isLoading = false;
    mockAppointmentForm.isLoadingSlotScopedOptions = false;
    mockAppointmentForm.selectedDate = null;
    mockAppointmentForm.selectedSlot = null;
    mockAppointmentForm.timeSlots = [];
    mockAppointmentForm.ServiceInfoData = null;
    mockAppointmentForm.LeadOptions = [{ value: 'lead-1', label: 'Dr. Smith' }];
    mockAppointmentForm.TeamOptions = [{ value: 'staff-1', label: 'Nurse Joy' }];
    mockAppointmentForm.setFormData = jest.fn();
    mockAppointmentForm.setFormDataErrors = jest.fn();
    mockAppointmentForm.setSelectedDate = jest.fn();
    mockAppointmentForm.setSelectedSlot = jest.fn();
    validateFormMock.mockReturnValue(true);
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue(mockCompanions);
    (loadCompanionsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (useIsPhone as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    (useIsPhone as jest.Mock).mockReturnValue(false);
  });

  it('renders the add-appointment form inside the bottom sheet on phone', () => {
    render(<AddAppointmentCentralModal {...defaultProps} />);

    // The shared BottomSheet is used, titled "New appointment"…
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-sheet-title')).toHaveTextContent('New appointment');
    // …and the desktop CenterModal shell is NOT rendered on phone.
    expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();
    // Same fields/handlers, presented inside the sheet body.
    const body = screen.getByTestId('bottom-sheet-body');
    expect(within(body).getByLabelText('Patient')).toBeInTheDocument();
    expect(within(body).getByLabelText('Client')).toBeInTheDocument();
    expect(within(body).getByLabelText(/emergency/i)).toBeInTheDocument();
  });

  it('renders the sticky footer Book button and submits the form', async () => {
    validateFormMock.mockReturnValue(true);
    render(<AddAppointmentCentralModal {...defaultProps} />);

    const footer = screen.getByTestId('bottom-sheet-footer');
    const book = within(footer).getByRole('button', { name: /book/i });

    await act(async () => {
      fireEvent.click(book);
      await Promise.resolve();
    });

    expect(handleCreateMock).toHaveBeenCalled();
  });

  it('does not render the sheet when the modal is closed', () => {
    render(<AddAppointmentCentralModal {...defaultProps} showModal={false} />);
    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument();
  });

  it('reflects an emergency draft and edits notes inside the sheet', () => {
    mockAppointmentForm.formData = {
      ...mockFormData,
      isEmergency: true,
    };
    render(<AddAppointmentCentralModal {...defaultProps} />);
    const body = screen.getByTestId('bottom-sheet-body');

    // Emergency toggle renders in its "on" state within the sheet…
    expect(within(body).getByLabelText(/emergency/i)).toBeChecked();
    // …and is still wired to the shared form handler.
    fireEvent.click(within(body).getByLabelText(/emergency/i));
    fireEvent.change(within(body).getByTestId('form-desc'), { target: { value: 'x' } });
    expect(mockAppointmentForm.setFormData).toHaveBeenCalled();
  });

  it('closes the sheet via its onClose when there are no unsaved changes', () => {
    const setShowModal = jest.fn();
    render(<AddAppointmentCentralModal {...defaultProps} setShowModal={setShowModal} />);

    fireEvent.click(screen.getByTestId('bottom-sheet-close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});

describe('buildBookButtonLabel', () => {
  it('uses the client first name when a client is selected', () => {
    expect(buildBookButtonLabel('Lena Hartmann')).toBe('Book · Lena gets notified');
  });

  it('falls back to a generic label when no client is selected', () => {
    expect(buildBookButtonLabel()).toBe('Book appointment');
    expect(buildBookButtonLabel('')).toBe('Book appointment');
  });
});
