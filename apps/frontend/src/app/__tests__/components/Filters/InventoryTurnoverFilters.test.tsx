import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InventoryTurnoverFilters from "@/app/components/Filters/InventoryTurnoverFilters";

describe("<InventoryTurnoverFilters />", () => {
  const list = [
    { name: "Med A", category: "Medicine" },
    { name: "Supply", category: "Consumable" },
  ];

  test("filters by category buttons", () => {
    const setFilteredList = jest.fn();
    render(
      <InventoryTurnoverFilters
        list={list as any}
        setFilteredList={setFilteredList}
      />,
    );

    expect(setFilteredList).toHaveBeenCalled();
    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual(list);

    fireEvent.click(screen.getByText("Medicines"));
    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([list[0]]);

    fireEvent.click(screen.getByText("Consumables"));
    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([list[1]]);
  });
});
