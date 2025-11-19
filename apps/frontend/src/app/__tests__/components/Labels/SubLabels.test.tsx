import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SubLabels from "@/app/components/Labels/SubLabels";

const LABELS = [
  { key: "companion", name: "Companion" },
  { key: "parent", name: "Parent" },
];

describe("<SubLabels />", () => {
  test("renders buttons with active styling and handles clicks", () => {
    const setActiveLabel = jest.fn();
    const { container } = render(
      <SubLabels
        labels={LABELS}
        activeLabel="companion"
        setActiveLabel={setActiveLabel}
      />
    );

    const wrapper = container.firstChild as HTMLDivElement;
    expect(wrapper.className).toContain("justify-center");

    fireEvent.click(screen.getByRole("button", { name: "Parent" }));
    expect(setActiveLabel).toHaveBeenCalledWith("parent");
  });

  test("switches to justify-start when content overflows", () => {
    const { container } = render(
      <SubLabels
        labels={LABELS}
        activeLabel="companion"
        setActiveLabel={jest.fn()}
      />
    );
    const wrapper = container.firstChild as HTMLDivElement;

    Object.defineProperty(wrapper, "scrollWidth", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(wrapper, "clientWidth", {
      configurable: true,
      value: 100,
    });

    act(() => {
      globalThis.dispatchEvent(new Event("resize"));
    });

    expect(wrapper.className).toContain("justify-start");
  });
});
