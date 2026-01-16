import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddRoom from "@/app/pages/Organization/Sections/Rooms/AddRoom";

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
  default: ({ placeholder, onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ value: "CONSULTATION" })}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: () => <div>MultiSelect</div>,
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

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => [],
}));

jest.mock("@/app/services/roomService", () => ({
  createRoom: jest.fn(),
}));

const roomService = jest.requireMock("@/app/services/roomService");

describe("AddRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors", () => {
    render(<AddRoom showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("creates a room", async () => {
    roomService.createRoom.mockResolvedValue({});
    const setShowModal = jest.fn();

    render(<AddRoom showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Room A" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(roomService.createRoom).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
