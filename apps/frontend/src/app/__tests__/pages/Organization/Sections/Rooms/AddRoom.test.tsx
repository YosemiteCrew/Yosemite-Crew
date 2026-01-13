import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import AddRoom from "@/app/pages/Organization/Sections/Rooms/AddRoom";

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
  default: ({ placeholder, options = [], onSelect }: any) => (
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
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, onChange }: any) => (
    <button type="button" onClick={() => onChange(["opt-1"])}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/services/roomService", () => ({
  createRoom: jest.fn(),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { createRoom } from "@/app/services/roomService";

describe("AddRoom", () => {
  const setShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "team-1", name: "Dr. Avery" },
    ]);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "spec-1", name: "Surgery" },
    ]);
  });

  it("renders modal and base fields", () => {
    render(<AddRoom showModal={true} setShowModal={setShowModal} />);

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getAllByText("Add room").length).toBeGreaterThan(0);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows validation error for missing name", () => {
    render(<AddRoom showModal={true} setShowModal={setShowModal} />);

    fireEvent.click(screen.getByText("Save"));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(createRoom).not.toHaveBeenCalled();
  });

  it("creates room with valid data", async () => {
    (createRoom as jest.Mock).mockResolvedValue({});

    render(<AddRoom showModal={true} setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Room A" },
    });
    fireEvent.click(screen.getByText("Type: CONSULTATION"));
    fireEvent.click(screen.getByText("Assigned specialities"));
    fireEvent.click(screen.getByText("Assigned staff"));

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
