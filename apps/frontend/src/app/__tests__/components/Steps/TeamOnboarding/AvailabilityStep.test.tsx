import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AvailabilityStep from "../../../../components/Steps/TeamOnboarding/AvailabilityStep";
import { upsertAvailability } from "@/app/services/availability";
import {
  convertAvailability,
  hasAtLeastOneAvailability,
} from "../../../../components/Availability/utils";

// --- Mocks ---

// 1. Mock Service
jest.mock("@/app/services/availability", () => ({
  upsertAvailability: jest.fn(),
}));

// 2. Mock Utils
jest.mock("../../../../components/Availability/utils", () => ({
  convertAvailability: jest.fn(),
  hasAtLeastOneAvailability: jest.fn(),
}));

// 3. Mock Child Components
// Mock the complex Availability component to isolate the step logic
jest.mock("../../../../components/Availability/Availability", () => () => (
  <div data-testid="availability-component">Mock Availability UI</div>
));

// Mock Buttons
jest.mock("../../../../components/Buttons", () => ({
  Primary: ({ onClick, text }: any) => (
    <button data-testid="btn-next" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("AvailabilityStep Component", () => {
  const mockPrevStep = jest.fn();
  const mockSetAvailability = jest.fn();
  const mockOrgId = "org-123";
  const mockAvailabilityState = { monday: [] } as any; // Dummy state
  const mockConvertedData = [{ day: "monday", slots: [] }]; // Dummy converted

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (convertAvailability as jest.Mock).mockReturnValue(mockConvertedData);
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);

    // Spy on console.log to avoid clutter and verify error logging
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --- Section 1: Rendering ---
  it("renders the container, title, and child components", () => {
    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
      />
    );

    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByTestId("availability-component")).toBeInTheDocument();
    expect(screen.getByTestId("btn-next")).toBeInTheDocument();
  });

  // --- Section 2: Validation (No Slots) ---
  it("logs message and aborts submission if no availability is selected", async () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(false);

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    // Check flow
    expect(convertAvailability).toHaveBeenCalledWith(mockAvailabilityState);
    expect(hasAtLeastOneAvailability).toHaveBeenCalledWith(mockConvertedData);

    // Ensure service was NOT called
    expect(upsertAvailability).not.toHaveBeenCalled();

    // Verify log
    expect(console.log).toHaveBeenCalledWith("No availability selected");
  });

  // --- Section 3: Successful Submission ---
  it("converts data and calls upsertAvailability on success", async () => {
    (hasAtLeastOneAvailability as jest.Mock).mockReturnValue(true);
    (upsertAvailability as jest.Mock).mockResolvedValue({});

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(convertAvailability).toHaveBeenCalledWith(mockAvailabilityState);
      expect(upsertAvailability).toHaveBeenCalledWith(
        mockConvertedData,
        mockOrgId
      );
    });
  });

  // --- Section 4: Error Handling ---
  it("catches and logs errors from upsertAvailability", async () => {
    const error = new Error("Network Error");
    (upsertAvailability as jest.Mock).mockRejectedValue(error);

    render(
      <AvailabilityStep
        prevStep={mockPrevStep}
        orgIdFromQuery={mockOrgId}
        availability={mockAvailabilityState}
        setAvailability={mockSetAvailability}
      />
    );

    fireEvent.click(screen.getByTestId("btn-next"));

    await waitFor(() => {
      expect(upsertAvailability).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(error);
    });
  });
});
