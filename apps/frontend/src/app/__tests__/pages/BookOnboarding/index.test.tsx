import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ProtectedBookOnboarding from "../../../pages/BookOnboarding";
import { getCalApi } from "@calcom/embed-react";

// --- Mocks ---

// 1. Mock @calcom/embed-react
// We need to mock both the default export (the Component) and the named export (getCalApi)
const mockCalApiFunction = jest.fn();

jest.mock("@calcom/embed-react", () => ({
  __esModule: true,
  // Mock the <Cal /> component to render a dummy div with its props serialized
  default: jest.fn((props) => (
    <div data-testid="cal-component" data-props={JSON.stringify(props)}>
      Cal Embed Component
    </div>
  )),
  // Mock getCalApi to return a Promise that resolves to our spy function
  getCalApi: jest.fn(() => Promise.resolve(mockCalApiFunction)),
}));

// 2. Mock OrgGuard
jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="org-guard">{children}</div>
  ),
}));

// 3. Mock ProtectedRoute
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe("BookOnboarding Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the page title and structure within protected guards", async () => {
    render(<ProtectedBookOnboarding />);

    // 1. Verify Wrappers (Statements/Functions coverage for ProtectedBookOnboarding)
    const protectedRoute = screen.getByTestId("protected-route");
    const orgGuard = screen.getByTestId("org-guard");

    expect(protectedRoute).toContainElement(orgGuard);

    // 2. Verify Title (Render coverage)
    expect(screen.getByText("Book onboarding call")).toBeInTheDocument();
  });

  it("initializes the Cal API on mount", async () => {
    render(<ProtectedBookOnboarding />);

    // 1. Verify getCalApi is called (Effect coverage)
    await waitFor(() => {
      expect(getCalApi).toHaveBeenCalledTimes(1);
      expect(getCalApi).toHaveBeenCalledWith({ namespace: "30min" });
    });

    // 2. Verify the returned cal function is configured (Branch/Statement coverage inside async IIFE)
    await waitFor(() => {
      expect(mockCalApiFunction).toHaveBeenCalledTimes(1);
      expect(mockCalApiFunction).toHaveBeenCalledWith("ui", {
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    });
  });

  it("renders the Cal component with correct props", () => {
    render(<ProtectedBookOnboarding />);

    const calComponent = screen.getByTestId("cal-component");

    // Parse the props passed to the mock
    const props = JSON.parse(calComponent.dataset.props ?? "{}");

    // Verify all props passed to <Cal />
    expect(props).toEqual(
      expect.objectContaining({
        namespace: "30min",
        calLink: "yosemitecrew/onboarding",
        style: { width: "100%", height: "100%", overflow: "scroll" },
        config: { theme: "light", layout: "month_view" },
      })
    );
  });
});
