import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InventoryTable, {
  getStatusStyle,
} from "@/app/components/DataTable/InventoryTable";

const createInventoryItem = () =>
  ({
    basicInfo: {
      name: "Apoquel",
      category: "Medicine",
      subCategory: "",
      department: "",
      description: "Itchy dogs",
      status: "Low stock",
    },
    classification: {
      form: "",
      unitofMeasure: "",
      species: "",
      administration: "",
    },
    pricing: {
      purchaseCost: "10",
      selling: "15",
      maxDiscount: "",
      tax: "",
    },
    vendor: {
      supplierName: "",
      brand: "",
      vendor: "",
      license: "",
      paymentTerms: "",
      leadTime: "",
    },
    stock: {
      current: "2",
      allocated: "",
      available: "",
      reorderLevel: "",
      reorderQuantity: "",
      stockLocation: "Fridge",
      stockType: "",
      minStockAlert: "",
    },
    batch: {
      batch: "",
      manufactureDate: "",
      expiryDate: "2025-01-01",
      serial: "",
      tracking: "",
      litterId: "",
      nextRefillDate: "",
    },
    status: "Low stock",
  } as any);

describe("<InventoryTable />", () => {
  test("renders table rows and card view", () => {
    const item = createInventoryItem();
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();

    render(
      <InventoryTable
        filteredList={[item]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
      />,
    );

    expect(screen.getAllByText("Apoquel")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Medicine").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$ 15").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("View"));
    expect(setActiveInventory).toHaveBeenCalledWith(item);
    expect(setViewInventory).toHaveBeenCalledWith(true);
  });

  test("maps status styles correctly", () => {
    expect(getStatusStyle("this week")).toEqual({
      color: "#54B492",
      backgroundColor: "#E6F4EF",
    });
    expect(getStatusStyle("expired")).toEqual({
      color: "#EA3729",
      backgroundColor: "#FDEBEA",
    });
    expect(getStatusStyle("unknown").color).toBeTruthy();
  });
});
