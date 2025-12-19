import React from "react";
import { render, screen } from "@testing-library/react";
import FieldRendered from "@/app/components/Accordion/FieldRendered";

describe("FieldRendered Component", () => {
  it("renders the component text correctly", () => {
    render(<FieldRendered />);

    const element = screen.getByText("FieldRendered");
    expect(element).toBeInTheDocument();
  });
});
