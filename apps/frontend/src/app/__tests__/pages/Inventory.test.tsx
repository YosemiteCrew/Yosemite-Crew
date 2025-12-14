import React from "react";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useOrgStore } from "@/app/stores/orgStore";
import { fetchInventoryItems, fetchInventoryTurnover } from "@/app/services/inventoryService";
import ProtectedInventory from "@/app/pages/Inventory";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/hooks/useLoadOrg", () => ({
  __esModule: true,
  useLoadOrg: jest.fn(),
}));

jest.mock("@/app/components/Buttons", () => ({
  __esModule: true,
  Primary: ({ text, onClick, disabled, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled || isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, disabled, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled || isDisabled}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Filters/InventoryFilters", () => ({
  __esModule: true,
  default: ({ onChange, filters }: any) => (
    <div data-testid="inventory-filters">
      <button
        type="button"
        onClick={() => onChange({ ...filters, search: "filter" })}
      >
        filter
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/InventoryTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActiveInventory, setViewInventory }: any) => (
    <div data-testid="inventory-table">
      <button
        type="button"
        onClick={() => {
          setActiveInventory(filteredList[0] ?? null);
          setViewInventory(true);
        }}
      >
        open-inventory
      </button>
      <button
        type="button"
        onClick={() => {
          setActiveInventory(null);
          setViewInventory(false);
        }}
      >
        clear-selection
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/InventoryTurnoverTable", () => ({
  __esModule: true,
  default: () => <div data-testid="turnover-table" />,
}));

jest.mock("@/app/components/AddInventory", () => ({
  __esModule: true,
  default: ({ showModal, setShowModal }: any) => (
    <div data-testid="add-inventory" data-open={showModal}>
      <button type="button" onClick={() => setShowModal(false)}>
        close-add
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/InventoryInfo", () => ({
  __esModule: true,
  default: ({ showModal, activeInventory, setShowModal }: any) =>
    activeInventory ? (
      <div
        data-testid="inventory-info"
        data-open={showModal}
        data-name={activeInventory?.basicInfo?.name ?? ""}
      >
        <button type="button" onClick={() => setShowModal(true)}>
          open-info
        </button>
      </div>
    ) : null,
}));

jest.mock("@/app/services/inventoryService", () => ({
  __esModule: true,
  fetchInventoryItems: jest.fn(),
  fetchInventoryTurnover: jest.fn(),
  createInventoryItem: jest.fn(),
  updateInventoryItem: jest.fn(),
  hideInventoryItem: jest.fn(),
}));

const mockInventoryResponse = [
  {
    _id: "item-1",
    organisationId: "org-1",
    businessType: "HOSPITAL",
    name: "Mock Item",
    category: "Medicine",
    subCategory: "Antibiotic",
    description: "desc",
    onHand: 10,
    allocated: 2,
    reorderLevel: 5,
    unitCost: 12,
    sellingPrice: 20,
    status: "ACTIVE",
    stockHealth: "HEALTHY",
    attributes: {
      stockLocation: "Pharmacy",
    },
  },
];

describe("Inventory page", () => {
  beforeEach(() => {
    (fetchInventoryItems as jest.Mock).mockResolvedValue(mockInventoryResponse);
    (fetchInventoryTurnover as jest.Mock).mockResolvedValue([]);
    useOrgStore.setState({
      orgsById: {
        "org-1": { _id: "org-1", name: "Org", type: "HOSPITAL" } as any,
      },
      orgIds: ["org-1"],
      primaryOrgId: "org-1",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    act(() => {
      useOrgStore.getState().clearOrgs();
    });
  });

  test("renders inventory layout inside protected route", async () => {
    render(<ProtectedInventory />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("inventory-table")).toBeInTheDocument()
    );
    expect(screen.getByTestId("inventory-filters")).toBeInTheDocument();
    expect(screen.getByTestId("turnover-table")).toBeInTheDocument();
    expect(screen.getByTestId("add-inventory")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("inventory-info")).toBeInTheDocument()
    );
  });

  test("opens add-inventory modal when add button clicked", async () => {
    render(<ProtectedInventory />);

    await waitFor(() =>
      expect(screen.getByTestId("add-inventory")).toHaveAttribute(
        "data-open",
        "false"
      )
    );
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-inventory")).toHaveAttribute(
      "data-open",
      "true"
    );
  });

  test("toggles inventory info visibility based on selection and clearing selection", async () => {
    render(<ProtectedInventory />);

    await waitFor(() =>
      expect(screen.getByTestId("inventory-info")).toHaveAttribute(
        "data-open",
        "false"
      )
    );

    fireEvent.click(screen.getByText("open-inventory"));
    expect(screen.getByTestId("inventory-info")).toHaveAttribute(
      "data-open",
      "true"
    );

    fireEvent.click(screen.getByText("clear-selection"));
    await waitFor(() =>
      expect(screen.queryByTestId("inventory-info")).not.toBeInTheDocument()
    );
  });
});
