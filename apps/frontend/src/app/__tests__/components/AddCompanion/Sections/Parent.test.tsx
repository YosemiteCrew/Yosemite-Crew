import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import Parent from "@/app/components/AddCompanion/Sections/Parent";
import { searchParent } from "@/app/services/companionService";
import { getCountryCode, validatePhone } from "@/app/utils/validators";
import { StoredParent } from "@/app/pages/Companions/types";
import { EMPTY_STORED_PARENT } from "@/app/components/AddCompanion/type";

// --- Mocks ---

// Mock Services
jest.mock("@/app/services/companionService", () => ({
  searchParent: jest.fn(),
}));

// Mock Validators
jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

// Mock Child Components to isolate logic
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, value, onChange, error }: any) => (
    <div data-testid={`input-wrapper-${inlabel}`}>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        value={value || ""}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ placeholder, value, onChange, error }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`dropdown-val-${placeholder}`}>{value}</span>
      <button
        data-testid={`select-${placeholder}`}
        onClick={() => onChange("United States")}
      >
        Select US
      </button>
      {error && <span data-testid={`error-${placeholder}`}>{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/SearchDropdown", () => {
  return ({ placeholder, query, setQuery, onSelect, options }: any) => (
    <div data-testid="search-dropdown">
      <input
        data-testid="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {options.map((opt: any) => (
        <button
          key={opt.key}
          data-testid={`search-option-${opt.key}`}
          onClick={() => onSelect(opt.key)}
        >
          {opt.value}
        </button>
      ))}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Datepicker", () => {
  return ({ currentDate, setCurrentDate }: any) => (
    <div data-testid="datepicker">
      <span>{currentDate ? currentDate.toISOString() : "No Date"}</span>
      <button
        data-testid="date-btn"
        onClick={() => setCurrentDate(new Date("2020-01-01"))}
      >
        Set Date
      </button>
    </div>
  );
});

jest.mock("@/app/components/Accordion/Accordion", () => ({ children }: any) => (
  <div>{children}</div>
));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="next-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("Parent Component", () => {
  const mockSetActiveLabel = jest.fn();
  const mockSetFormData = jest.fn();

  const defaultProps = {
    setActiveLabel: mockSetActiveLabel,
    formData: EMPTY_STORED_PARENT,
    setFormData: mockSetFormData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default validation behavior
    (validatePhone as jest.Mock).mockImplementation((val) => !!val);
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // --- 1. Rendering & Inputs ---

  it("renders all fields correctly", () => {
    render(<Parent {...defaultProps} />);

    expect(screen.getByText("Parents details")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("input-Parent's name")).toBeInTheDocument();
    expect(
      screen.getByTestId("input-Last name (Optional)")
    ).toBeInTheDocument();
    expect(screen.getByTestId("input-Email")).toBeInTheDocument();
    expect(screen.getByTestId("input-Phone number")).toBeInTheDocument();
    expect(screen.getByTestId("input-Address")).toBeInTheDocument();
    expect(screen.getByTestId("input-City")).toBeInTheDocument();
    expect(screen.getByTestId("input-Postal code")).toBeInTheDocument();
    expect(screen.getByTestId("input-State/Province")).toBeInTheDocument();
    expect(screen.getByTestId("next-btn")).toBeInTheDocument();
  });

  it("updates simple text inputs correctly", () => {
    render(<Parent {...defaultProps} />);

    // First Name
    fireEvent.change(screen.getByTestId("input-Parent's name"), {
      target: { value: "John" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "John" })
    );

    // Email
    fireEvent.change(screen.getByTestId("input-Email"), {
      target: { value: "john@example.com" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ email: "john@example.com" })
    );
  });

  it("updates nested address inputs correctly", () => {
    render(<Parent {...defaultProps} />);

    // Address Line
    fireEvent.change(screen.getByTestId("input-Address"), {
      target: { value: "123 Main St" },
    });
    // Check nested update logic
    const callArg = mockSetFormData.mock.calls.at(-1)[0];
    expect(callArg.address.addressLine).toBe("123 Main St");

    // City
    fireEvent.change(screen.getByTestId("input-City"), {
      target: { value: "New York" },
    });
    expect(mockSetFormData.mock.calls.at(-1)[0].address.city).toBe("New York");
  });

  it("updates Country via dropdown", () => {
    render(<Parent {...defaultProps} />);
    fireEvent.click(screen.getByTestId("select-Choose country"));
    const callArg = mockSetFormData.mock.calls.at(-1)[0];
    expect(callArg.address.country).toBe("United States");
  });

  it("updates Birth Date via Datepicker", () => {
    render(<Parent {...defaultProps} />);
    mockSetFormData.mockClear();

    fireEvent.click(screen.getByTestId("date-btn"));

    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ birthDate: expect.any(Date) })
    );
  });

  // --- 2. Search Functionality ---

  it("searches for parents after debounce", async () => {
    const mockParents = [{ id: "p1", firstName: "Alice", lastName: "Smith" }];
    (searchParent as jest.Mock).mockResolvedValue(mockParents);

    render(<Parent {...defaultProps} />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Ali" } });

    expect(searchParent).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(searchParent).toHaveBeenCalledWith("Ali");

    await waitFor(() => {
      expect(screen.getByTestId("search-option-p1")).toBeInTheDocument();
    });
  });

  it("handles search errors gracefully", async () => {
    (searchParent as jest.Mock).mockRejectedValue(new Error("API Error"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<Parent {...defaultProps} />);

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "Fail" },
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it("selects a parent from search results", async () => {
    const mockParent: StoredParent = {
      ...EMPTY_STORED_PARENT,
      id: "p1",
      firstName: "Alice",
      lastName: "Smith",
      birthDate: new Date("1990-01-01"),
    };
    (searchParent as jest.Mock).mockResolvedValue([mockParent]);

    render(<Parent {...defaultProps} />);

    // Trigger search
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "Ali" },
    });
    act(() => jest.advanceTimersByTime(300));
    await waitFor(() => screen.getByTestId("search-option-p1"));

    // Select
    fireEvent.click(screen.getByTestId("search-option-p1"));

    expect(mockSetFormData).toHaveBeenCalledWith(mockParent);
  });

  // --- 3. Validation Logic (Addressing Uncovered Lines) ---

  it("shows validation errors for empty required fields", () => {
    render(<Parent {...defaultProps} />);

    fireEvent.click(screen.getByTestId("next-btn"));

    expect(screen.getByTestId("error-Parent's name")).toHaveTextContent(
      "First name is required"
    );
    expect(screen.getByTestId("error-Email")).toHaveTextContent(
      "Email is required"
    );
    expect(screen.getByTestId("error-Address")).toHaveTextContent(
      "Address is required"
    );
    expect(screen.getByTestId("error-City")).toHaveTextContent(
      "City is required"
    );

    expect(mockSetActiveLabel).not.toHaveBeenCalled();
  });

  it("validates phone number: Success Case", () => {
    // 1. Mock country code found
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    // 2. Mock validation true
    (validatePhone as jest.Mock).mockReturnValue(true);

    const validData: StoredParent = {
      ...EMPTY_STORED_PARENT,
      firstName: "John",
      email: "test@test.com",
      phoneNumber: "1234567890",
      address: {
        country: "USA",
        addressLine: "123 St",
        city: "City",
        state: "State",
        postalCode: "12345",
      },
    };

    render(<Parent {...defaultProps} formData={validData} />);
    fireEvent.click(screen.getByTestId("next-btn"));

    expect(mockSetActiveLabel).toHaveBeenCalledWith("companion");
  });

  it("validates phone number: Invalid Format (Lines 121-124 coverage)", () => {
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    // Mock validation returning false to trigger the error block
    (validatePhone as jest.Mock).mockReturnValue(false);

    const invalidPhoneData: StoredParent = {
      ...EMPTY_STORED_PARENT,
      firstName: "John",
      email: "test@test.com",
      phoneNumber: "bad-phone",
      address: {
        country: "USA",
        addressLine: "123 St",
        city: "City",
        state: "State",
        postalCode: "12345",
      },
    };

    render(<Parent {...defaultProps} formData={invalidPhoneData} />);
    fireEvent.click(screen.getByTestId("next-btn"));

    // Expect the specific error state
    expect(screen.getByTestId("error-Phone number")).toHaveTextContent(
      "Valid number is required"
    );
    expect(mockSetActiveLabel).not.toHaveBeenCalled();
  });

  it("validates phone number: No Country Code Found (Edge Case)", () => {
    // Mock no country code found
    (getCountryCode as jest.Mock).mockReturnValue(undefined);
    // Even if phone is technically "valid" string, if no country code, logic might fail
    (validatePhone as jest.Mock).mockReturnValue(false);

    const invalidData: StoredParent = {
      ...EMPTY_STORED_PARENT,
      firstName: "John",
      email: "test@test.com",
      phoneNumber: "12345",
      address: {
        country: "UnknownLand",
        addressLine: "123 St",
        city: "City",
        state: "State",
        postalCode: "12345",
      },
    };

    render(<Parent {...defaultProps} formData={invalidData} />);
    fireEvent.click(screen.getByTestId("next-btn"));

    expect(screen.getByTestId("error-Phone number")).toBeInTheDocument();
    expect(mockSetActiveLabel).not.toHaveBeenCalled();
  });
});
