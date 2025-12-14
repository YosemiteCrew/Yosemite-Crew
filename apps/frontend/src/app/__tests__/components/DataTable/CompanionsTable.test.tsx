import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanionsTable, {
  getStatusStyle,
} from "@/app/components/DataTable/CompanionsTable";
import { CompanionParent } from "@/app/pages/Companions/types";

// --- Mocks ---

// Mock Next/Image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || "mock-img"} />,
}));

// Mock Icons
jest.mock("react-icons/fa", () => ({
  FaCalendar: () => <span data-testid="icon-calendar">Calendar</span>,
  FaTasks: () => <span data-testid="icon-tasks">Tasks</span>,
}));
jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="icon-eye">View</span>,
}));

// Mock Utils
jest.mock("@/app/utils/date", () => ({
  getAgeInYears: jest.fn(() => "5 years"),
}));

jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn((url) => url?.startsWith("https")),
}));

// Mock CompanionCard (Mobile View)
jest.mock("@/app/components/Cards/CompanionCard/CompanionCard", () => ({
  __esModule: true,
  default: ({ companion, handleViewCompanion }: any) => (
    <div data-testid="mobile-card">
      <span data-testid="mobile-name">{companion.companion.name}</span>
      <button
        data-testid={`mobile-view-btn-${companion.companion.id}`}
        onClick={() => handleViewCompanion(companion)}
      >
        View Mobile
      </button>
    </div>
  ),
}));

// IMPORTANT: Smart Mock for GenericTable to test column rendering
jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <thead>
        <tr>
          {columns.map((col: any) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, rowIndex: number) => (
          <tr key={rowIndex} data-testid="table-row">
            {columns.map((col: any) => (
              <td key={col.key}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

describe("CompanionsTable Component", () => {
  const mockSetActiveCompanion = jest.fn();
  const mockSetViewCompanion = jest.fn();

  const mockData: CompanionParent[] = [
    {
      companion: {
        id: "c1",
        name: "Buddy",
        breed: "Golden",
        type: "Dog",
        photoUrl: "https://example.com/buddy.jpg",
        gender: "Male",
        dateOfBirth: new Date("2018-01-01"),
        allergy: "Peanuts",
        status: "active",
      },
      parent: {
        id: "p1",
        firstName: "John",
        lastName: "Doe",
        email: "john@test.com",
        phoneNumber: "123",
        address: {},
      },
    } as any,
    {
      companion: {
        id: "c2",
        name: "Luna",
        breed: "Siamese",
        type: "Cat",
        photoUrl: "invalid-url", // Test fallback image
        gender: "Female",
        dateOfBirth: new Date("2020-01-01"),
        allergy: "", // Test empty allergy -> "-"
        status: "inactive",
      },
      parent: {
        id: "p2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@test.com",
        phoneNumber: "456",
        address: {},
      },
    } as any,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the desktop table correctly with data", () => {
    render(
      <CompanionsTable
        filteredList={mockData}
        activeCompanion={null}
        setActiveCompanion={mockSetActiveCompanion}
        setViewCompanion={mockSetViewCompanion}
      />
    );

    const table = screen.getByTestId("generic-table");
    const scope = within(table);

    // Check Headers
    expect(scope.getByText("Name")).toBeInTheDocument();
    expect(scope.getByText("Parent")).toBeInTheDocument();
    expect(scope.getByText("Gender/Age")).toBeInTheDocument();
    expect(scope.getByText("Allergy")).toBeInTheDocument();
    expect(scope.getByText("Status")).toBeInTheDocument();

    // Check Row 1 (Buddy)
    expect(scope.getByText("Buddy")).toBeInTheDocument();
    expect(scope.getByText("Golden/Dog")).toBeInTheDocument();
    expect(scope.getByText("John")).toBeInTheDocument();
    expect(scope.getByText("Male")).toBeInTheDocument();
    expect(scope.getAllByText("5 years")).toHaveLength(2); // Mock returns "5 years" for both
    expect(scope.getByText("Peanuts")).toBeInTheDocument();
    expect(scope.getByText("active")).toBeInTheDocument();

    // Check Row 2 (Luna - Fallbacks)
    expect(scope.getByText("Luna")).toBeInTheDocument();
    expect(scope.getByText("Siamese/Cat")).toBeInTheDocument();

    // Check for placeholders "-"
    // Upcoming Appointment (always "-") * 2 rows + Empty Allergy (for Luna) * 1 row = 3 instances
    const placeholders = scope.getAllByText("-");
    expect(placeholders.length).toBeGreaterThanOrEqual(1);

    expect(scope.getByText("inactive")).toBeInTheDocument();

    // Check Images
    const images = scope.getAllByRole("img");
    expect(images[0]).toHaveAttribute("src", "https://example.com/buddy.jpg");
    expect(images[1]).toHaveAttribute(
      "src",
      expect.stringContaining("ftafter.png")
    ); // Fallback
  });

  it("renders mobile cards correctly", () => {
    render(
      <CompanionsTable
        filteredList={mockData}
        activeCompanion={null}
        setActiveCompanion={mockSetActiveCompanion}
        setViewCompanion={mockSetViewCompanion}
      />
    );

    const cards = screen.getAllByTestId("mobile-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Buddy")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Luna")).toBeInTheDocument();
  });

  it("renders 'No data available' when list is empty", () => {
    render(
      <CompanionsTable
        filteredList={[]}
        activeCompanion={null}
        setActiveCompanion={mockSetActiveCompanion}
        setViewCompanion={mockSetViewCompanion}
      />
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-card")).not.toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it("handles view companion click (Desktop)", () => {
    render(
      <CompanionsTable
        filteredList={[mockData[0]]}
        activeCompanion={null}
        setActiveCompanion={mockSetActiveCompanion}
        setViewCompanion={mockSetViewCompanion}
      />
    );

    // Find the eye icon, get parent button
    const viewBtn = screen.getByTestId("icon-eye").closest("button");
    fireEvent.click(viewBtn!);

    expect(mockSetActiveCompanion).toHaveBeenCalledWith(mockData[0]);
    expect(mockSetViewCompanion).toHaveBeenCalledWith(true);
  });

  it("handles view companion click (Mobile)", () => {
    render(
      <CompanionsTable
        filteredList={[mockData[0]]}
        activeCompanion={null}
        setActiveCompanion={mockSetActiveCompanion}
        setViewCompanion={mockSetViewCompanion}
      />
    );

    const mobileBtn = screen.getByTestId("mobile-view-btn-c1");
    fireEvent.click(mobileBtn);

    expect(mockSetActiveCompanion).toHaveBeenCalledWith(mockData[0]);
    expect(mockSetViewCompanion).toHaveBeenCalledWith(true);
  });

  it("renders additional action buttons (Calendar, Tasks) in desktop", () => {
    render(
      <CompanionsTable
        filteredList={[mockData[0]]}
        activeCompanion={null}
        setActiveCompanion={mockSetActiveCompanion}
        setViewCompanion={mockSetViewCompanion}
      />
    );
    // These are static buttons for now, just verifying presence
    expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("icon-tasks")).toBeInTheDocument();
  });

  // --- 3. Utilities ---

  describe("getStatusStyle helper", () => {
    it("returns correct style for 'active'", () => {
      expect(getStatusStyle("active")).toEqual({
        color: "#54B492",
        backgroundColor: "#E6F4EF",
      });
    });

    it("returns correct style for 'archived'", () => {
      expect(getStatusStyle("Archived")).toEqual({
        // Case insensitive check
        color: "#EA3729",
        backgroundColor: "#FDEBEA",
      });
    });

    it("returns correct style for 'inactive'", () => {
      expect(getStatusStyle("inactive")).toEqual({
        color: "#F68523",
        backgroundColor: "#FEF3E9",
      });
    });

    it("returns default style for unknown status", () => {
      expect(getStatusStyle("unknown")).toEqual({
        color: "#6b7280",
        backgroundColor: "rgba(107,114,128,0.1)",
      });
    });
  });
});
