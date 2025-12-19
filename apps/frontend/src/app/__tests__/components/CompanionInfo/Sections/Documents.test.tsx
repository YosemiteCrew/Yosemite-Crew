import React from "react";
import { render, screen } from "@testing-library/react";
import Documents from "@/app/components/CompanionInfo/Sections/Documents";

describe("Documents Section Component", () => {
  // --- 1. Rendering & Content ---

  it("renders the 'Coming soon' message", () => {
    render(<Documents />);

    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  // --- 2. Styling ---

  it("applies the correct layout classes", () => {
    const { container } = render(<Documents />);

    // The component is a single div
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
