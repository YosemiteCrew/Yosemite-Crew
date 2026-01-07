import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedSettings from "@/app/pages/Settings/index";

// --- Mocks ---

// Mock the authentication wrapper to render children directly
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

// Mock the child sections to isolate the test to the layout component
jest.mock("@/app/pages/Settings/Sections/Personal", () => ({
  __esModule: true,
  default: () => <div data-testid="personal-section">Personal Settings</div>,
}));

jest.mock("@/app/pages/Settings/Sections/Delete", () => ({
  __esModule: true,
  default: () => <div data-testid="delete-section">Delete Account</div>,
}));

jest.mock("@/app/pages/Settings/Sections/OrgSection", () => ({
  __esModule: true,
  default: () => <div data-testid="org-section">Organization Settings</div>,
}));

describe("Settings Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Structure ---

  it("renders within the ProtectedRoute wrapper", () => {
    render(<ProtectedSettings />);

    // Verifies that the page is protected
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
  });

  it("renders all setting sections correctly", () => {
    render(<ProtectedSettings />);

    // Verifies all sub-components are present
    expect(screen.getByTestId("personal-section")).toBeInTheDocument();
    expect(screen.getByTestId("org-section")).toBeInTheDocument();
    expect(screen.getByTestId("delete-section")).toBeInTheDocument();
  });

  it("renders the layout container with correct classes", () => {
    const { container } = render(<ProtectedSettings />);

    // Select the first div inside the ProtectedRoute (the Settings component root)
    const settingsRoot = container.querySelector(".flex.flex-col");

    expect(settingsRoot).toHaveClass(
      "px-4!",
      "py-6!",
      "md:px-12!",
      "lg:px-10!"
    );
  });
});
