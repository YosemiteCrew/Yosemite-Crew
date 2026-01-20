import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Parent from "@/app/components/AddCompanion/Sections/Parent";
import { EMPTY_STORED_PARENT } from "@/app/components/AddCompanion/type";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const FieldMock = ({ error, inlabel }: any) => (
  <div>
    <span>{inlabel}</span>
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ error }: any) => (error ? <div>{error}</div> : <div />),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: () => <div>search</div>,
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: () => <div>label</div>,
}));

jest.mock("@/app/services/companionService", () => ({
  searchParent: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/app/utils/validators", () => ({
  getCountryCode: () => null,
  validatePhone: () => true,
}));

describe("AddCompanion Parent section", () => {
  it("shows validation errors when required fields are empty", () => {
    render(
      <Parent
        setActiveLabel={jest.fn()}
        formData={EMPTY_STORED_PARENT}
        setFormData={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Number is required")).toBeInTheDocument();
    expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
  });
});
