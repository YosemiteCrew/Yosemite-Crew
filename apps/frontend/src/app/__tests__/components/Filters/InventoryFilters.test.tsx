import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";

const baseList = [
  {
    name: "Gauze Pads",
    category: "Consumable",
    parent: "Supply",
    status: "This week",
  },
  {
    name: "Digital Scale",
    category: "Equipment",
    parent: "Lab",
    status: "Low stock",
  },
  {
    name: "Topical Cream",
    category: "Medicine",
    parent: "Pharmacy",
    status: "Hidden",
  },
] as any[];

describe("<InventoryFilters />", () => {
  test("sends list filtered by default status on mount", async () => {
    const setFilteredList = jest.fn();
    render(
      <InventoryFilters list={baseList} setFilteredList={setFilteredList} />
    );

    await waitFor(() => expect(setFilteredList).toHaveBeenCalled());
    const items = setFilteredList.mock.calls.at(-1)?.[0];
    expect(items).toHaveLength(1);
    expect(items?.[0].name).toBe("Gauze Pads");
  });

  test("combines category, status and text search filters", async () => {
    const setFilteredList = jest.fn();
    render(
      <InventoryFilters list={baseList} setFilteredList={setFilteredList} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Consumables" }));
    fireEvent.click(screen.getByRole("button", { name: "Low stock" }));
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "Digital" },
    });

    await waitFor(() =>
      expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([])
    );

    fireEvent.click(screen.getByRole("button", { name: "Equipments" }));
    await waitFor(() =>
      expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([
        expect.objectContaining({ name: "Digital Scale" }),
      ])
    );
  });
});
