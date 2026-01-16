import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddTeam from "@/app/pages/Organization/Sections/Team/AddTeam";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
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
      <button type="button" onClick={() => onSelect({ label: "Spec", value: "spec-1" })}>
        {placeholder}
      </button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ title, options, setOption }: any) => (
    <button type="button" onClick={() => setOption(options[0].value)}>
      {title}
    </button>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [
    { _id: "spec-1", name: "Surgery" },
  ],
}));

jest.mock("@/app/services/teamService", () => ({
  sendInvite: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  isValidEmail: jest.fn(),
  toTitleCase: (val: string) => val,
}));

const teamService = jest.requireMock("@/app/services/teamService");
const validators = jest.requireMock("@/app/utils/validators");

describe("Organization AddTeam", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors", () => {
    validators.isValidEmail.mockReturnValue(false);

    render(<AddTeam showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Speciality is required")).toBeInTheDocument();
    expect(screen.getByText("Role is required")).toBeInTheDocument();
  });

  it("sends invite on valid data", async () => {
    validators.isValidEmail.mockReturnValue(true);
    teamService.sendInvite.mockResolvedValue(undefined);

    render(<AddTeam showModal setShowModal={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "team@example.com" },
    });
    fireEvent.click(screen.getByText("Speciality"));
    fireEvent.click(screen.getByText("Role"));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(teamService.sendInvite).toHaveBeenCalled();
    });
  });
});
