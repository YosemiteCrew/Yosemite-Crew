import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../jest.mocks/testMocks";

const genericTableMock = jest.fn(
  ({ columns, data }: { columns: any[]; data: any[] }) => (
    <div data-testid="inventory-generic">
      {columns.map((col) => (
        <div key={col.key}>{col.render ? col.render(data[0]) : null}</div>
      ))}
    </div>
  )
);

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: (props: any) => genericTableMock(props),
}));

const inventoryCardMock = jest.fn(
  ({ item }: { item: any }) => <div data-testid="inventory-card">{item.name}</div>
);

jest.mock("@/app/components/Cards/InventoryCard", () => ({
  __esModule: true,
  default: (props: any) => inventoryCardMock(props),
}));

import InventoryTable, {
  getStatusStyle,
} from "@/app/components/DataTable/InventoryTable";

type InventoryStatus = "Low stock" | "Expired" | "Hidden" | "This week";
type InventoryCategory = "Medicine" | "Consumable" | "Equipment";
interface InventoryItem {
  name: string;
  category: InventoryCategory;
  onHand: number;
  unitCost: number;
  sellingPrice: number;
  totalValue: number;
  expiry: string;
  location: string;
  status: InventoryStatus;
}

const items: InventoryItem[] = [
  {
    name: "Gauze Pads",
    category: "Consumable",
    onHand: 10,
    unitCost: 2,
    sellingPrice: 4,
    totalValue: 20,
    expiry: "2026-01-01",
    location: "Shelf A",
    status: "Low stock",
  },
];

describe("<InventoryTable />", () => {
  beforeEach(() => {
    genericTableMock.mockClear();
    inventoryCardMock.mockClear();
  });

  test("renders generic table and cards for each item", () => {
    render(<InventoryTable filteredList={items} />);
    expect(genericTableMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: items })
    );
    expect(inventoryCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ item: items[0] })
    );
  });
});

describe("getStatusStyle (inventory)", () => {
  test("returns expected colors", () => {
    expect(getStatusStyle("Low stock")).toEqual(
      expect.objectContaining({ color: "#F68523" })
    );
    expect(getStatusStyle("Unknown")).toEqual(
      expect.objectContaining({ color: "#6b7280" })
    );
  });
});
