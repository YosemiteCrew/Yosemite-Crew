import React from "react";
import { render, screen, within } from "@testing-library/react";
import InventoryTurnoverTable, {
  getStatusStyle,
} from "@/app/components/DataTable/InventoryTurnoverTable";
import { InventoryTurnoverItem } from "@/app/pages/Inventory/types";

// --- Mocks ---

// NOTE: Not mocking GenericTable. Integration test with real table component.

// Mock InventoryTurnoverCard for Mobile View
jest.mock("@/app/components/Cards/InventoryTurnoverCard", () => ({
  __esModule: true,
  default: ({ item }: any) => (
    <div data-testid="turnover-card">
      <span>{item.name}</span>
      <span>{item.status}</span>
    </div>
  ),
}));

// --- Test Data ---

const mockInventoryItems: InventoryTurnoverItem[] = [
  {
    name: "Vaccines",
    category: "Medical",
    beginningInventory: 100,
    endingInventory: 20,
    averageInventory: 60,
    totalPurchases: 200,
    turnsPerYear: 3.3,
    daysOnShelf: 110,
    status: "Excellent",
  },
  {
    name: "Dog Food",
    category: "Retail",
    beginningInventory: 50,
    endingInventory: 5,
    avgInventory: 27.5,
    totalPurchased: 100, // <--- First "100"
    turnsPerYear: 3.6,
    daysOnShelf: 100, // <--- Second "100"
    status: "Low",
  },
  {
    name: "Cat Toys",
    category: "Retail",
    beginningInventory: 10,
    endingInventory: 10,
    turnsPerYear: 0,
    daysOnShelf: 365,
    status: undefined,
  },
] as any;

describe("InventoryTurnoverTable Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests (getStatusStyle) ---

  describe("getStatusStyle", () => {
    it("returns correct style for excellent", () => {
      expect(getStatusStyle("Excellent")).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#747283",
      });
    });
    it("returns correct style for low", () => {
      expect(getStatusStyle("Low")).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#D28F9A",
      });
    });
    it("returns correct style for moderate", () => {
      expect(getStatusStyle("Moderate")).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#BF9FAA",
      });
    });
    it("returns correct style for out of stock", () => {
      expect(getStatusStyle("Out of stock")).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#D28F9A",
      });
    });
    it("returns correct style for healthy", () => {
      expect(getStatusStyle("Healthy")).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#D9A488",
      });
    });
    it("returns default style for unknown", () => {
      expect(getStatusStyle("Unknown")).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#A8A181",
      });
    });
    it("handles undefined status gracefully", () => {
      expect(getStatusStyle()).toEqual({
        color: "#F7F7F7",
        backgroundColor: "#A8A181",
      });
    });
  });

  // --- 2. Desktop View (GenericTable) ---

  it("renders table with correct data (Desktop View)", () => {
    const { container } = render(
      <InventoryTurnoverTable filteredList={mockInventoryItems} />
    );

    // Scope to desktop view container
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    // Query rows within desktop view. getAllByRole('row') includes header row.
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    // 1 Header + 3 Data rows = 4 rows total
    expect(rows).toHaveLength(4);

    // -- Row 1 (Vaccines) --
    const row1 = rows[1];
    expect(within(row1).getByText("Vaccines")).toBeInTheDocument();
    expect(within(row1).getByText("Medical")).toBeInTheDocument();
    expect(within(row1).getByText("60")).toBeInTheDocument(); // averageInventory
    expect(within(row1).getByText("200")).toBeInTheDocument(); // totalPurchases
    expect(within(row1).getByText("Excellent")).toBeInTheDocument();

    // -- Row 2 (Dog Food) --
    const row2 = rows[2];
    expect(within(row2).getByText("Dog Food")).toBeInTheDocument();
    expect(within(row2).getByText("27.5")).toBeInTheDocument(); // avgInventory fallback

    // FIX: "100" appears twice (totalPurchased and daysOnShelf)
    // We expect 2 instances within this row
    const hundreds = within(row2).getAllByText("100");
    expect(hundreds).toHaveLength(2);

    // -- Row 3 (Cat Toys - Defaults) --
    const row3 = rows[3];
    expect(within(row3).getByText("Cat Toys")).toBeInTheDocument();
    const zeros = within(row3).getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2); // Avg + Total defaults
    expect(within(row3).getByText("—")).toBeInTheDocument(); // Status fallback
  });

  // --- 3. Mobile View (Cards) ---

  it("renders InventoryTurnoverCard components (Mobile View)", () => {
    render(<InventoryTurnoverTable filteredList={mockInventoryItems} />);

    // Cards are mocked with a distinct test-id, so finding them is reliable
    const cards = screen.getAllByTestId("turnover-card");
    expect(cards).toHaveLength(3);

    // Check first card content
    expect(within(cards[0]).getByText("Vaccines")).toBeInTheDocument();
  });

  // --- 4. Empty State ---

  it("renders without crashing when list is empty", () => {
    const { container } = render(<InventoryTurnoverTable filteredList={[]} />);

    // The GenericTable renders headers even if empty
    // Mobile view doesn't render cards
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    expect(screen.queryByTestId("turnover-card")).not.toBeInTheDocument();
  });
});
