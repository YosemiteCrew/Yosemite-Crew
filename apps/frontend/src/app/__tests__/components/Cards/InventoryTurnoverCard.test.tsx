import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InventoryTurnoverCard from "@/app/components/Cards/InventoryTurnoverCard";

describe("<InventoryTurnoverCard />", () => {
  const item = {
    name: "Gloves",
    category: "Consumable",
    beginningInventory: 50,
    endingInventory: 10,
    averageInventory: 30,
    totalPurchases: 200,
    turnsPerYear: 8,
    daysOnShelf: 45,
    status: "Healthy",
  };

  test("renders turnover fields and status style", () => {
    render(<InventoryTurnoverCard item={item} />);

    expect(screen.getByText("Gloves")).toBeInTheDocument();
    expect(screen.getByText("Consumable")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("$ 200")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    const status = screen.getByText("Healthy");
    expect(status).toBeInTheDocument();
    expect(status.style.backgroundColor).toBeTruthy();
  });
});
