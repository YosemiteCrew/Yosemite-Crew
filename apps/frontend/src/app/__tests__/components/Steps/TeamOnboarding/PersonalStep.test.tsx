import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PersonalStep from "@/app/components/Steps/TeamOnboarding/PersonalStep";
import { UserProfile } from "@/app/types/profile";

jest.mock("@/app/services/profileService", () => ({
  createUserProfile: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

jest.mock("@/app/utils/date", () => ({
  formatDateLocal: () => "2024-01-01",
}));

jest.mock("@/app/components/UploadImage/LogoUploader", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => <button>{placeholder}</button>,
}));

jest.mock(
  "@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown",
  () => ({
    __esModule: true,
    default: ({ inlabel, value, onChange, error }: any) => (
      <label>
        {inlabel}
        <input value={value} onChange={onChange} aria-label={inlabel} />
        {error && <span>{error}</span>}
      </label>
    ),
  })
);

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, error }: any) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect({ value: "USA", label: "USA" })}
      >
        {placeholder}
      </button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

const profileService = jest.requireMock("@/app/services/profileService");
const validators = jest.requireMock("@/app/utils/validators");

describe("PersonalStep", () => {
  const nextStep = jest.fn();
  const setFormData = jest.fn();
  const baseFormData: UserProfile = {
    _id: "",
    organizationId: "",
    personalDetails: {
      dateOfBirth: "",
      phoneNumber: "",
      gender: "MALE",
      address: {
        country: "",
        addressLine: "",
        city: "",
        state: "",
        postalCode: "",
      },
    },
  } as UserProfile;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors for required fields", () => {
    validators.getCountryCode.mockReturnValue(null);
    validators.validatePhone.mockReturnValue(false);

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={baseFormData}
        setFormData={setFormData}
        orgIdFromQuery="org-1"
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
    expect(screen.getByText("Valid number is required")).toBeInTheDocument();
    expect(screen.getByText("Address is required")).toBeInTheDocument();
  });

  it("creates profile when data is valid", async () => {
    validators.getCountryCode.mockReturnValue({ dial_code: "+1" });
    validators.validatePhone.mockReturnValue(true);

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={
          {
            _id: "",
            organizationId: "",
            personalDetails: {
              dateOfBirth: "2024-01-01",
              phoneNumber: "123456",
              gender: "FEMALE",
              address: {
                country: "USA",
                addressLine: "123 Main",
                city: "Austin",
                state: "TX",
                postalCode: "78701",
              },
            },
          } as UserProfile
        }
        setFormData={setFormData}
        orgIdFromQuery="org-1"
      />
    );

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(profileService.createUserProfile).toHaveBeenCalled();
    });
  });
});
