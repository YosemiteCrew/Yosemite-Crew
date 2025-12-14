import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Plan from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Plan";
// Fixed: Corrected import case to 'FormDataProps'
import { FormDataProps } from "@/app/pages/Appointments/Sections/AppointmentInfo";

// --- Mocks ---

// Mock Data
jest.mock("@/app/pages/Organization/demo", () => ({
  serviceOptions: [
    { key: "Service A", value: "Service A" },
    { key: "Service B", value: "Service B" },
    { key: "Medication X", value: "Medication X" },
  ],
  allServices: [
    { name: "Service A", charge: "100", maxDiscount: "20" },
    { name: "Service B", charge: "50", maxDiscount: "10" },
    { name: "Medication X", charge: "20", maxDiscount: "0" },
  ],
}));

// Mock Child Components
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, options }: any) => (
    <div data-testid={`search-dropdown-${placeholder}`}>
      <input placeholder={placeholder} readOnly />
      <ul>
        {options.map((opt: any) => (
          <li
            key={opt.key}
            data-testid={`option-${opt.key}`}
            onClick={() => onSelect(opt.key)}
          >
            {opt.value}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

jest.mock(
  "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/ServiceCard",
  () => ({
    __esModule: true,
    default: ({ service }: any) => (
      <div data-testid={`service-card-${service.name}`}>
        {service.name} - ${service.charge}
      </div>
    ),
  })
);

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <div data-testid="form-desc">
      <label>{inlabel}</label>
      <textarea data-testid="notes-input" value={value} onChange={onChange} />
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button>{text}</button>,
}));

describe("Plan Component", () => {
  const mockSetFormData = jest.fn();
  const mockActiveAppointment = {} as any;

  const defaultFormData: FormDataProps = {
    services: [],
    suggestions: [],
    notes: "",
    tax: "0",
    subtotal: "0",
    total: "0",
    problems: [],
    medications: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders all sections correctly", () => {
    render(
      <Plan
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    expect(screen.getByText("Treatment/Plan")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Services")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Medications")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Suggestions")).toBeInTheDocument();

    expect(screen.getByText("SubTotal:")).toBeInTheDocument();
    expect(screen.getByText("Tax:")).toBeInTheDocument();
    expect(screen.getByText("Estimatted total:")).toBeInTheDocument();
    expect(screen.getByTestId("form-desc")).toBeInTheDocument();
  });

  it("renders selected services in the list", () => {
    const formDataWithServices = {
      ...defaultFormData,
      services: [{ name: "Service A", charge: "100" }],
    } as any;

    render(
      <Plan
        formData={formDataWithServices}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    expect(screen.getByTestId("service-card-Service A")).toBeInTheDocument();
  });

  // --- 2. Interactions & Filtering ---

  it("adds a service when selected from dropdown", () => {
    render(
      <Plan
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    // Clear the initial call from useEffect on mount
    mockSetFormData.mockClear();

    // Select "Service A"
    const option = screen.getAllByTestId("option-Service A")[0];
    fireEvent.click(option);

    expect(mockSetFormData).toHaveBeenCalled();

    // Find the call that actually updates services (not the useEffect one if it ran again)
    const calls = mockSetFormData.mock.calls;
    let servicesUpdateFound = false;

    for (const call of calls) {
      const updateArg = call[0];
      if (typeof updateArg === "function") {
        const newState = updateArg(defaultFormData);
        // Check if this update added a service
        if (newState.services && newState.services.length === 1) {
          expect(newState.services[0]).toEqual(
            expect.objectContaining({
              name: "Service A",
              charge: "100",
              discount: "",
            })
          );
          servicesUpdateFound = true;
          break;
        }
      }
    }

    expect(servicesUpdateFound).toBe(true);
  });

  it("adds a suggestion when selected from suggestions dropdown", () => {
    render(
      <Plan
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    mockSetFormData.mockClear();

    // Find option in Suggestions accordion
    const suggestionsContainer = screen.getByTestId("accordion-Suggestions");
    const optionInSuggestions =
      within(suggestionsContainer).getByTestId("option-Service B");

    fireEvent.click(optionInSuggestions);

    expect(mockSetFormData).toHaveBeenCalled();

    // Find the specific call that added a suggestion
    const calls = mockSetFormData.mock.calls;
    let suggestionsUpdateFound = false;

    for (const call of calls) {
      const updateArg = call[0];
      if (typeof updateArg === "function") {
        const newState = updateArg(defaultFormData);
        if (newState.suggestions && newState.suggestions.length === 1) {
          expect(newState.suggestions[0].name).toBe("Service B");
          suggestionsUpdateFound = true;
          break;
        }
      }
    }

    expect(suggestionsUpdateFound).toBe(true);
  });

  it("filters out already selected services from options", () => {
    const formDataWithSelection = {
      ...defaultFormData,
      services: [{ name: "Service A" }],
    } as any;

    render(
      <Plan
        formData={formDataWithSelection}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    const planDropdown = screen.getByTestId("search-dropdown-Search plan");
    expect(
      within(planDropdown).queryByTestId("option-Service A")
    ).not.toBeInTheDocument();
    expect(
      within(planDropdown).getByTestId("option-Service B")
    ).toBeInTheDocument();
  });

  it("updates notes", () => {
    render(
      <Plan
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    mockSetFormData.mockClear();

    const textarea = screen.getByTestId("notes-input");
    fireEvent.change(textarea, { target: { value: "New Notes" } });

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "New Notes" })
    );
  });

  // --- 3. Calculations (useEffect) ---

  it("calculates totals correctly in useEffect", () => {
    const formDataCalc = {
      ...defaultFormData,
      tax: "10",
      services: [
        { name: "S1", charge: "100", maxDiscount: "20", discount: "10" }, // Net: 90
        { name: "S2", charge: "50", maxDiscount: "5", discount: "10" }, // Net: 45
        { name: "S3", charge: "0", maxDiscount: "0", discount: "" }, // Net: 0
      ],
    } as any;

    render(
      <Plan
        formData={formDataCalc}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    expect(mockSetFormData).toHaveBeenCalled();

    // Find the call updating subtotal
    const calls = mockSetFormData.mock.calls;
    let calcUpdateFound = false;

    for (const call of calls) {
      const updateArg = call[0];
      if (typeof updateArg === "function") {
        const newState = updateArg(formDataCalc);
        if (newState.subtotal === "135.00") {
          expect(newState.total).toBe("125.00");
          calcUpdateFound = true;
          break;
        }
      }
    }

    expect(calcUpdateFound).toBe(true);
  });

  it("handles empty values gracefully during calculation", () => {
    const formDataCalc = {
      ...defaultFormData,
      tax: "",
      services: [{ name: "S1", charge: "", maxDiscount: "", discount: "" }],
    } as any;

    render(
      <Plan
        formData={formDataCalc}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    const calls = mockSetFormData.mock.calls;
    let calcUpdateFound = false;

    for (const call of calls) {
      const updateArg = call[0];
      if (typeof updateArg === "function") {
        const newState = updateArg(formDataCalc);
        if (newState.subtotal === "0.00") {
          expect(newState.total).toBe("0.00");
          calcUpdateFound = true;
          break;
        }
      }
    }
    expect(calcUpdateFound).toBe(true);
  });
});
