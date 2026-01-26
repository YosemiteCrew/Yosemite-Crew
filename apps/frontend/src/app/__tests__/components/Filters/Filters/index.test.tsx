import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Filters from "@/app/components/Filters/Filters";

const filterOptions = [
  { key: "all", name: "All" },
  { key: "recent", name: "Recent" },
];

const statusOptions = [
  { key: "available", name: "Available", bg: "#eee", text: "#111" },
  { key: "requested", name: "Requested", bg: "#ddd", text: "#222" },
];

describe("Filters", () => {
  it("renders filter and status buttons and handles clicks", () => {
    const setActiveFilter = jest.fn();
    const setActiveStatus = jest.fn();

    render(
      <Filters
        filterOptions={filterOptions}
        statusOptions={statusOptions}
        activeFilter="all"
        activeStatus="requested"
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
      />
    );

    fireEvent.click(screen.getByText("Recent"));
    expect(setActiveFilter).toHaveBeenCalledWith("recent");

    fireEvent.click(screen.getByText("Available"));
    expect(setActiveStatus).toHaveBeenCalledWith("available");
  });
});
