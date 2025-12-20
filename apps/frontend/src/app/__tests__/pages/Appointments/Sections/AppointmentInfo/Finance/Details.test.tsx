import React from "react";
import { render, screen } from "@testing-library/react";
import Details from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Finance/Details";
// Import the mocked array instance
import { DemoPayments } from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Finance/demo";

// --- Mocks ---

// 1. Mock the Data Source
// We return a specific array instance that we can mutate in tests (push/splice)
// rather than reassigning the import.
jest.mock(
  "../../../../../../pages/Appointments/Sections/AppointmentInfo/Finance/demo",
  () => ({
    DemoPayments: [],
  })
);

// 2. Mock Child Components
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <div className="accordion-title">{title}</div>
      <div className="accordion-content">{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text }: any) => <button>{text}</button>,
}));

describe("Finance Details Section", () => {
  const mockPaymentList = [
    {
      appointmentId: "APT-123",
      paymentId: "PAY-999",
      mode: "Credit Card",
      date: "2025-01-01",
      time: "10:00 AM",
      status: "Completed",
      amount: "150.00",
    },
    {
      appointmentId: "APT-456",
      paymentId: "PAY-888",
      mode: "Cash",
      date: "2025-02-15",
      time: "14:30",
      status: "Pending",
      amount: "50.50",
    },
  ];

  beforeEach(() => {
    // Reset the mock data array contents before each test
    // We modify the array in place to preserve the reference used by the component
    DemoPayments.length = 0;
  });

  // --- Section 1: Rendering & Structure ---

  it("should render the main title", () => {
    render(<Details />);
    expect(screen.getByText("Payment details")).toBeInTheDocument();
  });

  it("should render a list of accordions matching the data length", () => {
    // Populate mock data
    DemoPayments.push(...mockPaymentList);

    render(<Details />);

    // We expect 2 accordions based on mockPaymentList
    const accordions = screen.getAllByTestId(/accordion-PAY-/);
    expect(accordions).toHaveLength(2);
  });

  // --- Section 2: Data Mapping & Formatting ---

  it("should display correct payment details inside the accordion", () => {
    DemoPayments.push(mockPaymentList[0]);

    render(<Details />);

    // Check Appointment ID
    expect(screen.getByText("Appointent ID:")).toBeInTheDocument();
    expect(screen.getByText("APT-123")).toBeInTheDocument();

    // Check Payment ID (It appears twice: Title and Row)
    const paymentIds = screen.getAllByText("PAY-999");
    expect(paymentIds.length).toBeGreaterThanOrEqual(1);

    // Check Payment Method
    expect(screen.getByText("Payment method:")).toBeInTheDocument();
    expect(screen.getByText("Credit Card")).toBeInTheDocument();
  });

  it("should format date/time and amount correctly", () => {
    const customData = {
      ...mockPaymentList[0],
      date: "2025-12-31",
      time: "23:59",
      amount: "99.99",
    };
    DemoPayments.push(customData);

    render(<Details />);

    // Code does: {payment.date + payment.time} (direct concatenation based on source)
    expect(screen.getByText("2025-12-3123:59")).toBeInTheDocument();

    // Code does: ${payment.amount}
    expect(screen.getByText("$99.99")).toBeInTheDocument();
  });

  // --- Section 3: User Interactions (Buttons) ---

  it("should render action buttons for each invoice", () => {
    DemoPayments.push(...mockPaymentList);

    render(<Details />);

    // "Print invoice" and "Email invoice" should appear twice (once per item)
    const printButtons = screen.getAllByText("Print invoice");
    const emailButtons = screen.getAllByText("Email invoice");

    expect(printButtons).toHaveLength(2);
    expect(emailButtons).toHaveLength(2);
  });

  // --- Section 4: Edge Cases & Empty States ---

  it("should render gracefully when payment list is empty", () => {
    // Array is already cleared in beforeEach
    render(<Details />);

    // Title still exists
    expect(screen.getByText("Payment details")).toBeInTheDocument();
    // No accordions
    expect(screen.queryByTestId(/accordion-/)).not.toBeInTheDocument();
  });

  it("should handle missing optional fields gracefully if they can occur (Type safety check)", () => {
    // Suppress console error because rendering NaN (undefined + undefined) triggers a React warning
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Even though Type defines them as strings, runtime data might be partial if API fails.
    const partialData = [
      {
        appointmentId: "APT-PARTIAL",
        paymentId: "PAY-PARTIAL",
        amount: "0",
        // Missing others (date, time, etc.)
      },
    ] as any;

    DemoPayments.push(...partialData);

    render(<Details />);

    expect(screen.getByText("APT-PARTIAL")).toBeInTheDocument();

    // Ensure the component rendered the title despite partial data
    expect(screen.getByText("Payment details")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
