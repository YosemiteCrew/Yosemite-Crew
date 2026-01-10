import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/link", () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import Primary from "@/app/components/Buttons/Primary";

describe("Primary button", () => {
  test("renders the provided text and href", () => {
    render(<Primary text="Book onboarding call" href="/book-demo" />);

    const link = screen.getByRole("link", { name: "Book onboarding call" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/book-demo");
  });

  test("prevents default navigation and calls onClick handler", () => {
    const handleClick = jest.fn();

    render(<Primary text="Next" href="/next" onClick={handleClick} />);

    const link = screen.getByRole("link", { name: "Next" });
    fireEvent.click(link);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick.mock.calls[0][0].defaultPrevented).toBe(true);
  });
});
