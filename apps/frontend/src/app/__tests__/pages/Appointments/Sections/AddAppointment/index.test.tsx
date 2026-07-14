import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddAppointment from '@/app/features/appointments/pages/Appointments/Sections/AddAppointment';
import * as appointmentService from '@/app/features/appointments/services/appointmentService';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: jest.fn(() => [
    {
      companion: { id: 'comp-1', name: 'Buddy', type: 'Dog', breed: 'Golden' },
      parent: { id: 'parent-1', firstName: 'John' },
    },
  ]),
}));

jest.mock('@/app/features/companions/services/companionService', () => ({
  loadCompanionsForPrimaryOrg: jest.fn(() => Promise.resolve()),
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
  default: ({ title, children, open, onOpenChange }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      <button data-testid={`toggle-${title}`} onClick={() => onOpenChange?.(!open)}>
        toggle {title}
      </button>
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
  default: ({ onSelect, setQuery, error }: any) => (
    <div>
      <button data-testid="search-companion" onClick={() => onSelect('comp-1')}>
        Select Buddy
      </button>
      <button data-testid="search-companion-2" onClick={() => onSelect('comp-2')}>
        Select Milo
      </button>
      <button data-testid="search-companion-unknown" onClick={() => onSelect('does-not-exist')}>
        Select Unknown
      </button>
      <button data-testid="search-setquery" onClick={() => setQuery('bud')}>
        Set Query
      </button>
      {error && <span data-testid="err-companion">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button data-testid="support-select" onClick={() => onChange(['staff-1'])}>
      Support
    </button>
  ),
}));

jest.mock('@/app/features/companions/components/AddCompanion', () => ({
  __esModule: true,
  default: ({ showModal, setShowModal, onCompanionCreated }: any) =>
    showModal ? (
      <div data-testid="add-companion-modal">
        <button data-testid="ac-create" onClick={() => onCompanionCreated?.('comp-2')}>
          Create companion
        </button>
        <button data-testid="ac-create-blank" onClick={() => onCompanionCreated?.('   ')}>
          Create blank
        </button>
        <button data-testid="ac-close" onClick={() => setShowModal(false)}>
          Close (bool)
        </button>
        <button data-testid="ac-close-fn" onClick={() => setShowModal((prev: boolean) => !prev)}>
          Close (fn)
        </button>
      </div>
    ) : null,
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, error, options }: any) => {
    const isService = placeholder === 'Services / Packages';
    const testKey = isService ? 'Service' : placeholder;
    return (
      <div>
        <button
          data-testid={`select-${testKey}`}
          onClick={() => {
            if (placeholder === 'Speciality')
              onSelect({ value: 'spec-1', label: 'General Checkup' });
            if (isService) onSelect({ value: 'serv-1', label: 'Consultation' });
            if (placeholder === 'Lead' && options?.length) onSelect(options[0]);
          }}
        >
          Select {placeholder}
        </button>
        {error && <span data-testid={`err-${testKey}`}>{error}</span>}
      </div>
    );
  },
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
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([
      {
        companion: { id: 'comp-1', name: 'Buddy', type: 'Dog', breed: 'Golden' },
        parent: { id: 'parent-1', firstName: 'John' },
      },
    ]);
    (loadCompanionsForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (appointmentService.createAppointment as jest.Mock).mockResolvedValue(undefined);
    (appointmentService.getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([
      { startTime: '10:00', endTime: '10:30', vetIds: ['lead-1'] },
    ]);
    Element.prototype.scrollIntoView = jest.fn();
    HTMLDivElement.prototype.scrollTo = jest.fn();
  });

  const flushAsync = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const advanceToBilling = async () => {
    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));
    fireEvent.change(screen.getByTestId('concern-input'), { target: { value: 'Limping' } });
    await waitFor(() =>
      expect(appointmentService.getSlotsForServiceAndDateForPrimaryOrg).toHaveBeenCalled()
    );
    fireEvent.click(screen.getAllByText('Next')[1]);
    await waitFor(() => expect(screen.getByTestId('slot-0')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('slot-0'));
    fireEvent.click(screen.getByTestId('select-Lead'));
    fireEvent.click(screen.getAllByText('Next')[2]);
    await waitFor(() => expect(screen.getByText('Book appointment')).toBeInTheDocument());
  };

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

  it('scrolls the modal container instead of the page when advancing steps', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));

    await waitFor(() => {
      expect(HTMLDivElement.prototype.scrollTo).toHaveBeenCalled();
    });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
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

  it('resets the form and consumes the prefill when the modal is closed', async () => {
    const onPrefillConsumed = jest.fn();
    const { rerender } = render(
      <AddAppointment {...defaultProps} onPrefillConsumed={onPrefillConsumed} />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();

    await act(async () => {
      rerender(
        <AddAppointment {...defaultProps} showModal={false} onPrefillConsumed={onPrefillConsumed} />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onPrefillConsumed).toHaveBeenCalled();
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('toggles the companion accordion and forwards search-dropdown queries', async () => {
    render(<AddAppointment {...defaultProps} />);

    const toggle = screen.getByTestId('toggle-Companion details');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByTestId('search-setquery'));

    expect(screen.getByTestId('accordion-Companion details')).toBeInTheDocument();
    await flushAsync();
  });

  it('ignores a companion selection whose id is not in the loaded list', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion-unknown'));

    expect(screen.queryByTestId('editable-accordion')).not.toBeInTheDocument();
    expect(screen.queryByTestId('accordion-Appointment details')).not.toBeInTheDocument();
    await flushAsync();
  });

  it('focuses and blurs the concern field to unlock the date & time step', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));
    fireEvent.change(screen.getByTestId('concern-input'), { target: { value: 'Limping' } });
    await waitFor(() =>
      expect(appointmentService.getSlotsForServiceAndDateForPrimaryOrg).toHaveBeenCalled()
    );

    fireEvent.focus(screen.getByTestId('concern-input'));
    fireEvent.blur(screen.getByTestId('concern-input'));

    await waitFor(() =>
      expect(screen.getByTestId('accordion-Select date & time')).toBeInTheDocument()
    );
    await flushAsync();
  });

  it('toggles the details, date & time, and billing accordions and edits support staff', async () => {
    render(<AddAppointment {...defaultProps} />);

    await advanceToBilling();

    fireEvent.click(screen.getByTestId('toggle-Appointment details'));
    fireEvent.click(screen.getByTestId('toggle-Appointment details'));
    fireEvent.click(screen.getByTestId('toggle-Select date & time'));
    fireEvent.click(screen.getByTestId('toggle-Select date & time'));
    fireEvent.click(screen.getByTestId('toggle-Billable services'));
    fireEvent.click(screen.getByTestId('toggle-Billable services'));
    fireEvent.click(screen.getByTestId('support-select'));

    expect(screen.getByText('Book appointment')).toBeInTheDocument();
    await flushAsync();
  });

  it('bounces back to the details step when advancing without a speciality', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Next')[0]);
    // Click the details-section Next without selecting a speciality/service/concern.
    fireEvent.click(screen.getAllByText('Next')[1]);

    await waitFor(() => expect(screen.getByTestId('err-Speciality')).toBeInTheDocument());
    expect(screen.queryByTestId('slot-0')).not.toBeInTheDocument();
    await flushAsync();
  });

  it('routes a submit error back to the details step when details are incomplete', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Book appointment'));

    await waitFor(() => expect(screen.getByTestId('err-Speciality')).toBeInTheDocument());
    expect(appointmentService.createAppointment).not.toHaveBeenCalled();
    await flushAsync();
  });

  it('routes a submit error back to the date & time step when no slot is available', async () => {
    (appointmentService.getSlotsForServiceAndDateForPrimaryOrg as jest.Mock).mockResolvedValue([]);
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.click(screen.getByTestId('select-Speciality'));
    fireEvent.click(screen.getByTestId('select-Service'));
    fireEvent.change(screen.getByTestId('concern-input'), { target: { value: 'Limping' } });
    await waitFor(() =>
      expect(appointmentService.getSlotsForServiceAndDateForPrimaryOrg).toHaveBeenCalled()
    );
    fireEvent.click(screen.getAllByText('Next')[1]);
    await waitFor(() => expect(screen.getByTestId('slot-0')).toBeInTheDocument());
    // Do not pick a slot — submit with an empty slot set.
    await flushAsync();

    fireEvent.click(screen.getByText('Book appointment'));

    await waitFor(() => expect(screen.getByTestId('err-input-Time')).toBeInTheDocument());
    expect(appointmentService.createAppointment).not.toHaveBeenCalled();
    await flushAsync();
  });

  it('books the appointment and consumes the prefill on success', async () => {
    const onPrefillConsumed = jest.fn();
    render(<AddAppointment {...defaultProps} onPrefillConsumed={onPrefillConsumed} />);

    await advanceToBilling();

    fireEvent.click(screen.getByText('Book appointment'));

    await waitFor(() => expect(appointmentService.createAppointment).toHaveBeenCalled());
    await waitFor(() => {
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
      expect(mockSetActiveFilter).toHaveBeenCalledWith('all');
      expect(mockSetActiveStatus).toHaveBeenCalledWith('all');
      expect(onPrefillConsumed).toHaveBeenCalled();
    });
    await flushAsync();
  });

  it('surfaces a booking error when appointment creation is rejected', async () => {
    const throwingError = (console.error as jest.Mock).getMockImplementation();
    (console.error as jest.Mock).mockImplementation(() => {});
    (appointmentService.createAppointment as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<AddAppointment {...defaultProps} />);

    await advanceToBilling();

    fireEvent.click(screen.getByText('Book appointment'));

    await waitFor(() =>
      expect(screen.getByText('Unable to book appointment. Please try again.')).toBeInTheDocument()
    );
    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);

    await flushAsync();
    (console.error as jest.Mock).mockImplementation(throwingError ?? (() => {}));
  });

  it('closes immediately when there are no unsaved changes', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('close-btn'));

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
    await flushAsync();
  });

  it('opens the discard confirmation instead of closing when there are unsaved changes', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('close-btn'));

    expect(mockSetShowModal).not.toHaveBeenCalledWith(false);
    expect(screen.getByText('Discard appointment draft?')).toBeInTheDocument();
    await flushAsync();
  });

  it('discards the draft and closes when confirming the discard dialog', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByTestId('select-Speciality')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Keep editing'));
    fireEvent.click(screen.getByText('Discard'));

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
    await flushAsync();
  });

  it('blocks closing while a booking is in progress', async () => {
    let resolveCreate: (() => void) | undefined;
    (appointmentService.createAppointment as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        })
    );

    render(<AddAppointment {...defaultProps} />);

    await advanceToBilling();

    fireEvent.click(screen.getByText('Book appointment'));
    await waitFor(() => expect(screen.getByText('Booking appointment')).toBeInTheDocument());

    mockSetShowModal.mockClear();
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(mockSetShowModal).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('shows the empty state and opens the add-companion modal when there are no companions', async () => {
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<AddAppointment {...defaultProps} />);

    expect(
      screen.getByText('You need companions to start booking appointments')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add companion'));

    expect(screen.getByTestId('add-companion-modal')).toBeInTheDocument();
    await flushAsync();
  });

  it('reloads companions when the quick add-companion modal is closed', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add new companion/i }));
    expect(screen.getByTestId('add-companion-modal')).toBeInTheDocument();

    // Close via the functional setState form, then again via the boolean form.
    fireEvent.click(screen.getByTestId('ac-close-fn'));
    await waitFor(() => expect(loadCompanionsForPrimaryOrg).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add new companion/i }));
    fireEvent.click(screen.getByTestId('ac-close'));
    await waitFor(() => expect(loadCompanionsForPrimaryOrg).toHaveBeenCalledTimes(2));
    await flushAsync();
  });

  it('auto-selects a newly created companion once it appears in the list', async () => {
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([
      {
        companion: { id: 'comp-1', name: 'Buddy', type: 'Dog', breed: 'Golden' },
        parent: { id: 'parent-1', firstName: 'John' },
      },
      {
        companion: { id: 'comp-2', name: 'Milo', type: 'Cat', breed: 'Tabby' },
        parent: { id: 'parent-2', firstName: 'Jane', lastName: 'Doe' },
      },
    ]);
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add new companion/i }));
    fireEvent.click(screen.getByTestId('ac-create'));
    fireEvent.click(screen.getByTestId('ac-close'));

    await waitFor(() =>
      expect(screen.getByTestId('accordion-Appointment details')).toBeInTheDocument()
    );
    expect(screen.getByTestId('editable-accordion')).toBeInTheDocument();
    await flushAsync();
  });

  it('ignores a created companion that is blank or missing from the list', async () => {
    render(<AddAppointment {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add new companion/i }));
    fireEvent.click(screen.getByTestId('ac-create-blank'));
    fireEvent.click(screen.getByTestId('ac-create'));
    fireEvent.click(screen.getByTestId('ac-close'));

    await flushAsync();
    expect(screen.queryByTestId('editable-accordion')).not.toBeInTheDocument();
  });

  it('bounces back to the date & time step in the calendar-slot flow without a slot', async () => {
    render(
      <AddAppointment
        {...defaultProps}
        prefill={{ date: new Date('2026-04-01T00:00:00.000Z'), minuteOfDay: 600, leadId: 'lead-1' }}
      />
    );

    fireEvent.click(screen.getByTestId('search-companion'));
    await waitFor(() => expect(screen.getByText('Date')).toBeInTheDocument());

    // In the calendar flow the date & time accordion is step 2; its Next validates the slot.
    fireEvent.click(screen.getAllByText('Next')[1]);

    await waitFor(() => expect(screen.getByTestId('err-input-Time')).toBeInTheDocument());
    expect(screen.queryByTestId('select-Speciality')).not.toBeInTheDocument();
    await flushAsync();
  });
});
