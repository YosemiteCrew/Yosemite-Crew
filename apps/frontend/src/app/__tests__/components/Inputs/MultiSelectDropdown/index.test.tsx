import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";

jest.mock("react-icons/io", () => ({
  IoIosClose: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      remove
    </button>
  ),
  IoIosWarning: () => <span>warning</span>,
}));

jest.mock("react-icons/fa6", () => ({
  FaCaretDown: () => <span>caret</span>,
}));

describe("MultiSelectDropdown", () => {
  it("adds and removes options", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        placeholder="Select"
        value={[]}
        onChange={onChange}
        options={["One", "Two"]}
      />
    );

    fireEvent.click(screen.getByText("Select"));
    fireEvent.click(screen.getByRole("button", { name: "One" }));
    expect(onChange).toHaveBeenCalledWith(["One"]);

    rerender(
      <MultiSelectDropdown
        placeholder="Select"
        value={["One"]}
        onChange={onChange}
        options={["One", "Two"]}
      />
    );

    fireEvent.click(screen.getByText("remove"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
