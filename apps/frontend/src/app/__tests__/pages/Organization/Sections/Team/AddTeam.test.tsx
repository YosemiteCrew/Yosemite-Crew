import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddTeam from "@/app/features/organization/pages/Organization/Sections/Team/AddTeam";

jest.mock("@/app/ui/overlays/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/ui/primitives/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock("@/app/ui/primitives/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock("@/app/ui/primitives/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const FieldMock = ({ error, inlabel, placeholder }: any) => (
  <div>
    <span>{inlabel || placeholder}</span>
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock("@/app/ui/inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/ui/inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/ui/inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock("@/app/ui/inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ title }: any) => <div>{title}</div>,
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [],
}));

jest.mock("@/app/features/organization/services/teamService", () => ({
  sendInvite: jest.fn(),
}));

jest.mock("@/app/lib/validators", () => ({
  isValidEmail: () => false,
}));

describe("AddTeam", () => {
  it("shows validation errors when fields are missing", () => {
    render(<AddTeam showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Speciality is required")).toBeInTheDocument();
    expect(screen.getByText("Role is required")).toBeInTheDocument();
  });
});
