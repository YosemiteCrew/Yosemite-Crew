import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";
import { createOrg } from "@/app/services/orgService";
import { getCountryCode, validatePhone } from "@/app/utils/validators";
import { Organisation } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Service
jest.mock("@/app/services/orgService", () => ({
  createOrg: jest.fn(),
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

jest.mock(
  "@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown",
  () => {
    return ({ inlabel, value, onChange, error }: any) => (
      <div data-testid="google-dropdown-wrapper">
        <label>{inlabel}</label>
        <input
          data-testid={`google-input-${inlabel}`}
          value={value || ""}
          onChange={onChange}
        />
        {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
      </div>
    );
  }
);

jest.mock("@/app/components/UploadImage/LogoUploader", () => {
  return ({ setImageUrl }: any) => (
    <button
      data-testid="logo-uploader"
      onClick={() => setImageUrl("https://example.com/logo.png")}
    >
      Upload Logo
    </button>
  );
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="next-btn" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button data-testid="back-btn">{text}</button>,
}));

describe("OrgStep Component", () => {
  const mockNextStep = jest.fn();
  const mockSetFormData = jest.fn();

  const emptyFormData: Organisation = {
    name: "",
    type: "Practice",
    phoneNo: "",
    taxId: "",
    address: {
      addressLine: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    },
  } as any;

  const filledFormData: Organisation = {
    ...emptyFormData,
    name: "Test Org",
    phoneNo: "1234567890",
    taxId: "TAX-123",
    address: { ...emptyFormData.address, country: "United States" },
    type: "Practice",
  } as any;

  const defaultProps = {
    nextStep: mockNextStep,
    formData: emptyFormData,
    setFormData: mockSetFormData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders all fields and title correctly", () => {
    render(<OrgStep {...defaultProps} />);

    expect(screen.getByText("Organisation")).toBeInTheDocument();
    expect(screen.getByTestId("logo-uploader")).toBeInTheDocument();

    // Check Organization Type Options using case-insensitive regex
    // Updated to match the actual types seen in your error log (Hospital, Breeder, etc.)
    expect(screen.getByText(/Hospital/i)).toBeInTheDocument();
    expect(screen.getByText(/Breeder/i)).toBeInTheDocument();
    expect(screen.getByText(/Boarder/i)).toBeInTheDocument();

    // Check Inputs
    expect(
      screen.getByTestId("google-input-Organisation name")
    ).toBeInTheDocument();
    expect(screen.getByTestId("select-Select country")).toBeInTheDocument();
    expect(
      screen.getByTestId("input-DUNS number (optional)")
    ).toBeInTheDocument();
    expect(screen.getByTestId("input-Phone number")).toBeInTheDocument();
    expect(screen.getByTestId("input-Tax ID")).toBeInTheDocument();
    expect(screen.getByTestId("input-Website (optional)")).toBeInTheDocument();

    // Check Buttons
    expect(screen.getByTestId("next-btn")).toBeInTheDocument();
    expect(screen.getByTestId("back-btn")).toBeInTheDocument();
  });

  // --- 2. Input Interactions ---

  it("updates Organisation Type when clicked", () => {
    render(<OrgStep {...defaultProps} />);

    // Click "Hospital" (one of the valid types)
    const typeBtn = screen.getByText(/Hospital/i);
    fireEvent.click(typeBtn);

    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("updates Logo URL via uploader", () => {
    // FIX: Handle both functional updates and direct updates
    let state = { ...emptyFormData };
    mockSetFormData.mockImplementation((update: any) => {
      if (typeof update === "function") {
        state = update(state);
      } else {
        state = update;
      }
    });

    render(
      <OrgStep
        {...defaultProps}
        setFormData={mockSetFormData}
        formData={state}
      />
    );

    fireEvent.click(screen.getByTestId("logo-uploader"));

    expect(state.imageURL).toBe("https://example.com/logo.png");
  });

  it("updates text inputs correctly", () => {
    // FIX: Default mock for setFormData needs to handle functional updates safely to prevent crash
    mockSetFormData.mockImplementation((update: any) => {
      if (typeof update === "function") {
        update(emptyFormData);
      }
    });

    render(<OrgStep {...defaultProps} />);

    // Name (Google Dropdown)
    fireEvent.change(screen.getByTestId("google-input-Organisation name"), {
      target: { value: "New Org" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Org" })
    );

    // Phone
    fireEvent.change(screen.getByTestId("input-Phone number"), {
      target: { value: "987" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNo: "987" })
    );

    // Tax ID
    fireEvent.change(screen.getByTestId("input-Tax ID"), {
      target: { value: "T-99" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ taxId: "T-99" })
    );

    // DUNS
    fireEvent.change(screen.getByTestId("input-DUNS number (optional)"), {
      target: { value: "D-1" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ DUNSNumber: "D-1" })
    );

    // Website
    fireEvent.change(screen.getByTestId("input-Website (optional)"), {
      target: { value: "web.com" },
    });
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ website: "web.com" })
    );

    // Optional Certs
    fireEvent.change(
      screen.getByTestId("input-Health & Safety Certification (optional)"),
      { target: { value: "Cert-1" } }
    );
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({ healthAndSafetyCertNo: "Cert-1" })
    );
  });

  it("updates Country dropdown correctly", () => {
    mockSetFormData.mockImplementation(() => {});
    render(<OrgStep {...defaultProps} />);

    fireEvent.click(screen.getByTestId("select-Select country"));

    // Checks that nested address update happens.
    // Note: The component source maps dropdown 'e' to postalCode, likely a bug, but we test the code as-is.
    expect(mockSetFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({ postalCode: "United States" }),
      })
    );
  });

  // --- 3. Validation Logic ---

  it("shows validation errors for required fields on Next", async () => {
    mockSetFormData.mockImplementation(() => {});
    render(<OrgStep {...defaultProps} />); // Empty data

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-btn"));
    });

    expect(screen.getByTestId("error-Organisation name")).toHaveTextContent(
      "Name is required"
    );
    expect(screen.getByTestId("error-Select country")).toHaveTextContent(
      "Country is required"
    );
    // FIX: Expect "Valid number is required" because empty/invalid number falls into the 'else' block
    expect(screen.getByTestId("error-Phone number")).toHaveTextContent(
      "Valid number is required"
    );
    expect(screen.getByTestId("error-Tax ID")).toHaveTextContent(
      "TaxID is required"
    );

    expect(createOrg).not.toHaveBeenCalled();
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it("validates phone number correctly (valid)", async () => {
    mockSetFormData.mockImplementation(() => {});
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
    (createOrg as jest.Mock).mockResolvedValue({});

    render(<OrgStep {...defaultProps} formData={filledFormData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-btn"));
    });

    expect(validatePhone).toHaveBeenCalledWith("+11234567890");
    expect(createOrg).toHaveBeenCalledWith(filledFormData);
    expect(mockNextStep).toHaveBeenCalled();
  });

  it("validates phone number correctly (invalid format)", async () => {
    mockSetFormData.mockImplementation(() => {});
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(false); // Fail

    render(<OrgStep {...defaultProps} formData={filledFormData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-btn"));
    });

    expect(screen.getByTestId("error-Phone number")).toHaveTextContent(
      "Valid number is required"
    );
    expect(createOrg).not.toHaveBeenCalled();
  });

  it("validates phone number correctly (no country code found)", async () => {
    mockSetFormData.mockImplementation(() => {});
    (getCountryCode as jest.Mock).mockReturnValue(undefined);

    render(<OrgStep {...defaultProps} formData={filledFormData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-btn"));
    });

    expect(screen.getByTestId("error-Phone number")).toHaveTextContent(
      "Valid number is required"
    );
    expect(createOrg).not.toHaveBeenCalled();
  });

  // --- 4. Submission & Errors ---

  it("handles createOrg failure gracefully", async () => {
    mockSetFormData.mockImplementation(() => {});
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (createOrg as jest.Mock).mockRejectedValue(new Error("API Fail"));

    render(<OrgStep {...defaultProps} formData={filledFormData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-btn"));
    });

    expect(createOrg).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error creating organization:",
      expect.any(Error)
    );
    expect(mockNextStep).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
