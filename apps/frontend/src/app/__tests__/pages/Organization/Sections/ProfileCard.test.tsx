import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileCard from "@/app/pages/Organization/Sections/ProfileCard";
import * as useProfiles from "@/app/hooks/useProfiles";
import * as authStore from "@/app/stores/authStore";

// --- Mocks ---

// Mock Hooks
jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: jest.fn(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

// Mock Utils
jest.mock("@/app/utils/urls", () => ({
  isHttpsImageUrl: jest.fn((url) => url?.startsWith("https")),
}));

// Mock Next/Image
// We use a simple img tag so we can test attributes easily
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

// Mock Buttons
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="primary-btn" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button data-testid="secondary-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Mock Inputs
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, value, onChange, error }: any) => (
    <div data-testid={`input-wrapper-${inlabel}`}>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        value={value || ""}
        onChange={onChange}
      />
      {error && <span data-testid={`error-${inlabel}`}>{error}</span>}
    </div>
  );
});

// Mock Icons
jest.mock("react-icons/ri", () => ({
  RiEdit2Fill: ({ onClick }: any) => (
    <button data-testid="edit-icon" onClick={onClick}>
      Edit
    </button>
  ),
}));

describe("ProfileCard Component", () => {
  const mockOnSave = jest.fn();

  const defaultFields = [
    { label: "Name", key: "name", required: true, editable: true },
    { label: "Email", key: "email", required: true, editable: true },
    { label: "Role", key: "role", editable: false }, // Not editable
  ];

  const defaultOrg = {
    name: "Test Org",
    email: "test@org.com",
    role: "Admin",
    imageURL: "https://example.com/logo.png",
    isVerified: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useProfiles.usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { profilePictureUrl: "https://user.com/pic.png" },
    });

    // FIX: Double cast (as unknown as jest.Mock) fixes the "Conversion of type..." TS error
    (authStore.useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector) =>
        selector({
          attributes: { given_name: "John", family_name: "Doe" },
        })
    );
  });

  // --- 1. Rendering ---

  it("renders title and read-only fields correctly", () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        editable={false}
      />
    );

    expect(screen.getByText("Org Profile")).toBeInTheDocument();
    expect(screen.getByText("Name:")).toBeInTheDocument();
    expect(screen.getByText("Test Org")).toBeInTheDocument();
    expect(screen.getByText("Email:")).toBeInTheDocument();
    expect(screen.getByText("test@org.com")).toBeInTheDocument();

    // Edit icon should not be visible if editable=false
    expect(screen.queryByTestId("edit-icon")).not.toBeInTheDocument();
  });

  it("renders empty placeholder for missing values", () => {
    const emptyOrg = { ...defaultOrg, email: null };
    render(
      <ProfileCard title="Org Profile" fields={defaultFields} org={emptyOrg} />
    );
    // Find the label "Email:", then check the next sibling or value container
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders user profile section when showProfileUser is true", () => {
    render(
      <ProfileCard
        title="User Profile"
        fields={[]}
        org={{}}
        showProfileUser={true}
      />
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();

    // FIX: Use toHaveAttribute instead of casting to HTMLImageElement
    const img = screen.getByAltText("Logo");
    // We check partial match for src because Next/Image might process it
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("https://user.com/pic.png")
    );
  });

  it("renders default user image if profile url is invalid", () => {
    (useProfiles.usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { profilePictureUrl: "invalid-url" },
    });

    render(
      <ProfileCard
        title="User Profile"
        fields={[]}
        org={{}}
        showProfileUser={true}
      />
    );

    // FIX: Use toHaveAttribute instead of casting
    const img = screen.getByAltText("Logo");
    expect(img).toHaveAttribute("src", expect.stringContaining("ftafter.png"));
  });

  it("renders organization profile section (active) when showProfile is true", () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={[]}
        org={defaultOrg} // isVerified: true
        showProfile={true}
      />
    );

    expect(screen.getByText("Test Org")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Book onboarding call")).not.toBeInTheDocument();
  });

  it("renders organization profile section (pending) with booking button", () => {
    const pendingOrg = { ...defaultOrg, isVerified: false, imageURL: null };
    render(
      <ProfileCard
        title="Org Profile"
        fields={[]}
        org={pendingOrg}
        showProfile={true}
      />
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Book onboarding call")).toBeInTheDocument();

    // FIX: Use toHaveAttribute instead of casting
    const img = screen.getByAltText("Logo");
    expect(img).toHaveAttribute("src", expect.stringContaining("ftafter.png"));

    // Check note rendering
    expect(
      screen.getByText(/This short chat helps us confirm/)
    ).toBeInTheDocument();
  });

  // --- 2. Interaction & State ---

  it("enters edit mode when edit icon is clicked", () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        editable={true}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));

    expect(screen.getByTestId("input-Name")).toBeInTheDocument();
    expect(screen.getByTestId("input-Email")).toBeInTheDocument();
    // Non-editable field should still show as text
    expect(screen.queryByTestId("input-Role")).not.toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    expect(screen.getByTestId("primary-btn")).toHaveTextContent("Save");
    expect(screen.getByTestId("secondary-btn")).toHaveTextContent("Cancel");
  });

  it("updates form values in edit mode", () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        editable={true}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));

    const nameInput = screen.getByTestId("input-Name");
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    expect(nameInput).toHaveValue("New Name");
  });

  it("resets values on cancel", () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        editable={true}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));

    const nameInput = screen.getByTestId("input-Name");
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    fireEvent.click(screen.getByTestId("secondary-btn")); // Cancel

    // Should return to view mode
    expect(screen.queryByTestId("input-Name")).not.toBeInTheDocument();
    expect(screen.getByText("Test Org")).toBeInTheDocument(); // Original value
  });

  it("updates form values when 'org' prop changes while not editing", () => {
    const { rerender } = render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
      />
    );

    const newOrg = { ...defaultOrg, name: "Updated Org" };
    rerender(
      <ProfileCard title="Org Profile" fields={defaultFields} org={newOrg} />
    );

    expect(screen.getByText("Updated Org")).toBeInTheDocument();
  });

  // --- 3. Validation ---

  it("validates required fields on save", async () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));

    const nameInput = screen.getByTestId("input-Name");
    fireEvent.change(nameInput, { target: { value: "" } }); // Clear required field

    await act(async () => {
      fireEvent.click(screen.getByTestId("primary-btn")); // Save
    });

    expect(screen.getByTestId("error-Name")).toHaveTextContent(
      "Name is required"
    );
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("clears validation error on input change", async () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));

    // Trigger error
    const nameInput = screen.getByTestId("input-Name");
    fireEvent.change(nameInput, { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("primary-btn"));
    });
    expect(screen.getByTestId("error-Name")).toBeInTheDocument();

    // Fix error
    fireEvent.change(nameInput, { target: { value: "Fixed" } });

    // Error should be gone (undefined in state, so not rendered by mock)
    expect(screen.queryByTestId("error-Name")).not.toBeInTheDocument();
  });

  // --- 4. Submission ---

  it("calls onSave with valid data and exits edit mode", async () => {
    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));

    const nameInput = screen.getByTestId("input-Name");
    fireEvent.change(nameInput, { target: { value: "Saved Name" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("primary-btn"));
    });

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Saved Name",
        email: "test@org.com", // Unchanged field
        role: "Admin", // Non-editable field included in state
      })
    );

    // Should return to view mode
    expect(screen.queryByTestId("input-Name")).not.toBeInTheDocument();
  });

  it("handles onSave errors gracefully", async () => {
    mockOnSave.mockRejectedValue(new Error("Save failed"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ProfileCard
        title="Org Profile"
        fields={defaultFields}
        org={defaultOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTestId("edit-icon"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("primary-btn"));
    });

    expect(mockOnSave).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in ProfileCard onSave:",
      expect.any(Error)
    );

    // Should remain in edit mode on error
    expect(screen.getByTestId("input-Name")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  // --- 5. Edge Cases ---

  it("handles getStatusStyle edge cases", () => {
    const { rerender } = render(
      <ProfileCard
        title="T"
        fields={[]}
        org={{ isVerified: true }}
        showProfile={true}
      />
    );
    // Active (Green)
    let statusBadge = screen.getByText("Active");
    expect(statusBadge).toHaveStyle({
      color: "#008F5D",
      backgroundColor: "#E6F4EF",
    });

    // Pending (Orange)
    rerender(
      <ProfileCard
        title="T"
        fields={[]}
        org={{ isVerified: false }}
        showProfile={true}
      />
    );
    statusBadge = screen.getByText("Pending");
    expect(statusBadge).toHaveStyle({
      color: "#F68523",
      backgroundColor: "#FEF3E9",
    });
  });
});
