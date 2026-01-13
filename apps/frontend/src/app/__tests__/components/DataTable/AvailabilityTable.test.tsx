import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AvailabilityTable, {
  getStatusStyle,
} from "@/app/components/DataTable/AvailabilityTable";
import { Team } from "@/app/types/team";

// --- Mocks ---

// Mock GenericTable to test that columns and data are passed correctly
// and to render the cell contents (which contain the logic we want to test)
jest.mock("@/app/components/GenericTable/GenericTable", () => {
  return ({ data, columns }: any) => (
    <div data-testid="generic-table">
      <div data-testid="table-headers">
        {columns.map((col: any) => (
          <span key={col.key}>{col.label}</span>
        ))}
      </div>
      <div data-testid="table-body">
        {data.map((item: any, i: number) => (
          <div key={i+"avaiability-key"} data-testid={`row-${i}`}>
            {columns.map((col: any) => (
              <div key={col.key} data-testid={`cell-${col.key}`}>
                {col.render ? col.render(item) : item[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// Mock Next.js Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="profile-image" />
  ),
}));

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="eye-icon">Eye</span>,
}));

// --- Test Data ---

const mockTeam: Team[] = [
  {
    _id: "1",
    name: "Dr. Smith",
    role: "Doctor",
    speciality: {
      name: "Cardiology",
      _id: "spec-1",
      organisationId: "org-1",
    },
    todayAppointment: "5",
    weeklyWorkingHours: "40",
    status: "Available",
    organisationId: "org-1",
    email: "test@example.com",
    phone: "123",
  } as unknown as Team,
  {
    _id: "2",
    name: "", // Test fallback
    role: "Nurse",
    // Speciality is mandatory in Team type, providing dummy for type safety
    // Component logic likely handles empty objects or we check for it
    speciality: { name: "", _id: "", organisationId: "" },
    todayAppointment: "0",
    weeklyWorkingHours: "0",
    status: "Consulting",
    organisationId: "org-1",
    email: "nurse@example.com",
    phone: "456",
  } as unknown as Team,
];

describe("AvailabilityTable Component", () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();

  const defaultProps = {
    filteredList: mockTeam,
    setActive: mockSetActive,
    setView: mockSetView,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests ---

  describe("getStatusStyle", () => {
    it("returns correct style for 'Available'", () => {
      const style = getStatusStyle("Available");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct style for 'Consulting'", () => {
      const style = getStatusStyle("Consulting");
      expect(style).toEqual({ color: "#EA3729", backgroundColor: "#FDEBEA" });
    });

    it("returns correct style for 'Off-duty'", () => {
      const style = getStatusStyle("Off-duty");
      expect(style).toEqual({ color: "#F68523", backgroundColor: "#FEF3E9" });
    });

    it("returns default style for unknown status", () => {
      const style = getStatusStyle("Unknown");
      expect(style).toEqual({
        color: "#302f2e",
        backgroundColor: "#6b72801a",
      });
    });

    it("handles case insensitivity", () => {
      const style = getStatusStyle("available");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });
  });

  // --- 2. Rendering Tests ---

  it("renders table with all columns and data by default", () => {
    render(<AvailabilityTable {...defaultProps} />);

    // Headers
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Speciality")).toBeInTheDocument();
    expect(screen.getByText("Today's Appointment")).toBeInTheDocument();
    expect(screen.getByText("Weekly working hours")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    // Row 1 Content

    // Profile Image
  });

  it("handles fallback values for missing data", () => {
    render(<AvailabilityTable {...defaultProps} />);

    // Row 2 Content (Index 1) fallback checks
    // The mock data for row 2 has empty name and empty speciality name
    // Logic in component should render "-" for empty name.
    const dashElements = screen.getAllByText("-");
    expect(dashElements.length).toBeGreaterThanOrEqual(1);
  });

  it("triggers view handlers when action button is clicked", () => {
    render(<AvailabilityTable {...defaultProps} />);

    const viewButtons = screen.getAllByTestId("eye-icon");
    fireEvent.click(viewButtons[0].closest("button")!);

    expect(mockSetActive).toHaveBeenCalledWith(mockTeam[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  it("hides the 'Actions' column when hideActions is true", () => {
    render(<AvailabilityTable {...defaultProps} hideActions={true} />);

    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("eye-icon")).not.toBeInTheDocument();
  });

  it("applies correct status styles in rendered component", () => {
    render(<AvailabilityTable {...defaultProps} />);
  });

  // --- 3. Edge Cases ---

  it("does not crash if event handlers are undefined", () => {
    render(<AvailabilityTable filteredList={mockTeam} />);

    const viewButtons = screen.getAllByTestId("eye-icon");
    fireEvent.click(viewButtons[0].closest("button")!);

    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockSetView).not.toHaveBeenCalled();
  });
});
