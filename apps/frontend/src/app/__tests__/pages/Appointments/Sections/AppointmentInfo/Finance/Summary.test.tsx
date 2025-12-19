import React from "react";
import { render, screen } from "@testing-library/react";
import Summary from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Finance/Summary";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

// Mock EditableAccordion to inspect the 'data' prop passed to it
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid="editable-accordion">
      <div>Title: {title}</div>
      <div data-testid="accordion-data">{JSON.stringify(data)}</div>
    </div>
  ),
}));

// Mock Primary Button
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid="pay-button">
      {text}
    </a>
  ),
}));

describe("Finance Summary Section", () => {
  const mockSetFormData = jest.fn();

  // Mock Date objects (Using strings or objects depending on what the type actually holds at runtime)
  // Assuming the type definition implies Date objects, but the component falls back to "" if null.
  const mockActiveAppointment: Appointment = {
    id: "appt-1",
    concern: "Fever",
    appointmentType: {
      id: "s1",
      name: "Checkup",
      speciality: { id: "sp1", name: "Gen" },
    },
    appointmentDate: new Date("2025-01-01"),
    startTime: new Date("2025-01-01T10:00:00Z"),
    lead: { id: "l1", name: "Dr. Smith" },
    status: "Confirmed",
  } as unknown as Appointment;

  const mockFormData = {
    subTotal: "100.00",
    tax: "10.00",
    total: "110.00",
  };

  const defaultProps = {
    activeAppointment: mockActiveAppointment,
    formData: mockFormData as any,
    setFormData: mockSetFormData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering & Structure ---

  it("should render the Summary title and layout", () => {
    render(<Summary {...defaultProps} />);

    expect(screen.getByText("Summary")).toBeInTheDocument();
    // "Pay" header inside the finance box
    const headers = screen.getAllByText("Pay");
    expect(headers.length).toBeGreaterThan(0);

    // Stripe Image
    expect(screen.getByAltText("Powered by stripe")).toBeInTheDocument();
  });

  // --- Section 2: Data Mapping (useMemo Logic) ---

  it("should correctly map activeAppointment data to Accordion props", () => {
    render(<Summary {...defaultProps} />);

    const accordionDataEl = screen.getByTestId("accordion-data");
    const data = JSON.parse(accordionDataEl.textContent || "{}");

    expect(data).toEqual(
      expect.objectContaining({
        concern: "Fever",
        service: "Checkup",
        lead: "Dr. Smith",
        status: "Confirmed",
      })
    );
    // Date checks usually result in ISO strings when JSON.stringified
    expect(data.date).toBeDefined();
    expect(data.time).toBeDefined();
  });

  // --- Section 3: Financial Data Display ---

  it("should display financial totals from formData", () => {
    render(<Summary {...defaultProps} />);

    // Labels
    expect(screen.getByText("SubTotal:")).toBeInTheDocument();
    expect(screen.getByText("Tax:")).toBeInTheDocument();
    expect(screen.getByText("Estimatted total:")).toBeInTheDocument();

    // Values
    expect(screen.getByText("$100.00")).toBeInTheDocument(); // Subtotal
    expect(screen.getByText("$10.00")).toBeInTheDocument(); // Tax
    expect(screen.getByText("$110.00")).toBeInTheDocument(); // Total
  });

  it("should render the Pay button", () => {
    render(<Summary {...defaultProps} />);
    const btn = screen.getByTestId("pay-button");
    expect(btn).toHaveTextContent("Pay");
    expect(btn).toHaveAttribute("href", "#");
  });

  // --- Section 4: Edge Cases & Null Handling ---

  it("should handle missing optional fields in activeAppointment gracefully (fallbacks)", () => {
    const emptyAppointment = {
      ...mockActiveAppointment,
      concern: undefined,
      appointmentType: undefined, // .name -> undefined
      appointmentDate: undefined,
      startTime: undefined,
      lead: undefined, // .name -> undefined
      status: undefined,
    } as unknown as Appointment;

    render(<Summary {...defaultProps} activeAppointment={emptyAppointment} />);

    const accordionDataEl = screen.getByTestId("accordion-data");
    const data = JSON.parse(accordionDataEl.textContent || "{}");

    // Expect empty strings due to `?? ""` fallback in source
    expect(data.concern).toBe("");
    expect(data.service).toBe("");
    expect(data.lead).toBe("");
    expect(data.status).toBe("");
    expect(data.date).toBe("");
    expect(data.time).toBe("");
  });

  it("should handle missing financial data gracefully (defaults)", () => {
    const emptyFormData = {
      subTotal: "100.00",
      // tax and total missing
    } as any;

    render(<Summary {...defaultProps} formData={emptyFormData} />);

    // Logic: ${formData.tax || "0.00"}
    // Since tax is undefined, it should render "$0.00"
    const zeros = screen.getAllByText("$0.00");
    // Should be at least 2 (one for Tax, one for Total)
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
