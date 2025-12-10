import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/link", () => {
  const Link = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = "Link";
  return { __esModule: true, default: Link };
});

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <div>
      <label>
        {inlabel}
        <input
          aria-label={inlabel}
          value={value}
          onChange={(e) => onChange(e)}
        />
      </label>
      {error ? <span data-testid={`${inlabel}-error`}>{error}</span> : null}
    </div>
  ),
}));

jest.mock("@/app/components/Faq/Faq", () => ({
  __esModule: true,
  default: () => <div data-testid="faq" />,
}));

jest.mock("@/app/components/Footer/Footer", () => ({
  __esModule: true,
  default: () => <footer data-testid="footer" />,
}));

jest.mock("@/app/components/Buttons", () => ({
  __esModule: true,
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

import PricingPage from "@/app/pages/PricingPage/PricingPage";

describe("PricingPage", () => {
  test("toggles billing cycles and shows plans", () => {
    render(<PricingPage />);

    const monthly = screen.getByText("Pay monthly");
    const yearly = screen.getByText("Pay yearly");
    expect(yearly.className).toMatch(/bg-blue-light/);

    fireEvent.click(monthly);
    expect(monthly.className).toMatch(/bg-blue-light/);
    expect(screen.getByText("Transparent pricing, no hidden fees")).toBeInTheDocument();
    expect(screen.getAllByText("Get started").length).toBeGreaterThan(0);
  });

  test("opens notify modal and validates inputs", () => {
    render(<PricingPage />);

    fireEvent.click(screen.getByText("Notify me"));
    expect(screen.getByText("Get notified")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Send"));
    expect(screen.getByTestId("First name-error")).toHaveTextContent("required");
    expect(screen.getByTestId("Last name-error")).toHaveTextContent("required");
    expect(screen.getByTestId("Enter email-error")).toHaveTextContent("required");

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByLabelText("Enter email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByText("Send"));

    expect(screen.queryByTestId("First name-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("Enter email-error")).not.toBeInTheDocument();
  });
});
