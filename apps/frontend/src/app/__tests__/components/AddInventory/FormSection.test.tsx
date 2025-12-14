import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import FormsTable, {
  getStatusStyle,
} from "@/app/components/DataTable/FormsTable";
import { FormsProps } from "@/app/types/forms";

// --- Mocks ---

// Mock GenericTable because it's a UI component we don't need to test internally here
jest.mock("@/app/components/GenericTable/GenericTable", () => {
  return ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <thead>
        <tr>
          {columns.map((col: any) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item: any, i: number) => (
          <tr key={i} data-testid={`row-${i}`}>
            {columns.map((col: any) => (
              <td key={col.key}>
                {col.render ? col.render(item) : item[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

// Mock FormCard for mobile view
// Fixed: Changed div to button to satisfy a11y rules in tests
jest.mock("@/app/components/Cards/FormCard", () => {
  return ({ form, handleViewForm }: any) => (
    <button
      data-testid={`form-card-${form.name}`}
      onClick={() => handleViewForm(form)}
    >
      {form.name}
    </button>
  );
});

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="eye-icon">Eye</span>,
}));

// --- Test Data ---

// Fixed: Added 'schema: []' to satisfy FormsProps type requirements
const mockForms: FormsProps[] = [
  {
    name: "Intake Form",
    category: "Custom" as any,
    usage: "External",
    updatedBy: "Alice",
    lastUpdated: "2023-10-01",
    status: "Published",
    schema: [],
  },
  {
    name: "Feedback Form",
    category: "Custom" as any,
    usage: "Internal",
    updatedBy: "Bob",
    lastUpdated: "2023-10-05",
    status: "Draft",
    schema: [],
  },
  {
    name: "Archived Form",
    category: "Custom" as any,
    usage: "Internal",
    updatedBy: "Charlie",
    lastUpdated: "2023-01-01",
    status: "Archived",
    schema: [],
  },
];

describe("FormsTable Component", () => {
  const mockSetActiveForm = jest.fn();
  const mockSetViewPopup = jest.fn();

  const defaultProps = {
    filteredList: mockForms,
    activeForm: null,
    setActiveForm: mockSetActiveForm,
    setViewPopup: mockSetViewPopup,
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests ---

  describe("getStatusStyle", () => {
    it("returns correct style for 'Published'", () => {
      const style = getStatusStyle("Published");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct style for 'published' (case insensitive)", () => {
      const style = getStatusStyle("published");
      expect(style).toEqual({ color: "#54B492", backgroundColor: "#E6F4EF" });
    });

    it("returns correct style for 'Draft'", () => {
      const style = getStatusStyle("Draft");
      expect(style).toEqual({ color: "#F68523", backgroundColor: "#FEF3E9" });
    });

    it("returns default style for unknown status", () => {
      const style = getStatusStyle("Archived");
      expect(style).toEqual({ color: "#EA3729", backgroundColor: "#FDEBEA" });
    });

    it("returns empty style for empty status", () => {
      const style = getStatusStyle("");
      expect(style).toEqual({ color: "#302F2E", backgroundColor: "#F3F3F3" });
    });
  });

  // --- 2. Desktop View (Table) Tests ---

  it("renders the table with correct columns in desktop view", () => {
    render(<FormsTable {...defaultProps} />);

    // Check headers
    expect(screen.getByText("Form name")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("Updated by")).toBeInTheDocument();
    expect(screen.getByText("Last updated")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    // Check data rendering.
    // Fixed: Use getAllByText because data renders in both desktop table and hidden mobile cards.
    expect(screen.getAllByText("Intake Form").length).toBeGreaterThan(0);
    // "Custom" appears multiple times (once per row)
    expect(screen.getAllByText("Custom").length).toBeGreaterThan(0);
    expect(screen.getAllByText("External").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
  });

  it("calls setActiveForm and setViewPopup when view action is clicked", () => {
    render(<FormsTable {...defaultProps} />);

    // Find the eye icon/button for the first row
    const viewButtons = screen.getAllByTestId("eye-icon");
    // Ensure we click the button wrapping the icon
    fireEvent.click(viewButtons[0].closest("button")!);

    expect(mockSetActiveForm).toHaveBeenCalledWith(mockForms[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("shows loading state in desktop view", () => {
    render(<FormsTable {...defaultProps} loading={true} />);

    // Expect loading text (getAllByText because it might render in mobile view too)
    expect(screen.getAllByText("Loading forms...").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("generic-table")).not.toBeInTheDocument();
  });

  // --- 3. Mobile View (Cards) Tests ---

  it("renders cards in mobile view", () => {
    render(<FormsTable {...defaultProps} />);

    expect(screen.getByTestId("form-card-Intake Form")).toBeInTheDocument();
    expect(screen.getByTestId("form-card-Feedback Form")).toBeInTheDocument();
  });

  it("calls handlers when card is clicked in mobile view", () => {
    render(<FormsTable {...defaultProps} />);

    const card = screen.getByTestId("form-card-Intake Form");
    fireEvent.click(card);

    expect(mockSetActiveForm).toHaveBeenCalledWith(mockForms[0]);
    expect(mockSetViewPopup).toHaveBeenCalledWith(true);
  });

  it("shows loading state in mobile view", () => {
    render(<FormsTable {...defaultProps} loading={true} />);

    expect(screen.getAllByText("Loading forms...").length).toBeGreaterThan(0);
    expect(
      screen.queryByTestId("form-card-Intake Form")
    ).not.toBeInTheDocument();
  });

  it("shows 'No data available' when list is empty in mobile view", () => {
    render(<FormsTable {...defaultProps} filteredList={[]} />);

    expect(screen.getAllByText("No data available").length).toBeGreaterThan(0);
  });

  // --- 4. Edge Cases ---

  it("renders correctly with empty status in table row", () => {
    const formWithNoStatus = [{ ...mockForms[0], status: "" }];
    render(
      <FormsTable {...defaultProps} filteredList={formWithNoStatus as any} />
    );

    const rows = screen.getAllByTestId("row-0");
    expect(rows.length).toBeGreaterThan(0);
  });
});
