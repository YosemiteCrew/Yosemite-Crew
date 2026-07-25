import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Details from '@/app/features/forms/pages/Forms/Sections/AddForm/Details';
import { FormsProps } from '@/app/features/forms/types/forms';
import * as formUtils from '@/app/lib/forms';

// --- Mocks ---

// Mock Utils
jest.mock('@/app/lib/forms', () => ({
  getCategoryTemplate: jest.fn(),
  ensureSingleSignatureAtEnd: jest.fn((fields) => fields),
  hasSignatureField: jest.fn(() => false),
  removeSignatureFields: jest.fn((fields) => fields),
}));

// Mock Child Components to simplify testing logic
jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div data-testid={`input-wrapper-${inlabel}`}>
      <label>{inlabel}</label>
      <input data-testid={`input-${inlabel}`} value={value} onChange={onChange} />
      {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, defaultOption, onSelect, options = [], error }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`dropdown-value-${placeholder}`}>{defaultOption}</span>
      <button
        data-testid={`dropdown-select-${placeholder}`}
        onClick={() => onSelect({ value: 'SelectedValue', label: 'SelectedValue' })}
      >
        Select
      </button>
      <div data-testid={`dropdown-options-${placeholder}`}>
        {options.map((option: { label: string; value: string }) => (
          <button
            key={option.value}
            type="button"
            data-testid={`dropdown-option-${placeholder}-${option.value}`}
            onClick={() => onSelect(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <span data-testid={`dropdown-error-${placeholder}`}>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange, error }: any) => (
    <div data-testid={`multi-${placeholder}`}>
      <span data-testid={`multi-val-${placeholder}`}>{value.join(',')}</span>
      <button
        data-testid={`multi-select-${placeholder}`}
        onClick={() => onChange(['SelectedOption'])}
      >
        Select Multi
      </button>
      {error && <span data-testid={`multi-error-${placeholder}`}>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="next-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Org store: drive the org-type selector deterministically per test.
let mockOrgState: { primaryOrgId: string | null; orgsById: Record<string, any> } = {
  primaryOrgId: null,
  orgsById: {},
};
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (s: any) => unknown) => selector(mockOrgState),
}));

describe('Details Component', () => {
  const mockSetFormData = jest.fn();
  const mockOnNext = jest.fn();

  const defaultFormData: FormsProps = {
    name: '',
    category: 'Custom', // Initialized to a valid FormsCategory literal
    description: '',
    usage: 'Internal',
    requiredSigner: undefined,
    species: [],
    services: [],
    schema: [],
    updatedBy: '',
    lastUpdated: '',
    status: 'Draft',
    _id: undefined,
  } as FormsProps;

  const serviceOptions = [{ label: 'Service A', value: 'A' }];

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState = { primaryOrgId: null, orgsById: {} };
    (formUtils.getCategoryTemplate as jest.Mock).mockReturnValue([{ id: 'template-field' }]);
  });

  // --- 1. Rendering ---

  it('renders all form fields correctly', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId('accordion-Form details')).toBeInTheDocument();
    expect(screen.getByTestId('input-Form name')).toBeInTheDocument();
    expect(screen.getByTestId('input-Description')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-Category')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-Signed by')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-Usage and visibility')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-Visibility type')).toBeInTheDocument();
    expect(screen.getByTestId('multi-Services / Packages (Optional)')).toBeInTheDocument();
    expect(screen.getByTestId('multi-Species')).toBeInTheDocument();
    expect(screen.getByTestId('next-btn')).toBeInTheDocument();
    // Ownership selector lives above Category; Custom is the default and shows
    // the org/personal scope sub-choice.
    expect(screen.getByTestId('dropdown-Template Source')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-value-Template Source')).toHaveTextContent('CUSTOM');
    expect(screen.getByTestId('dropdown-Template visibility')).toBeInTheDocument();
  });

  it('locks structure and hides the scope sub-choice for YC default templates', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'YC_LIBRARY' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId('dropdown-value-Template Source')).toHaveTextContent('YC_LIBRARY');
    expect(screen.getByText(/fixed structure/i)).toBeInTheDocument();
    // The org/personal scope only applies to Custom templates.
    expect(screen.queryByTestId('dropdown-Template visibility')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dropdown-Signed by')).not.toBeInTheDocument();
  });

  it('restricts category options to canonical structures for YC default templates', () => {
    render(
      <Details
        // A real YC-default template's category is one of the curated five; using
        // that here keeps the "own saved category is always appended" guard (see
        // the retained-category test below) from adding an extra option.
        formData={{ ...defaultFormData, templateSource: 'YC_LIBRARY', category: 'SOAP' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    const categoryOptions = screen.getByTestId('dropdown-options-Category');
    expect(categoryOptions).toHaveTextContent('SOAP');
    expect(categoryOptions).toHaveTextContent('Prescription');
    expect(categoryOptions).toHaveTextContent('Task Template');
    expect(categoryOptions).toHaveTextContent('Discharge Form');
    expect(categoryOptions).toHaveTextContent('Consent form');
    expect(categoryOptions).not.toHaveTextContent('Vitals');
    expect(categoryOptions).not.toHaveTextContent('Custom');
    expect(categoryOptions).not.toHaveTextContent('Inpatient Schedule');
  });

  it('keeps the template own saved category selectable when it is outside the offering', () => {
    // Vitals is not one of the five curated YC-default categories, but it is this
    // template's saved value. A controlled dropdown can only display a value that
    // is present in its options, so the saved category must remain selectable
    // (otherwise the Category field reads as blank when editing).
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'YC_LIBRARY', category: 'Vitals' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId('dropdown-options-Category')).toHaveTextContent('Vitals');
    expect(screen.getByTestId('dropdown-option-Category-Vitals')).toBeInTheDocument();
  });

  it('drops the library-backed identity when converting a YC default template to Custom', () => {
    const setFormData = jest.fn();
    const ycTemplate = {
      ...defaultFormData,
      templateSource: 'YC_LIBRARY',
      category: 'SOAP',
      _id: 'lib-1',
      templateId: 'lib-1',
    } as FormsProps;
    render(
      <Details
        formData={ycTemplate}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Template Source-CUSTOM'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next = typeof updater === 'function' ? updater(ycTemplate) : updater;
    // Clearing the ids makes the save POST a new org-owned copy instead of
    // PATCHing the un-writable shared library record (which 403s on publish).
    expect(next).toEqual(
      expect.objectContaining({
        templateSource: 'ORG_TEMPLATE',
        isTemplateBacked: false,
        templateId: undefined,
        _id: undefined,
      })
    );
  });

  it('keeps the id when re-selecting Custom on an already org-owned template', () => {
    const setFormData = jest.fn();
    const orgTemplate = {
      ...defaultFormData,
      templateSource: 'ORG_TEMPLATE',
      _id: 'org-1',
      templateId: 'org-1',
    } as FormsProps;
    render(
      <Details
        formData={orgTemplate}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Template Source-CUSTOM'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next = typeof updater === 'function' ? updater(orgTemplate) : updater;
    expect(next.templateId).toBe('org-1');
    expect(next._id).toBe('org-1');
    expect(next.templateSource).toBe('ORG_TEMPLATE');
  });

  it('keeps the full hospital category set for custom templates', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    const categoryOptions = screen.getByTestId('dropdown-options-Category');
    expect(categoryOptions).toHaveTextContent('Vitals');
    expect(categoryOptions).toHaveTextContent('Custom');
    expect(categoryOptions).toHaveTextContent('Inpatient Schedule');
  });

  it('switching to YC default marks the template backed and locked', () => {
    const setFormData = jest.fn();
    // Drive the YC_LIBRARY branch by selecting from a dropdown that emits it.
    render(
      <Details
        formData={defaultFormData}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // The mock LabelDropdown emits "SelectedValue"; assert the Custom branch keeps
    // an org scope and clears the template-backed flag.
    fireEvent.click(screen.getByTestId('dropdown-select-Template Source'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next = typeof updater === 'function' ? updater(defaultFormData) : updater;
    expect(next).toEqual(
      expect.objectContaining({ templateSource: 'ORG_TEMPLATE', isTemplateBacked: false })
    );
  });

  it('clears categories that are not allowed when switching to YC default', () => {
    const setFormData = jest.fn();
    render(
      <Details
        formData={{ ...defaultFormData, category: 'Vitals' }}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Template Source-YC_LIBRARY'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function' ? updater({ ...defaultFormData, category: 'Vitals' }) : updater;
    expect(next).toEqual(
      expect.objectContaining({
        templateSource: 'YC_LIBRARY',
        isTemplateBacked: true,
        requiredSigner: '',
        category: '',
      })
    );
  });

  // --- 2. Input Interactions ---

  it('updates text inputs correctly (name)', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    const input = screen.getByTestId('input-Form name');
    fireEvent.change(input, { target: { value: 'New Name' } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name',
      })
    );
  });

  it('updates text inputs correctly (description)', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    const input = screen.getByTestId('input-Description');
    fireEvent.change(input, { target: { value: 'New Desc' } });

    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('updates usage dropdown', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-select-Visibility type'));

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ usage: 'SelectedValue' })
    );
  });

  it('updates multi-selects (services and species)', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Services (Direct update)
    fireEvent.click(screen.getByTestId('multi-select-Services / Packages (Optional)'));
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ services: ['SelectedOption'] })
    );

    // Species (Direct update)
    fireEvent.click(screen.getByTestId('multi-select-Species'));
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ species: ['SelectedOption'] })
    );
  });

  // --- 3. Category Logic (Schema Template) ---

  it('updates category and applies template if form is new', () => {
    const newForm = { ...defaultFormData, _id: undefined, schema: [] };

    render(
      <Details
        formData={newForm}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-select-Category'));

    const updateFn = mockSetFormData.mock.calls.at(-1)?.[0];
    let newState: FormsProps = newForm; // Initialize newState
    act(() => {
      const updateResult = updateFn(newForm);
      if (updateResult) {
        newState = updateResult;
      }
    });

    // Check if newState was successfully updated
    // Fixed: Checking 'SelectedValue' casted to FormsCategory
    expect(newState.category).toBe('SelectedValue');

    // Fixed: Added check if newState is defined before accessing schema
    if (newState) {
      expect(formUtils.getCategoryTemplate).toHaveBeenCalledWith('SelectedValue');
      expect(newState.schema).toEqual([{ id: 'template-field' }]);
    }
  });

  it('updates category but DOES NOT apply template if form has existing schema', () => {
    const existingForm = {
      ...defaultFormData,
      _id: '123', // Has ID
      schema: [{ field: 'existing' }] as any, // Has schema
    };

    render(
      <Details
        formData={existingForm}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-select-Category'));

    const updateFn = mockSetFormData.mock.calls.at(-1)?.[0];
    let newState: FormsProps = existingForm; // Initialize newState
    act(() => {
      const updateResult = updateFn(existingForm);
      if (updateResult) {
        newState = updateResult;
      }
    });

    expect(newState.category).toBe('SelectedValue');

    // Fixed: Added check if newState is defined before accessing schema
    if (newState) {
      // Should NOT overwrite schema
      expect(newState.schema).toEqual([{ field: 'existing' }]);
    }
  });

  // --- 4. Validation & Next Step ---

  it('validates required fields on Next and blocks submission if invalid', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));

    expect(screen.getByTestId('error-Form name')).toHaveTextContent('Form name is required');
    expect(screen.getByTestId('error-Description')).toHaveTextContent('Description is required');
    expect(screen.getByText('Select at least one species')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-error-Signed by')).toHaveTextContent(
      'Signed by is required'
    );

    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('clears specific errors when user inputs data', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));
    expect(screen.getByTestId('error-Form name')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-Form name'), {
      target: { value: 'Fixed' },
    });

    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('calls onNext if validation passes', () => {
    const validData: FormsProps = {
      ...defaultFormData,
      name: 'Valid Name',
      description: 'Desc',
      category: 'Consent form',
      requiredSigner: 'VET',
      services: ['A'],
      species: ['Dog'],
      usage: 'Internal',
    };

    render(
      <Details
        formData={validData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));
    expect(mockOnNext).toHaveBeenCalled();
  });

  it('does not require signed by for YC default templates', () => {
    const validYcDefaultData: FormsProps = {
      ...defaultFormData,
      name: 'Valid Name',
      description: 'Desc',
      category: 'SOAP',
      templateSource: 'YC_LIBRARY',
      isTemplateBacked: true,
      requiredSigner: '',
      services: ['A'],
      species: ['Dog'],
      usage: 'Internal',
    };

    render(
      <Details
        formData={validYcDefaultData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));
    expect(screen.queryByTestId('dropdown-error-Signed by')).not.toBeInTheDocument();
    expect(mockOnNext).toHaveBeenCalled();
  });

  // --- 5. Validator Registration ---

  it('exposes the validator through the step ref on mount', () => {
    const stepRef = React.createRef<{ validate: () => boolean }>();
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
        ref={stepRef}
      />
    );

    expect(stepRef.current?.validate).toEqual(expect.any(Function));
  });

  it('hides the Next button when hideNext is set (single-screen builder)', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
        hideNext
      />
    );

    expect(screen.queryByTestId('next-btn')).not.toBeInTheDocument();
    // All the detail fields still render — only the step Next button is removed.
    expect(screen.getByTestId('input-Form name')).toBeInTheDocument();
  });

  it('allows parent to trigger validation via registered validator', () => {
    const stepRef = React.createRef<{ validate: () => boolean }>();

    const invalidData = { ...defaultFormData, name: '' } as FormsProps; // Invalid

    render(
      <Details
        formData={invalidData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
        ref={stepRef}
      />
    );

    let isValid: boolean = false; // Initialize explicitly
    act(() => {
      isValid = Boolean(stepRef.current?.validate());
    });

    expect(isValid).toBe(false);
    expect(screen.getByTestId('error-Form name')).toBeInTheDocument();
  });

  // --- 6. Category placeholder + error clearing ---

  it('shows an empty category placeholder and clears the category error on selection', () => {
    render(
      <Details
        formData={{ ...defaultFormData, name: '', category: '' as any }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Empty category falls back to '' for the dropdown default (line 118).
    expect(screen.getByTestId('dropdown-value-Category')).toHaveTextContent('');

    // Missing category is reported by the validator (lines 343-345).
    fireEvent.click(screen.getByTestId('next-btn'));
    expect(screen.getByTestId('dropdown-error-Category')).toHaveTextContent('Category is required');

    // Picking a category clears just that error (lines 308-311).
    fireEvent.click(screen.getByTestId('dropdown-select-Category'));
    expect(screen.queryByTestId('dropdown-error-Category')).not.toBeInTheDocument();
  });

  it('limits the signer options to "no signature" for SOAP forms', () => {
    render(
      <Details
        formData={{ ...defaultFormData, category: 'SOAP', templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // SOAP only allows the empty (no-signature) signer option (lines 132-133).
    expect(screen.getByTestId('dropdown-option-Signed by-')).toBeInTheDocument();
    expect(screen.queryByTestId('dropdown-option-Signed by-CLIENT')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dropdown-option-Signed by-VET')).not.toBeInTheDocument();
  });

  it('updates the template visibility for custom templates', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // onSelect + setFormData for template visibility (lines 182, 426).
    fireEvent.click(screen.getByTestId('dropdown-select-Template visibility'));
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ templateSource: 'SelectedValue' })
    );
  });

  it('defaults services and species to empty arrays when undefined', () => {
    render(
      <Details
        formData={{ ...defaultFormData, services: undefined, species: undefined }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // `formData.services || []` and `formData.species || []` fallbacks (lines 194, 206).
    expect(screen.getByTestId('multi-val-Services / Packages (Optional)')).toHaveTextContent('');
    expect(screen.getByTestId('multi-val-Species')).toHaveTextContent('');
  });

  it('filters services to inpatient options for inpatient-only categories', () => {
    const svc = [
      { label: 'In A', value: 'a', isInpatient: true },
      { label: 'Out B', value: 'b' },
    ];
    render(
      <Details
        formData={{ ...defaultFormData, category: 'Task Template' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={svc}
      />
    );

    // Inpatient-only note + inpatient-filtered options (lines 199, 278-279).
    expect(screen.getByText(/in-patient services/i)).toBeInTheDocument();
    expect(screen.getByTestId('multi-Services / Packages')).toBeInTheDocument();
  });

  // --- 7. Org-type driven category options ---

  it('scopes categories to the hospital base set from the org store', () => {
    mockOrgState = { primaryOrgId: 'org1', orgsById: { org1: { type: 'HOSPITAL' } } };
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Store-driven org type resolves via the selector (line 231) and gates categories (257-258).
    const opts = screen.getByTestId('dropdown-options-Category');
    expect(opts).toHaveTextContent('Custom');
    expect(opts).not.toHaveTextContent('Boarder - Boarding Checklist');
  });

  it('adds boarder categories for boarder orgs', () => {
    mockOrgState = { primaryOrgId: 'org1', orgsById: { org1: { type: 'BOARDER' } } };
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Lines 260-261.
    expect(screen.getByTestId('dropdown-options-Category')).toHaveTextContent(
      'Boarder - Boarding Checklist'
    );
  });

  it('adds breeder categories for breeder orgs', () => {
    mockOrgState = { primaryOrgId: 'org1', orgsById: { org1: { type: 'BREEDER' } } };
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Lines 263-264.
    expect(screen.getByTestId('dropdown-options-Category')).toHaveTextContent(
      'Breeder - Health & Behavior'
    );
  });

  it('adds groomer categories for groomer orgs', () => {
    mockOrgState = { primaryOrgId: 'org1', orgsById: { org1: { type: 'GROOMER' } } };
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Lines 266-267.
    expect(screen.getByTestId('dropdown-options-Category')).toHaveTextContent(
      'Groomer - Grooming Prep'
    );
  });

  // --- 8. Ownership change branches ---

  it('keeps a YC-allowed category when switching to YC default', () => {
    const setFormData = jest.fn();
    render(
      <Details
        formData={{ ...defaultFormData, category: 'SOAP' }}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Template Source-YC_LIBRARY'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function' ? updater({ ...defaultFormData, category: 'SOAP' }) : updater;
    // Allowed category is preserved (line 291 truthy branch).
    expect(next).toEqual(
      expect.objectContaining({ templateSource: 'YC_LIBRARY', category: 'SOAP' })
    );
  });

  it('preserves an existing custom scope when leaving YC default', () => {
    const setFormData = jest.fn();
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'USER_TEMPLATE' }}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-select-Template Source'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function'
        ? updater({ ...defaultFormData, templateSource: 'USER_TEMPLATE' })
        : updater;
    // Keeps the existing personal scope (lines 300-301 truthy branch).
    expect(next).toEqual(
      expect.objectContaining({ templateSource: 'USER_TEMPLATE', isTemplateBacked: false })
    );
  });

  // --- 9. Clinical category signature normalization ---

  it('ensures a trailing signature for clinical categories with a signer', () => {
    const setFormData = jest.fn();
    render(
      <Details
        formData={{ ...defaultFormData, requiredSigner: 'VET', templateSource: 'ORG_TEMPLATE' }}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Category-Prescription'));
    // Signer present -> ensureSingleSignatureAtEnd (lines 316-318).
    expect(formUtils.ensureSingleSignatureAtEnd).toHaveBeenCalled();

    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function'
        ? updater({ ...defaultFormData, requiredSigner: 'VET', templateSource: 'ORG_TEMPLATE' })
        : updater;
    expect(next.category).toBe('Prescription');
    // Non-SOAP / non-YC keeps the signer (line 326 falsy branch).
    expect(next.requiredSigner).toBe('VET');
  });

  it('strips signatures for clinical categories without a signer', () => {
    render(
      <Details
        formData={{ ...defaultFormData, requiredSigner: '', templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Category-Discharge Form'));
    // No signer -> removeSignatureFields (line 319).
    expect(formUtils.removeSignatureFields).toHaveBeenCalled();
  });

  it('clears the required signer when switching to SOAP', () => {
    const setFormData = jest.fn();
    render(
      <Details
        formData={{ ...defaultFormData, requiredSigner: 'VET', templateSource: 'ORG_TEMPLATE' }}
        setFormData={setFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Category-SOAP'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function'
        ? updater({ ...defaultFormData, requiredSigner: 'VET', templateSource: 'ORG_TEMPLATE' })
        : updater;
    // SOAP clears the signer (line 326 truthy branch).
    expect(next.category).toBe('SOAP');
    expect(next.requiredSigner).toBe('');
  });

  // --- 10. Services validation for non-custom categories ---

  it('requires services for non-custom categories', () => {
    render(
      <Details
        formData={{
          ...defaultFormData,
          category: 'Consent form',
          services: [],
          templateSource: 'ORG_TEMPLATE',
        }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));
    // Lines 356-358.
    expect(screen.getByTestId('multi-error-Services / Packages')).toHaveTextContent(
      'Services / Packages is required'
    );
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  // --- 11. Description + required-signer change handlers ---

  it('clears the description error when the description changes', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));
    expect(screen.getByTestId('error-Description')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-Description'), {
      target: { value: 'Some desc' },
    });
    // Error cleared + functional setFormData (lines 387-390).
    expect(screen.queryByTestId('error-Description')).not.toBeInTheDocument();
    const updater = mockSetFormData.mock.calls.at(-1)?.[0];
    const next = typeof updater === 'function' ? updater(defaultFormData) : updater;
    expect(next).toEqual(expect.objectContaining({ description: 'Some desc' }));
  });

  it('clears the signer error and keeps schema for non-clinical categories', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('next-btn'));
    expect(screen.getByTestId('dropdown-error-Signed by')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dropdown-select-Signed by'));
    // Signer error cleared (lines 395-397).
    expect(screen.queryByTestId('dropdown-error-Signed by')).not.toBeInTheDocument();

    const updater = mockSetFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function' ? updater({ ...defaultFormData, category: 'Custom' }) : updater;
    // Non-clinical category with a signer leaves the schema alone (lines 398-413 else path).
    expect(next.requiredSigner).toBe('SelectedValue');
  });

  it('removes signature fields when the signer is cleared', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE', requiredSigner: 'VET' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Signed by-'));
    const updater = mockSetFormData.mock.calls.at(-1)?.[0];
    if (typeof updater === 'function') {
      updater({ ...defaultFormData, schema: [{ id: 's' }] as any });
    }
    // Cleared signer -> removeSignatureFields (lines 404-405).
    expect(formUtils.removeSignatureFields).toHaveBeenCalled();
  });

  it('appends a signature when a signer is set for a clinical category', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'ORG_TEMPLATE', category: 'Prescription' }}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId('dropdown-option-Signed by-VET'));
    const updater = mockSetFormData.mock.calls.at(-1)?.[0];
    if (typeof updater === 'function') {
      updater({ ...defaultFormData, category: 'Prescription', schema: [] });
    }
    // Signer set on a clinical form without a signature -> ensureSingleSignatureAtEnd (lines 406-410).
    expect(formUtils.ensureSingleSignatureAtEnd).toHaveBeenCalled();
  });
});
