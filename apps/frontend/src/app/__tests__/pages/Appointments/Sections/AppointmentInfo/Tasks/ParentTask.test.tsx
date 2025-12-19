import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Matches the depth used in previous Tasks tests (8 levels up to root, then down)
import ParentTask from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Tasks/ParentTask";

describe("ParentTask Component", () => {
  // --- Section 1: Rendering & Content ---

  it("should render without crashing", () => {
    const { container } = render(<ParentTask />);
    expect(container).toBeInTheDocument();
  });

  it("should display the 'Coming soon' placeholder text", () => {
    render(<ParentTask />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  // --- Section 2: Structure & Styling ---

  it("should have the correct layout and styling classes", () => {
    const { container } = render(<ParentTask />);

    // Check that the container div has the centering and font classes
    // We check the first child because the component returns a single <div>
    expect(container.firstChild).toHaveClass(
      "w-full",
      "flex",
      "items-center",
      "justify-center",
      "font-grotesk",
      "text-grey-noti",
      "font-normal"
    );
  });
});
