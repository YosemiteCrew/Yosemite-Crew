import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import History from "@/app/components/CompanionInfo/Sections/History";

describe("CompanionInfo History section", () => {
  it("renders coming soon message", () => {
    render(<History />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
