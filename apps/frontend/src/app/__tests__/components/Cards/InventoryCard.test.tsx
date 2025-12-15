import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InventoryCard from "@/app/components/Cards/InventoryCard";

describe("<InventoryCard />", () => {
  const item = {
    basicInfo: {
      name: "Heartworm Med",
      category: "Medicine",
      subCategory: "",
      department: "",
      description: "Desc",
      status: "Low stock",
    },
    pricing: {
      purchaseCost: "12",
      selling: "15",
      maxDiscount: "",
      tax: "",
    },
    stock: {
      current: "3",
      allocated: "",
      available: "",
      reorderLevel: "",
      reorderQuantity: "",
      stockLocation: "Pharmacy",
      stockType: "",
      minStockAlert: "",
    },
    batch: {
      batch: "",
      manufactureDate: "",
      expiryDate: "2025-02-01",
      serial: "",
      tracking: "",
      litterId: "",
      nextRefillDate: "",
    },
    status: "Low stock",
  };

  test("renders inventory fields and status", () => {
    render(<InventoryCard item={item} handleViewInventory={jest.fn()} />);

    expect(screen.getByText("Heartworm Med")).toBeInTheDocument();
    expect(screen.getByText("Medicine")).toBeInTheDocument();
    expect(screen.getByText("3 units")).toBeInTheDocument();
    expect(screen.getByText("$ 12")).toBeInTheDocument();
    expect(screen.getByText("$ 15")).toBeInTheDocument();
    expect(screen.getByText("01 Feb 2025")).toBeInTheDocument();
    expect(screen.getByText("Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
  });

  test("invokes view handler on button click", () => {
    const onView = jest.fn();
    render(<InventoryCard item={item} handleViewInventory={onView} />);

    fireEvent.click(screen.getByText("View"));
    expect(onView).toHaveBeenCalledWith(item);
  });
});
