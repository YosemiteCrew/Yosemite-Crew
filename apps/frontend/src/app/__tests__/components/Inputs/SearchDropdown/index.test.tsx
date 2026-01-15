import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchDropdown from "@/app/components/Inputs/SearchDropdown";

jest.mock("react-icons/io", () => ({
  IoIosSearch: () => <span data-testid="icon-search" />,
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

const Wrapper = ({ onSelect }: { onSelect: (val: string) => void }) => {
  const [query, setQuery] = useState("");
  return (
    <SearchDropdown
      options={[
        { value: "buddy", label: "Buddy" },
        { value: "bella", label: "Bella" },
      ]}
      onSelect={onSelect}
      placeholder="Search companion"
      query={query}
      setQuery={setQuery}
      minChars={1}
    />
  );
};

describe("SearchDropdown", () => {
  it("shows filtered options when query meets min chars", () => {
    render(<Wrapper onSelect={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Search companion"), {
      target: { value: "b" },
    });

    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Bella")).toBeInTheDocument();
  });

  it("selects an option and closes the list", () => {
    const onSelect = jest.fn();
    render(<Wrapper onSelect={onSelect} />);

    fireEvent.change(screen.getByPlaceholderText("Search companion"), {
      target: { value: "bud" },
    });
    fireEvent.click(screen.getByText("Buddy"));

    expect(onSelect).toHaveBeenCalledWith("buddy");
    expect(screen.queryByText("Buddy")).not.toBeInTheDocument();
  });

  it("renders error message when provided", () => {
    render(
      <SearchDropdown
        options={[]}
        onSelect={jest.fn()}
        placeholder="Search"
        query={""}
        setQuery={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByTestId("icon-warning")).toBeInTheDocument();
  });
});
