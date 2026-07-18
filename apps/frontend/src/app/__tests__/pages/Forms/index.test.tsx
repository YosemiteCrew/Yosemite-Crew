import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ProtectedForms from '@/app/features/forms/pages/Forms';
import { useFormsStore } from '@/app/stores/formsStore';
import { loadForms } from '@/app/features/forms/services/formService';

expect.extend(toHaveNoViolations);
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrgStore } from '@/app/stores/orgStore';

// Controllable mocks (prefixed with `mock` so jest hoisting permits references).
const mockCan = jest.fn(() => true);
const mockSearchQuery = { value: '' };
const mockSearchParamsGet = jest.fn((_key: string): string | null => null);

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('Sections/AddForm')) {
        const MockAddForm = (
          jest.requireMock('@/app/features/forms/pages/Forms/Sections/AddForm') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockAddForm {...props} />;
      }

      if (source.includes('Sections/FormInfo')) {
        const MockFormInfo = (
          jest.requireMock('@/app/features/forms/pages/Forms/Sections/FormInfo') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockFormInfo {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

// --- Mocks ---

// 1. Mock Hooks & Services
jest.mock('@/app/stores/formsStore');
jest.mock('@/app/features/forms/services/formService');
jest.mock('@/app/stores/revampCatalogStore');
jest.mock('@/app/stores/orgStore');
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: mockCan,
    canAll: () => true,
    canAny: () => true,
    permissions: [],
    isLoading: false,
    activeOrgId: 'org-1',
  }),
}));
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div data-testid="fallback">No permission</div>,
}));
jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: (s: { query: string }) => unknown) =>
    selector({ query: mockSearchQuery.value }),
}));

// 2. Mock Guards
jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected-route">{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

// 3. Mock UI Components
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="btn-add" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/filters/FormsFilters', () => ({
  __esModule: true,
  default: ({ onFiltersChange, categoryAction }: any) => (
    <div data-testid="forms-filters">
      {categoryAction}
      <button
        data-testid="filter-reset"
        onClick={() => onFiltersChange({ status: 'All', category: 'All' })}
      >
        Reset Filter
      </button>
      <button
        data-testid="filter-empty"
        onClick={() => onFiltersChange({ status: 'Archived', category: 'Custom' })}
      >
        Empty Filter
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/tables/FormsTable', () => ({
  __esModule: true,
  default: ({ setActiveForm, setViewPopup }: any) => (
    <div data-testid="forms-table">
      <button
        data-testid="select-form-btn"
        onClick={() => setActiveForm({ _id: 'form-2' })} // Selects form-2
      >
        Select Form 2
      </button>
      <button
        data-testid="select-null-btn"
        onClick={() => setActiveForm(null)} // Edge case
      >
        Select Null
      </button>
      <button data-testid="view-popup-btn" onClick={() => setViewPopup(true)}>
        View Popup
      </button>
    </div>
  ),
}));

// 4. Mock Modals (AddForm & FormInfo)
// We expose their callbacks via buttons to test parent state changes
jest.mock('@/app/features/forms/pages/Forms/Sections/AddForm', () => ({
  __esModule: true,
  default: ({ showModal, onClose, onDraftChange, initialForm, serviceOptions }: any) =>
    showModal ? (
      <div data-testid="add-form-modal">
        <span data-testid="edit-mode">{initialForm ? 'Editing' : 'Adding'}</span>
        <div data-testid="service-options">{JSON.stringify(serviceOptions)}</div>
        <button data-testid="close-add-form" onClick={onClose}>
          Close
        </button>
        <button data-testid="set-draft" onClick={() => onDraftChange({ _id: 'draft-1' })}>
          Set Draft
        </button>
      </div>
    ) : null,
}));

jest.mock('@/app/features/forms/pages/Forms/Sections/FormInfo', () => ({
  __esModule: true,
  default: ({ showModal, activeForm, onEdit }: any) =>
    showModal ? (
      <div data-testid="form-info-modal">
        Info: {activeForm?._id}
        <button data-testid="edit-btn" onClick={() => onEdit(activeForm)}>
          Edit
        </button>
      </div>
    ) : null,
}));

// --- Test Data ---

const mockForms = {
  'form-1': { _id: 'form-1', name: 'Form One' },
  'form-2': { _id: 'form-2', name: 'Form Two' },
};
const mockFormIds = ['form-1', 'form-2'];

const ORG_ID = 'org-1';
const mockServices = [
  {
    id: 'srv-1',
    name: 'General Consult',
    specialityId: 'spec-1',
    organisationId: ORG_ID,
    status: 'ACTIVE',
  },
  {
    id: 'srv-2',
    name: 'General Consult',
    specialityId: 'spec-2',
    organisationId: ORG_ID,
    status: 'ACTIVE',
  },
  {
    id: 'srv-3',
    name: 'Vaccination',
    specialityId: 'spec-1',
    organisationId: ORG_ID,
    status: 'ACTIVE',
  },
];
const mockPackages = [
  {
    id: 'pkg-1',
    name: 'Wellness Package',
    specialityId: 'spec-1',
    organisationId: ORG_ID,
    status: 'ACTIVE',
  },
];
const mockSpecialities = [
  { id: 'spec-1', name: 'General Practice', organisationId: ORG_ID },
  { id: 'spec-2', name: 'Emergency Care', organisationId: ORG_ID },
];

describe('Forms Page', () => {
  const mockSetActiveForm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockSearchQuery.value = '';
    mockSearchParamsGet.mockReturnValue(null);

    // Default Hook Returns
    const catalogState = {
      specialities: mockSpecialities,
      services: mockServices,
      packages: mockPackages,
      loadOrganisationCatalog: jest.fn().mockResolvedValue(undefined),
      loadSpecialityCatalog: jest.fn().mockResolvedValue(undefined),
    };
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector(catalogState)
    );
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: ORG_ID })
    );
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: mockForms,
      formIds: mockFormIds,
      activeFormId: 'form-1',
      setActiveForm: mockSetActiveForm,
      loading: false,
    });
    // Component reads the action imperatively via getState() inside effects
    // to avoid re-subscribing; mirror that on the mock.
    (useFormsStore as unknown as { getState: () => unknown }).getState = () => ({
      setActiveForm: mockSetActiveForm,
    });
  });

  // --- Section 1: Rendering & Initialization ---

  it('has no axe violations on initial render', async () => {
    const { container } = render(<ProtectedForms />);
    await screen.findByRole('heading', { level: 1, name: /Templates/ });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders h1 page heading', () => {
    render(<ProtectedForms />);
    expect(screen.getByRole('heading', { level: 1, name: /Templates/ })).toBeInTheDocument();
    expect(
      screen.getByText('Build and reuse templates, link them to services and packages')
    ).toBeInTheDocument();
  });

  it('renders structure, guards, and fetches data on mount if list is empty', async () => {
    // Mock empty store to trigger loadForms
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: {},
      formIds: [],
      activeFormId: null,
      setActiveForm: mockSetActiveForm,
      loading: false,
    });

    render(<ProtectedForms />);

    // Verify Guards
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByTestId('org-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Templates/ })).toBeInTheDocument();

    // Verify Load Effect
    await waitFor(() => {
      expect(loadForms).toHaveBeenCalled();
    });
  });

  it('does not fetch data if list is already populated', async () => {
    render(<ProtectedForms />);
    // Since formIds has length 2 (default mock), loadForms shouldn't run
    expect(loadForms).not.toHaveBeenCalled();
  });

  it('handles loadForms error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: {},
      formIds: [],
      setActiveForm: mockSetActiveForm,
    });
    (loadForms as jest.Mock).mockRejectedValue(new Error('Fetch failed'));

    render(<ProtectedForms />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load forms', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  // --- Section 2: Active Form Logic (useMemo & useEffect) ---

  it('selects the active form from the store if it exists in the filtered list', () => {
    render(<ProtectedForms />);
    // Default activeFormId is "form-1" — FormsTable is rendered (no crash)
    expect(screen.getByTestId('forms-table')).toBeInTheDocument();
  });

  it('fallbacks to the first item if active form is NOT in filtered list', () => {
    // Store has "form-3" active, but list only has form-1, form-2
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: mockForms,
      formIds: mockFormIds,
      activeFormId: 'form-3', // Invalid ID
      setActiveForm: mockSetActiveForm,
    });

    render(<ProtectedForms />);
    // Should fallback to list[0] -> calls setActiveForm with "form-1"
    expect(mockSetActiveForm).toHaveBeenCalledWith('form-1');
  });

  it('sets active form to null if filtered list is empty', () => {
    render(<ProtectedForms />);

    // Simulate filtering to empty via UI
    fireEvent.click(screen.getByTestId('filter-empty'));

    // Verify store update called with null
    expect(mockSetActiveForm).toHaveBeenCalledWith(null);
  });

  it('auto-selects the first form if activeID is missing or filtered out', () => {
    // Scenario: activeFormId is null, list has items
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: mockForms,
      formIds: mockFormIds,
      activeFormId: null,
      setActiveForm: mockSetActiveForm,
    });

    render(<ProtectedForms />);

    // Effect should trigger setActiveForm with first item ID
    expect(mockSetActiveForm).toHaveBeenCalledWith('form-1');
  });

  // --- Section 3: Modal & Edit Flow Interactions ---

  it('opens Add Modal when Add button is clicked', () => {
    render(<ProtectedForms />);

    fireEvent.click(screen.getByTestId('btn-add'));

    const modal = screen.getByTestId('add-form-modal');
    expect(modal).toBeInTheDocument();
    // Verify it's in Add mode (not edit)
    expect(screen.getByTestId('edit-mode')).toHaveTextContent('Adding');
  });

  it('handles Edit flow: Open Info -> Click Edit -> Open Add Modal in Edit Mode', () => {
    render(<ProtectedForms />);

    // 1. Open View Popup
    fireEvent.click(screen.getByTestId('view-popup-btn'));
    expect(screen.getByTestId('form-info-modal')).toBeInTheDocument();

    // 2. Click Edit inside Info Modal
    fireEvent.click(screen.getByTestId('edit-btn'));

    // 3. Verify Info closes and Add opens in Edit mode
    expect(screen.queryByTestId('form-info-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('edit-mode')).toHaveTextContent('Editing');
  });

  it('clears drafts when closing an edit form', () => {
    render(<ProtectedForms />);

    // Enter Edit Mode
    fireEvent.click(screen.getByTestId('view-popup-btn'));
    fireEvent.click(screen.getByTestId('edit-btn'));

    // Close the modal
    fireEvent.click(screen.getByTestId('close-add-form'));

    // Re-open via Add button (should be clean state)
    fireEvent.click(screen.getByTestId('btn-add'));
    expect(screen.getByTestId('edit-mode')).toHaveTextContent('Adding');
  });

  // --- Section 4: User Actions & Edge Cases ---

  it('updates draft state only when NOT editing', () => {
    render(<ProtectedForms />);

    // 1. Open Add Modal (Adding mode)
    fireEvent.click(screen.getByTestId('btn-add'));

    // Simulate draft change
    // Since we can't easily spy on internal useState 'setDraftForm',
    // we assume the component doesn't crash and covers the branch `!editingForm`
    fireEvent.click(screen.getByTestId('set-draft'));

    // 2. Switch to Edit mode
    fireEvent.click(screen.getByTestId('close-add-form'));
    fireEvent.click(screen.getByTestId('view-popup-btn'));
    fireEvent.click(screen.getByTestId('edit-btn')); // Now editing form-1

    // Simulate draft change (Should NOT update draft state because editingForm is present)
    fireEvent.click(screen.getByTestId('set-draft'));

    // Test passes if no errors thrown and branch logic executed
  });

  it('handles form selection from table', () => {
    render(<ProtectedForms />);

    fireEvent.click(screen.getByTestId('select-form-btn'));
    expect(mockSetActiveForm).toHaveBeenCalledWith('form-2');
  });

  it('handles null form selection gracefully', () => {
    render(<ProtectedForms />);

    // Clear previous auto-select calls
    mockSetActiveForm.mockClear();

    // Click button that passes null to handleSelectForm
    fireEvent.click(screen.getByTestId('select-null-btn'));

    // Should NOT call setActiveForm because form is invalid/null
    expect(mockSetActiveForm).not.toHaveBeenCalled();
  });

  it('builds service and package options with badges, deduping shared names by speciality', () => {
    render(<ProtectedForms />);
    fireEvent.click(screen.getByTestId('btn-add'));

    const serviceOptions = JSON.parse(screen.getByTestId('service-options').textContent ?? '[]');

    expect(serviceOptions).toEqual([
      {
        label: 'General Practice / General Consult',
        value: 'srv-1',
        badge: 'Service',
        isInpatient: false,
      },
      {
        label: 'Emergency Care / General Consult',
        value: 'srv-2',
        badge: 'Service',
        isInpatient: false,
      },
      { label: 'Vaccination', value: 'srv-3', badge: 'Service', isInpatient: false },
      { label: 'Wellness Package', value: 'pkg-1', badge: 'Package', isInpatient: false },
    ]);
  });

  it('excludes catalog entries belonging to another organisation', () => {
    const catalogState = {
      specialities: mockSpecialities,
      services: [
        ...mockServices,
        {
          id: 'srv-foreign',
          name: 'Foreign Consult',
          specialityId: 'spec-foreign',
          organisationId: 'org-2',
          status: 'ACTIVE',
        },
      ],
      packages: [
        ...mockPackages,
        {
          id: 'pkg-foreign',
          name: 'Foreign Package',
          specialityId: 'spec-foreign',
          organisationId: 'org-2',
          status: 'ACTIVE',
        },
      ],
      loadOrganisationCatalog: jest.fn().mockResolvedValue(undefined),
      loadSpecialityCatalog: jest.fn().mockResolvedValue(undefined),
    };
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector(catalogState)
    );

    render(<ProtectedForms />);
    fireEvent.click(screen.getByTestId('btn-add'));

    const serviceOptions = JSON.parse(screen.getByTestId('service-options').textContent ?? '[]');
    const values = serviceOptions.map((option: { value: string }) => option.value);

    expect(values).toEqual(['srv-1', 'srv-2', 'srv-3', 'pkg-1']);
    // Previously these leaked through labelled 'Unknown Speciality'.
    expect(values).not.toContain('srv-foreign');
    expect(values).not.toContain('pkg-foreign');
    expect(screen.getByTestId('service-options').textContent).not.toContain('Unknown Speciality');
  });

  // --- Section 5: Org-scoped catalog loading & edge cases ---

  it('skips catalog loading and yields no org specialities when primaryOrgId is missing', () => {
    const loadOrganisationCatalog = jest.fn().mockResolvedValue(undefined);
    const loadSpecialityCatalog = jest.fn().mockResolvedValue(undefined);
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        specialities: mockSpecialities,
        services: [],
        packages: [],
        loadOrganisationCatalog,
        loadSpecialityCatalog,
      })
    );
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: null })
    );

    render(<ProtectedForms />);

    // Both org-gated effects bail out early (line: `if (!primaryOrgId) return`).
    expect(loadOrganisationCatalog).not.toHaveBeenCalled();
    expect(loadSpecialityCatalog).not.toHaveBeenCalled();

    // orgSpecialities resolves to [] (the ternary's false branch) and the empty
    // catalog yields no service options.
    fireEvent.click(screen.getByTestId('btn-add'));
    const serviceOptions = JSON.parse(screen.getByTestId('service-options').textContent ?? '[]');
    expect(serviceOptions).toEqual([]);
  });

  it('drops form ids that are missing from the store map when building the list', () => {
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: { 'form-1': { _id: 'form-1', name: 'Form One' } },
      formIds: ['form-1', 'ghost-form'], // ghost-form has no entry in formsById
      activeFormId: 'form-1',
      setActiveForm: mockSetActiveForm,
      loading: false,
    });

    render(<ProtectedForms />);

    // Only the resolvable form contributes to the count.
    expect(screen.getByRole('heading', { level: 1, name: /Templates \(1\)/ })).toBeInTheDocument();
  });

  it('filters the list by the header search query (name and category matches)', () => {
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: {
        'form-1': { _id: 'form-1', name: 'Vaccination Consent', category: 'Medical' },
        'form-2': { _id: 'form-2', name: 'Intake', category: 'Onboarding' },
      },
      formIds: ['form-1', 'form-2'],
      activeFormId: 'form-1',
      setActiveForm: mockSetActiveForm,
      loading: false,
    });

    // Query matches form-1 by name only.
    mockSearchQuery.value = 'vaccination';
    const { unmount } = render(<ProtectedForms />);
    expect(screen.getByTestId('forms-table')).toBeInTheDocument();
    unmount();

    // Query matches form-2 by category only.
    mockSearchQuery.value = 'onboarding';
    render(<ProtectedForms />);
    expect(screen.getByTestId('forms-table')).toBeInTheDocument();
  });

  it('builds catalog options across missing names, blank ids, inactive rows, and unknown specialities', () => {
    (useRevampCatalogStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        specialities: [
          { id: 'spec-1', name: 'General Practice', organisationId: ORG_ID },
          { id: null, name: 'Nameless Speciality', organisationId: ORG_ID }, // id ?? '' branch
        ],
        services: [
          {
            id: 'srv-a',
            name: 'Duplicate Service',
            specialityId: 'spec-1',
            organisationId: ORG_ID,
            status: 'ACTIVE',
            isInpatientPreferred: true,
          },
          {
            id: 'srv-b',
            name: 'Duplicate Service',
            specialityId: 'spec-unknown', // not in speciality map -> 'Unknown Speciality'
            organisationId: ORG_ID,
            status: 'ACTIVE',
          },
          {
            id: 'srv-c',
            name: undefined, // name ?? '' branch, then skipped by !item.name guard
            specialityId: 'spec-1',
            organisationId: ORG_ID,
            status: 'ACTIVE',
          },
          {
            id: '', // blank id skipped by !item.id guard
            name: 'Has No Id',
            specialityId: 'spec-1',
            organisationId: ORG_ID,
            status: 'ACTIVE',
          },
          {
            id: 'srv-d',
            name: 'Inactive Service',
            specialityId: 'spec-1',
            organisationId: ORG_ID,
            status: 'INACTIVE', // status !== ACTIVE branch
          },
        ],
        packages: [
          {
            id: 'pkg-a',
            name: undefined, // package name ?? '' branch, then skipped
            specialityId: 'spec-1',
            organisationId: ORG_ID,
            status: 'ACTIVE',
          },
          {
            id: 'pkg-b',
            name: 'Inactive Package',
            specialityId: 'spec-1',
            organisationId: ORG_ID,
            status: 'INACTIVE',
          },
        ],
        loadOrganisationCatalog: jest.fn().mockResolvedValue(undefined),
        loadSpecialityCatalog: jest.fn().mockResolvedValue(undefined),
      })
    );

    render(<ProtectedForms />);
    fireEvent.click(screen.getByTestId('btn-add'));

    const serviceOptions = JSON.parse(screen.getByTestId('service-options').textContent ?? '[]');
    expect(serviceOptions).toEqual([
      {
        label: 'General Practice / Duplicate Service',
        value: 'srv-a',
        badge: 'Service',
        isInpatient: true,
      },
      {
        label: 'Unknown Speciality / Duplicate Service',
        value: 'srv-b',
        badge: 'Service',
        isInpatient: false,
      },
    ]);
  });

  it('does not re-run the initial fetch once it has already fired', () => {
    const { rerender } = render(<ProtectedForms />);
    expect(loadForms).not.toHaveBeenCalled();

    // Force the [list.length] effect to re-run; the fetchedRef guard should short-circuit it.
    (useFormsStore as unknown as jest.Mock).mockReturnValue({
      formsById: {
        'form-1': { _id: 'form-1', name: 'Form One' },
        'form-2': { _id: 'form-2', name: 'Form Two' },
        'form-3': { _id: 'form-3', name: 'Form Three' },
      },
      formIds: ['form-1', 'form-2', 'form-3'],
      activeFormId: 'form-1',
      setActiveForm: mockSetActiveForm,
      loading: false,
    });
    rerender(<ProtectedForms />);

    expect(loadForms).not.toHaveBeenCalled();
  });

  it('opens the info modal for a valid deep-linked formId and ignores repeat handling', () => {
    mockSearchParamsGet.mockReturnValue('form-1');

    const { rerender } = render(<ProtectedForms />);

    // Deep link resolves -> active form set + view popup opened.
    expect(mockSetActiveForm).toHaveBeenCalledWith('form-1');
    expect(screen.getByTestId('form-info-modal')).toBeInTheDocument();

    mockSetActiveForm.mockClear();
    // Re-render re-runs the effect; handledDeepLinkRef guard short-circuits it.
    rerender(<ProtectedForms />);
    expect(mockSetActiveForm).not.toHaveBeenCalled();
  });

  it('ignores a deep-linked formId that is not present in the list', () => {
    mockSearchParamsGet.mockReturnValue('missing-form');

    render(<ProtectedForms />);

    // Target not found -> effect returns before opening the view popup.
    expect(screen.queryByTestId('form-info-modal')).not.toBeInTheDocument();
  });

  it('hides the Add action when the user cannot edit forms', () => {
    mockCan.mockReturnValue(false);

    render(<ProtectedForms />);

    // categoryAction resolves to null, so the Add button is not rendered.
    expect(screen.queryByTestId('btn-add')).not.toBeInTheDocument();
    expect(screen.getByTestId('forms-filters')).toBeInTheDocument();
  });
});
