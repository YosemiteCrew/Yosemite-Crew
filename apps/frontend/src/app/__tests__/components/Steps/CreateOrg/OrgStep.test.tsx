import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

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

jest.mock("@/app/services/orgService", () => ({
  createOrg: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

import { createOrg } from "@/app/services/orgService";
import { getCountryCode, validatePhone } from "@/app/utils/validators";

describe("OrgStep", () => {
  const nextStep = jest.fn();
  const setFormData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getCountryCode as jest.Mock).mockReturnValue({ dial_code: "+1" });
    (validatePhone as jest.Mock).mockReturnValue(true);
  });

  it("shows validation errors when required fields missing", () => {
    render(
      <OrgStep
        nextStep={nextStep}
        formData={{ name: "", address: {} } as any}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Country is required")).toBeInTheDocument();
    expect(screen.getByText("Number is required")).toBeInTheDocument();
    expect(screen.getByText("TaxID is required")).toBeInTheDocument();
    expect(createOrg).not.toHaveBeenCalled();
  });

  it("creates org and advances when valid", async () => {
    (createOrg as jest.Mock).mockResolvedValue("org-1");

    render(
      <OrgStep
        nextStep={nextStep}
        formData={{
          name: "Clinic",
          type: "VET",
          phoneNo: "1234567890",
          taxId: "TAX123",
          address: { country: "United States" },
        } as any}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(createOrg).toHaveBeenCalled();
    });
    expect(mockReplace).toHaveBeenCalledWith("/create-org?orgId=org-1");
    expect(nextStep).toHaveBeenCalled();
  });
});
