import React from "react";
import { render, screen } from "@testing-library/react";
import Personal from "@/app/pages/Settings/Sections/Personal";
import { useAuthStore } from "@/app/stores/authStore";

// --- Mocks ---

// Mock Auth Store
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

// Mock Child Components
jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="accordion-button">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// FIX: Use absolute path for import
jest.mock("@/app/pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title, org, showProfileUser, editable }: any) => (
    <div data-testid="profile-card">
      <h2>{title}</h2>
      <span>Given Name: {org.given_name}</span>
      <span>Show User: {String(showProfileUser)}</span>
      <span>Editable: {String(editable)}</span>
    </div>
  ),
}));

describe("Personal Settings Section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering with Data ---

  it("renders personal details when attributes are present", () => {
    const mockAttributes = {
      given_name: "John",
      family_name: "Doe",
      email: "john@example.com",
    };

    // Mock store returning attributes
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ attributes: mockAttributes })
    );

    render(<Personal />);

    // Check Accordion Wrapper
    expect(screen.getByTestId("accordion-button")).toBeInTheDocument();
    expect(screen.getByText("Personal details")).toBeInTheDocument();

    // Check Profile Card Content
    expect(screen.getByTestId("profile-card")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Given Name: John")).toBeInTheDocument();
  });

  // --- 2. Rendering Empty State ---

  it("renders nothing when attributes are missing", () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ attributes: null })
    );

    const { container } = render(<Personal />);

    expect(container).toBeEmptyDOMElement();
  });
});
