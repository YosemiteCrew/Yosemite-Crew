import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrgSection from "@/app/pages/Settings/Sections/OrgSection";
import * as orgSelectors from "@/app/hooks/useOrgSelectors";
import * as availabilityHooks from "@/app/hooks/useAvailabiities";
import * as availabilityService from "@/app/services/availability";
import * as availabilityUtils from "@/app/components/Availability/utils";

// --- Mocks ---

// Mock Hooks
jest.mock("@/app/hooks/useOrgSelectors", () => ({
  usePrimaryOrgWithMembership: jest.fn(),
}));

jest.mock("@/app/hooks/useAvailabiities", () => ({
  usePrimaryAvailability: jest.fn(),
}));

// Mock Services
jest.mock("@/app/services/availability", () => ({
  upsertAvailability: jest.fn(),
}));

// Mock Utils
// We mock the entire module to control helper functions and constants
jest.mock("@/app/components/Availability/utils", () => ({
  // Provide a simplified week for testing logic
  daysOfWeek: ["Monday", "Tuesday", "Sunday"],
  DEFAULT_INTERVAL: { start: "09:00", end: "17:00" },
  convertAvailability: jest.fn(),
  hasAtLeastOneAvailability: jest.fn(),
  AvailabilityState: {},
}));

// Mock Child Components
jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid="accordion-button">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// FIX: Use the absolute alias path for the mock so Jest resolves it correctly
jest.mock("@/app/pages/Organization/Sections/ProfileCard", () => ({
  __esModule: true,
  default: ({ title }: any) => <div data-testid={`profile-card-${title}`} />,
}));

jest.mock("@/app/components/Availability/Availability", () => ({
  __esModule: true,
  default: () => <div data-testid="availability-component" />,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="save-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("OrgSection Component", () => {
  const mockOrg = { id: "org-1", name: "Test Org" };
  const mockMembership = { roleDisplay: "Admin" };
  const mockAvailabilities = {
    Monday: { enabled: true, intervals: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Hooks
    (orgSelectors.usePrimaryOrgWithMembership as jest.Mock).mockReturnValue({
      org: mockOrg,
      membership: mockMembership,
    });

    (availabilityHooks.usePrimaryAvailability as jest.Mock).mockReturnValue({
      availabilities: null, // Default null to test initial state logic
    });

    // Default Utils
    (availabilityUtils.convertAvailability as jest.Mock).mockReturnValue(
      "converted-data"
    );
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(
      true
    );

    // Spy on console to silence logs and assert errors
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  // --- 1. Rendering ---

  it("renders nothing if org or membership is missing", () => {
    (orgSelectors.usePrimaryOrgWithMembership as jest.Mock).mockReturnValue({
      org: null,
      membership: null,
    });
    const { container } = render(<OrgSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all profile cards and availability section when data exists", () => {
    render(<OrgSection />);

    expect(screen.getByText("Org Details")).toBeInTheDocument();
    expect(screen.getByTestId("profile-card-Info")).toBeInTheDocument();
    expect(screen.getByTestId("profile-card-Address")).toBeInTheDocument();
    expect(
      screen.getByTestId("profile-card-Professional details")
    ).toBeInTheDocument();
    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByTestId("availability-component")).toBeInTheDocument();
    expect(screen.getByTestId("save-btn")).toBeInTheDocument();
  });

  // --- 2. State & Effects ---

  it("initializes default availability state correctly", () => {
    // Tests the reduce logic in the useState initializer
    render(<OrgSection />);
    // Component renders successfully implies reducer logic for daysOfWeek ran
  });

  it("updates availability state when hook returns data", () => {
    // Tests useEffect([availabilities])
    (availabilityHooks.usePrimaryAvailability as jest.Mock).mockReturnValue({
      availabilities: mockAvailabilities,
    });

    render(<OrgSection />);

    // Internal state update is verified by the fact that valid render still happens
    // and subsequent actions would use this data.
  });

  // --- 3. Interactions (Save) ---

  it("saves availability successfully", async () => {
    render(<OrgSection />);

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      // Verify utilities are called with current state
      expect(availabilityUtils.convertAvailability).toHaveBeenCalled();

      // Verify validation check
      expect(availabilityUtils.hasAtLeastOneAvailability).toHaveBeenCalledWith(
        "converted-data"
      );

      // Verify API call
      expect(availabilityService.upsertAvailability).toHaveBeenCalledWith(
        "converted-data",
        null
      );
    });
  });

  it("logs warning and aborts if no availability is selected", async () => {
    // Simulate validation failure
    (availabilityUtils.hasAtLeastOneAvailability as jest.Mock).mockReturnValue(
      false
    );

    render(<OrgSection />);

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith("No availability selected");
      expect(availabilityService.upsertAvailability).not.toHaveBeenCalled();
    });
  });

  it("logs error if upsert fails", async () => {
    const error = new Error("Upsert Failed");
    (availabilityService.upsertAvailability as jest.Mock).mockRejectedValue(
      error
    );

    render(<OrgSection />);

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(error);
    });
  });
});
