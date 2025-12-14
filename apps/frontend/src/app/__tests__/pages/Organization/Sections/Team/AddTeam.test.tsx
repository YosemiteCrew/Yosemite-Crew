import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddTeam from "@/app/pages/Organization/Sections/Team/AddTeam";
import { sendInvite } from "@/app/services/teamService";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";

// --- Mocks ---

// Mock Hooks
jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

// Mock Services
jest.mock("@/app/services/teamService", () => ({
  sendInvite: jest.fn(),
}));

// Mock Utils
jest.mock("@/app/utils/validators", () => ({
  isValidEmail: jest.fn((email) => {
    // FIX: Return true for empty string so the component's "Required" check takes precedence
    // and isn't overwritten by "Enter a valid email".
    if (!email) return true;
    return email.includes("@");
  }),
}));

// Mock Constants/Types from relative path
jest.mock("@/app/pages/Organization/types", () => ({
  EmploymentTypes: [
    { key: "FULL_TIME", label: "Full Time" },
    { key: "PART_TIME", label: "Part Time" },
  ],
  RoleOptions: ["Admin", "Staff"],
}));

// Mock UI Components
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children, setShowModal }: any) =>
    showModal ? (
      <div data-testid="mock-modal">
        <button data-testid="close-modal" onClick={() => setShowModal(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null;
});

jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ children, title }: any) => (
    <div data-testid="mock-accordion">
      <h2>{title}</h2>
      {children}
    </div>
  );
});

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ value, onChange, error, inlabel, intype }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        type={intype}
        data-testid={`input-${inlabel}`}
        value={value}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({ value, onChange, error, placeholder, options }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`dropdown-val-${placeholder}`}>{value}</span>
      <select
        data-testid={`select-${placeholder}`}
        onChange={(e) => {
          const val = e.target.value;
          // Simulate the behavior expected by the component for the Speciality dropdown
          if (placeholder === "Speciality") {
            const selected = options.find((o: any) => o.label === val);
            // Component expects object with 'name' and 'key' properties
            onChange({ name: selected?.label, key: selected?.value });
          } else {
            // Role dropdown expects a simple string
            onChange(val);
          }
        }}
      >
        <option value="">Select</option>
        {options?.map((opt: any) => (
          <option
            key={typeof opt === "string" ? opt : opt.value}
            value={typeof opt === "string" ? opt : opt.label}
          >
            {typeof opt === "string" ? opt : opt.label}
          </option>
        ))}
      </select>
      {error && <span data-testid={`error-${placeholder}`}>{error}</span>}
    </div>
  );
});

jest.mock("@/app/components/Inputs/SelectLabel", () => {
  return ({ title, options, activeOption, setOption }: any) => (
    <div data-testid={`select-label-${title}`}>
      <span>Current: {activeOption}</span>
      {options.map((opt: any) => (
        <button
          key={opt.key}
          data-testid={`option-${opt.key}`}
          onClick={() => setOption(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
});

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="save-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <div data-testid="icon-close" onClick={onClick}>
      Icon
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

  it("renders the modal and form fields correctly", () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
    expect(screen.getByTestId("input-Email")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Speciality")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-Role")).toBeInTheDocument();
    expect(
      screen.getByTestId("select-label-Employee type")
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-btn")).toBeInTheDocument();
  });

  it("does not render when showModal is false", () => {
    render(<AddTeam showModal={false} setShowModal={mockSetShowModal} />);
    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();
  });

  // --- 2. Interaction & State Update ---

  it("updates form state on input change", () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    // 1. Update Email
    const emailInput = screen.getByTestId("input-Email");
    fireEvent.change(emailInput, { target: { value: "new@test.com" } });
    expect(emailInput).toHaveValue("new@test.com");

    // 2. Update Speciality
    const specSelect = screen.getByTestId("select-Speciality");
    fireEvent.change(specSelect, { target: { value: "Cardiology" } });
    expect(screen.getByTestId("dropdown-val-Speciality")).toHaveTextContent(
      "Cardiology"
    );

    // 3. Update Role
    const roleSelect = screen.getByTestId("select-Role");
    fireEvent.change(roleSelect, { target: { value: "Admin" } });

    // 4. Update Employee Type
    const partTimeBtn = screen.getByTestId("option-PART_TIME");
    fireEvent.click(partTimeBtn);
    expect(screen.getByText("Current: PART_TIME")).toBeInTheDocument();
  });

  // --- 3. Validation ---

  it("shows validation errors for empty fields on save", async () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    expect(screen.getByTestId("error-Email")).toHaveTextContent(
      "Email is required"
    );
    expect(screen.getByTestId("error-Speciality")).toHaveTextContent(
      "Speciality is required"
    );
    expect(screen.getByTestId("error-Role")).toHaveTextContent(
      "Role is required"
    );

    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid email", async () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    fireEvent.change(screen.getByTestId("input-Email"), {
      target: { value: "invalid-email" },
    });
    fireEvent.change(screen.getByTestId("select-Speciality"), {
      target: { value: "Cardiology" },
    });
    fireEvent.change(screen.getByTestId("select-Role"), {
      target: { value: "Admin" },
    });

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    expect(screen.getByTestId("error-Email")).toHaveTextContent(
      "Enter a valid email"
    );
    expect(sendInvite).not.toHaveBeenCalled();
  });

  // --- 4. Success & Error Handling ---

  it("calls sendInvite and closes modal on successful save", async () => {
    (sendInvite as jest.Mock).mockResolvedValueOnce({ success: true });

    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    fireEvent.change(screen.getByTestId("input-Email"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByTestId("select-Speciality"), {
      target: { value: "Neurology" },
    });
    fireEvent.change(screen.getByTestId("select-Role"), {
      target: { value: "Staff" },
    });

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    expect(sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "valid@test.com",
        role: "Staff",
        speciality: expect.objectContaining({ name: "Neurology" }),
        type: "FULL_TIME", // Default value
      })
    );

    await waitFor(() => {
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  it("handles API error gracefully (console log)", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    (sendInvite as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    fireEvent.change(screen.getByTestId("input-Email"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByTestId("select-Speciality"), {
      target: { value: "Neurology" },
    });
    fireEvent.change(screen.getByTestId("select-Role"), {
      target: { value: "Staff" },
    });

    fireEvent.click(screen.getByTestId("save-btn"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    expect(mockSetShowModal).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("closes modal when clicking close icons", () => {
    render(<AddTeam showModal={true} setShowModal={mockSetShowModal} />);

    const closeIcons = screen.getAllByTestId("icon-close");
    fireEvent.click(closeIcons[1]); // The visible clickable icon

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
