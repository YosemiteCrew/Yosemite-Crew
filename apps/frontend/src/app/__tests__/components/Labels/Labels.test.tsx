import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Labels from "@/app/components/Labels/Labels";

describe("Labels", () => {
  const labels = [
    {
      key: "details",
      name: "Details",
      labels: [
        { key: "core", name: "Core" },
        { key: "history", name: "History" },
      ],
    },
    { key: "documents", name: "Documents", labels: [] },
  ];

  it("renders main labels and sublabels for active label", () => {
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={jest.fn()}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("calls setActiveLabel when clicking a label", () => {
    const setActiveLabel = jest.fn();
    render(
      <Labels
        labels={labels}
        activeLabel="details"
        setActiveLabel={setActiveLabel}
        activeSubLabel="core"
        setActiveSubLabel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Documents"));
    expect(setActiveLabel).toHaveBeenCalledWith("documents");
  });
});
