import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import SelectLabel from "@/app/components/Inputs/SelectLabel";

describe("<SelectLabel />", () => {
  test("renders options and highlights the active one", () => {
    const setOption = jest.fn();
    render(
      <SelectLabel
        title="Gender"
        options={["Male", "Female"]}
        activeOption="Male"
        setOption={setOption}
      />
    );

    expect(screen.getByText("Gender")).toBeInTheDocument();
    const active = screen.getByRole("button", { name: "Male" });
    expect(active.className).toMatch(/bg-blue-light/);

    fireEvent.click(screen.getByRole("button", { name: "Female" }));
    expect(setOption).toHaveBeenCalledWith("Female");
  });

  test("supports column layout", () => {
    const { container } = render(
      <SelectLabel
        title="Origin"
        options={["Shop", "Shelter"]}
        activeOption="Shop"
        setOption={jest.fn()}
        type="coloumn"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("flex-col");
  });
});
