import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Progress from "@/app/components/Steps/Progress/Progress";

describe("Steps Progress", () => {
  test("marks the active step", () => {
    const steps = [
      { title: "Organisation", logo: "1" },
      { title: "Address", logo: "2" },
    ];

    const { container } = render(<Progress activeStep={1} steps={steps} />);

    const titles = screen.getAllByText(/Organisation|Address/);
    expect(titles[1]).toHaveClass("activestep");

    const activeBadges = container.querySelectorAll(".activestepbackground");
    expect(activeBadges.length).toBeGreaterThan(0);
  });
});
