import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/utils/countryList.json", () => [
  { name: "Germany", code: "DE", flag: "🇩🇪" },
  { name: "France", code: "FR", flag: "🇫🇷" },
]);

import CountryDropdown from "@/app/components/Inputs/CountryDropdown/CountryDropdown";

describe("CountryDropdown", () => {
  test("shows placeholder and emits selection", () => {
    const handleChange = jest.fn();
    render(
      <CountryDropdown
        placeholder="Select country"
        value=""
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /Select country/i });
    fireEvent.click(trigger);

    const germanyOption = screen.getByRole("button", { name: /Germany/ });
    fireEvent.click(germanyOption);

    expect(handleChange).toHaveBeenCalledWith("🇩🇪 Germany");
  });

  test("renders current value and error message", () => {
    render(
      <CountryDropdown
        placeholder="Select country"
        value="🇫🇷 France"
        onChange={jest.fn()}
        error="Country required"
      />
    );

    expect(screen.getByText("🇫🇷 France")).toBeInTheDocument();
    expect(screen.getByText("Country required")).toBeInTheDocument();
  });
});
