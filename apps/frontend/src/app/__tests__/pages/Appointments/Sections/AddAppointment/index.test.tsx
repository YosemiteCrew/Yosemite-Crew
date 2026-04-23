import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddAppointment from '@/app/features/appointments/pages/Appointments/Sections/AddAppointment';
import * as appointmentService from '@/app/features/appointments/services/appointmentService';

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: jest.fn(() => [
    {
      companion: { id: 'comp-1', name: 'Buddy', type: 'Dog', breed: 'Golden' },
      parent: { id: 'parent-1', firstName: 'John' },
    },
  ]),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(() => [
    { _id: 'lead-1', name: 'Dr. Smith' },
    { _id: 'staff-1', name: 'Nurse Joy' },
  ]),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(() => [{ _id: 'spec-1', name: 'General Checkup' }]),
}));

jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: {
    getState: () => ({
      getServicesBySpecialityId: jest.fn(() => [
        {
          id: 'serv-1',
          name: 'Consultation',
          description: 'Basic check',
          cost: '50',
          maxDiscount: '10',
          durationMinutes: '30',
        },
      ]),
    }),
  },
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  createAppointment: jest.fn(),
  getCalendarPrefillMatchesForPrimaryOrg: jest.fn(() => Promise.resolve(null)),
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
  loadAppointmentsForPrimaryOrg: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/app/hooks/useStripeOnboarding', () => ({
  useSubscriptionCounterUpdate: jest.fn(() => ({ refetch: jest.fn(() => Promise.resolve()) })),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCanMoreForPrimaryOrg: jest.fn(() => ({ canMore: true, reason: 'ok' })),
  useCurrencyForPrimaryOrg: jest.fn(() => 'USD'),
}));

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  loadInvoicesForOrgPrimaryOrg: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label }: any) => <div>{label}</div>,
}));

jest.mock('@/app/lib/date', () => ({
  buildUtcDateFromDateAndTime: jest.fn((d) => d),
  getDurationMinutes: jest.fn(() => 30),
  formatDisplayDate: jest.fn(() => 'Jan 1, 2026'),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  formatUtcTimeToLocalLabel: jest.fn(() => '10:00 AM'),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/EditableAccordion', () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid="editable-accordion">
      <h4>{title}</h4>
      <pre>{JSON.stringify(data)}</pre>
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button onClick={onClick} data-testid="submit-btn">
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => <button onClick={onClick}>{text}</button>,
}));

jest.mock('@/app/ui/inputs/SearchDropdown', () => ({
  __esModule: true,
  default: ({ onSelect, error }: any) => (
    <div>
      <button data-testid="search-companion" onClick={() => onSelect('comp-1')}>
        Select Buddy
      </button>
      {error && <span data-testid="err-companion">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, error, options }: any) => (
    <div>
      <button
        data-testid={`select-${placeholder}`}
        onClick={() => {
          if (placeholder === 'Speciality') onSelect({ value: 'spec-1', label: 'General Checkup' });
          if (placeholder === 'Service') onSelect({ value: 'serv-1', label: 'Consultation' });
          if (placeholder === 'Lead' && options?.length) onSelect(options[0]);
        }}
      >
        Select {placeholder}
      </button>
      {error && <span data-testid={`err-${placeholder}`}>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ onChange, onFocus, onBlur, value }: any) => (
    <textarea
      data-testid="concern-input"
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      value={value}
    />
  ),
}));

jest.mock('@/app/ui/inputs/Slotpicker', () => ({
  __esModule: true,
  default: ({ setSelectedSlot, timeSlots }: any) => (
    <div data-testid="slot-picker">
      <button
        data-testid="slot-0"
        onClick={() =>
          setSelectedSlot(
            timeSlots?.[0] ?? { startTime: '10:00', endTime: '10:30', vetIds: ['lead-1'] }
          )
        }
      >
        {timeSlots?.[0]?.startTime ?? '10:00'}
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input readOnly value={value} />
      {error && <span data-testid={`err-input-${inlabel}`}>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button data-testid="close-btn" onClick={onClick}>
      X
    </button>
  ),
}));

describe('AddAppointment Component', () => {
  const mockSetShowModal = jest.fn();
  const mockSetActiveStatus = jest.fn();
  const mockSetActiveFilter = jest.fn();
  const defaultProps = {
    showModal: true,
    setShowModal: mockSetShowModal,
    setActiveStatus: mockSetActiveStatus,
    setActiveFilter: mockSetActiveFilter,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (appointmentService.getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([
      { startTime: '10:00', endTime: '10:30', vetIds: ['lead-1'] },
    ]);
  });

  it('renders base modal and companion section', () => {
    render(<AddAppointment {...defaultProps} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Add appointment')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-Companion details')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('shows companion validation when step 1 next is clicked without a companion', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByTestId('err-companion')).toBeInTheDocument();
    });
  });

  it('reveals details step and fetches slots after companion + speciality + service selection', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));

    await waitFor(() => {
      expect(screen.getByTestId('select-Speciality')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));

    await waitFor(() => {
      expect(appointmentService.getSlotsForServiceAndDateForPrimaryOrg).toHaveBeenCalled();
    });
  });

  it('advances through accordions with next buttons', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));

    await waitFor(() => {
      expect(screen.getByTestId('select-Speciality')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Next')[0]);

    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));
    fireEvent.change(screen.getByTestId('concern-input'), { target: { value: 'Limping' } });
    fireEvent.click(screen.getAllByText('Next')[1]);

    await waitFor(() => {
      expect(screen.getByTestId('slot-0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('slot-0'));
    fireEvent.click(screen.getByTestId('select-Lead'));
    fireEvent.click(screen.getAllByText('Next')[2]);

    await waitFor(() => {
      expect(screen.getByText('Book appointment')).toBeInTheDocument();
    });
  });

  it('shows companion validation when submitting without required input', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByText('Book appointment'));

    await waitFor(() => {
      expect(screen.getByTestId('err-companion')).toBeInTheDocument();
    });

    expect(appointmentService.createAppointment).not.toHaveBeenCalled();
  });

  it('uses date-time before details when opened from calendar slot prefill', async () => {
    render(
      <AddAppointment
        {...defaultProps}
        prefill={{ date: new Date('2026-04-01T00:00:00.000Z'), minuteOfDay: 600, leadId: 'lead-1' }}
      />
    );

    fireEvent.click(screen.getByTestId('search-companion'));

    await waitFor(() => {
      expect(screen.queryByTestId('slot-picker')).not.toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.queryByTestId('select-Speciality')).not.toBeInTheDocument();
    });
  });

  it('shows a blocking booking loader until the submit flow completes', async () => {
    let resolveCreate: (() => void) | undefined;
    (appointmentService.createAppointment as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        })
    );

    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));

    await waitFor(() => {
      expect(screen.getByTestId('select-Speciality')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));
    fireEvent.change(screen.getByTestId('concern-input'), { target: { value: 'Limping' } });
    fireEvent.click(screen.getAllByText('Next')[1]);

    await waitFor(() => {
      expect(screen.getByTestId('slot-0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('slot-0'));
    fireEvent.click(screen.getByTestId('select-Lead'));
    fireEvent.click(screen.getAllByText('Next')[2]);

    await waitFor(() => {
      expect(screen.getByText('Book appointment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Book appointment'));

    await waitFor(() => {
      expect(screen.getByText('Booking appointment')).toBeInTheDocument();
      expect(
        screen.getByText('Finalizing the appointment and refreshing the schedule.')
      ).toBeInTheDocument();
    });

    expect(mockSetShowModal).not.toHaveBeenCalled();

    await waitFor(async () => {
      resolveCreate?.();
    });

    await waitFor(() => {
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it('toggles the emergency checkbox when clicking its label text', () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));
    fireEvent.change(screen.getByTestId('concern-input'), { target: { value: 'Limping' } });
    fireEvent.click(screen.getAllByText('Next')[1]);
    fireEvent.click(screen.getByTestId('slot-0'));
    fireEvent.click(screen.getByTestId('select-Lead'));
    fireEvent.click(screen.getAllByText('Next')[2]);

    const emergencyLabel = screen.getByText('I confirm this is an emergency.');
    const emergencyCheckbox = screen.getByLabelText('I confirm this is an emergency.');

    expect(emergencyCheckbox).not.toBeChecked();

    fireEvent.click(emergencyLabel);
    expect(emergencyCheckbox).toBeChecked();

    fireEvent.click(emergencyLabel);
    expect(emergencyCheckbox).not.toBeChecked();
  });
});
