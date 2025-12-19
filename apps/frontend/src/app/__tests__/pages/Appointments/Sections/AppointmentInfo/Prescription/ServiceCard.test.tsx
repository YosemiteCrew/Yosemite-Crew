import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
// Import Path: Go up 6 levels to 'src/app', then down to 'pages'
import ServiceCard from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/ServiceCard";
// We cast to any for the ServiceEdit type import if strictly needed,
// but usually adding the missing props fixes the assignment error.

// --- Mocks ---

// Mock Accordion to expose the delete action and render content
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children, onDeleteClick, showDeleteIcon }: any) => (
    <div data-testid={`accordion-${title}`}>
      <div className="content">{children}</div>
      {showDeleteIcon && (
        <button data-testid="delete-btn" onClick={onDeleteClick}>
          Delete
        </button>
      )}
    </div>
  ),
}));

// Mock FormInput to allow easy interaction
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel }: any) => (
    <input data-testid={`input-${inlabel}`} value={value} onChange={onChange} />
  ),
}));

describe("ServiceCard Component", () => {
  // --- Test Data ---
  // FIXED: Added missing properties 'id', 'organisationId', and 'isActive' to satisfy ServiceEdit type
  const mockService = {
    id: "srv-123",
    organisationId: "org-1",
    isActive: true,
    name: "Consultation",
    description: "General Checkup",
    durationMinutes: 30,
    cost: 50,
    discount: "10",
  };

  const mockSetFormData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering (Edit Mode - Default) ---

  it("renders service details correctly in Edit mode (default)", () => {
    render(<ServiceCard service={mockService} setFormData={mockSetFormData} />);

    expect(screen.getByText("Name:")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();

    expect(screen.getByText("Description:")).toBeInTheDocument();
    expect(screen.getByText("General Checkup")).toBeInTheDocument();

    expect(screen.getByText("Duration:")).toBeInTheDocument();
    expect(screen.getByText("30 mins")).toBeInTheDocument();

    expect(screen.getByText("Charges:")).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();

    // Verify Input exists (Edit mode)
    expect(screen.getByTestId("input-Discount (%)")).toHaveValue("10");

    // Verify Delete button exists (Edit mode)
    expect(screen.getByTestId("delete-btn")).toBeInTheDocument();
  });

  // --- Section 2: Rendering (View Mode) ---

  it("renders static text instead of input in View mode (edit=false)", () => {
    render(
      <ServiceCard
        service={mockService}
        setFormData={mockSetFormData}
        edit={false}
      />
    );

    // Input should be absent
    expect(screen.queryByTestId("input-Discount (%)")).not.toBeInTheDocument();

    // Static text should be present
    expect(screen.getByText("Discount (%):")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();

    // Delete button should be absent
    expect(screen.queryByTestId("delete-btn")).not.toBeInTheDocument();
  });

  it("handles missing discount value in View mode (fallback to 0)", () => {
    const noDiscountService = { ...mockService, discount: "" };
    render(
      <ServiceCard
        service={noDiscountService}
        setFormData={mockSetFormData}
        edit={false}
      />
    );

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("applies border class correctly in View mode", () => {
    render(
      <ServiceCard
        service={mockService}
        setFormData={mockSetFormData}
        edit={false}
      />
    );

    // Check for the specific conditional class on the 'Charges' container
    // We navigate to the Charges label parent to check className
    const chargesLabel = screen.getByText("Charges:");
    const container = chargesLabel.parentElement;
    expect(container).toHaveClass("border-b border-grey-light");
  });

  // --- Section 3: Interactions & State Logic ---

  it("updates discount value via input (Edit mode)", () => {
    render(<ServiceCard service={mockService} setFormData={mockSetFormData} />);

    const input = screen.getByTestId("input-Discount (%)");
    fireEvent.change(input, { target: { value: "20" } });

    // Verify setFormData was called with a function
    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    const updateFn = mockSetFormData.mock.calls[0][0];

    // Simulate state update logic
    const prevState = {
      services: [
        mockService,
        { ...mockService, name: "Other Service", discount: "0" }, // Control item
      ],
    };

    const newState = updateFn(prevState);

    // Verify only the matching service was updated
    expect(newState.services).toHaveLength(2);
    expect(newState.services[0].discount).toBe("20");
    expect(newState.services[1].discount).toBe("0");
  });

  it("removes service when delete is clicked", () => {
    render(<ServiceCard service={mockService} setFormData={mockSetFormData} />);

    const deleteBtn = screen.getByTestId("delete-btn");
    fireEvent.click(deleteBtn);

    // Verify setFormData was called with a function
    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    const updateFn = mockSetFormData.mock.calls[0][0];

    // Simulate state update logic
    const prevState = {
      services: [mockService, { ...mockService, name: "Other Service" }],
    };

    const newState = updateFn(prevState);

    // Verify filtering logic
    expect(newState.services).toHaveLength(1);
    expect(newState.services[0].name).toBe("Other Service");
  });

  // --- Section 4: Edge Cases & Branch Logic ---

  it("does not update other services when changing discount", () => {
    // Tests the ternary: s.name === service.name ? ... : s
    render(<ServiceCard service={mockService} setFormData={mockSetFormData} />);

    const input = screen.getByTestId("input-Discount (%)");
    fireEvent.change(input, { target: { value: "50" } });

    const updateFn = mockSetFormData.mock.calls[0][0];
    const prevState = {
      services: [
        { ...mockService, name: "Different Name", discount: "5" }, // Mismatched name
      ],
    };

    const newState = updateFn(prevState);

    // Should remain unchanged
    expect(newState.services[0].discount).toBe("5");
  });
});
