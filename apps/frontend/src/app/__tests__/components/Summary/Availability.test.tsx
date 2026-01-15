import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Availability from "../../../components/Summary/Availability";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";

// --- Mocks ---

// 1. Mock the custom hook
jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

// 2. Mock the Child Table Component
// FIX: Use the correct path based on the component's import structure ("../DataTable")
// Assuming the file is at src/app/components/DataTable/AvailabilityTable
jest.mock(
  "@/app/components/DataTable/AvailabilityTable",
  () =>
    ({ filteredList }: { filteredList: any[] }) => (
      <div data-testid="mock-availability-table">
        {filteredList.map((item) => (
          <div key={item.id} data-testid="table-row">
            {item.name} - {item.status}
          </div>
        ))}
      </div>
    )
);

// 3. Mock Next.js Link
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe("Availability Component", () => {
  // Mock Data
  const mockTeams = [
    { id: 1, name: "Team 1", status: "available" },
    { id: 2, name: "Team 2", status: "available" },
    { id: 3, name: "Team 3", status: "consulting" },
    { id: 4, name: "Team 4", status: "off-duty" },
    { id: 5, name: "Team 5", status: "available" },
    { id: 6, name: "Team 6", status: "available" }, // 6th item to test slicing
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
  });

  // --- Section 1: Rendering ---
  it("renders the title with the total count correctly", () => {
    render(<Availability />);

    // Title should show total length (6)
    expect(screen.getByText(/Availability/i)).toBeInTheDocument();
    expect(screen.getByText("(6)")).toBeInTheDocument();
  });

  it("renders the 'See all' link pointing to the correct path", () => {
    render(<Availability />);

    const link = screen.getByRole("link", { name: /See all/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/organization");
  });

  // --- Section 2: Data Slicing & Initial State ---
  it("renders the table with the first 5 items by default (All)", () => {
    render(<Availability />);

    // Mock data has 6 items, slice(0,5) should render 5
    const rows = screen.getAllByTestId("table-row");
    expect(rows).toHaveLength(5);

    // Ensure the 6th item is not rendered
    expect(screen.queryByText("Team 6 - available")).not.toBeInTheDocument();
  });

  // --- Section 3: Filtering Logic ---
  it("filters the list when clicking 'Available'", () => {
    render(<Availability />);

    // Click "Available" button
    const availableBtn = screen.getByRole("button", { name: "Available" });
    fireEvent.click(availableBtn);

    // Should show Team 1, 2, 5, 6 (Total 4 items, all fit within slice of 5)
    const rows = screen.getAllByTestId("table-row");
    expect(rows).toHaveLength(4);
    expect(screen.getByText("Team 1 - available")).toBeInTheDocument();
    expect(screen.queryByText("Team 3 - consulting")).not.toBeInTheDocument();
  });

  it("filters the list when clicking 'Consulting'", () => {
    render(<Availability />);

    const consultingBtn = screen.getByRole("button", { name: "Consulting" });
    fireEvent.click(consultingBtn);

    const rows = screen.getAllByTestId("table-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("Team 3 - consulting")).toBeInTheDocument();
  });

  it("filters the list when clicking 'Off-Duty'", () => {
    render(<Availability />);

    const offDutyBtn = screen.getByRole("button", { name: "Off-Duty" });
    fireEvent.click(offDutyBtn);

    const rows = screen.getAllByTestId("table-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("Team 4 - off-duty")).toBeInTheDocument();
  });

  it("returns to 'All' list when clicking 'All' button", () => {
    render(<Availability />);

    // First filter to something else
    fireEvent.click(screen.getByRole("button", { name: "Consulting" }));
    expect(screen.getAllByTestId("table-row")).toHaveLength(1);

    // Filter back to All
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByTestId("table-row")).toHaveLength(5); // Sliced to 5
  });

  // --- Section 4: Styling & Conditional Class Names ---
  it("applies correct active styles to the selected button", () => {
    render(<Availability />);

    const allBtn = screen.getByRole("button", { name: "All" });
    const availableBtn = screen.getByRole("button", { name: "Available" });

    // Initial State: "All" is active
    // Check ternary: label.value === selectedLabel ? "border! ..." : "border-0!"

    // Check specific style ternary: i === 0 ? "1px solid #302f2e" : ""
    expect(availableBtn).not.toHaveStyle({ border: "1px solid #302f2e" });

    // Interaction: Click Available
    fireEvent.click(availableBtn);

    // New State: "Available" is active
    expect(availableBtn).toHaveClass("text-body-4");
    expect(allBtn).toHaveClass("text-body-4");
  });

  it("handles case insensitivity in filtering", () => {
    // Determine if the logic handles "Available" vs "available"
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 1, name: "Team Mixed", status: "AVAILABLE" },
    ]);

    render(<Availability />);

    // Select Available (value is "available")
    fireEvent.click(screen.getByRole("button", { name: "Available" }));

    // Should match because logic is: item.status.toLowerCase() === selectedLabel.toLowerCase()
    expect(screen.getByText("Team Mixed - AVAILABLE")).toBeInTheDocument();
  });
});
