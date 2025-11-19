import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InventoryCard from "@/app/components/Cards/InventoryCard";

const item = {
  name: "Sterile Gauze",
  category: "Consumable",
  onHand: 100,
  unitCost: 2,
  sellingPrice: 4,
  totalValue: 200,
  expiry: "2026-01-01",
  location: "Shelf A",
  status: "Low stock",
};

describe("<InventoryCard />", () => {
  test("displays inventory details and status", () => {
    render(<InventoryCard item={item} />);

    expect(screen.getByText("Sterile Gauze")).toBeInTheDocument();
    expect(screen.getByText(/Category:/)).toBeInTheDocument();
    expect(screen.getByText(/Low stock/)).toBeInTheDocument();
    expect(screen.getByText("$ 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });
});
