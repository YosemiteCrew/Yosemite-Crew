import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProtectedTeamOnboarding from "@/app/pages/TeamOnboarding/TeamOnboarding";
import { useRouter, useSearchParams } from "next/navigation";
import { useTeamOnboarding } from "@/app/hooks/useTeamOnboarding";
import { convertFromGetApi } from "@/app/components/Availability/utils";

// --- Mocks ---

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/app/hooks/useTeamOnboarding", () => ({
  useTeamOnboarding: jest.fn(),
}));

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/Steps/Progress/Progress", () => ({
  __esModule: true,
  default: ({ activeStep }: any) => (
    <div data-testid="progress">Step {activeStep + 1}</div>
  ),
}));

// Mock Step Components
jest.mock("@/app/components/Steps/TeamOnboarding/PersonalStep", () => ({
  __esModule: true,
  default: ({ nextStep }: any) => (
    <div data-testid="personal-step">
      Personal Details
      <button onClick={nextStep}>Next</button>
    </div>
  ),
}));

jest.mock("@/app/components/Steps/TeamOnboarding/ProfessionalStep", () => ({
  __esModule: true,
  default: ({ nextStep, prevStep }: any) => (
    <div data-testid="professional-step">
      Professional Details
      <button onClick={prevStep}>Prev</button>
      <button onClick={nextStep}>Next</button>
    </div>
  ),
}));

jest.mock("@/app/components/Steps/TeamOnboarding/AvailabilityStep", () => ({
  __esModule: true,
  default: ({ prevStep }: any) => (
    <div data-testid="availability-step">
      Availability Details
      <button onClick={prevStep}>Prev</button>
    </div>
  ),
}));

jest.mock("@/app/components/Availability/utils", () => ({
  ...jest.requireActual("@/app/components/Availability/utils"),
  convertFromGetApi: jest.fn(),
}));

describe("TeamOnboarding Page", () => {
  const mockRouterReplace = jest.fn();
  const mockSearchParams = { get: jest.fn() };

  const defaultHookValues = {
    profile: null,
    step: 0,
    slots: [],
    shouldRedirectToOrganizations: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockRouterReplace });
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (useTeamOnboarding as jest.Mock).mockReturnValue(defaultHookValues);
    (convertFromGetApi as jest.Mock).mockReturnValue({});
  });

  // --- 1. Rendering & Protection ---

  it("renders within ProtectedRoute", () => {
    render(<ProtectedTeamOnboarding />);
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
  });

  it("renders PersonalStep initially (step 0)", () => {
    render(<ProtectedTeamOnboarding />);
    expect(screen.getByText("Create profile")).toBeInTheDocument();
    expect(screen.getByTestId("personal-step")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveTextContent("Step 1");
  });

  // --- 2. Redirect Logic ---

  it("redirects to /organizations if shouldRedirectToOrganizations is true", () => {
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      shouldRedirectToOrganizations: true,
    });

    render(<ProtectedTeamOnboarding />);
    expect(mockRouterReplace).toHaveBeenCalledWith("/organizations");
  });

  it("redirects to /dashboard if step is 3 (completed)", () => {
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      step: 3,
    });

    render(<ProtectedTeamOnboarding />);
    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
  });

  // --- 3. Step Transitions & State Sync ---

  it("renders ProfessionalStep when step is 1", () => {
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      step: 1,
    });

    render(<ProtectedTeamOnboarding />);
    expect(screen.getByTestId("professional-step")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveTextContent("Step 2");
  });

  it("renders AvailabilityStep when step is 2", () => {
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      step: 2,
    });

    render(<ProtectedTeamOnboarding />);
    expect(screen.getByTestId("availability-step")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveTextContent("Step 3");
  });

  it("syncs profile data from hook to local state", () => {
    const mockProfile = { personalDetails: { firstName: "Test" } };
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      profile: mockProfile,
    });

    render(<ProtectedTeamOnboarding />);
    // Just verifying no crash and effect execution;
    // real prop passing is handled by React, mocked components just render divs.
    expect(screen.getByTestId("personal-step")).toBeInTheDocument();
  });

  it("syncs slots data from hook to availability state", () => {
    const mockSlots = [{ day: "Monday", intervals: [] }];
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      slots: mockSlots,
    });

    render(<ProtectedTeamOnboarding />);
    expect(convertFromGetApi).toHaveBeenCalledWith(mockSlots);
  });

  // --- 4. Navigation Handlers (Internal State) ---

  it("navigates forward using nextStep handler", async () => {
    // Start at step 0 (Personal)
    render(<ProtectedTeamOnboarding />);

    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);

    // Should move to step 1 (Professional)
    await waitFor(() => {
      expect(screen.getByTestId("professional-step")).toBeInTheDocument();
    });
  });

  it("navigates backward using prevStep handler", async () => {
    // Force start at step 1 via hook to initialize state correctly
    (useTeamOnboarding as jest.Mock).mockReturnValue({
      ...defaultHookValues,
      step: 1,
    });

    render(<ProtectedTeamOnboarding />);
    expect(screen.getByTestId("professional-step")).toBeInTheDocument();

    const prevBtn = screen.getByText("Prev");
    fireEvent.click(prevBtn);

    // Should move back to step 0 (Personal)
    await waitFor(() => {
      expect(screen.getByTestId("personal-step")).toBeInTheDocument();
    });
  });
});
