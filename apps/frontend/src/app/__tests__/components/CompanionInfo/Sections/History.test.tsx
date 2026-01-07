import React from "react";
import { render, screen } from "@testing-library/react";
import History from "@/app/components/CompanionInfo/Sections/History";

describe("History Section Component", () => {
  // --- 1. Rendering & Content ---

  it("renders the 'Coming soon' message", () => {
    render(<History />);

    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  // --- 2. Styling ---

  it("applies the correct layout classes", () => {
    const { container } = render(<History />);

    // The component is a single div wrapper
    const div = container.firstChild;

    expect(div).toHaveClass(
      "w-full",
      "flex",
      "items-center",
      "justify-center",
      "font-grotesk",
      "text-grey-noti"
    );
  });
});
