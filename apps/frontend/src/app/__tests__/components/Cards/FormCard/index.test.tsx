import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FormCard from "@/app/components/Cards/FormCard";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

jest.mock("@/app/components/DataTable/FormsTable", () => ({
  getStatusStyle: jest.fn(() => ({ color: "blue" })),
}));

// --- Test Data ---

const mockForm: FormsProps = {
  _id: "form-1",
  name: "Intake Form",
  category: "Client",
  description: "Initial client data collection",
  usage: "Onboarding",
  updatedBy: "Admin User",
  lastUpdated: "2023-01-15",
  status: "active",
} as any;

describe("FormCard Component", () => {
  const mockHandleViewForm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders form details correctly", () => {
    render(<FormCard form={mockForm} handleViewForm={mockHandleViewForm} />);

    // Header Name
    expect(screen.getByText("Intake Form")).toBeInTheDocument();

    // Fields
    expect(screen.getByText("Client")).toBeInTheDocument(); // Category
    expect(
      screen.getByText("Initial client data collection")
    ).toBeInTheDocument(); // Description
    expect(screen.getByText("Onboarding")).toBeInTheDocument(); // Usage
    expect(screen.getByText("Admin User")).toBeInTheDocument(); // Updated By
    expect(screen.getByText("2023-01-15")).toBeInTheDocument(); // Last Updated
  });

  // --- 2. Status Logic ---

  it("renders status with correct style", () => {
    render(<FormCard form={mockForm} handleViewForm={mockHandleViewForm} />);

    const statusBadge = screen.getByText("active");
    expect(statusBadge).toBeInTheDocument();
    // JSDOM computes "blue" to "rgb(0, 0, 255)"
    expect(statusBadge).toHaveStyle({ color: "rgb(0, 0, 255)" });
  });

  it("handles missing status gracefully", () => {
    const formNoStatus = { ...mockForm, status: undefined } as any;

    render(
      <FormCard form={formNoStatus} handleViewForm={mockHandleViewForm} />
    );

    const viewBtn = screen.getByText("View");
    expect(viewBtn).toBeInTheDocument();
  });

  // --- 3. Interaction ---

  it("calls handleViewForm when View button is clicked", () => {
    render(<FormCard form={mockForm} handleViewForm={mockHandleViewForm} />);

    const viewBtn = screen.getByText("View");
    fireEvent.click(viewBtn);

    expect(mockHandleViewForm).toHaveBeenCalledTimes(1);
    expect(mockHandleViewForm).toHaveBeenCalledWith(mockForm);
  });
});
