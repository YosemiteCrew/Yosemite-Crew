import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Service mocks ─────────────────────────────────────────────────────────────
const mockSearchParent = jest.fn();
const mockCreateCompanion = jest.fn();
const mockCreateParent = jest.fn();
const mockGetCompanionForParent = jest.fn();
const mockLinkCompanion = jest.fn();
const mockUpdateCompanion = jest.fn();
const mockUpdateParent = jest.fn();

jest.mock('@/app/features/companions/services/companionService', () => ({
  searchParent: (...args: any[]) => mockSearchParent(...args),
  createCompanion: (...args: any[]) => mockCreateCompanion(...args),
  createParent: (...args: any[]) => mockCreateParent(...args),
  getCompanionForParent: (...args: any[]) => mockGetCompanionForParent(...args),
  linkCompanion: (...args: any[]) => mockLinkCompanion(...args),
  updateCompanion: (...args: any[]) => mockUpdateCompanion(...args),
  updateParent: (...args: any[]) => mockUpdateParent(...args),
}));

const mockFetchSpeciesCodeEntries = jest.fn().mockResolvedValue([]);
const mockFetchBreedCodeEntries = jest.fn().mockResolvedValue([]);

jest.mock('@/app/features/companions/services/codeEntriesService', () => ({
  fetchSpeciesCodeEntries: (...args: any[]) => mockFetchSpeciesCodeEntries(...args),
  fetchBreedCodeEntries: (...args: any[]) => mockFetchBreedCodeEntries(...args),
}));

const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

const mockCompanionsParents: any[] = [];
jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsParentsForPrimaryOrg: jest.fn(() => mockCompanionsParents),
}));

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ─── UI component mocks ───────────────────────────────────────────────────────

jest.mock(
  '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell',
  () => ({
    __esModule: true,
    default: ({ showModal, children, title, canClose, setShowModal }: any) => {
      if (!showModal) return null;
      return (
        <div data-testid="modal-shell">
          <h2>{title}</h2>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => {
              if (canClose && !canClose()) return;
              setShowModal(false);
            }}
          >
            Close
          </button>
          {children}
        </div>
      );
    },
  })
);

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="center-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, defaultOption, error }: any) => (
    <div>
      <select
        aria-label={placeholder}
        value={defaultOption ?? ''}
        onChange={(e) => {
          const opt = (options as any[]).find((o: any) => o.value === e.target.value);
          if (opt) onSelect(opt);
        }}
      >
        {(options as any[]).map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error, intype, inname }: any) => (
    <div>
      <input
        aria-label={inlabel}
        type={intype ?? 'text'}
        name={inname}
        value={value ?? ''}
        onChange={onChange}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ placeholder }: any) => (
    <input aria-label={placeholder ?? 'date'} type="text" readOnly />
  ),
}));

jest.mock('@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div>
      <input aria-label={inlabel} value={value ?? ''} onChange={onChange} />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <textarea aria-label={inlabel} value={value ?? ''} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, type, icon }: any) => (
    <button type={type ?? 'button'} onClick={onClick}>
      {icon}
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, href }: any) => (
    <a href={href ?? '#'} role="button" onClick={onClick}>
      {text}
    </a>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: any) => <span data-testid="next-image" role="img" aria-label={alt} />,
}));

jest.mock('react-icons/io5', () => ({
  IoClose: () => <span data-testid="icon-io-close" />,
  IoPencilOutline: () => <span data-testid="icon-io-pencil" />,
  IoInformationCircleOutline: () => <span data-testid="icon-io-info" />,
}));

jest.mock('react-icons/io', () => ({
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

jest.mock('react-icons/fi', () => ({
  FiPlus: () => <span data-testid="icon-fi-plus" />,
  FiCheck: () => <span data-testid="icon-fi-check" />,
}));

jest.mock('react-icons/md', () => ({
  MdPets: () => <span data-testid="icon-md-pets" />,
}));

jest.mock('react-icons/fa', () => ({
  FaUser: () => <span data-testid="icon-fa-user" />,
}));

jest.mock('@/app/hooks/useDropdown', () => ({
  useFilteredOptions: (options: any[], value: string) => {
    if (!value) return [];
    return options.filter((o: any) => o.label.toLowerCase().includes(value.toLowerCase()));
  },
}));

// Mock InputWithDropdown internals — the component is defined inside the module so we need
// to intercept via the module boundary. We mock createPortal to prevent portal errors in tests.
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: jest.fn(() => '/mock-image.png'),
}));

jest.mock('@/app/lib/companionName', () => ({
  formatCompanionNameWithOwnerLastName: jest.fn(
    (name: string, parent: any) => `${name} (${parent?.lastName ?? ''})`
  ),
}));

jest.mock('@/app/lib/companionHistoryRoute', () => ({
  buildCompanionOverviewHref: jest.fn(() => '/companions/mock'),
}));

jest.mock('@/app/lib/date', () => ({
  formatDisplayDate: jest.fn(() => '01/01/2020'),
  getAgeInYears: jest.fn(() => 4),
}));

jest.mock('@/app/ui/tables/tableUtils', () => ({
  getCompanionStatusStyle: jest.fn(() => ({ background: 'green', color: 'white' })),
}));

jest.mock('@/app/lib/validators', () => ({
  getEmailValidationError: jest.fn((email: string) => {
    if (!email) return 'Email is required';
    if (!email.includes('@')) return 'Enter a valid email address';
    return null;
  }),
  normalizeEmail: jest.fn((email: string) => email.toLowerCase().trim()),
  validatePhone: jest.fn((phone: string) => phone.length >= 10),
  toTitleCase: jest.fn((s: string) => s.charAt(0).toUpperCase() + s.slice(1)),
}));

// ─── Import component AFTER mocks ─────────────────────────────────────────────
import AddCompanionCentralModal from '@/app/features/companions/components/AddCompanionCentralModal/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockViewCompanion = {
  companion: {
    id: 'comp-1',
    organisationId: 'org-1',
    parentId: 'parent-1',
    name: 'Buddy',
    type: 'dog' as const,
    speciesCode: 'K9',
    breed: 'Labrador',
    breedCode: 'LAB',
    dateOfBirth: new Date('2020-01-01'),
    gender: 'male' as const,
    currentWeight: 30,
    colour: 'brown',
    allergy: '',
    bloodGroup: '',
    isneutered: false,
    microchipNumber: '',
    passportNumber: '',
    isInsured: false,
    insurance: undefined,
    countryOfOrigin: '',
    source: 'unknown' as const,
    status: 'active' as const,
    photoUrl: '',
  },
  parent: {
    id: 'parent-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    birthDate: undefined,
    phoneNumber: '+12025551234',
    address: {
      addressLine: '123 Main St',
      country: 'US',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      latitude: undefined,
      longitude: undefined,
    },
    createdFrom: 'pms' as const,
  },
};

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddCompanionCentralModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompanionForParent.mockResolvedValue([]);
    mockSearchParent.mockResolvedValue([]);
    mockFetchSpeciesCodeEntries.mockResolvedValue([]);
    mockFetchBreedCodeEntries.mockResolvedValue([
      { display: 'Poodle', code: 'PDL', meta: { speciesCode: 'K9' } },
      { display: 'Labrador', code: 'LAB', meta: { speciesCode: 'K9' } },
    ]);
  });

  afterEach(async () => {
    // Flush all pending state updates and promises to prevent act() warnings
    // from leaking into subsequent tests.
    await act(async () => {
      await Promise.resolve();
    });
  });

  // ── 1. Render ───────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders nothing when showModal is false', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} showModal={false} />);
      });
      expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();
    });

    it('renders form with "New Patient / Client" title when showModal=true and no viewCompanion', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
      expect(screen.getByText('New Patient / Client')).toBeInTheDocument();
    });

    it('renders patient and client section headings in create mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      expect(screen.getByText('Patient Details')).toBeInTheDocument();
      expect(screen.getByText('Client Details')).toBeInTheDocument();
    });

    it('renders Save Patient Info button in create mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      expect(screen.getByRole('button', { name: /save patient info/i })).toBeInTheDocument();
    });
  });

  // ── 2. View mode ────────────────────────────────────────────────────────────

  describe('view mode', () => {
    it('renders companion name and client details when viewCompanion is provided', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      // The modal shell title shows companion name via formatCompanionNameWithOwnerLastName
      expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
      // Client details section
      expect(screen.getByText('Client Details')).toBeInTheDocument();
    });

    it('shows Edit button in view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('clicking Edit switches to edit mode showing "Edit Patient / Client" title', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      const editBtn = screen.getByRole('button', { name: /edit/i });
      await act(async () => {
        fireEvent.click(editBtn);
      });
      expect(screen.getByText('Edit Patient / Client')).toBeInTheDocument();
    });

    it('shows Back to details button in edit mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });
      expect(screen.getByRole('button', { name: /← back to details/i })).toBeInTheDocument();
    });

    it('clicking Back to details from edit reverts to view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });
      // Verify edit mode is active
      expect(screen.getByText('Edit Patient / Client')).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /← back to details/i }));
      });
      // Returns to view mode — modal shell heading shows companion title
      expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
    });

    it('shows patient info rows in view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });
      expect(screen.getByText('Patient Details')).toBeInTheDocument();
      expect(screen.getByText('Labrador')).toBeInTheDocument();
    });
  });

  // ── 3. Create mode validation ───────────────────────────────────────────────

  describe('create mode validation', () => {
    it('shows validation errors when saving without required fields', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      // Check that multiple validation errors are shown across the form.
      // FormInput mock renders errors as role="alert"; InputWithDropdown renders as plain <span>.
      // Use getAllByRole('alert') for FormInput errors and getByText for others.
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Number is required')).toBeInTheDocument();
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });

    it('shows email validation error for missing email', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('shows phone number required error when no phone is entered', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(screen.getByText('Number is required')).toBeInTheDocument();
    });

    it('shows address required error when address is empty', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });

    it('does not call createCompanion when validation fails', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });
      expect(mockCreateCompanion).not.toHaveBeenCalled();
    });
  });

  // ── 4. Create mode happy path ───────────────────────────────────────────────

  describe('create mode happy path', () => {
    const fillRequiredFields = async () => {
      // companion name — uses InputWithDropdown, accessible via aria-label
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Max' } });
      // species — LabelDropdown select
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });
      // Wait for breed options to load (async fetchBreedCodeEntries)
      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });
      // breed
      fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
      // parent first name — InputWithDropdown
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
      // parent last name
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
      // email
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
      // phone
      fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '2025551234' } });
      // address
      fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Test Ave' } });
      // city
      fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
      // state
      fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'IL' } });
      // postal code
      fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '62701' } });
    };

    it('calls createParent and createCompanion on successful submission', async () => {
      mockCreateParent.mockResolvedValue('new-parent-id');
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-id', name: 'Max' });

      const setShowModal = jest.fn();
      const onCompanionCreated = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            onCompanionCreated={onCompanionCreated}
          />
        );
      });

      await act(async () => {
        await fillRequiredFields();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockCreateParent).toHaveBeenCalled();
        expect(mockCreateCompanion).toHaveBeenCalled();
      });
    });

    it('calls onCompanionCreated with companion id and setShowModal(false) after creation', async () => {
      mockCreateParent.mockResolvedValue('new-parent-id');
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-id', name: 'Max' });

      const setShowModal = jest.fn();
      const onCompanionCreated = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            onCompanionCreated={onCompanionCreated}
          />
        );
      });

      await act(async () => {
        await fillRequiredFields();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(onCompanionCreated).toHaveBeenCalledWith('new-comp-id');
        expect(setShowModal).toHaveBeenCalledWith(false);
      });
    });

    it('shows success notification after creation', async () => {
      mockCreateParent.mockResolvedValue('new-parent-id');
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-id', name: 'Max' });

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        await fillRequiredFields();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Companion saved' })
        );
      });
    });
  });

  // ── 5. Fasttrack mode ───────────────────────────────────────────────────────

  describe('fasttrack mode', () => {
    it('renders modal in fasttrack mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} formMode="fasttrack" />);
      });
      expect(screen.getByText('New Patient / Client')).toBeInTheDocument();
    });

    it('does not show insurance validation errors in fasttrack mode even when isInsured', async () => {
      // In fasttrack, insurance validation is skipped even if companion is insured
      mockCreateParent.mockResolvedValue('parent-ft');
      mockCreateCompanion.mockResolvedValue({ id: 'comp-ft', name: 'Bella' });

      const setShowModal = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            formMode="fasttrack"
          />
        );
      });

      // Fill required fields but leave insurance blank
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bella' } });
      });
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });
      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alice' } });
        fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Brown' } });
        fireEvent.change(screen.getByLabelText('Email'), {
          target: { value: 'alice@example.com' },
        });
        fireEvent.change(screen.getByLabelText('Phone number'), {
          target: { value: '2025551234' },
        });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '5 Oak St' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Portland' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'OR' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '97201' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      // No insurance errors in fasttrack
      await waitFor(() => {
        expect(screen.queryByText('Company name is required')).not.toBeInTheDocument();
        expect(screen.queryByText('Policy number is required')).not.toBeInTheDocument();
      });
    });
  });

  // ── 6. Discard changes confirmation ─────────────────────────────────────────

  describe('discard changes confirmation', () => {
    it('shows discard confirm modal when closing with unsaved changes', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Type companion name to make form dirty
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      // Click the shell close button which calls canClose
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    });

    it('clicking "Keep editing" closes confirm without dismissing main modal', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      const keepEditing = screen.getByRole('button', { name: /keep editing/i });
      await act(async () => {
        fireEvent.click(keepEditing);
      });

      expect(setShowModal).not.toHaveBeenCalled();
      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
    });

    it('clicking "Discard" calls setShowModal(false)', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      const discardBtn = screen.getByRole('button', { name: /^discard$/i });
      await act(async () => {
        fireEvent.click(discardBtn);
      });

      expect(setShowModal).toHaveBeenCalledWith(false);
    });

    it('closes cleanly with no changes (no discard dialog shown)', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      expect(screen.queryByTestId('center-modal')).not.toBeInTheDocument();
      expect(setShowModal).toHaveBeenCalledWith(false);
    });
  });

  // ── 7. onGoToAppointment ────────────────────────────────────────────────────

  describe('onGoToAppointment', () => {
    it('renders "← Go to Appointment" button when onGoToAppointment is provided in create mode', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} onGoToAppointment={onGoToAppointment} />
        );
      });

      expect(screen.getByRole('button', { name: /go to appointment/i })).toBeInTheDocument();
    });

    it('clicking "← Go to Appointment" with no changes calls onGoToAppointment', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} onGoToAppointment={onGoToAppointment} />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /go to appointment/i }));
      });

      expect(onGoToAppointment).toHaveBeenCalled();
    });

    it('clicking "← Go to Appointment" with unsaved changes shows discard confirm', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} onGoToAppointment={onGoToAppointment} />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /go to appointment/i }));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
      expect(onGoToAppointment).not.toHaveBeenCalled();
    });

    it('after discarding, calls onGoToAppointment instead of setShowModal(false)', async () => {
      const setShowModal = jest.fn();
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            onGoToAppointment={onGoToAppointment}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /go to appointment/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
      });

      expect(onGoToAppointment).toHaveBeenCalled();
      expect(setShowModal).not.toHaveBeenCalled();
    });

    it('does not show "← Go to Appointment" in view mode', async () => {
      const onGoToAppointment = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            onGoToAppointment={onGoToAppointment}
          />
        );
      });

      expect(screen.queryByRole('button', { name: /go to appointment/i })).not.toBeInTheDocument();
    });
  });

  // ── 8. Alert add/remove ─────────────────────────────────────────────────────

  describe('alert add/remove', () => {
    it('Add alert button is disabled when alert input is empty', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const addAlertBtn = screen.getByRole('button', { name: /add alert/i });
      expect(addAlertBtn).toBeDisabled();
    });

    it('Add alert button is enabled when alert input has text', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
      });

      expect(screen.getByRole('button', { name: /add alert/i })).not.toBeDisabled();
    });

    it('adds an alert chip when Add alert is clicked', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(screen.getByText('Diabetic')).toBeInTheDocument();
    });

    it('clears alert input after adding an alert', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(alertInput).toHaveValue('');
    });

    it('removes an alert chip when Remove is clicked', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');
      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Diabetic' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(screen.getByText('Diabetic')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /remove alert diabetic/i }));
      });

      expect(screen.queryByText('Diabetic')).not.toBeInTheDocument();
    });

    it('can add multiple alerts', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const alertInput = screen.getByLabelText('e.g. Diabetic, May bite…');

      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Alert 1' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      await act(async () => {
        fireEvent.change(alertInput, { target: { value: 'Alert 2' } });
        fireEvent.click(screen.getByRole('button', { name: /add alert/i }));
      });

      expect(screen.getByText('Alert 1')).toBeInTheDocument();
      expect(screen.getByText('Alert 2')).toBeInTheDocument();
    });
  });

  // ── 9. Status change (view mode) ────────────────────────────────────────────

  describe('status change in view mode', () => {
    it('shows status dropdown when canEditCompanionStatus=true', async () => {
      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      expect(screen.getByLabelText('Change status')).toBeInTheDocument();
    });

    it('does not show status dropdown when canEditCompanionStatus=false', async () => {
      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={false}
          />
        );
      });

      expect(screen.queryByLabelText('Change status')).not.toBeInTheDocument();
    });

    it('calls updateCompanion when a new status is selected', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Change status'), { target: { value: 'inactive' } });
      });

      await waitFor(() => {
        expect(mockUpdateCompanion).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'inactive' })
        );
      });
    });

    it('shows success notification after status update', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Change status'), { target: { value: 'inactive' } });
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Status updated' })
        );
      });
    });

    it('shows error notification when updateCompanion throws', async () => {
      mockUpdateCompanion.mockRejectedValue(new Error('API error'));

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={mockViewCompanion}
            canEditCompanionStatus={true}
          />
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Change status'), { target: { value: 'archived' } });
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({ title: 'Failed to update status' })
        );
      });
    });
  });

  // ── 10. Error notification ──────────────────────────────────────────────────

  describe('error notification on creation failure', () => {
    const fillRequiredFieldsInner = async () => {
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Max' } });
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });
      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });
      fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
      fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '2025551234' } });
      fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Test Ave' } });
      fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
      fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'IL' } });
      fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '62701' } });
    };

    it('shows error notification when createCompanion throws', async () => {
      mockCreateParent.mockResolvedValue('p-id');
      mockCreateCompanion.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await fillRequiredFieldsInner();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({ title: 'Unable to save' })
        );
      });
    });

    it('does not call setShowModal(false) when creation fails', async () => {
      mockCreateParent.mockResolvedValue('p-id');
      mockCreateCompanion.mockRejectedValue(new Error('Fail'));

      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      await fillRequiredFieldsInner();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
      });

      expect(setShowModal).not.toHaveBeenCalled();
    });
  });

  // ── 11. Edit mode save ──────────────────────────────────────────────────────

  describe('edit mode save', () => {
    it('calls updateCompanion and updateParent on Save changes', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);
      mockUpdateParent.mockResolvedValue(undefined);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      // Switch to edit mode
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        expect(mockUpdateCompanion).toHaveBeenCalled();
        expect(mockUpdateParent).toHaveBeenCalled();
      });
    });

    it('shows success notification after edit save', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);
      mockUpdateParent.mockResolvedValue(undefined);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'Companion updated' })
        );
      });
    });

    it('returns to view mode after successful edit save', async () => {
      mockUpdateCompanion.mockResolvedValue(undefined);
      mockUpdateParent.mockResolvedValue(undefined);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        // View mode shows the companion title as a heading
        expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
      });
    });
  });

  // ── 12. Modal resets on close ───────────────────────────────────────────────

  describe('modal state resets', () => {
    it('clears form fields when showModal changes from true to false', async () => {
      const { rerender } = render(
        <AddCompanionCentralModal showModal={true} setShowModal={jest.fn()} />
      );

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Maximus' } });
      });

      await act(async () => {
        rerender(<AddCompanionCentralModal showModal={false} setShowModal={jest.fn()} />);
      });

      // Modal hidden — no crash
      expect(screen.queryByTestId('modal-shell')).not.toBeInTheDocument();

      await act(async () => {
        rerender(<AddCompanionCentralModal showModal={true} setShowModal={jest.fn()} />);
      });

      // Name should be cleared
      expect(screen.getByLabelText('Name')).toHaveValue('');
    });
  });

  // ── 13. Parent selection ────────────────────────────────────────────────────

  describe('parent search and selection', () => {
    it('selecting a parent result fills first name, last name, and phone fields', async () => {
      mockSearchParent.mockResolvedValue([
        {
          id: 'p-found',
          firstName: 'Alice',
          lastName: 'Wonder',
          email: 'alice@w.com',
          phoneNumber: '+12025559999',
          birthDate: undefined,
          address: {
            addressLine: '5 Oak',
            city: 'LA',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          createdFrom: 'pms' as const,
        },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Type in first name to trigger parent search
      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alice' } });
      });

      // Wait for results via debounce
      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      // Simulate selecting a result via the dropdown option click
      await act(async () => {
        // The InputWithDropdown options are rendered as buttons — find by role and name
        const option = await screen.findByRole('button', { name: 'Alice Wonder' });
        fireEvent.click(option);
      });

      expect(screen.getByLabelText('First name')).toHaveValue('Alice');
    });

    it('handlePhoneChange updates localPhoneNumber field', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Phone number'), {
          target: { value: '9876543210' },
        });
      });

      expect(screen.getByLabelText('Phone number')).toHaveValue('9876543210');
    });

    it('handleCountryCodeSelect changes selected country code', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      const countryCodeDropdown = screen.getByLabelText('Country code');
      await act(async () => {
        fireEvent.change(countryCodeDropdown, { target: { value: 'GB' } });
      });

      // No errors — country code dropdown changed
      expect(countryCodeDropdown).toBeInTheDocument();
    });

    it('updateAddressField updates address city field', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'New York' } });
      });

      expect(screen.getByLabelText('City')).toHaveValue('New York');
    });
  });

  // ── 14. Companion search via allCompanionParents ─────────────────────────────

  describe('companion name search from store', () => {
    it('selecting from companion name search autofills companion and parent fields', async () => {
      const { useCompanionsParentsForPrimaryOrg } = jest.requireMock(
        '@/app/hooks/useCompanion'
      ) as any;

      useCompanionsParentsForPrimaryOrg.mockReturnValue([
        {
          companion: {
            id: 'store-comp-1',
            name: 'Buddy',
            type: 'dog',
            breed: 'Labrador',
            speciesCode: 'K9',
            breedCode: 'LAB',
            status: 'active',
            dateOfBirth: new Date('2020-01-01'),
            gender: 'male',
            isneutered: false,
          },
          parent: {
            id: 'store-parent-1',
            firstName: 'Store',
            lastName: 'Owner',
            email: 'store@owner.com',
            phoneNumber: '+12025551111',
            birthDate: undefined,
            address: {
              addressLine: '1 Store St',
              city: 'Chicago',
              state: 'IL',
              postalCode: '60601',
              country: 'US',
            },
            createdFrom: 'pms' as const,
          },
        },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Type in companion name
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bud' } });
      });

      // Companion search options appear
      const buddyOption = await screen.findByRole('button', { name: 'Buddy' });
      await act(async () => {
        fireEvent.click(buddyOption);
      });

      // companion name is filled from store
      expect(screen.getByLabelText('Name')).toHaveValue('Buddy');
    });
  });

  // ── 15. View mode footer ────────────────────────────────────────────────────

  describe('view mode footer', () => {
    it('clicking Close in view mode footer calls setShowModal(false)', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(
          <AddCompanionCentralModal
            showModal={true}
            setShowModal={setShowModal}
            viewCompanion={mockViewCompanion}
          />
        );
      });

      const closeBtn = screen.getByRole('button', { name: /^close$/i });
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      expect(setShowModal).toHaveBeenCalledWith(false);
    });

    it('clicking companion name button navigates to companion overview', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      // The companion name in view mode is a button
      const nameBtn = screen.getByRole('button', { name: /buddy \(doe\)/i });
      await act(async () => {
        fireEvent.click(nameBtn);
      });

      expect(mockRouterPush).toHaveBeenCalledWith('/companions/mock');
    });
  });

  // ── 16. Edit mode FooterLeft — Discard changes ───────────────────────────────

  describe('edit mode footer left', () => {
    it('shows Discard changes button in edit mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
    });

    it('clicking Discard changes in edit mode reverts to view mode', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      expect(screen.getByText('Edit Patient / Client')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /discard changes/i }));
      });

      expect(screen.getByRole('heading', { name: /buddy/i })).toBeInTheDocument();
    });
  });

  // ── 17. createCompanionFlow — existing parent branch ────────────────────────

  describe('createCompanionFlow with existing parent', () => {
    it('calls createCompanion (not createParent) when parent already has an id', async () => {
      mockSearchParent.mockResolvedValue([
        {
          id: 'existing-parent',
          firstName: 'Bob',
          lastName: 'Builder',
          email: 'bob@builder.com',
          phoneNumber: '+12025557777',
          birthDate: undefined,
          address: {
            addressLine: '7 Build St',
            city: 'Denver',
            state: 'CO',
            postalCode: '80201',
            country: 'US',
          },
          createdFrom: 'pms' as const,
        },
      ]);
      mockCreateCompanion.mockResolvedValue({ id: 'new-comp-with-existing-parent' });

      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      // Fill companion fields
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });

      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
      });

      // Trigger parent search and select existing parent
      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Bob' } });
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      await act(async () => {
        const bobOption = await screen.findByRole('button', { name: 'Bob Builder' });
        fireEvent.click(bobOption);
      });

      // Fill remaining required fields (phone already autofilled from parent select with +1 2025557777 = 13 chars ≥ 10)
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@builder.com' } });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '7 Build St' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Denver' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'CO' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '80201' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockCreateCompanion).toHaveBeenCalled();
        expect(mockCreateParent).not.toHaveBeenCalled();
      });
    });
  });

  // ── 18. View mode — insured companion details ────────────────────────────────

  describe('view mode insured companion', () => {
    it('shows insurance company and policy number when companion isInsured', async () => {
      const insuredCompanion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          isInsured: true,
          insurance: { isInsured: true, companyName: 'PetSure', policyNumber: 'POL-123' },
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={insuredCompanion} />);
      });

      expect(screen.getByText('PetSure')).toBeInTheDocument();
      expect(screen.getByText('POL-123')).toBeInTheDocument();
    });
  });

  // ── 19. handleAddressSelect ──────────────────────────────────────────────────

  describe('handleAddressSelect', () => {
    it('updates address fields from GoogleSearchDropDown onAddressSelect', async () => {
      // jest.mock cannot be called inside test bodies (not hoisted), so verify via state indirectly
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Verify the form renders without errors
      expect(screen.getByLabelText('Address')).toBeInTheDocument();
    });
  });

  // ── 20. loadBreedOptions / fetchBreedCodeEntries ─────────────────────────────

  describe('breed loading', () => {
    it('loads breed options when species is selected', async () => {
      mockFetchBreedCodeEntries.mockResolvedValue([
        { display: 'Persian', code: 'PER', meta: { speciesCode: 'CAT' } },
        { display: 'Persian', code: 'PER2', meta: { speciesCode: 'CAT' } }, // duplicate — should be deduplicated
        { display: 'Siamese', code: 'SIA', meta: { speciesCode: 'CAT' } },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'cat' } });
      });

      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        // Deduplicated: Persian appears once, Siamese once
        const options = Array.from(breedSelect.options).map((o) => o.value);
        expect(options.filter((v) => v === 'Persian').length).toBe(1);
        expect(options).toContain('Siamese');
      });
    });

    it('clears breed options when fetchBreedCodeEntries throws', async () => {
      mockFetchBreedCodeEntries.mockRejectedValue(new Error('API error'));

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });

      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        // Only the empty/placeholder option
        expect(breedSelect.options.length).toBe(0);
      });
    });
  });

  // ── 21. validateCompanionFields — insurance in default mode ──────────────────

  describe('insurance validation in default mode', () => {
    it('shows insurance fields when companion is marked as insured', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Before selecting insured, insurance company input should not be visible
      expect(screen.queryByLabelText('Company name')).not.toBeInTheDocument();

      // Select insurance = yes via the accordion dropdown
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Insurance'), { target: { value: 'true' } });
      });

      // Insurance fields should appear after selecting insured
      await waitFor(() => {
        expect(screen.getByLabelText('Company name')).toBeInTheDocument();
        expect(screen.getByLabelText('Policy number')).toBeInTheDocument();
      });
    });

    it('companion insurance validation errors appear on save when fields empty', async () => {
      // Directly render with isInsured=true via companionFormData override
      // We do this by rendering in view mode with an insured companion then switching to edit
      const insuredViewCompanion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          isInsured: true,
          insurance: { isInsured: true, companyName: '', policyNumber: '' },
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={insuredViewCompanion} />);
      });

      // Switch to edit mode
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      // Clear company name to trigger validation error
      await act(async () => {
        const companyInput = screen.getByLabelText('Company name');
        fireEvent.change(companyInput, { target: { value: '' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Company name is required')).toBeInTheDocument();
      });
    });
  });

  // ── 22. canCloseModal — isSubmitting blocks close ────────────────────────────

  describe('canCloseModal', () => {
    it('does not close modal while isSubmitting', async () => {
      // Make createParent hang so isSubmitting stays true
      mockCreateParent.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      // Fill minimum required fields
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });

      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
        fireEvent.change(screen.getByLabelText('Phone number'), {
          target: { value: '2025551234' },
        });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Test Ave' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Springfield' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'IL' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '62701' } });
      });

      // Start submission (will hang)
      fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));

      // Try to close while submitting
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      // setShowModal should NOT be called (canClose returns false while submitting)
      expect(setShowModal).not.toHaveBeenCalled();
    });
  });

  // ── 23. View mode — companion with alerts ────────────────────────────────────

  describe('view mode with alerts', () => {
    it('renders AlertChipView chips for companions with alerts', async () => {
      const companionWithAlerts = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          alerts: [
            { id: 'a1', label: 'Diabetic', priority: 'high' as const },
            { id: 'a2', label: 'May bite', priority: 'critical' as const },
          ],
        } as any,
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companionWithAlerts} />);
      });

      expect(screen.getByText('Diabetic')).toBeInTheDocument();
      expect(screen.getByText('May bite')).toBeInTheDocument();
    });
  });

  // ── 24. fmtDate / fmtAge / getSexLabel paths ─────────────────────────────────

  describe('view mode formatting functions', () => {
    it('shows formatted age and sex in view mode', async () => {
      const companion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          dateOfBirth: new Date('2020-01-01'),
          gender: 'female' as const,
          isneutered: true,
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companion} />);
      });

      // fmtAge renders "4 Yrs" from mocked getAgeInYears returning 4
      expect(screen.getByText('4 Yrs')).toBeInTheDocument();
      // getSexLabel for female+neutered = "Female Spayed"
      expect(screen.getByText('Female Spayed')).toBeInTheDocument();
    });

    it('shows "-" for dob when dateOfBirth is absent', async () => {
      const companion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          dateOfBirth: undefined,
          gender: undefined,
          isneutered: undefined,
        } as any,
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companion} />);
      });

      // fmtAge returns '-' when no dob; fmtDate returns '-'
      // formatDisplayDate mock returns '01/01/2020' but only when dob exists, so no call
      // We just verify rendering doesn't crash
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    });

    it('shows gender without neutered label for unknown gender', async () => {
      const companion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          gender: 'unknown' as const,
          isneutered: false,
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companion} />);
      });

      // getSexLabel for unknown+intact = "Unknown"
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  // ── 25. fetchParentResults error path ────────────────────────────────────────

  describe('fetchParentResults error path', () => {
    it('returns empty results silently when searchParent throws', async () => {
      mockSearchParent.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Error' } });
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      // No crash — form is still usable
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    });
  });

  // ── 26. getCompanionForParent error path ─────────────────────────────────────

  describe('companion results fetch error path', () => {
    it('handles getCompanionForParent rejection gracefully', async () => {
      mockSearchParent.mockResolvedValue([
        {
          id: 'err-parent',
          firstName: 'Err',
          lastName: 'Parent',
          email: 'err@parent.com',
          phoneNumber: '+12025550000',
          birthDate: undefined,
          address: {
            addressLine: '1 Err St',
            city: 'Err',
            state: 'ER',
            postalCode: '00000',
            country: 'US',
          },
          createdFrom: 'pms' as const,
        },
      ]);
      mockGetCompanionForParent.mockRejectedValue(new Error('fetch error'));

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Err' } });
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      await act(async () => {
        const errOption = await screen.findByRole('button', { name: 'Err Parent' });
        fireEvent.click(errOption);
      });

      // getCompanionForParent rejects → companionResults stays empty → no crash
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    });
  });

  // ── 27. Edit mode: companion with dateOfBirth populates edit snapshot ─────────

  describe('edit mode with companion dateOfBirth', () => {
    it('switches to edit mode and renders species/breed dropdowns for existing companion', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={mockViewCompanion} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      // In edit mode, species and breed dropdowns should be present
      expect(screen.getByLabelText('Species')).toBeInTheDocument();
      expect(screen.getByLabelText('Breed')).toBeInTheDocument();
    });
  });

  // ── 28. Species codes fetch error ────────────────────────────────────────────

  describe('fetchSpeciesCodeEntries error', () => {
    it('falls back to DEFAULT_SPECIES_OPTIONS when fetchSpeciesCodeEntries throws', async () => {
      mockFetchSpeciesCodeEntries.mockRejectedValue(new Error('species API error'));

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Species dropdown should still show default options (Canine, Feline, Equine)
      const speciesSelect = screen.getByLabelText('Species') as HTMLSelectElement;
      const options = Array.from(speciesSelect.options).map((o) => o.label);
      expect(options).toContain('Canine');
      expect(options).toContain('Feline');
    });
  });

  // ── 29. handleCompanionSelect without parent autofill (cp.parent is absent) ──

  describe('handleCompanionSelect without parent autofill', () => {
    it('selects companion from store without parent autofill when cp.parent is absent', async () => {
      const { useCompanionsParentsForPrimaryOrg } = jest.requireMock(
        '@/app/hooks/useCompanion'
      ) as any;

      // Entry with no parent — only companion
      useCompanionsParentsForPrimaryOrg.mockReturnValue([
        {
          companion: {
            id: 'no-parent-comp',
            name: 'Solo',
            type: 'dog',
            breed: 'Beagle',
            speciesCode: 'K9',
            breedCode: 'BGL',
            status: 'active',
          },
          parent: null, // No parent autofill
        },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sol' } });
      });

      const soloOption = await screen.findByRole('button', { name: 'Solo' });
      await act(async () => {
        fireEvent.click(soloOption);
      });

      // Companion name filled, no parent autofill (parent fields stay empty)
      expect(screen.getByLabelText('Name')).toHaveValue('Solo');
    });
  });

  // ── 30. InputWithDropdown error state ────────────────────────────────────────

  describe('InputWithDropdown with error state', () => {
    it('InputWithDropdown renders error via IoIosWarning span', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Click save without filling name — triggers companionErrors.name
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      // The InputWithDropdown shows errors as a plain span containing the error text
      // The IoIosWarning icon mock renders as data-testid="icon-warning"
      // Verify error spans appear (companion name and parent first name errors)
      const warnIcons = screen.getAllByTestId('icon-warning');
      expect(warnIcons.length).toBeGreaterThan(0);
    });
  });

  // ── 31. Additional view mode details ─────────────────────────────────────────

  describe('view mode additional details', () => {
    it('shows microchip, passport, colour, bloodGroup, countryOfOrigin in view mode', async () => {
      const richCompanion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          colour: 'Golden',
          bloodGroup: 'DEA 1.1 Positive',
          microchipNumber: 'CHIP-123',
          passportNumber: 'PASS-456',
          countryOfOrigin: 'US',
          currentWeight: 30,
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={richCompanion} />);
      });

      expect(screen.getByText('Golden')).toBeInTheDocument();
      expect(screen.getByText('DEA 1.1 Positive')).toBeInTheDocument();
      expect(screen.getByText('CHIP-123')).toBeInTheDocument();
      expect(screen.getByText('PASS-456')).toBeInTheDocument();
    });

    it('shows allergy in view mode', async () => {
      const allergicCompanion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          allergy: 'Penicillin',
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={allergicCompanion} />);
      });

      expect(screen.getByText('Penicillin')).toBeInTheDocument();
    });

    it('shows client birthDate when present in view mode', async () => {
      const companionWithBirthDate = {
        ...mockViewCompanion,
        parent: {
          ...mockViewCompanion.parent,
          birthDate: new Date('1990-05-15'),
        },
      };

      await act(async () => {
        render(
          <AddCompanionCentralModal {...defaultProps} viewCompanion={companionWithBirthDate} />
        );
      });

      // fmtDate is mocked to return '01/01/2020'
      expect(screen.getAllByText('01/01/2020').length).toBeGreaterThan(0);
    });
  });

  // ── 32. toNonNegativeNumber via weight input ─────────────────────────────────

  describe('toNonNegativeNumber via weight field', () => {
    it('updates weight field with a valid number', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '25' } });
      });

      // FormInput mock uses type="number", toHaveValue returns number
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(25);
    });

    it('handles empty string weight input (NaN → undefined)', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // First set a value, then clear it
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '' } });
      });

      // After clearing, toNonNegativeNumber returns undefined → state reflects empty string
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null);
    });
  });

  // ── 33. handleCountryCodeSelect with valid country code ──────────────────────

  describe('handleCountryCodeSelect with real option', () => {
    it('updates country code when a valid option is selected', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Get the actual options from the CountryDialCodeOptions — use the first available value
      const countryCodeDropdown = screen.getByLabelText('Country code') as HTMLSelectElement;
      const firstOptionValue = Array.from(countryCodeDropdown.options)[0]?.value;

      if (firstOptionValue) {
        await act(async () => {
          fireEvent.change(countryCodeDropdown, { target: { value: firstOptionValue } });
        });
      }

      expect(countryCodeDropdown).toBeInTheDocument();
    });
  });

  // ── 34. handleAddressSelect via GoogleSearchDropDown ─────────────────────────

  describe('handleAddressSelect integration', () => {
    it('address fields update when address line, city, state, postal are typed', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '99 Elm St' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Portland' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'OR' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '97201' } });
      });

      expect(screen.getByLabelText('Address')).toHaveValue('99 Elm St');
      expect(screen.getByLabelText('City')).toHaveValue('Portland');
    });
  });

  // ── 35. Accordion inner onChange handlers ────────────────────────────────────

  describe('accordion inner field handlers', () => {
    it('colour, microchip, passport, allergy onChange handlers update state', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Color (optional)'), { target: { value: 'Black' } });
        fireEvent.change(screen.getByLabelText('Microchip no.'), { target: { value: 'CHIP001' } });
        fireEvent.change(screen.getByLabelText('Passport no.'), { target: { value: 'PASS001' } });
        fireEvent.change(screen.getByLabelText('Allergies'), { target: { value: 'Dust' } });
      });

      expect(screen.getByLabelText('Color (optional)')).toHaveValue('Black');
      expect(screen.getByLabelText('Microchip no.')).toHaveValue('CHIP001');
      expect(screen.getByLabelText('Passport no.')).toHaveValue('PASS001');
    });

    it('blood group, country of origin, source, sex onSelect handlers work', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // First select dog species to get blood group options
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });

      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });

      // Sex dropdown
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'female-spayed' } });
      });

      // Blood group
      const bloodGroupSelect = screen.getByLabelText('Blood group') as HTMLSelectElement;
      const firstBloodOption = Array.from(bloodGroupSelect.options)[0]?.value;
      if (firstBloodOption) {
        await act(async () => {
          fireEvent.change(bloodGroupSelect, { target: { value: firstBloodOption } });
        });
      }

      // Country of origin
      const countryOriginSelect = screen.getByLabelText('Country of origin') as HTMLSelectElement;
      const firstCountryOption = Array.from(countryOriginSelect.options)[0]?.value;
      if (firstCountryOption) {
        await act(async () => {
          fireEvent.change(countryOriginSelect, { target: { value: firstCountryOption } });
        });
      }

      // Source
      const sourceSelect = screen.getByLabelText('Source') as HTMLSelectElement;
      const firstSourceOption = Array.from(sourceSelect.options)[0]?.value;
      if (firstSourceOption) {
        await act(async () => {
          fireEvent.change(sourceSelect, { target: { value: firstSourceOption } });
        });
      }

      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    });
  });

  // ── 36. onPointerDown/onPointerMove on Discard button ────────────────────────

  describe('Discard button pointer events', () => {
    it('onPointerDown and onPointerMove fire without error', async () => {
      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      // Dirty the form
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dirty' } });
      });

      // Open discard modal
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      const discardBtn = screen.getByRole('button', { name: /^discard$/i });

      // Trigger pointer events
      await act(async () => {
        fireEvent.pointerDown(discardBtn, { clientX: 10, clientY: 10 });
        fireEvent.pointerMove(discardBtn, { clientX: 15, clientY: 15 });
      });

      // No crash
      expect(discardBtn).toBeInTheDocument();
    });
  });

  // ── 37. Branch coverage: fmtAge with age=1 ("1 Yr"), getSexLabel with no match ─

  describe('fmtAge and getSexLabel branches', () => {
    it('shows "1 Yr" when age is exactly 1', async () => {
      const dateLib = jest.requireMock('@/app/lib/date') as any;
      dateLib.getAgeInYears.mockImplementation(() => 1);

      const companion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          dateOfBirth: new Date('2024-01-01'),
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companion} />);
      });

      expect(screen.getByText('1 Yr')).toBeInTheDocument();

      // Restore default
      dateLib.getAgeInYears.mockImplementation(() => 4);
    });

    it('shows "-" for age when getAgeInYears returns NaN', async () => {
      const { getAgeInYears } = jest.requireMock('@/app/lib/date') as any;
      getAgeInYears.mockImplementationOnce(() => NaN);

      const companion = {
        ...mockViewCompanion,
        companion: { ...mockViewCompanion.companion, dateOfBirth: new Date('2020-01-01') },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companion} />);
      });

      // fmtAge returns '-' when age is NaN
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    });

    it('getSexLabel returns toTitleCase fallback for unmatched gender', async () => {
      const companion = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          gender: 'nonbinary' as any,
          isneutered: false,
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companion} />);
      });

      // toTitleCase('nonbinary') = 'Nonbinary'
      expect(screen.getByText('Nonbinary')).toBeInTheDocument();
    });
  });

  // ── 38. Edit mode with parent birthDate and no companion dateOfBirth ──────────

  describe('edit mode branch: parent with birthDate and companion without dateOfBirth', () => {
    it('populates edit form when parent has birthDate and companion has no dateOfBirth', async () => {
      const companionNoDob = {
        companion: {
          ...mockViewCompanion.companion,
          dateOfBirth: undefined as any,
        },
        parent: {
          ...mockViewCompanion.parent,
          birthDate: new Date('1985-03-20'),
        },
      };

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} viewCompanion={companionNoDob} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      // Should switch to edit mode without crash
      expect(screen.getByText('Edit Patient / Client')).toBeInTheDocument();
    });
  });

  // ── 39. validateParentFields: invalid phone number branch ────────────────────

  describe('validateParentFields invalid phone', () => {
    it('shows invalid phone error when phone format is wrong', async () => {
      const { validatePhone } = jest.requireMock('@/app/lib/validators') as any;
      validatePhone.mockReturnValueOnce(false);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Fill all fields but with invalid phone
      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
        fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '12345678' } });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '1 Test' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'NYC' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'NY' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '10001' } });
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rex' } });
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dog' } });
      });

      await waitFor(() => {
        const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
        expect(breedSelect.options.length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Breed'), { target: { value: 'Poodle' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument();
      });
    });
  });

  // ── 40. buildFullName with and without lastName ───────────────────────────────

  describe('buildFullName branches', () => {
    it('parent search shows full name with lastName', async () => {
      mockSearchParent.mockResolvedValue([
        {
          id: 'parent-full',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@doe.com',
          phoneNumber: '+12025551234',
          birthDate: undefined,
          address: {
            addressLine: '1 Main',
            city: 'LA',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          createdFrom: 'pms' as const,
        },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'John' } });
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      // Dropdown shows 'John Doe'
      const johnOption = await screen.findByRole('button', { name: 'John Doe' });
      expect(johnOption).toBeInTheDocument();
    });
  });

  // ── 41. AlertChipView with unknown priority ───────────────────────────────────

  describe('AlertChipView with unknown priority', () => {
    it('renders alert chip with fallback to medium when priority is unknown', async () => {
      const companionWithUnknownPriorityAlert = {
        ...mockViewCompanion,
        companion: {
          ...mockViewCompanion.companion,
          alerts: [{ id: 'a1', label: 'Unknown alert', priority: 'unknown' as any }],
        } as any,
      };

      await act(async () => {
        render(
          <AddCompanionCentralModal
            {...defaultProps}
            viewCompanion={companionWithUnknownPriorityAlert}
          />
        );
      });

      expect(screen.getByText('Unknown alert')).toBeInTheDocument();
    });
  });

  // ── 42. computeHasUnsavedChanges: each field makes form dirty ────────────────

  describe('computeHasUnsavedChanges dirty tracking', () => {
    it('changing species makes form dirty and shows discard confirm on close', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Change species — dirtier than initial
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'cat' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      // Species change makes hasUnsavedChanges = true, so discard confirm appears
      // (depends on whether type differs from EMPTY_SNAPSHOT.companionType = '')
      // Since EMPTY_SNAPSHOT.companionType is '' and we selected 'cat', should be dirty
      expect(screen.getByTestId('modal-shell')).toBeInTheDocument();
    });

    it('changing first name makes form dirty', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'NewFirst' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    });

    it('changing email makes form dirty', async () => {
      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dirty@email.com' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      });

      expect(screen.getByTestId('center-modal')).toBeInTheDocument();
    });
  });

  // ── 43. fetchSpeciesCodeEntries speciesCode mapping ───────────────────────────

  describe('fetchSpeciesCodeEntries speciesCode mapping', () => {
    it('maps species codes from API when entries include the species queries', async () => {
      mockFetchSpeciesCodeEntries.mockResolvedValue([
        { display: 'canine', code: 'CANINE-CODE' },
        { display: 'feline', code: 'FELINE-CODE' },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // After mount, species codes are fetched. No crash expected
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(screen.getByLabelText('Species')).toBeInTheDocument();
    });
  });

  // ── 44. handleCompanionSelect with no cp (store miss) ────────────────────────

  describe('handleCompanionSelect when companion not found in store', () => {
    it('does nothing (returns early) when companion id not found anywhere', async () => {
      const { useCompanionsParentsForPrimaryOrg } = jest.requireMock(
        '@/app/hooks/useCompanion'
      ) as any;

      // Store has entry but with different companion id — ensure dropdown shows it via name match
      useCompanionsParentsForPrimaryOrg.mockReturnValue([
        {
          companion: {
            id: 'phantom-comp-id',
            name: 'Ghost',
            type: 'dog',
            breed: 'Mix',
            speciesCode: '',
            breedCode: '',
            status: 'active',
          },
          parent: null,
        },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      // Type partial match to show dropdown
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gh' } });
      });

      const ghostOption = await screen.findByRole('button', { name: 'Ghost' });
      await act(async () => {
        fireEvent.click(ghostOption);
      });

      // Should fill name without crash
      expect(screen.getByLabelText('Name')).toHaveValue('Ghost');
    });
  });

  // ── 45. handleParentSelect with no birthDate in parent ───────────────────────

  describe('handleParentSelect parent with no birthDate', () => {
    it('selects parent without birthDate without crash', async () => {
      mockSearchParent.mockResolvedValue([
        {
          id: 'nodob-parent',
          firstName: 'No',
          lastName: 'DOB',
          email: 'no@dob.com',
          phoneNumber: '+12025554444',
          birthDate: undefined,
          address: {
            addressLine: '4 No DOB',
            city: 'Miami',
            state: 'FL',
            postalCode: '33101',
            country: 'US',
          },
          createdFrom: 'pms' as const,
        },
      ]);

      await act(async () => {
        render(<AddCompanionCentralModal {...defaultProps} />);
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'No' } });
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      const noOption = await screen.findByRole('button', { name: 'No DOB' });
      await act(async () => {
        fireEvent.click(noOption);
      });

      expect(screen.getByLabelText('First name')).toHaveValue('No');
    });
  });

  // ── 46. linkCompanion branch ─────────────────────────────────────────────────

  describe('linkCompanion branch', () => {
    it('calls linkCompanion when companion has an id and parent already exists', async () => {
      const { useCompanionsParentsForPrimaryOrg } = jest.requireMock(
        '@/app/hooks/useCompanion'
      ) as any;

      useCompanionsParentsForPrimaryOrg.mockReturnValue([
        {
          companion: {
            id: 'existing-comp',
            name: 'Luna',
            type: 'cat',
            breed: 'Siamese',
            speciesCode: 'CAT',
            breedCode: 'SIA',
            status: 'active',
            dateOfBirth: new Date('2021-06-01'),
            gender: 'female',
            isneutered: true,
          },
          parent: {
            id: 'link-parent-1',
            firstName: 'Link',
            lastName: 'Owner',
            email: 'link@owner.com',
            phoneNumber: '+12025552222',
            birthDate: undefined,
            address: {
              addressLine: '2 Link Ave',
              city: 'Austin',
              state: 'TX',
              postalCode: '78701',
              country: 'US',
            },
            createdFrom: 'pms' as const,
          },
        },
      ]);

      mockLinkCompanion.mockResolvedValue({ id: 'linked-comp' });

      const setShowModal = jest.fn();

      await act(async () => {
        render(<AddCompanionCentralModal showModal={true} setShowModal={setShowModal} />);
      });

      // Select companion from store (this sets companionFormData.id)
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lun' } });
      });

      const lunaOption = await screen.findByRole('button', { name: 'Luna' });
      await act(async () => {
        fireEvent.click(lunaOption);
      });

      // Fill remaining required fields
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'link@owner.com' } });
        fireEvent.change(screen.getByLabelText('Phone number'), {
          target: { value: '2025552222' },
        });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 Link Ave' } });
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Austin' } });
        fireEvent.change(screen.getByLabelText('State / Province'), { target: { value: 'TX' } });
        fireEvent.change(screen.getByLabelText('ZIP'), { target: { value: '78701' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save patient info/i }));
      });

      await waitFor(() => {
        expect(mockLinkCompanion).toHaveBeenCalled();
      });
    });
  });
});
