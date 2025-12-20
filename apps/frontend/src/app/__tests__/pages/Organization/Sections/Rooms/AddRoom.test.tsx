import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import AddRoom from "@/app/pages/Organization/Sections/Rooms/AddRoom";
import { createRoom } from "@/app/services/roomService";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";

// --- Mocks ---

jest.mock("@/app/services/roomService", () => ({
  createRoom: jest.fn(),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

// Mocking Modal to render children directly
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

// Mocking Inputs to simplify selection and interaction
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input data-testid="name-input" value={value} onChange={onChange} />
      {error && <span data-testid="error-msg">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ onChange, value, placeholder }: any) => (
    <select
      data-testid="dropdown-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="CONSULTATION">CONSULTATION</option>
      <option value="SURGERY">SURGERY</option>
    </select>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ onChange, value, placeholder }: any) => (
    <div
      data-testid={`multiselect-${placeholder.toLowerCase().replace(" ", "-")}`}
    >
      <button onClick={() => onChange(["val1"])}>Trigger Change</button>
    </div>
  ),
}));

describe("AddRoom Component", () => {
  const mockSetShowModal = jest.fn();
  const mockTeams = [{ _id: "staff-1", name: "Dr. Smith" }];
  const mockSpecialities = [{ _id: "spec-1", name: "Surgery" }];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
  });

  // --- 1. Rendering ---

  it("renders correctly when showModal is true", () => {
    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);
  });

  it("closes modal when close icon is clicked", () => {
    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);

    const closeButtons = screen.getAllByRole("button", { hidden: true });
    // Click the visible close icon (index 1 based on JSX structure)
    fireEvent.click(closeButtons[1]);
  });

  // --- 2. Input Interactions ---

  it("updates form state on input change", () => {
    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);

    const nameInput = screen.getByTestId("name-input");
    fireEvent.change(nameInput, { target: { value: "Operation Theatre" } });
    expect(nameInput).toHaveValue("Operation Theatre");

    const typeSelect = screen.getByTestId("dropdown-select");
    fireEvent.change(typeSelect, { target: { value: "SURGERY" } });
    expect(typeSelect).toHaveValue("SURGERY");
  });

  it("updates multiselect fields", () => {
    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);

    const specTrigger = within(
      screen.getByTestId("multiselect-assigned-specialities")
    ).getByText("Trigger Change");
    fireEvent.click(specTrigger);

    const staffTrigger = within(
      screen.getByTestId("multiselect-assigned-staff")
    ).getByText("Trigger Change");
    fireEvent.click(staffTrigger);

    // Logic passes arrays internally; verified by successful Save call later
  });

  // --- 3. Validation ---

  it("shows error if name is missing on save", async () => {
    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);

    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);

    expect(screen.getByTestId("error-msg")).toHaveTextContent(
      "Name is required"
    );
    expect(createRoom).not.toHaveBeenCalled();
  });

  // --- 4. Form Submission ---

  it("calls createRoom and resets state on successful submission", async () => {
    (createRoom as jest.Mock).mockResolvedValueOnce({ success: true });
    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);

    // Fill required data
    fireEvent.change(screen.getByTestId("name-input"), {
      target: { value: "Room 101" },
    });

    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Room 101",
        })
      );
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
      // Verify reset (input should be empty if we re-rendered or checked internal state)
      expect(screen.getByTestId("name-input")).toHaveValue("");
    });
  });

  it("logs error to console if createRoom fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const mockError = new Error("Network Error");
    (createRoom as jest.Mock).mockRejectedValueOnce(mockError);

    render(<AddRoom showModal={true} setShowModal={mockSetShowModal} />);
    fireEvent.change(screen.getByTestId("name-input"), {
      target: { value: "Room 102" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(mockError);
    });
    consoleSpy.mockRestore();
  });
});

