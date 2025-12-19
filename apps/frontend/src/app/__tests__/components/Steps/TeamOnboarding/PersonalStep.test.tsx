import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PersonalStep from "../../../../components/Steps/TeamOnboarding/PersonalStep";
import { createUserProfile } from "@/app/services/profileService";
import { getCountryCode, validatePhone } from "@/app/utils/validators";
import { UserProfile } from "@/app/types/profile";

// --- Mocks ---

jest.mock("@/app/services/profileService", () => ({
  createUserProfile: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

jest.mock("@/app/utils/date", () => ({
  formatDateLocal: jest.fn((d) => d.toISOString().split("T")[0]),
}));

jest.mock(
  "../../../../components/Inputs/FormInput/FormInput",
  () =>
    ({ inname, onChange, value, error }: any) => (
      <div data-testid={`wrapper-${inname}`}>
        <input
          data-testid={`input-${inname}`}
          name={inname}
          value={value}
          onChange={onChange}
        />
        {error && <span data-testid={`error-${inname}`}>{error}</span>}
      </div>
    )
);

jest.mock(
  "../../../../components/Inputs/Dropdown/Dropdown",
  () =>
    ({ onChange, value, error }: any) => (
      <div data-testid="wrapper-country">
        <select
          data-testid="input-country"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          <option value="US">United States</option>
        </select>
        {error && <span data-testid="error-country">{error}</span>}
      </div>
    )
);

jest.mock(
  "../../../../components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown",
  () =>
    ({ onChange, value, error }: any) => (
      <div data-testid="wrapper-address">
        <input data-testid="input-address" value={value} onChange={onChange} />
        {error && <span data-testid="error-address">{error}</span>}
      </div>
    )
);

jest.mock(
  "../../../../components/Inputs/Datepicker",
  () =>
    ({ currentDate, setCurrentDate }: any) => (
      <div data-testid="wrapper-datepicker">
        <input
          data-testid="input-datepicker"
          value={currentDate ? currentDate.toISOString().split("T")[0] : ""}
          onChange={(e) => setCurrentDate(new Date(e.target.value))}
        />
      </div>
    )
);

jest.mock(
  "../../../../components/UploadImage/LogoUploader",
  () =>
    ({ setImageUrl }: any) => (
      <button
        data-testid="upload-logo"
        onClick={() => setImageUrl("https://mock-logo.com/image.png")}
      >
        Upload Logo
      </button>
    )
);

jest.mock("../../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="btn-next" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button data-testid="btn-back">{text}</button>,
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="error-icon" />,
}));

describe("PersonalStep Component", () => {
  const mockNextStep = jest.fn();
  const mockSetFormData = jest.fn();
  const mockOrgId = "org-123";

  const emptyFormData: UserProfile = {
    personalDetails: {
      firstName: "",
      lastName: "",
      email: "",
      dateOfBirth: "",
      phoneNumber: "",
      gender: "",
      address: {
        addressLine: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
      },
    },
  } as unknown as UserProfile;

  const validFormData: UserProfile = {
    personalDetails: {
      dateOfBirth: "1990-01-01",
      phoneNumber: "1234567890",
      gender: "MALE",
      address: {
        addressLine: "123 Main St",
        city: "City",
        state: "State",
        country: "US",
        postalCode: "12345",
      },
    },
  } as unknown as UserProfile;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Section 1: Rendering ---
  it("renders all inputs and initial state", () => {
    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    expect(screen.getByText("Personal details")).toBeInTheDocument();
    expect(screen.getByTestId("input-datepicker")).toBeInTheDocument();
    expect(screen.getByTestId("input-country")).toBeInTheDocument();
    expect(screen.getByTestId("input-number")).toBeInTheDocument();

    // FIX: Use getAllByText to handle potential duplicates safely, though normally unique
    const maleButtons = screen.getAllByText(/MALE/i);
    expect(maleButtons.length).toBeGreaterThan(0);
  });

  // --- Section 2: Input & State Handling ---
  it("updates form data on input change", () => {
    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.change(screen.getByTestId("input-datepicker"), {
      target: { value: "2000-01-01" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("input-country"), {
      target: { value: "US" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("input-number"), {
      target: { value: "555-0199" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("input-address"), {
      target: { value: "New St" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("input-city"), {
      target: { value: "New City" },
    });
    expect(mockSetFormData).toHaveBeenCalled();

    // FIX: Select specific male button if multiple exist (though strict regex ^MALE$ prevents FEMALE match)
    const maleBtns = screen.getAllByText(/^MALE$/i);
    fireEvent.click(maleBtns[0]);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it("updates profile picture url", () => {
    let stateCallback: any;
    mockSetFormData.mockImplementation((cb: any) => {
      stateCallback = cb;
    });

    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("upload-logo"));
    const newState = stateCallback(emptyFormData);
    expect(newState.personalDetails.profilePictureUrl).toBe(
      "https://mock-logo.com/image.png"
    );
  });

  // --- Section 3: Validation ---
  it("shows errors for missing required fields", async () => {
    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={emptyFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(screen.getByTestId("error-icon")).toBeInTheDocument();
      // FIX: The logic falls through to "Valid number is required"
      expect(screen.getByTestId("error-number")).toHaveTextContent(
        "Valid number is required"
      );
      expect(screen.getByTestId("error-country")).toHaveTextContent(
        "Country is required"
      );
      expect(screen.getByTestId("error-address")).toHaveTextContent(
        "Address is required"
      );
      expect(screen.getByTestId("error-city")).toHaveTextContent(
        "City is required"
      );
      expect(screen.getByTestId("error-state")).toHaveTextContent(
        "State is required"
      );
      expect(screen.getByTestId("error-postal code")).toHaveTextContent(
        "PostalCode is required"
      );
    });

    expect(createUserProfile).not.toHaveBeenCalled();
  });

  it("validates phone number correctly", async () => {
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(false);

    const invalidPhoneData = {
      ...validFormData,
      personalDetails: {
        ...validFormData.personalDetails,
        phoneNumber: "invalid",
      },
    };

    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={invalidPhoneData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(screen.getByTestId("error-number")).toHaveTextContent(
        "Valid number is required"
      );
    });

    expect(validatePhone).toHaveBeenCalledWith("+1invalid");
  });

  // --- Section 4: Submission & Error Handling ---
  it("submits successfully when valid", async () => {
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
    (createUserProfile as jest.Mock).mockResolvedValue({});

    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={validFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(createUserProfile).toHaveBeenCalledWith(validFormData, mockOrgId);
    });
  });

  it("logs error if submission fails", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
    (createUserProfile as jest.Mock).mockRejectedValue(new Error("API Fail"));

    render(
      <PersonalStep
        nextStep={mockNextStep}
        formData={validFormData}
        setFormData={mockSetFormData}
        orgIdFromQuery={mockOrgId}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating profile:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
