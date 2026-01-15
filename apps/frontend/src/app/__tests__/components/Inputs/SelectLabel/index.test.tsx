import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SelectLabel from "@/app/components/Inputs/SelectLabel";

describe("SelectLabel", () => {
  const options = [
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" },
  ];

  it("renders options and handles selection", () => {
    const setOption = jest.fn();
    render(
      <SelectLabel
        title="Neutered"
        options={options}
        activeOption="yes"
        setOption={setOption}
      />
    );

    expect(screen.getByText("Neutered")).toBeInTheDocument();
    fireEvent.click(screen.getByText("No"));
    expect(setOption).toHaveBeenCalledWith("no");
  });
});
