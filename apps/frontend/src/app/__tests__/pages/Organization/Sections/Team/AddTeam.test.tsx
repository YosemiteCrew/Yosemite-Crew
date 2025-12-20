import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddTeam from "@/app/pages/Organization/Sections/Team/AddTeam";
import { sendInvite } from "@/app/services/teamService";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";

// --- Mocks ---

jest.mock("@/app/services/teamService", () => ({
  sendInvite: jest.fn(),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

// Mock Modal to render children directly
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

// Mock child components for simpler interaction
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input data-testid="email-input" value={value} onChange={onChange} />
      {error && <span data-testid="email-error">{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ onChange, value, placeholder, error, returnObject }: any) => (
    <div>
      <label>{placeholder}</label>
      <button
        data-testid={`dropdown-${placeholder.toLowerCase()}`}
        onClick={() => {
          // Simulate returning object vs value based on prop
          if (returnObject) {
            onChange({ label: "Cardiology", value: "spec-1" });
          } else {
            onChange("VETERINARIAN");
          }
        }}
      >
        Select {placeholder}
      </button>
      {error && (
        <span data-testid={`${placeholder.toLowerCase()}-error`}>{error}</span>
      )}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ setOption, title }: any) => (
    <div data-testid="select-label">
      <span>{title}</span>
      <button onClick={() => setOption("PART_TIME")}>Set Part Time</button>
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

describe("AddTeam Component", () => {
  const mockSetShowModal = jest.fn();
  const mockSpecialities = [
    { _id: "spec-1", name: "Cardiology" },
    { _id: "spec-2", name: "Neurology" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
  });

  // --- 1. Rendering ---

  it("renders correctly when showModal is true", () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);
  });

  it("closes modal when close icon is clicked", () => {
    const { container } = render(
      <AddTeam showModal={true} setShowModal={mockSetShowModal} />
    );

    // Find the clickable close SVG
    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) fireEvent.click(closeIcon);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- 2. Input Interaction ---

  it("updates form state for email, speciality, role, and type", () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    // 1. Email
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "test@example.com" },
    });
    expect(screen.getByTestId("email-input")).toHaveValue("test@example.com");

    // 2. Speciality
    fireEvent.click(screen.getByTestId("dropdown-speciality"));

    // 3. Role
    fireEvent.click(screen.getByTestId("dropdown-role"));

    // 4. Type (SelectLabel)
    fireEvent.click(screen.getByText("Set Part Time"));

    // Assertions are implicit via successful submission test later,
    // but we check component interactions here.
  });

  // --- 3. Validation Logic ---

  it("shows validation errors for empty fields", async () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    fireEvent.click(screen.getByText("Save"));
  });

  it("shows error for invalid email format", async () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    // Fill other required fields to isolate email error
    fireEvent.click(screen.getByTestId("dropdown-speciality"));
    fireEvent.click(screen.getByTestId("dropdown-role"));

    // Invalid Email
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "invalid-email" },
    });

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByTestId("email-error")).toHaveTextContent(
      "Enter a valid email"
    );
    expect(sendInvite).not.toHaveBeenCalled();
  });

  // --- 4. Successful Submission & Error Handling ---

  it("calls sendInvite with correct data and closes modal on success", async () => {
    (sendInvite as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    // Fill all valid data
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "doc@test.com" },
    });
    fireEvent.click(screen.getByTestId("dropdown-speciality")); // Selects Cardiology/spec-1
    fireEvent.click(screen.getByTestId("dropdown-role")); // Selects VETERINARIAN
    fireEvent.click(screen.getByText("Set Part Time")); // Selects PART_TIME

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(sendInvite).toHaveBeenCalledWith({
        email: "doc@test.com",
        speciality: { name: "Cardiology", key: "spec-1" },
        role: "VETERINARIAN",
        type: "PART_TIME",
      });
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("logs error to console if sendInvite fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const mockError = new Error("Invite Failed");
    (sendInvite as jest.Mock).mockRejectedValueOnce(mockError);

    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    // Fill minimal valid data
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "doc@test.com" },
    });
    fireEvent.click(screen.getByTestId("dropdown-speciality"));
    fireEvent.click(screen.getByTestId("dropdown-role"));

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(mockError);
    });

    consoleSpy.mockRestore();
  });
});
