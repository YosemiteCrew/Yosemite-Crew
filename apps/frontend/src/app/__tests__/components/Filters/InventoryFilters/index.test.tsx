import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, options }: any) => (
    <div>
      <span>{placeholder}</span>
      <button
        type="button"
        onClick={() => onSelect(options[1])}
      >
        pick-category
      </button>
    </div>
  ),
}));

describe("InventoryFilters", () => {
  it("updates status and category", () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ status: "ALL", category: "all" } as any}
        onChange={onChange}
        categories={["Food"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(onChange).toHaveBeenCalledWith({
      status: "ACTIVE",
      category: "all",
    });

    fireEvent.click(screen.getByRole("button", { name: "pick-category" }));
    expect(onChange).toHaveBeenCalledWith({
      status: "ALL",
      category: "Food",
    });
  });
});
