import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import PersonalStep from "@/app/components/Steps/TeamOnboarding/PersonalStep";

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value ?? ""} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value ?? ""} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/UploadImage/LogoUploader", () => ({
  __esModule: true,
  default: () => <div data-testid="logo-uploader" />,
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date("2025-01-01"))}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect, error }: any) => (
    <div>
      <span>{placeholder}</span>
      {options.map((option: any) => (
        <button
          key={`${placeholder}-${option.key}`}
          type="button"
          onClick={() => onSelect(option)}
        >
          {placeholder}: {option.label}
        </button>
      ))}
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock("@/app/services/profileService", () => ({
  createUserProfile: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

jest.mock("@/app/utils/date", () => ({
  formatDateLocal: jest.fn(() => "2025-01-01"),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

import { createUserProfile } from "@/app/services/profileService";
import { getCountryCode, validatePhone } from "@/app/utils/validators";

describe("PersonalStep", () => {
  const nextStep = jest.fn();
  const setFormData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
  });

  it("shows validation errors when required fields are missing", () => {
    render(
      <PersonalStep
        nextStep={nextStep}
        formData={{ _id: "", organizationId: "" } as any}
        setFormData={setFormData}
        orgIdFromQuery="org-1"
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
    expect(screen.getByText("Number is required")).toBeInTheDocument();
    expect(createUserProfile).not.toHaveBeenCalled();
  });

  it("submits profile when data is valid", async () => {
    (createUserProfile as jest.Mock).mockResolvedValue({});

    render(
      <PersonalStep
        nextStep={nextStep}
        formData={{
          _id: "user-1",
          organizationId: "org-1",
          personalDetails: {
            dateOfBirth: "2025-01-01",
            phoneNumber: "1234567890",
            gender: "female",
            address: {
              country: "United States",
              addressLine: "123 Main",
              city: "Austin",
              state: "TX",
              postalCode: "78701",
            },
          },
        } as any}
        setFormData={setFormData}
        orgIdFromQuery="org-1"
      />
    );

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(createUserProfile).toHaveBeenCalled();
    });
  });
});
