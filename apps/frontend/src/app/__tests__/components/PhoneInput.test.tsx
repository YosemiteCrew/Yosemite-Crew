import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import PhoneInput from "@/app/components/PhoneInput/PhoneInput"; 
jest.mock("react-bootstrap/Form", () => ({
  Group: ({ children, className }: { children: React.ReactNode; className: string }) => <div className={className}>{children}</div>,
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  Text: ({ children, className }: { children: React.ReactNode; className: string }) => <p className={className}>{children}</p>,
}));

jest.mock("react-icons/fa6", () => ({
  FaChevronDown: () => <svg data-testid="chevron-icon" />,
}));

describe("PhoneInput Component", () => {
  const mockOnPhoneChange = jest.fn();
  const mockOnCountryCodeChange = jest.fn();

  beforeEach(() => {
    mockOnPhoneChange.mockClear();
    mockOnCountryCodeChange.mockClear();
  });

  it("should render with initial values and default countries", () => {
    render(
      <PhoneInput
        countryCode="+1"
        phone="1234567890"
        onPhoneChange={mockOnPhoneChange}
      />
    );

    expect(screen.getByText("Phone Number")).toBeInTheDocument();

    const phoneInput = screen.getByPlaceholderText("672-892-6294");
    expect(phoneInput).toHaveValue("1234567890");

    const countrySelect = screen.getByRole("combobox");
    expect(countrySelect).toHaveValue("+1");
  });

  it("should call onPhoneChange when the phone number is typed into", async () => {
    const user = userEvent.setup();
    const TestWrapper = () => {
      const [phone, setPhone] = useState("");
      return (
        <PhoneInput
          countryCode="+1"
          phone={phone}
          onPhoneChange={(newPhone) => {
            setPhone(newPhone);
            mockOnPhoneChange(newPhone);
          }}
        />
      );
    };

    render(<TestWrapper />);

    const phoneInput = screen.getByPlaceholderText("672-892-6294");
    await user.type(phoneInput, "98765");

    expect(mockOnPhoneChange).toHaveBeenCalledTimes(5);
    expect(mockOnPhoneChange).toHaveBeenLastCalledWith("98765");
  });

  it("should call onCountryCodeChange when a new country is selected", async () => {
    const user = userEvent.setup();
    render(
      <PhoneInput
        countryCode="+1"
        phone=""
        onPhoneChange={mockOnPhoneChange}
        onCountryCodeChange={mockOnCountryCodeChange}
      />
    );

    const countrySelect = screen.getByRole("combobox");
    await user.selectOptions(countrySelect, "+91");

    expect(mockOnCountryCodeChange).toHaveBeenCalledTimes(1);
    expect(mockOnCountryCodeChange).toHaveBeenCalledWith("+91");
  });

  it("should display an error message and apply invalid styles when an error prop is provided", () => {
    const errorMessage = "Invalid phone number";
    render(
      <PhoneInput
        countryCode="+1"
        phone="123"
        onPhoneChange={mockOnPhoneChange}
        error={errorMessage}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();

    const mainContainer = screen.getByText("Phone Number").nextElementSibling;
    expect(mainContainer).toHaveClass("is-invalid");

    const countrySelect = screen.getByRole("combobox");
    expect(countrySelect).toHaveClass("is-invalid");

    const phoneInput = screen.getByPlaceholderText("672-892-6294");
    expect(phoneInput).toHaveClass("is-invalid");
  });

  it("should render custom country options when provided", () => {
    const customCountries = [
      { code: "+33", flag: "🇫🇷", label: "France" },
      { code: "+49", flag: "🇩🇪", label: "Germany" },
    ];
    render(
      <PhoneInput
        countryCode="+33"
        phone=""
        onPhoneChange={mockOnPhoneChange}
        countryOptions={customCountries}
      />
    );

    expect(screen.getByRole("option", { name: "🇫🇷 +33" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "🇩🇪 +49" })).toBeInTheDocument();

    expect(screen.queryByRole("option", { name: "🇺🇸 +1" })).not.toBeInTheDocument();
  });
});

