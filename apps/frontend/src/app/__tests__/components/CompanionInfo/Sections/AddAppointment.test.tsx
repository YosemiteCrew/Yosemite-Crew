import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AddAppointment, {
  SpecialityOptions,
  LeadOptions,
  SupportOptions,
} from "@/app/components/CompanionInfo/Sections/AddAppointment";

// --- Mocks ---

jest.mock("@/app/components/Accordion/Accordion", () => {
  return function MockAccordion({ title, children }: any) {
    return (
      <div data-testid="accordion">
        <h3>{title}</h3>
        {children}
      </div>
    );
  };
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return function MockDropdown({
    placeholder,
    value,
    onChange,
    options,
    error,
  }: any) {
    return (
      <div data-testid={`dropdown-${placeholder.toLowerCase()}`}>
        <label>{placeholder}</label>
        <select
          data-testid={`select-${placeholder.toLowerCase()}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          {options.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && (
          <span data-testid={`error-${placeholder.toLowerCase()}`}>
            {error}
          </span>
        )}
      </div>
    );
  };
});

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => {
  return function MockMultiSelect({
    placeholder,
    value,
    onChange,
    options,
  }: any) {
    return (
      <div data-testid={`multiselect-${placeholder.toLowerCase()}`}>
        <label>{placeholder}</label>
        <select
          multiple
          data-testid={`select-multi-${placeholder.toLowerCase()}`}
          value={value}
          onChange={(e) => {
            const selected = Array.from(
              e.target.selectedOptions,
              (option: any) => option.value
            );
            onChange(selected);
          }}
        >
          {options.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  };
});

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => {
  return function MockFormDesc({ inlabel, value, onChange }: any) {
    return (
      <div>
        <label>{inlabel}</label>
        <textarea
          data-testid="desc-concern"
          value={value}
          onChange={onChange}
        />
      </div>
    );
  };
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button>{text}</button>,
}));

describe("AddAppointment Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Structure ---

  it("renders the main title", () => {
    render(<AddAppointment />);
    expect(screen.getByText("Add appointment")).toBeInTheDocument();
  });

  it("renders all accordion sections", () => {
    render(<AddAppointment />);
    expect(screen.getByText("Appointment details")).toBeInTheDocument();
    expect(screen.getByText("Select date & time")).toBeInTheDocument();
    expect(screen.getByText("Staff details")).toBeInTheDocument();
    expect(screen.getByText("Billable services")).toBeInTheDocument();
  });

  it("renders the book button", () => {
    render(<AddAppointment />);
    expect(screen.getByText("Book appointment")).toBeInTheDocument();
  });

  // --- 2. Form Interactions (State Updates) ---

  it("updates Speciality dropdown state", () => {
    render(<AddAppointment />);

    const select = screen.getByTestId("select-speciality");
    fireEvent.change(select, { target: { value: SpecialityOptions[0] } });

    expect(select).toHaveValue(SpecialityOptions[0]);
  });

  it("updates Service dropdown state", () => {
    render(<AddAppointment />);

    const select = screen.getByTestId("select-service");
    fireEvent.change(select, { target: { value: SpecialityOptions[1] } });

    expect(select).toHaveValue(SpecialityOptions[1]);
  });

  it("updates Lead dropdown state", () => {
    render(<AddAppointment />);

    const select = screen.getByTestId("select-lead");
    fireEvent.change(select, { target: { value: LeadOptions[0] } });

    expect(select).toHaveValue(LeadOptions[0]);
  });

  it("updates Support multi-select state", () => {
    render(<AddAppointment />);

    // FIX: Removed 'as HTMLSelectElement' to satisfy SonarQube S4325
    const select = screen.getByTestId("select-multi-support");

    // We cast specifically here to access the .options property safely
    const options = Array.from((select as HTMLSelectElement).options);
    options[0].selected = true;
    options[1].selected = true;

    fireEvent.change(select);

    expect(select).toHaveValue([SupportOptions[0], SupportOptions[1]]);
  });

  it("updates Concern description state", () => {
    render(<AddAppointment />);

    const textarea = screen.getByTestId("desc-concern");
    fireEvent.change(textarea, { target: { value: "My pet is sick" } });

    expect(textarea).toHaveValue("My pet is sick");
  });

  // --- 3. Validation / Error Handling ---

  it("renders errors passed to dropdowns (if set in state)", () => {
    render(<AddAppointment />);
    expect(screen.getByTestId("dropdown-speciality")).toBeInTheDocument();
  });
});
