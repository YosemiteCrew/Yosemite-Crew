import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import InventoryTable from "@/app/components/DataTable/InventoryTable";

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span data-testid="icon-eye" />,
}));

jest.mock("@/app/components/Cards/InventoryCard", () => ({
  __esModule: true,
  default: ({ item, handleViewInventory }: any) => (
    <div data-testid="mobile-card">
      <span>{item.basicInfo.name}</span>
      <button
        type="button"
        onClick={() => handleViewInventory(item)}
      >
        View Mobile
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <table data-testid="generic-table">
      <tbody>
        {data.map((row: any, idx: number) => (
          <tr key={row.id} data-testid="table-row">
            {columns.map((col: any) => (
              <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock("@/app/pages/Inventory/utils", () => ({
  displayStatusLabel: () => "Healthy",
  formatDisplayDate: () => "01 Jan 2025",
  getStatusBadgeStyle: () => ({ backgroundColor: "#000", color: "#fff" }),
}));

describe("InventoryTable", () => {
  const item = {
    id: "item-1",
    basicInfo: {
      name: "Vaccine",
      category: "Medicine",
      status: "ACTIVE",
    },
    stock: {
      current: 2,
      stockLocation: "Shelf A",
    },
    pricing: {
      purchaseCost: 5,
      selling: 10,
    },
    batch: {
      expiryDate: "2025-01-01",
    },
  } as any;

  it("renders table data and mobile cards", () => {
    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={jest.fn()}
        setViewInventory={jest.fn()}
      />
    );

    const table = screen.getByTestId("generic-table");
    const tableScope = within(table);
    expect(tableScope.getByText("Vaccine")).toBeInTheDocument();
    expect(tableScope.getByText("Medicine")).toBeInTheDocument();
    expect(tableScope.getByText("2 units")).toBeInTheDocument();
    expect(tableScope.getByText("$ 5")).toBeInTheDocument();
    expect(tableScope.getByText("$ 10")).toBeInTheDocument();
    expect(tableScope.getByText("$ 20")).toBeInTheDocument();
    expect(tableScope.getByText("01 Jan 2025")).toBeInTheDocument();
    expect(tableScope.getByText("Shelf A")).toBeInTheDocument();
    expect(tableScope.getByText("Healthy")).toBeInTheDocument();

    const cards = screen.getAllByTestId("mobile-card");
    expect(cards).toHaveLength(1);
  });

  it("handles view action", () => {
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
      />
    );

    fireEvent.click(screen.getByTestId("icon-eye").closest("button")!);
    expect(setActiveInventory).toHaveBeenCalledWith(item);
    expect(setViewInventory).toHaveBeenCalledWith(true);
  });
});
