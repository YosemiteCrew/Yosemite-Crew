import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 6 levels to 'src/app', then down to 'pages'
import Audit from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Audit";

describe("Audit Component", () => {
  // --- Section 1: Rendering & Content ---

  it("should render without crashing", () => {
    const { container } = render(<Audit />);
    expect(container).toBeInTheDocument();
  });

  it("should display the 'Coming soon' placeholder text", () => {
    render(<Audit />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  // --- Section 2: Structure & Styling ---

  it("should have the correct layout and styling classes", () => {
    const { container } = render(<Audit />);

    // Check that the container div has the centering and font classes
    // We check the first child because the component returns a single <div>
    expect(container.firstChild).toHaveClass(
      "w-full",
      "flex",
      "items-center",
      "justify-center",
      "font-grotesk",
      "text-grey-noti"
    );
  });
});
