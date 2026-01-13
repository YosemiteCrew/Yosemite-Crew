import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import Parent from "@/app/components/AddCompanion/Sections/Parent";
import { StoredParent } from "@/app/pages/Companions/types";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date("2020-01-01"))}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect, error }: any) => (
    <div>
      <span>{placeholder}</span>
      <button
        type="button"
        onClick={() => options[0] && onSelect(options[0])}
      >
        Select
      </button>
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input
        aria-label={inlabel}
        value={value ?? ""}
        onChange={onChange}
      />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], query, setQuery, onSelect }: any) => (
    <div>
      <input
        placeholder={placeholder}
        value={query ?? ""}
        onChange={(event) => setQuery(event.target.value)}
      />
      {options.map((option: any) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
        >
          {option.value}
        </button>
      ))}
    </div>
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

import { searchParent } from "@/app/services/companionService";
import { getCountryCode, validatePhone } from "@/app/utils/validators";

const baseFormData: StoredParent = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  birthDate: undefined,
  phoneNumber: "",
  address: {
    addressLine: "",
    country: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: undefined,
    longitude: undefined,
  },
  createdFrom: "pms",
};

describe("<Parent />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches parents on query and renders options", async () => {
    jest.useFakeTimers();
    (searchParent as jest.Mock).mockResolvedValue([
      {
        id: "parent-1",
        firstName: "Sam",
        lastName: "Smith",
      },
    ]);

    render(
      <Parent
        formData={baseFormData}
        setFormData={jest.fn()}
        setActiveLabel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search parent"), {
      target: { value: "Sam" },
    });

    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(searchParent).toHaveBeenCalledWith("Sam");
      expect(screen.getByText("Sam Smith")).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it("advances to companion section when required fields are valid", () => {
    (validatePhone as jest.Mock).mockReturnValue(true);
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });

    const setActiveLabel = jest.fn();
    const formData: StoredParent = {
      ...baseFormData,
      firstName: "Jane",
      email: "jane@example.com",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      address: {
        ...baseFormData.address,
        country: "United States",
        addressLine: "123 Main",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
      },
    };

    render(
      <Parent
        formData={formData}
        setFormData={jest.fn()}
        setActiveLabel={setActiveLabel}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(setActiveLabel).toHaveBeenCalledWith("companion");
    expect(screen.queryByText("Valid number is required")).not.toBeInTheDocument();
  });
});
