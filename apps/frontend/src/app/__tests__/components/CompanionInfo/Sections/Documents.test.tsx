import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Documents from "@/app/components/CompanionInfo/Sections/Documents";

describe("CompanionInfo Documents section", () => {
  it("renders coming soon message", () => {
    render(<Documents />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
