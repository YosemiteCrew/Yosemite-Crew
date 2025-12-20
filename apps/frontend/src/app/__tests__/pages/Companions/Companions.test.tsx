import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ProtectedCompanions from "../../../pages/Companions/Companions";
import { useCompanionsParentsForPrimaryOrg } from "@/app/hooks/useCompanion";
import { CompanionParent } from "../../../pages/Companions/types";

// --- Mocks ---

// 1. Mock Custom Hook
jest.mock("@/app/hooks/useCompanion");

// 2. Mock Guards
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

// 3. Mock Child Components
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="btn-add" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Filters/CompanionFilters", () => ({
  __esModule: true,
  default: ({ setFilteredList, list }: any) => (
    <div data-testid="filters">
      <button
        data-testid="filter-trigger"
        onClick={() => setFilteredList(list)}
      >
        Filter
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/CompanionsTable", () => ({
  __esModule: true,
  default: ({
    activeCompanion,
    setActiveCompanion,
    setViewCompanion,
    setBookAppointment,
  }: any) => (
    <div data-testid="companions-table">
      <span data-testid="active-id">
        {activeCompanion?.companion.id || "none"}
      </span>
      <button
        data-testid="select-companion-btn"
        onClick={() => setActiveCompanion({ companion: { id: "new-id" } })}
      >
        Select
      </button>
      <button data-testid="view-btn" onClick={() => setViewCompanion(true)}>
        View
      </button>
      <button data-testid="book-btn" onClick={() => setBookAppointment(true)}>
        Book
      </button>
    </div>
  ),
}));

// Mock Modals
const MockModal = ({ showModal, name }: any) =>
  showModal ? <div data-testid={`modal-${name}`}>Modal: {name}</div> : null;

jest.mock("@/app/components/AddCompanion", () => ({
  __esModule: true,
  default: (props: any) => <MockModal {...props} name="AddCompanion" />,
}));

jest.mock("@/app/components/CompanionInfo", () => ({
  __esModule: true,
  default: (props: any) => <MockModal {...props} name="CompanionInfo" />,
}));

// Ensure BookAppointment matches the prop signature expected
jest.mock("../../../pages/Companions/BookAppointment", () => ({
  __esModule: true,
  default: (props: any) => <MockModal {...props} name="BookAppointment" />,
}));

// --- Test Data ---

const mockCompanions: CompanionParent[] = [
  { companion: { id: "1", name: "Doggo" }, parent: { id: "p1" } } as any,
  { companion: { id: "2", name: "Cat" }, parent: { id: "p2" } } as any,
];

describe("Companions Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue(
      mockCompanions
    );
  });

  // --- Section 1: Rendering & Structure ---

  it("renders the main structure and guards correctly", () => {
    render(<ProtectedCompanions />);

    // Verify Guards
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("org-guard")).toBeInTheDocument();

    // Verify Page Title
    expect(screen.getByText("Companions")).toBeInTheDocument();

    // Verify Child Components Presence
    expect(screen.getByTestId("filters")).toBeInTheDocument();
    expect(screen.getByTestId("companions-table")).toBeInTheDocument();
  });

  // --- Section 2: User Interactions (State Changes) ---

  it("opens the Add Companion modal when Add button is clicked", () => {
    render(<ProtectedCompanions />);

    expect(screen.queryByTestId("modal-AddCompanion")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-add"));

    expect(screen.getByTestId("modal-AddCompanion")).toBeInTheDocument();
  });

  it("handles table actions: select, view, and book", () => {
    render(<ProtectedCompanions />);

    // 1. View Modal
    fireEvent.click(screen.getByTestId("view-btn"));
    expect(screen.getByTestId("modal-CompanionInfo")).toBeInTheDocument();

    // 2. Book Modal
    fireEvent.click(screen.getByTestId("book-btn"));
    expect(screen.getByTestId("modal-BookAppointment")).toBeInTheDocument();

    // 3. Filter Trigger (just to cover the prop passing line)
    fireEvent.click(screen.getByTestId("filter-trigger"));
  });

  // --- Section 3: useEffect & Active Companion Logic ---

  it("initializes activeCompanion with the first item in the list", () => {
    render(<ProtectedCompanions />);
    // mockCompanions[0].id is "1"
    expect(screen.getByTestId("active-id")).toHaveTextContent("1");
  });

  it("updates activeCompanion logic: keeps selection if it still exists in new list", () => {
    const { rerender } = render(<ProtectedCompanions />);

    // Initial state: active is "1"
    expect(screen.getByTestId("active-id")).toHaveTextContent("1");

    // Update hook to return same list (simulating refresh where ID "1" still exists)
    const newDocs = [...mockCompanions];
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue(newDocs);

    rerender(<ProtectedCompanions />);

    // Should still be "1"
    expect(screen.getByTestId("active-id")).toHaveTextContent("1");
  });

  it("updates activeCompanion logic: defaults to first item if selection is removed", () => {
    const { rerender } = render(<ProtectedCompanions />);
    expect(screen.getByTestId("active-id")).toHaveTextContent("1");

    // Update hook: Remove item "1", keep item "2"
    const newDocs = [mockCompanions[1]];
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue(newDocs);

    rerender(<ProtectedCompanions />);

    // Should switch to "2" because "1" is gone
    expect(screen.getByTestId("active-id")).toHaveTextContent("2");
  });

  it("updates activeCompanion logic: handles empty list", () => {
    const { rerender } = render(<ProtectedCompanions />);

    // Update hook to return empty list
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([]);

    rerender(<ProtectedCompanions />);

    // Should be "none" (null)
    expect(screen.getByTestId("active-id")).toHaveTextContent("none");
  });

  it("updates activeCompanion logic: handles null previous state", () => {
    // Start with empty list so activeCompanion is null
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    const { rerender } = render(<ProtectedCompanions />);
    expect(screen.getByTestId("active-id")).toHaveTextContent("none");

    // Update to populated list
    (useCompanionsParentsForPrimaryOrg as jest.Mock).mockReturnValue(
      mockCompanions
    );
    rerender(<ProtectedCompanions />);

    // Should default to first item "1"
    expect(screen.getByTestId("active-id")).toHaveTextContent("1");
  });
});
