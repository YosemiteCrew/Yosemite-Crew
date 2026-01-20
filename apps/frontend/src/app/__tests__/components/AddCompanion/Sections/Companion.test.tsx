import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Companion from "@/app/components/AddCompanion/Sections/Companion";
import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
} from "@/app/components/AddCompanion/type";

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
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
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

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ error }: any) => (error ? <div>{error}</div> : <div />),
}));

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: () => <div>search</div>,
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/services/companionService", () => ({
  createCompanion: jest.fn(),
  createParent: jest.fn(),
  getCompanionForParent: jest.fn().mockResolvedValue([]),
  linkCompanion: jest.fn(),
}));

describe("AddCompanion Companion section", () => {
  it("shows validation errors when required fields are missing", () => {
    const formData = {
      ...EMPTY_STORED_COMPANION,
      dateOfBirth: new Date(),
      type: "" as any,
    };

    render(
      <Companion
        setActiveLabel={jest.fn()}
        formData={formData}
        setFormData={jest.fn()}
        parentFormData={EMPTY_STORED_PARENT}
        setParentFormData={jest.fn()}
        setShowModal={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Species is required")).toBeInTheDocument();
    expect(screen.getByText("Breed is required")).toBeInTheDocument();
  });
});
