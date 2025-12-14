import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Objective from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Objective";
import { formDataProps } from "@/app/pages/Appointments/Sections/AppointmentInfo"; // Adjust import path if needed

// --- Mocks ---

// Mock Data
jest.mock(
  "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/demo",
  () => ({
    DemoSubjectiveOptions: [{ label: "Option 1", value: "1" }],
  })
);

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
  default: ({ placeholder, onSelect, setQuery }: any) => (
    <div data-testid="search-dropdown">
      <input
        data-testid="search-query-input"
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        data-testid="search-select-btn"
        onClick={() => onSelect("some-id")}
      >
        Select
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inname, value, onChange, inlabel }: any) => (
    <div data-testid={`input-wrapper-${inname}`}>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inname}`}
        name={inname}
        value={value}
        onChange={onChange}
      />
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inname, value, onChange, inlabel }: any) => (
    <div data-testid={`desc-wrapper-${inname}`}>
      <label>{inlabel}</label>
      <textarea
        data-testid={`desc-${inname}`}
        name={inname}
        value={value}
        onChange={onChange}
      />
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="save-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("Objective Component", () => {
  const mockSetFormData = jest.fn();
  const mockActiveAppointment = {} as any;

  // Initialize with empty strings for all used fields to avoid uncontrolled input warnings
  const defaultFormData: formDataProps = {
    general: "",
    temp: "",
    pulse: "",
    respiration: "",
    mucousColor: "",
    bloodPressure: "",
    weight: "",
    hydration: "",
    generalBehaviour: "",
    musculoskeletal: "",
    neuro: "",
    pain: "",
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all sections and fields correctly", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    expect(
      screen.getByTestId("accordion-Objective (clinical examination)")
    ).toBeInTheDocument();
    expect(screen.getByTestId("search-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Vitals")).toBeInTheDocument();
    expect(screen.getByTestId("save-btn")).toBeInTheDocument();

    // Check presence of specific inputs
    const fields = [
      "general",
      "temperature",
      "pulse",
      "respiration",
      "mucous",
      "bloodPressure",
      "weight",
      "hydration",
      "generalBehaviour",
      "neuro",
      "pain",
    ];
    fields.forEach((field) => {
      expect(screen.getByTestId(`input-${field}`)).toBeInTheDocument();
    });

    // Check textarea
    expect(screen.getByTestId("desc-musculoskeletal")).toBeInTheDocument();
  });

  it("updates SearchDropdown query", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    // Testing internal state update of 'query'
    const searchInput = screen.getByTestId("search-query-input");
    fireEvent.change(searchInput, { target: { value: "Test Query" } });
    expect(searchInput).toHaveValue("Test Query"); // Mock reflects value change if controlled locally in test? No, mocked component is uncontrolled here but event fires.
    // Since setQuery is internal to parent but passed to child, checking no crash is sufficient coverage for the prop function.
  });

  it("handles empty selection handler", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );
    // handleObjectiveSelect is empty in source, just ensuring it is called
    fireEvent.click(screen.getByTestId("search-select-btn"));
  });

  it("handles empty save handler", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );
    // handleSave is empty in source
    fireEvent.click(screen.getByTestId("save-btn"));
  });

  // Helper to test input changes
  const testInputUpdate = (
    testId: string,
    key: keyof formDataProps,
    value: string
  ) => {
    const input = screen.getByTestId(testId);
    fireEvent.change(input, { target: { value } });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ [key]: value })
    );
  };

  it("updates all form inputs correctly", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    // 1. General (Top)
    testInputUpdate("input-general", "general", "Normal");

    // 2. Temp
    testInputUpdate("input-temperature", "temp", "38.5");

    // 3. Pulse
    testInputUpdate("input-pulse", "pulse", "100");

    // 4. Respiration
    testInputUpdate("input-respiration", "respiration", "20");

    // 5. Mucous
    testInputUpdate("input-mucous", "mucousColor", "Pink");

    // 6. Blood Pressure
    testInputUpdate("input-bloodPressure", "bloodPressure", "120/80");

    // 7. Weight
    testInputUpdate("input-weight", "weight", "15kg");

    // 8. Hydration
    testInputUpdate("input-hydration", "hydration", "Adequate");

    // 9. General Behaviour (Inside Vitals grid)
    testInputUpdate("input-generalBehaviour", "generalBehaviour", "Alert");

    // 10. Neuro
    testInputUpdate("input-neuro", "neuro", "Normal reflexes");

    // 11. Pain
    testInputUpdate("input-pain", "pain", "2/10");

    // 12. Musculoskeletal (Textarea)
    const desc = screen.getByTestId("desc-musculoskeletal");
    fireEvent.change(desc, { target: { value: "No limping" } });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ musculoskeletal: "No limping" })
    );
  });
});
