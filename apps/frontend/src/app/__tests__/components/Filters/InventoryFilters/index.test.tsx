import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ value, onChange, options, disabled }: any) => (
    <select
      data-testid="category-dropdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

describe("InventoryFilters", () => {
  it("resets invalid category when categories change", () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ category: "Toys", status: "ALL", search: "" } as any}
        onChange={onChange}
        categories={["Food"]}
      />
    );

    expect(onChange).toHaveBeenCalledWith({
      category: "all",
      status: "ALL",
      search: "",
    });
  });

  it("updates category and status filters", () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ category: "all", status: "ALL", search: "" } as any}
        onChange={onChange}
        categories={["Food"]}
      />
    );

    fireEvent.change(screen.getByTestId("category-dropdown"), {
      target: { value: "Food" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      category: "Food",
      status: "ALL",
      search: "",
    });

    fireEvent.click(screen.getByText("Expired"));
    expect(onChange).toHaveBeenLastCalledWith({
      category: "all",
      status: "EXPIRED",
      search: "",
    });
  });

  it("disables interactions while loading", () => {
    const onChange = jest.fn();
    render(
      <InventoryFilters
        filters={{ category: "all", status: "ALL", search: "" } as any}
        onChange={onChange}
        categories={["Food"]}
        loading
      />
    );

    expect(screen.getByTestId("category-dropdown")).toBeDisabled();
    expect(screen.getByText("Active")).toBeDisabled();
  });
});
