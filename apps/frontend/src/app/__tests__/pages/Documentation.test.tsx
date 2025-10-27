
import Documentation from "@/app/pages/Documentation/Documentation";
import { render, screen } from "@testing-library/react";


describe("Documentation Page", () => {
  it("renders the Documentation heading", () => {
    render(<Documentation />);
    const heading = screen.getByText(/Documentation/i);
    expect(heading).toBeInTheDocument();
  });
});
