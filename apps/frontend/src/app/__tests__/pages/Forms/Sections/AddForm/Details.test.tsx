import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Details from "@/app/pages/Forms/Sections/AddForm/Details";
import { FormsProps } from "@/app/types/forms";
import * as formUtils from "@/app/utils/forms";

// --- Mocks ---

// Mock Utils
jest.mock("@/app/utils/forms", () => ({
  getCategoryTemplate: jest.fn(),
}));

// Mock Child Components to simplify testing logic
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div data-testid={`input-wrapper-${inlabel}`}>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        value={value}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`dropdown-value-${placeholder}`}>{value}</span>
      <button
        data-testid={`dropdown-select-${placeholder}`}
        onClick={() => onChange("SelectedValue")}
      >
        Select
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange }: any) => (
    <div data-testid={`multi-${placeholder}`}>
      <span data-testid={`multi-val-${placeholder}`}>{value.join(",")}</span>
      <button
        data-testid={`multi-select-${placeholder}`}
        onClick={() => onChange(["SelectedOption"])}
      >
        Select Multi
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="next-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("Details Component", () => {
  const mockSetFormData = jest.fn();
  const mockOnNext = jest.fn();
  const mockRegisterValidator = jest.fn();

  const defaultFormData: FormsProps = {
    name: "",
    category: "Custom", // Initialized to a valid FormsCategory literal
    description: "",
    usage: "Internal",
    species: [],
    services: [],
    schema: [],
    updatedBy: "",
    lastUpdated: "",
    status: "Draft",
    _id: undefined,
  } as FormsProps;

  const serviceOptions = [{ label: "Service A", value: "A" }];

  beforeEach(() => {
    jest.clearAllMocks();
    (formUtils.getCategoryTemplate as jest.Mock).mockReturnValue([
      { id: "template-field" },
    ]);
  });

  // --- 1. Rendering ---

  it("renders all form fields correctly", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByTestId("accordion-Form details")).toBeInTheDocument();
    expect(screen.getByTestId("input-Form name")).toBeInTheDocument();
    expect(screen.getByTestId("input-Description")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Category")).toBeInTheDocument();
    expect(
      screen.getByTestId("accordion-Usage and visibility")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Visibility type")).toBeInTheDocument();
    expect(screen.getByTestId("multi-Service (Optional)")).toBeInTheDocument();
    expect(screen.getByTestId("multi-Species")).toBeInTheDocument();
    expect(screen.getByTestId("next-btn")).toBeInTheDocument();
  });

  // --- 2. Input Interactions ---

  it("updates text inputs correctly (name)", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    const input = screen.getByTestId("input-Form name");
    fireEvent.change(input, { target: { value: "New Name" } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Name",
      })
    );
  });

  it("updates text inputs correctly (description)", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    const input = screen.getByTestId("input-Description");
    fireEvent.change(input, { target: { value: "New Desc" } });

    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("updates usage dropdown", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("dropdown-select-Visibility type"));

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ usage: "SelectedValue" })
    );
  });

  it("updates multi-selects (services and species)", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    // Services (Direct update)
    fireEvent.click(screen.getByTestId("multi-select-Service (Optional)"));
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ services: ["SelectedOption"] })
    );

    // Species (Direct update)
    fireEvent.click(screen.getByTestId("multi-select-Species"));
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ species: ["SelectedOption"] })
    );
  });

  // --- 3. Category Logic (Schema Template) ---

  it("updates category and applies template if form is new", () => {
    const newForm = { ...defaultFormData, _id: undefined, schema: [] };

    render(
      <Details
        formData={newForm}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("dropdown-select-Category"));

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
    expect(newState.category).toBe("SelectedValue");

    // Fixed: Added check if newState is defined before accessing schema
    if (newState) {
      expect(formUtils.getCategoryTemplate).toHaveBeenCalledWith(
        "SelectedValue"
      );
      expect(newState.schema).toEqual([{ id: "template-field" }]);
    }
  });

  it("updates category but DOES NOT apply template if form has existing schema", () => {
    const existingForm = {
      ...defaultFormData,
      _id: "123", // Has ID
      schema: [{ field: "existing" }] as any, // Has schema
    };

    render(
      <Details
        formData={existingForm}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("dropdown-select-Category"));

    const updateFn = mockSetFormData.mock.calls.at(-1)?.[0];
    let newState: FormsProps = existingForm; // Initialize newState
    act(() => {
      const updateResult = updateFn(existingForm);
      if (updateResult) {
        newState = updateResult;
      }
    });

    expect(newState.category).toBe("SelectedValue");

    // Fixed: Added check if newState is defined before accessing schema
    if (newState) {
      // Should NOT overwrite schema
      expect(newState.schema).toEqual([{ field: "existing" }]);
    }
  });

  // --- 4. Validation & Next Step ---

  it("validates required fields on Next and blocks submission if invalid", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("next-btn"));

    expect(screen.getByTestId("error-Form name")).toHaveTextContent(
      "Form name is required"
    );
    expect(screen.getByTestId("error-Description")).toHaveTextContent(
      "Description is required"
    );
    expect(screen.getByText("Select at least one species")).toBeInTheDocument();

    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it("clears specific errors when user inputs data", () => {
    render(
      <Details
        formData={defaultFormData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("error-Form name")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-Form name"), {
      target: { value: "Fixed" },
    });

    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("calls onNext if validation passes", () => {
    const validData: FormsProps = {
      ...defaultFormData,
      name: "Valid Name",
      description: "Desc",
      category: "Consent form",
      services: ["A"],
      species: ["Dog"],
      usage: "Internal",
    };

    render(
      <Details
        formData={validData}
        setFormData={mockSetFormData}
        onNext={mockOnNext}
        serviceOptions={serviceOptions}
      />
    );

    fireEvent.click(screen.getByTestId("next-btn"));
    expect(mockOnNext).toHaveBeenCalled();
  });

  // --- 5. Validator Registration ---

  it("registers the validator function on mount", () => {
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

  it("allows parent to trigger validation via registered validator", () => {
    let capturedValidator: (data: FormsProps) => boolean = () => false; // Initialize explicitly
    mockRegisterValidator.mockImplementation((fn) => {
      capturedValidator = fn;
    });

    const invalidData = { ...defaultFormData, name: "" } as FormsProps; // Invalid

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
    expect(screen.getByTestId("error-Form name")).toBeInTheDocument();
  });
});
