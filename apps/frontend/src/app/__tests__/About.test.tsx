import { render, screen } from "@testing-library/react";
import AboutUs from "@/app/pages/AboutUs/AboutUs";

describe("About page", () => {
  it("renders the main heading with correct content", () => {
    render(<AboutUs />);

    // Check for the h2 heading with span text included
    const heading = screen.getByRole("heading", {
      level: 2,
      name: /welcome to yosemite crew where compassion meets code/i,
    });
    expect(heading).toBeInTheDocument();

  });
});
