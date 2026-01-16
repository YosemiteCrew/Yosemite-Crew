import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SubLabels from "@/app/components/Labels/SubLabels";

describe("SubLabels", () => {
  const labels = [
    { key: "core", name: "Core" },
    { key: "history", name: "History" },
  ];

  it("renders status indicators", () => {
    render(
      <SubLabels
        labels={labels}
        activeLabel="core"
        setActiveLabel={jest.fn()}
        statuses={{ core: "valid", history: "error" }}
      />
    );

    const coreButton = screen.getByText("Core").closest("button");
    const historyButton = screen.getByText("History").closest("button");

    expect(within(coreButton!).getByText("•")).toBeInTheDocument();
    expect(within(historyButton!).getByText("•")).toBeInTheDocument();
  });

  it("prevents clicking when disabled", () => {
    const setActiveLabel = jest.fn();
    render(
      <SubLabels
        labels={labels}
        activeLabel="core"
        setActiveLabel={setActiveLabel}
        disableClicking
      />
    );

    fireEvent.click(screen.getByText("History"));
    expect(setActiveLabel).not.toHaveBeenCalled();
  });
});
