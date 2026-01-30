import React from "react";
import { render, screen } from "@testing-library/react";
import { BlurIn } from "../../../components/Animations/BlurIn";
import { useInView } from "framer-motion";

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

jest.mock("framer-motion", () => ({
  useInView: jest.fn(),
  motion: {
    // Mock motion.h2 to simply render an h2 with special data attributes
    // so we can assert that the correct props were passed to it.
    h2: ({ children, initial, animate, transition, className }: any) => (
      <h2
        data-testid="motion-h2"
        data-initial={JSON.stringify(initial)}
        data-animate={JSON.stringify(animate)}
        data-transition={JSON.stringify(transition)}
        className={className}
      >
        {children}
      </h2>
    ),
  },
}));

describe("BlurIn Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children correctly", () => {
    (useInView as jest.Mock).mockReturnValue(false);
    render(<BlurIn>Test Content</BlurIn>);

    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByTestId("motion-h2")).toHaveClass(
      "text-xl text-center sm:text-4xl",
    );
  });

  it("applies initial state correctly", () => {
    (useInView as jest.Mock).mockReturnValue(false);
    render(<BlurIn>Initial Check</BlurIn>);

    const element = screen.getByTestId("motion-h2");
    const initial = JSON.parse(element.dataset.initial ?? "{}");

    // Matches line 11: initial={{ filter: 'blur(20px)', opacity: 0 }}
    expect(initial).toEqual({ filter: "blur(20px)", opacity: 0 });
  });

  it("does NOT animate when not in view", () => {
    // Mock useInView to return false
    (useInView as jest.Mock).mockReturnValue(false);

    render(<BlurIn>Hidden Content</BlurIn>);

    const element = screen.getByTestId("motion-h2");
    const animate = JSON.parse(element.dataset.animate ?? "{}");


    // Matches line 12 (False branch): animate={... : {}}
    expect(animate).toEqual({});
  });

  it("animates to visible state when in view", () => {
    // Mock useInView to return true
    (useInView as jest.Mock).mockReturnValue(true);

    render(<BlurIn>Visible Content</BlurIn>);

    const element = screen.getByTestId("motion-h2");
    const animate = JSON.parse(element.dataset.animate ?? "{}");


    // Matches line 12 (True branch): animate={... { filter: 'blur(0px)', opacity: 1 } ...}
    expect(animate).toEqual({ filter: "blur(0px)", opacity: 1 });
  });
});
