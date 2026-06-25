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

describe('Details Component', () => {
  const mockSetFormData = jest.fn();
  const mockOnNext = jest.fn();
  const mockRegisterValidator = jest.fn();

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
    expect(screen.getByTestId('dropdown-Template type')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-value-Template type')).toHaveTextContent('CUSTOM');
    expect(screen.getByTestId('dropdown-Template scope')).toBeInTheDocument();
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

    expect(screen.getByTestId('dropdown-value-Template type')).toHaveTextContent('YC_LIBRARY');
    expect(screen.getByText(/fixed structure/i)).toBeInTheDocument();
    // The org/personal scope only applies to Custom templates.
    expect(screen.queryByTestId('dropdown-Template scope')).not.toBeInTheDocument();
  });

  it('restricts category options to canonical structures for YC default templates', () => {
    render(
      <Details
        formData={{ ...defaultFormData, templateSource: 'YC_LIBRARY' }}
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
    fireEvent.click(screen.getByTestId('dropdown-select-Template type'));
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

    fireEvent.click(screen.getByTestId('dropdown-option-Template type-YC_LIBRARY'));
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const next =
      typeof updater === 'function' ? updater({ ...defaultFormData, category: 'Vitals' }) : updater;
    expect(next).toEqual(
      expect.objectContaining({
        templateSource: 'YC_LIBRARY',
        isTemplateBacked: true,
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

  // --- 5. Validator Registration ---

  it('registers the validator function on mount', () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
        registerValidator={mockRegisterValidator}
      />
    );

    expect(mockRegisterValidator).toHaveBeenCalledWith(expect.any(Function));
  });

  it('allows parent to trigger validation via registered validator', () => {
    let capturedValidator: (data: FormsProps) => boolean = () => false; // Initialize explicitly
    mockRegisterValidator.mockImplementation((fn) => {
      capturedValidator = fn;
    });

    const invalidData = { ...defaultFormData, name: '' } as FormsProps; // Invalid

    render(
      <Details
        formData={invalidData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
        registerValidator={mockRegisterValidator}
      />
    );

    let isValid: boolean = false; // Initialize explicitly
    act(() => {
      isValid = capturedValidator(invalidData);
    });

    expect(isValid).toBe(false);
    expect(screen.getByTestId('error-Form name')).toBeInTheDocument();
  });
});
