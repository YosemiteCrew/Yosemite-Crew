import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import AddTeam from "@/app/pages/Organization/Sections/Team/AddTeam";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (
    <div data-testid="modal" data-open={showModal}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
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

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ title, options = [], setOption }: any) => (
    <div>
      <span>{title}</span>
      {options.map((option: any) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setOption(option.key)}
        >
          {option.name ?? option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/services/teamService", () => ({
  sendInvite: jest.fn(),
}));

jest.mock("@/app/utils/validators", () => ({
  isValidEmail: jest.fn(),
  toTitleCase: (value: string) => value,
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { sendInvite } from "@/app/services/teamService";
import { isValidEmail } from "@/app/utils/validators";

describe("AddTeam", () => {
  const setShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "spec-1", name: "Surgery" },
    ]);
    (isValidEmail as jest.Mock).mockReturnValue(true);
  });

  it("renders modal and form", () => {
    render(<AddTeam showModal={true} setShowModal={setShowModal} />);

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getAllByText("Add team").length).toBeGreaterThan(0);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows validation errors when fields are missing", () => {
    render(<AddTeam showModal={true} setShowModal={setShowModal} />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Speciality is required")).toBeInTheDocument();
    expect(screen.getByText("Role is required")).toBeInTheDocument();
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("submits invite when valid", async () => {
    (sendInvite as jest.Mock).mockResolvedValue({});

    render(<AddTeam showModal={true} setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByText("Speciality: Surgery"));
    fireEvent.click(screen.getByText("Role: OWNER"));

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(sendInvite).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
