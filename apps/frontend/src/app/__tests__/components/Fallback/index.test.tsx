import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Fallback from "@/app/ui/overlays/Fallback";

describe("Fallback", () => {
  it("renders not authorized message", () => {
    render(<Fallback />);
    expect(screen.getByText("Not authorized")).toBeInTheDocument();
  });
});
