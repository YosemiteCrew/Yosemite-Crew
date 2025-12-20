import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceInfo from "../../../../pages/Finance/Sections/InvoiceInfo";
import { Invoice } from "@yosemite-crew/types";

// --- Mocks ---

// 1. Mock Modal wrapper
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal-container">{children}</div> : null,
}));

// 2. Mock Accordion to inspect props passed to it
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid={`accordion-${title.replace(" ", "-")}`}>
      <h3>{title}</h3>
      {/* Render key data to verify prop passing */}
      <span data-testid={`data-${title.replace(" ", "-")}`}>
        {JSON.stringify(data)}
      </span>
    </div>
  ),
}));

// 3. Mock Buttons
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text }: any) => <button data-testid="btn-primary">{text}</button>,
  Secondary: ({ text }: any) => (
    <button data-testid="btn-secondary">{text}</button>
  ),
}));

// --- Test Data ---

const mockInvoice: Invoice = {
  id: "inv-123",
  total: "100.00",
  subtotal: "90.00",
  tax: "10.00",
  date: "2025-01-01",
  time: "10:00 AM",
  status: "paid",
  metadata: {
    pet: "Buddy",
    parent: "John Doe",
    service: "Grooming",
    appointmentId: "apt-1",
    petImage: "url",
  },
} as unknown as Invoice;

describe("InvoiceInfo Component", () => {
  const mockSetShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering & Structure ---

  it("renders the modal with correct header and buttons when showModal is true", () => {
    render(
      <InvoiceInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInvoice={mockInvoice}
      />
    );

    expect(screen.getByTestId("modal-container")).toBeInTheDocument();
    expect(screen.getByText("View Invoice")).toBeInTheDocument();
    expect(screen.getByTestId("btn-primary")).toHaveTextContent(
      "Mail Payment link"
    );
    expect(screen.getByTestId("btn-secondary")).toHaveTextContent("Print");
  });

  it("does not render when showModal is false", () => {
    render(
      <InvoiceInfo
        showModal={false}
        setShowModal={mockSetShowModal}
        activeInvoice={mockInvoice}
      />
    );

    expect(screen.queryByTestId("modal-container")).not.toBeInTheDocument();
  });

  // --- Section 2: Data Passing (Props to Children) ---

  it("passes correct invoice metadata to the 'Appointments details' accordion", () => {
    render(
      <InvoiceInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInvoice={mockInvoice}
      />
    );

    const accordion = screen.getByTestId("data-Appointments-details");
    const data = JSON.parse(accordion.textContent || "{}");

    expect(data).toEqual(expect.objectContaining({ pet: "Buddy" }));
  });

  it("passes correct invoice details to the 'Payment details' accordion", () => {
    render(
      <InvoiceInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInvoice={mockInvoice}
      />
    );

    const accordion = screen.getByTestId("data-Payment-details");
    const data = JSON.parse(accordion.textContent || "{}");

    expect(data).toEqual(expect.objectContaining({ total: "100.00" }));
  });

  it("handles null activeInvoice safely (passes empty array/object)", () => {
    render(
      <InvoiceInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInvoice={null}
      />
    );

    // Verify Appointments details gets empty array/object
    const aptAccordion = screen.getByTestId("data-Appointments-details");
    expect(JSON.parse(aptAccordion.textContent || "[]")).toEqual([]);

    // Verify Payment details gets empty array/object
    const payAccordion = screen.getByTestId("data-Payment-details");
    expect(JSON.parse(payAccordion.textContent || "[]")).toEqual([]);
  });

  // --- Section 3: Interactions ---

  it("calls setShowModal(false) when the close icon is clicked", () => {
    render(
      <InvoiceInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeInvoice={mockInvoice}
      />
    );

    // The component has two icons: one opacity-0 (spacer) and one cursor-pointer (close button)
    // We target the second SVG which acts as the close button
    const svgs = document.querySelectorAll("svg");
    const closeBtn = svgs[1];

    fireEvent.click(closeBtn);

    expect(mockSetShowModal).toHaveBeenCalledTimes(1);
    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
