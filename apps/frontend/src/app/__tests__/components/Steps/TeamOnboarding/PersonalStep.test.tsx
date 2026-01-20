import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PersonalStep from "@/app/components/Steps/TeamOnboarding/PersonalStep";

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <div>{text}</div>,
}));

const FieldMock = ({ error, inlabel, label }: any) => (
  <div>
    <span>{inlabel || label}</span>
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/components/UploadImage/LogoUploader", () => ({
  __esModule: true,
  default: () => <div>logo</div>,
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ error }: any) => (error ? <div>{error}</div> : <div />),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/services/profileService", () => ({
  createUserProfile: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: () => null,
  validatePhone: () => false,
}));

jest.mock("@/app/utils/date", () => ({
  formatDateLocal: () => "2024-01-01",
}));

describe("PersonalStep", () => {
  it("shows validation errors when required fields are missing", () => {
    render(
      <PersonalStep
        nextStep={jest.fn()}
        formData={{ _id: "", organizationId: "" } as any}
        setFormData={jest.fn()}
        orgIdFromQuery={"org-1"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
    expect(screen.getByText("Valid number is required")).toBeInTheDocument();
    expect(screen.getByText("Country is required")).toBeInTheDocument();
    expect(screen.getByText("Address is required")).toBeInTheDocument();
  });
});
