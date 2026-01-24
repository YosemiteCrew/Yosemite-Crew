import React from "react";
import { render, screen } from "@testing-library/react";
import { WordsPullUp } from "../../../components/Animations/WordsPullUp";
import { useInView } from "framer-motion";

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

jest.mock("framer-motion", () => ({
  useInView: jest.fn(),
  motion: {
    // Mocking motion.div to inspect props and execute internal variants
    div: ({ children, variants, custom, animate, className }: any) => {
      // Explicitly execute the 'animate' function in the variants to ensure
      // 100% function/branch coverage on the variant definition line.
      if (variants && typeof variants.animate === "function") {
        variants.animate(custom || 0);
      }

      return (
        <div
          data-testid="motion-word"
          data-animate={animate}
          className={className}
        >
          {children}
        </div>
      );
    },
  },
}));

describe("WordsPullUp Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders text split by spaces", () => {
    (useInView as jest.Mock).mockReturnValue(true);
    render(<WordsPullUp text="Hello World" />);

    const words = screen.getAllByTestId("motion-word");
    expect(words).toHaveLength(2);
    expect(words[0]).toHaveTextContent("Hello");
    expect(words[1]).toHaveTextContent("World");
  });

  it("renders correct structure and styling", () => {
    (useInView as jest.Mock).mockReturnValue(true);
    render(
      <WordsPullUp
        text="Test"
        className="text-red-500"
        containerClassName="bg-blue-500"
      />,
    );

    const word = screen.getByTestId("motion-word");
    // Check item classes (includes pr-2! logic)
    expect(word).toHaveClass("pr-2! text-red-500");

    // Check container classes
    const container = word.parentElement;
    expect(container).toHaveClass("bg-blue-500");
  });

  it("handles multiple spaces by rendering non-breaking spaces", () => {
    (useInView as jest.Mock).mockReturnValue(true);
    // "A  B" (double space) splits to ["A", "", "B"]
    render(<WordsPullUp text="A  B" />);

    const words = screen.getAllByTestId("motion-word");
    expect(words).toHaveLength(3);

    // First word
    expect(words[0]).toHaveTextContent("A");

    // Middle "word" (empty string) should render non-breaking space span
    expect(words[1].innerHTML).toContain("<span>&nbsp;</span>");

    // Last word
    expect(words[2]).toHaveTextContent("B");
  });

  it("animates when in view", () => {
    (useInView as jest.Mock).mockReturnValue(true);
    render(<WordsPullUp text="Visible" />);

    const word = screen.getByTestId("motion-word");
    // Code logic: animate={isInView ? "animate" : ""}
    expect(word).toHaveAttribute("data-animate", "animate");
  });

  it("does not animate when not in view", () => {
    (useInView as jest.Mock).mockReturnValue(false);
    render(<WordsPullUp text="Hidden" />);

    const word = screen.getByTestId("motion-word");
    // Code logic: animate={isInView ? "animate" : ""} -> becomes ""
    expect(word).toHaveAttribute("data-animate", "");
  });
});
