import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Delete from "@/app/components/Buttons/Delete";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, onClick, children, className, ...rest }: any) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
}));

describe("Delete button", () => {
  it("renders link text and href", () => {
    render(<Delete text="Remove" href="/remove" />);

    const link = screen.getByRole("link", { name: "Remove" });
    expect(link).toHaveAttribute("href", "/remove");
  });

  it("calls onClick when enabled", () => {
    const onClick = jest.fn();
    render(<Delete text="Delete" href="#" onClick={onClick} />);

    fireEvent.click(screen.getByRole("link", { name: "Delete" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks click when disabled", () => {
    const onClick = jest.fn();
    render(
      <Delete text="Delete" href="#" onClick={onClick} isDisabled />
    );

    const link = screen.getByRole("link", { name: "Delete" });
    fireEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
    expect(link).toHaveAttribute("aria-disabled", "true");
  });
});
