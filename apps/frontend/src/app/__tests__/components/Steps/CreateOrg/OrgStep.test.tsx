import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrgStep from "@/app/components/Steps/CreateOrg/OrgStep";
import { Organisation } from "@yosemite-crew/types";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock("@/app/services/orgService", () => ({
  createOrg: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: jest.fn(),
  validatePhone: jest.fn(),
}));

jest.mock("@/app/components/UploadImage/LogoUploader", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

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
      <button type="button" onClick={() => onSelect({ value: "USA", label: "USA" })}>
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

const orgService = jest.requireMock("@/app/services/orgService");
const validators = jest.requireMock("@/app/utils/validators");

describe("OrgStep", () => {
  const nextStep = jest.fn();
  const setFormData = jest.fn();

  const baseFormData: Organisation = {
    name: "",
    phoneNo: "",
    taxId: "",
    address: { country: "" },
  } as Organisation;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors for required fields", () => {
    validators.getCountryCode.mockReturnValue(null);
    validators.validatePhone.mockReturnValue(false);

    render(
      <OrgStep
        nextStep={nextStep}
        formData={baseFormData}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Country is required")).toBeInTheDocument();
    expect(screen.getByText("Valid number is required")).toBeInTheDocument();
    expect(screen.getByText("TaxID is required")).toBeInTheDocument();
    expect(orgService.createOrg).not.toHaveBeenCalled();
  });

  it("creates org and advances on valid data", async () => {
    validators.getCountryCode.mockReturnValue({ dial_code: "+1" });
    validators.validatePhone.mockReturnValue(true);
    orgService.createOrg.mockResolvedValue("org-123");

    render(
      <OrgStep
        nextStep={nextStep}
        formData={{
          ...baseFormData,
          name: "Vet Clinic",
          phoneNo: "123456",
          taxId: "TX-1",
          address: { country: "USA" },
        }}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(orgService.createOrg).toHaveBeenCalled();
    });
    expect(replaceMock).toHaveBeenCalledWith("/create-org?orgId=org-123");
    expect(nextStep).toHaveBeenCalled();
  });
});
