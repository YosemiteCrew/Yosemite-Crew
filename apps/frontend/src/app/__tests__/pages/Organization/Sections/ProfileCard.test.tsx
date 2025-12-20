import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfileCard from "@/app/pages/Organization/Sections/ProfileCard";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";
import { useAuthStore } from "@/app/stores/authStore";

// --- Mocks ---

jest.mock("@/app/hooks/useProfiles", () => ({
  usePrimaryOrgProfile: jest.fn(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "", ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input data-testid="form-input" value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </div>
  ),
}));

// Mocking these to avoid complex nested rendering logic
jest.mock("@/app/components/Inputs/Datepicker", () => () => (
  <div data-testid="mock-datepicker" />
));
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => () => (
  <div data-testid="mock-dropdown" />
));
jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => () => (
  <div data-testid="mock-multiselect" />
));

describe("ProfileCard Component", () => {
  const mockOrg = {
    name: "Test Org",
    imageURL: "https://example.com/image.png",
    isVerified: true,
    email: "test@org.com",
    joined: "2023-01-01",
    tags: ["Vet", "Emergency"],
  };

  const mockFields = [
    { label: "Email", key: "email", type: "text", editable: false },
    {
      label: "Org Name",
      key: "name",
      type: "text",
      editable: true,
      required: true,
    },
    { label: "Join Date", key: "joined", type: "date", editable: true },
    {
      label: "Tags",
      key: "tags",
      type: "multiSelect",
      options: ["Vet", "Grooming"],
      editable: true,
    },
  ];

  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePrimaryOrgProfile as jest.Mock).mockReturnValue({
      personalDetails: { profilePictureUrl: "https://pic.com" },
    });
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ attributes: { given_name: "John", family_name: "Doe" } })
    );
  });

  // Helper to find the Edit Icon (SVG)
  const getEditIcon = (container: HTMLElement) => {
    const svg = container.querySelector("svg.cursor-pointer");
    if (!svg) throw new Error("Could not find edit icon");
    return svg;
  };

  // --- 1. Rendering & Status Logic ---

  it("renders correctly in read-only mode", () => {
    render(
      <ProfileCard title="Org Details" fields={mockFields} org={mockOrg} />
    );

    expect(screen.getByText("Org Details")).toBeInTheDocument();
    expect(screen.getByText("test@org.com")).toBeInTheDocument();
    expect(screen.queryByTestId("form-input")).not.toBeInTheDocument();
  });

  it("displays Pending status correctly for unverified orgs", () => {
    render(
      <ProfileCard
        title="T"
        fields={[]}
        org={{ ...mockOrg, isVerified: false }}
        showProfile
      />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Book onboarding call")).toBeInTheDocument();
  });

  // --- 2. Edit Mode & Interactions ---

  it("enters edit mode and handles changes", () => {
    const { container } = render(
      <ProfileCard
        title="T"
        fields={mockFields}
        org={mockOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(getEditIcon(container));

    const inputs = screen.getAllByTestId("form-input");
    fireEvent.change(inputs[0], { target: { value: "Updated Name" } });

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels editing and reverts values", () => {
    const { container } = render(
      <ProfileCard
        title="T"
        fields={mockFields}
        org={mockOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(getEditIcon(container));
    fireEvent.change(screen.getAllByTestId("form-input")[0], {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.getByText("Test Org")).toBeInTheDocument();
  });

  // --- 3. Validation & Saving ---

  it("shows validation error for required fields", async () => {
    const { container } = render(
      <ProfileCard
        title="T"
        fields={mockFields}
        org={mockOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(getEditIcon(container));
    // Clear the required Name field
    fireEvent.change(screen.getAllByTestId("form-input")[0], {
      target: { value: "" },
    });

    fireEvent.click(screen.getByText("Save"));

    expect(await screen.findByText("Org Name is required")).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("calls onSave with updated values on successful validation", async () => {
    mockOnSave.mockResolvedValueOnce(undefined);
    const { container } = render(
      <ProfileCard
        title="T"
        fields={mockFields}
        org={mockOrg}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(getEditIcon(container));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });
  });

  // --- 4. Helper Logic & Edge Cases ---

  it("handles fallback images when URL is invalid", () => {
    render(
      <ProfileCard
        title="T"
        fields={[]}
        org={{ imageURL: "not-https" }}
        showProfile
      />
    );
    const img = screen.getByAltText("Logo");
    expect(img).toHaveAttribute(
      "src",
      "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
    );
  });

  it("renders user details when showProfileUser is true", () => {
    render(<ProfileCard title="T" fields={[]} org={mockOrg} showProfileUser />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });
});
