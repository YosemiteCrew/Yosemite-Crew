import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import ProtectedInventory from "@/app/pages/Inventory/index";
import { useOrgStore } from "@/app/stores/orgStore";
import { useInventoryModule } from "@/app/hooks/useInventory";

// --- Mocks ---

// Mock Components
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

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="add-btn">
      {text}
    </button>
  ),
}));

// Mock Filters
jest.mock("@/app/components/Filters/InventoryFilters", () => ({
  __esModule: true,
  default: ({ onChange, filters }: any) => (
    <div data-testid="inventory-filters">
      <input
        data-testid="search-input"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <select
        data-testid="category-select"
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
      >
        <option value="all">all</option>
        <option value="Medicine">Medicine</option>
      </select>
      <select
        data-testid="status-select"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="ALL">ALL</option>
        <option value="ACTIVE">ACTIVE</option>
        <option value="HIDDEN">HIDDEN</option>
        <option value="Low Stock">Low Stock</option>
      </select>
    </div>
  ),
}));

jest.mock("@/app/components/Filters/InventoryTurnoverFilters", () => ({
  __esModule: true,
  default: () => <div data-testid="turnover-filters" />,
}));

// Mock Tables
jest.mock("@/app/components/DataTable/InventoryTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActiveInventory, setViewInventory }: any) => (
    <div data-testid="inventory-table">
      {filteredList.map((item: any) => (
        <button
          key={item.id}
          data-testid={`item-${item.id}`}
          onClick={() => {
            setActiveInventory(item);
            setViewInventory(true);
          }}
        >
          {item.basicInfo.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/InventoryTurnoverTable", () => ({
  __esModule: true,
  default: () => <div data-testid="turnover-table" />,
}));

// Mock Modals (Updated to handle async errors in onClick to prevent Unhandled Promise Rejections)
jest.mock("@/app/components/AddInventory", () => ({
  __esModule: true,
  default: ({ showModal, onSubmit }: any) =>
    showModal ? (
      <div data-testid="add-modal">
        <button
          data-testid="submit-add"
          onClick={() => {
            // Catch error here to prevent test failure, as component re-throws
            Promise.resolve(
              onSubmit({ basicInfo: { name: "New Item" } })
            ).catch(() => {});
          }}
        >
          Submit
        </button>
      </div>
    ) : null,
}));

jest.mock("@/app/components/InventoryInfo", () => ({
  __esModule: true,
  default: ({
    showModal,
    activeInventory,
    onUpdate,
    onAddBatch,
    onHide,
    onUnhide,
  }: any) =>
    showModal ? (
      <div data-testid="info-modal">
        <span>Current: {activeInventory.basicInfo.name}</span>
        <button
          data-testid="update-btn"
          onClick={() => {
            Promise.resolve(
              onUpdate({
                ...activeInventory,
                id: activeInventory.id,
                basicInfo: { name: "Updated" },
              })
            ).catch(() => {});
          }}
        >
          Update
        </button>
        <button
          data-testid="add-batch-btn"
          onClick={() => {
            Promise.resolve(
              onAddBatch(activeInventory.id, [{ id: "b1" }])
            ).catch(() => {});
          }}
        >
          Add Batch
        </button>
        <button
          data-testid="hide-btn"
          onClick={() => {
            Promise.resolve(onHide(activeInventory.id)).catch(() => {});
          }}
        >
          Hide
        </button>
        <button
          data-testid="unhide-btn"
          onClick={() => {
            Promise.resolve(onUnhide(activeInventory.id)).catch(() => {});
          }}
        >
          Unhide
        </button>
      </div>
    ) : null,
}));

// Mock Hooks
jest.mock("@/app/stores/orgStore");
jest.mock("@/app/hooks/useLoadOrg", () => ({ useLoadOrg: jest.fn() }));
jest.mock("@/app/hooks/useInventory");

// --- Test Data ---

const mockInventory = [
  {
    id: "1",
    status: "ACTIVE",
    stockHealth: "Healthy",
    basicInfo: { name: "Item A", category: "Medicine", description: "Desc A" },
  },
  {
    id: "2",
    status: "HIDDEN",
    stockHealth: "Low Stock",
    basicInfo: { name: "Item B", category: "Food", description: "Desc B" },
  },
];

const mockTurnover = [{ id: "t1", name: "Turnover Item" }];

describe("Inventory Page", () => {
  const mockCreateItem = jest.fn();
  const mockUpdateItem = jest.fn();
  const mockHideItem = jest.fn();
  const mockUnhideItem = jest.fn();
  const mockAddBatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default Store Mock
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: "org-1",
        orgsById: { "org-1": { type: "CLINIC" } },
      })
    );

    // Default Hook Mock
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: mockInventory,
      turnover: mockTurnover,
      status: "success",
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup(); // Ensure DOM is clean
  });

  // --- Section 1: Rendering & Initialization ---

  it("renders the inventory page layout correctly", () => {
    render(<ProtectedInventory />);

    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByTestId("add-btn")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-filters")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-table")).toBeInTheDocument();
    expect(screen.getByText("Turnover")).toBeInTheDocument();
    expect(screen.getByTestId("turnover-table")).toBeInTheDocument();
  });

  it("displays loading state when fetching data", () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [],
      turnover: [],
      status: "loading",
      error: null,
      createItem: jest.fn(),
    });

    render(<ProtectedInventory />);
    expect(screen.getByText("Loading inventory...")).toBeInTheDocument();
  });

  it("defaults businessType to GROOMER if no org type present", () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: null,
        orgsById: {},
      })
    );

    render(<ProtectedInventory />);
    expect(useInventoryModule).toHaveBeenCalledWith("GROOMER");
  });

  it("updates businessType when primary org changes", () => {
    const { rerender } = render(<ProtectedInventory />);
    expect(useInventoryModule).toHaveBeenCalledWith("CLINIC");

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: "org-2",
        orgsById: { "org-2": { type: "BREEDER" } },
      })
    );

    rerender(<ProtectedInventory />);
    expect(useInventoryModule).toHaveBeenCalledWith("BREEDER");
  });

  // --- Section 2: Filtering Logic ---

  it("filters inventory by search text (debounced)", async () => {
    render(<ProtectedInventory />);
    const searchInput = screen.getByTestId("search-input");

    expect(screen.getByTestId("item-1")).toBeInTheDocument();
    expect(screen.getByTestId("item-2")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Item A" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("item-2")).not.toBeInTheDocument();
      expect(screen.getByTestId("item-1")).toBeInTheDocument();
    });
  });

  it("filters inventory by category", async () => {
    render(<ProtectedInventory />);
    const catSelect = screen.getByTestId("category-select");

    fireEvent.change(catSelect, { target: { value: "Medicine" } });

    await waitFor(() => {
      expect(screen.getByTestId("item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("item-2")).not.toBeInTheDocument();
    });
  });

  it("filters inventory by status", async () => {
    render(<ProtectedInventory />);
    const statusSelect = screen.getByTestId("status-select");

    fireEvent.change(statusSelect, { target: { value: "ACTIVE" } });
    await waitFor(() => {
      expect(screen.getByTestId("item-1")).toBeInTheDocument();
      expect(screen.queryByTestId("item-2")).not.toBeInTheDocument();
    });
  });

  it("filters inventory by stock health (Special Status Filter)", async () => {
    render(<ProtectedInventory />);
    const statusSelect = screen.getByTestId("status-select");

    fireEvent.change(statusSelect, { target: { value: "Low Stock" } });
    await waitFor(() => {
      expect(screen.queryByTestId("item-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("item-2")).toBeInTheDocument();
    });
  });

  // --- Section 3: Interactions (Modals & Selection) ---

  it("opens add modal on button click", () => {
    render(<ProtectedInventory />);
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("add-btn"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
  });

  it("selects an item and opens info modal when clicked", () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));
    expect(screen.getByTestId("info-modal")).toBeInTheDocument();
    expect(screen.getByText("Current: Item A")).toBeInTheDocument();
  });

  it("automatically selects the first item if current active item is filtered out", async () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-2"));
    expect(screen.getByText("Current: Item B")).toBeInTheDocument();

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Item A" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Current: Item A")).toBeInTheDocument();
    });
  });

  it("closes info modal if list becomes empty", async () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));
    expect(screen.getByTestId("info-modal")).toBeInTheDocument();

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "ZZZZZ" } });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("info-modal")).not.toBeInTheDocument();
    });
  });

  // --- Section 4: CRUD Actions & Error Handling ---

  it("handles create item success", async () => {
    mockCreateItem.mockResolvedValue({
      id: "new",
      basicInfo: { name: "New Item" },
    });
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByTestId("add-btn"));
    fireEvent.click(screen.getByTestId("submit-add"));

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalled();
      expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
    });
  });

  it("handles create item error", async () => {
    // 1. Simulate NO org to check disabled state (forcing check in a separate scope if needed)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ primaryOrgId: null })
    );

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ProtectedInventory />);
    const btn = screen.getByTestId("add-btn");
    expect(btn).toBeDisabled();

    // Cleanup before re-rendering for the error test part
    cleanup();

    // 2. Simulate API Error
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: "org-1",
        orgsById: { "org-1": { type: "CLINIC" } },
      })
    );
    render(<ProtectedInventory />);

    mockCreateItem.mockRejectedValue(new Error("API Fail"));
    fireEvent.click(screen.getByTestId("add-btn"));
    fireEvent.click(screen.getByTestId("submit-add"));

    await waitFor(() => {
      expect(
        screen.getByText("Unable to save inventory item.")
      ).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("handles update item success", async () => {
    mockUpdateItem.mockResolvedValue({
      id: "1",
      basicInfo: { name: "Updated" },
    });
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByTestId("item-1"));
    fireEvent.click(screen.getByTestId("update-btn"));

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalled();
    });
  });

  it("handles update item error", async () => {
    mockUpdateItem.mockRejectedValue(new Error("Fail"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));
    fireEvent.click(screen.getByTestId("update-btn"));

    await waitFor(() => {
      expect(
        screen.getByText("Unable to update inventory item.")
      ).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it("handles add batch success", async () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));
    fireEvent.click(screen.getByTestId("add-batch-btn"));
    expect(mockAddBatch).toHaveBeenCalledWith("1", [{ id: "b1" }]);
  });

  it("handles add batch error", async () => {
    mockAddBatch.mockRejectedValue(new Error("Fail"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));
    fireEvent.click(screen.getByTestId("add-batch-btn"));

    await waitFor(() => {
      expect(screen.getByText("Unable to add batch.")).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it("handles hide/unhide success", async () => {
    mockHideItem.mockResolvedValue({ id: "1", basicInfo: {} });
    mockUnhideItem.mockResolvedValue({ id: "1", basicInfo: {} });

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));

    fireEvent.click(screen.getByTestId("hide-btn"));
    await waitFor(() => expect(mockHideItem).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("unhide-btn"));
    await waitFor(() => expect(mockUnhideItem).toHaveBeenCalled());
  });

  it("handles hide/unhide error", async () => {
    mockHideItem.mockRejectedValue(new Error("Fail"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId("item-1"));
    fireEvent.click(screen.getByTestId("hide-btn"));

    await waitFor(() => {
      expect(
        screen.getByText("Unable to hide inventory item.")
      ).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });
});
