import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  __esModule: true,
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Filters/InventoryFilters", () => ({
  __esModule: true,
  default: ({ setFilteredList, list }: any) => (
    <div data-testid="inventory-filters">
      <button type="button" onClick={() => setFilteredList([])}>
        clear-filters
      </button>
      <button type="button" onClick={() => setFilteredList(list)}>
        reset-filters
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
    </div>
  ),
}));

jest.mock("@/app/components/Filters/InventoryTurnoverFilters", () => ({
  __esModule: true,
  default: () => <div data-testid="turnover-filters" />,
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

import ProtectedInventory from "@/app/pages/Inventory";

describe("Inventory page", () => {
  test("renders inventory layout inside protected route", () => {
    render(<ProtectedInventory />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-filters")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-table")).toBeInTheDocument();
    expect(screen.getByTestId("turnover-filters")).toBeInTheDocument();
    expect(screen.getByTestId("turnover-table")).toBeInTheDocument();
    expect(screen.getByTestId("add-inventory")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-info")).toBeInTheDocument();
  });

  test("opens add-inventory modal when add button clicked", () => {
    render(<ProtectedInventory />);

    expect(screen.getByTestId("add-inventory")).toHaveAttribute(
      "data-open",
      "false",
    );
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-inventory")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  test("toggles inventory info visibility based on selection and filters", async () => {
    render(<ProtectedInventory />);

    expect(screen.getByTestId("inventory-info")).toHaveAttribute(
      "data-open",
      "false",
    );

    fireEvent.click(screen.getByText("open-inventory"));
    expect(screen.getByTestId("inventory-info")).toHaveAttribute(
      "data-open",
      "true",
    );

    fireEvent.click(screen.getByText("clear-filters"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("inventory-info"),
      ).not.toBeInTheDocument(),
    );
  });
});
