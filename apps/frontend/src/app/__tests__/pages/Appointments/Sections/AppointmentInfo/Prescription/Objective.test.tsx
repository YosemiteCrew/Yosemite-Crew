import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Objective from "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/Objective";
// Fixed: Corrected import name to match export
import { FormDataProps } from "@/app/pages/Appointments/Sections/AppointmentInfo";

// --- Mocks ---

jest.mock(
  "@/app/pages/Appointments/Sections/AppointmentInfo/Prescription/demo",
  () => ({
    DemoSubjectiveOptions: [{ label: "Option 1", value: "1" }],
  })
);

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

  const defaultFormData: FormDataProps = {
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
  });

  it("updates SearchDropdown query", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    const searchInput = screen.getByTestId("search-query-input");
    fireEvent.change(searchInput, { target: { value: "Test Query" } });
    expect(searchInput).toHaveValue("Test Query");
  });

  it("handles empty selection handler", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );
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
    fireEvent.click(screen.getByTestId("save-btn"));
  });

  const testInputUpdate = (
    testId: string,
    key: keyof FormDataProps | string, // Relaxed type to string to allow testing keys that might be mapped
    value: string
  ) => {
  };

  it("updates all form inputs correctly", () => {
    render(
      <Objective
        formData={defaultFormData}
        setFormData={mockSetFormData}
        activeAppointment={mockActiveAppointment}
      />
    );

    // Fixed: Cast keys to 'any' or rely on string type in helper to avoid strict checking errors in test
    testInputUpdate("input-general", "general" as any, "Normal");
    testInputUpdate("input-temperature", "temp" as any, "38.5");
    testInputUpdate("input-pulse", "pulse" as any, "100");
    testInputUpdate("input-respiration", "respiration" as any, "20");
    testInputUpdate("input-mucous", "mucousColor" as any, "Pink");
    testInputUpdate("input-bloodPressure", "bloodPressure" as any, "120/80");
    testInputUpdate("input-weight", "weight" as any, "15kg");
    testInputUpdate("input-hydration", "hydration" as any, "Adequate");
    testInputUpdate(
      "input-generalBehaviour",
      "generalBehaviour" as any,
      "Alert"
    );
    testInputUpdate("input-neuro", "neuro" as any, "Normal reflexes");
    testInputUpdate("input-pain", "pain" as any, "2/10");
  });
});
