import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Parent from "@/app/components/AddCompanion/Sections/Parent";
import { EMPTY_STORED_PARENT } from "@/app/components/AddCompanion/type";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("@/app/services/companionService", () => ({
  searchParent: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, query, setQuery }: any) => (
    <label>
      {placeholder}
      <input
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => (
    <button type="button">{placeholder}</button>
  ),
}));

const companionService = jest.requireMock("@/app/services/companionService");
const validators = jest.requireMock("@/app/utils/validators");

describe("AddCompanion Parent section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors when required fields are missing", async () => {
    validators.validatePhone.mockReturnValue(true);
    validators.getCountryCode.mockReturnValue(null);

    render(
      <Parent
        setActiveLabel={jest.fn()}
        formData={EMPTY_STORED_PARENT}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Number is required")).toBeInTheDocument();
    expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
    expect(screen.getByText("Address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("Postal code is required")).toBeInTheDocument();
    expect(screen.getByText("State is required")).toBeInTheDocument();
  });

  it("validates phone number with country code when needed", async () => {
    validators.validatePhone.mockReturnValue(false);
    validators.getCountryCode.mockReturnValue({ dial_code: "+1" });

    render(
      <Parent
        setActiveLabel={jest.fn()}
        formData={{
          ...EMPTY_STORED_PARENT,
          firstName: "Jamie",
          email: "jamie@test.com",
          phoneNumber: "123456",
          birthDate: new Date("1990-01-01"),
          address: {
            ...EMPTY_STORED_PARENT.address,
            country: "United States",
            addressLine: "123 Test",
            city: "Austin",
            state: "TX",
            postalCode: "78701",
          },
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(await screen.findByText("Valid number is required")).toBeInTheDocument();
  });

  it("advances to companion section when data is valid", async () => {
    const setActiveLabel = jest.fn();
    validators.validatePhone.mockReturnValue(true);
    validators.getCountryCode.mockReturnValue(null);

    render(
      <Parent
        setActiveLabel={setActiveLabel}
        formData={{
          ...EMPTY_STORED_PARENT,
          firstName: "Jamie",
          email: "jamie@test.com",
          phoneNumber: "123456",
          birthDate: new Date("1990-01-01"),
          address: {
            ...EMPTY_STORED_PARENT.address,
            country: "United States",
            addressLine: "123 Test",
            city: "Austin",
            state: "TX",
            postalCode: "78701",
          },
        }}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(setActiveLabel).toHaveBeenCalledWith("companion");
    });
  });

  it("searches parents after a debounce", async () => {
    companionService.searchParent.mockResolvedValue([]);
    jest.useFakeTimers();

    render(
      <Parent
        setActiveLabel={jest.fn()}
        formData={EMPTY_STORED_PARENT}
        setFormData={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Search parent"), {
      target: { value: "Jamie" },
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(companionService.searchParent).toHaveBeenCalledWith("Jamie");
    });
    jest.useRealTimers();
  });
});
