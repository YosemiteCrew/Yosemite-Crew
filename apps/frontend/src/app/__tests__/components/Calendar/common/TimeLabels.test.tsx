import React from "react";
import { render, screen } from "@testing-library/react";
import TimeLabels from "@/app/components/Calendar/common/TimeLabels";

// --- Mocks ---

// Mock Helpers to make pixel calculations predictable
jest.mock("@/app/components/Calendar/helpers", () => ({
  MINUTES_PER_STEP: 60, // 1 step = 60 minutes
  PIXELS_PER_STEP: 100, // 1 step = 100 pixels
  // Therefore: 1 minute = 100/60 = 1.666 pixels
}));

describe("TimeLabels Component", () => {
  // --- 1. Rendering Logic ---

  it("renders labels for exact hour boundaries", () => {
    // Window: 09:00 (540 mins) to 11:00 (660 mins)
    // Should render 09:00, 10:00, 11:00
    render(<TimeLabels windowStart={540} windowEnd={660} />);

    // Use regex to match 9:00 with flexible AM/PM and spacing
    expect(screen.getByText(/9:00/i)).toBeInTheDocument();
    expect(screen.getByText(/10:00/i)).toBeInTheDocument();
    expect(screen.getByText(/11:00/i)).toBeInTheDocument();
  });

  it("renders correctly for partial windows (Math.ceil/floor logic)", () => {
    // Window: 09:30 (570 mins) to 11:30 (690 mins)
    // Start Hour: ceil(9.5) = 10 (10:00)
    // End Hour: floor(11.5) = 11 (11:00)
    // Should render ONLY 10:00 and 11:00. 09:00 and 12:00 should be excluded.
    render(<TimeLabels windowStart={570} windowEnd={690} />);

    expect(screen.queryByText(/9:00/i)).not.toBeInTheDocument();
    expect(screen.getByText(/10:00/i)).toBeInTheDocument();
    expect(screen.getByText(/11:00/i)).toBeInTheDocument();
    expect(screen.queryByText(/12:00/i)).not.toBeInTheDocument();
  });

  it("renders nothing if window is smaller than an hour and crosses no boundary", () => {
    // Window: 09:10 (550) to 09:50 (590)
    // Start Hour: 10, End Hour: 9. Length 0.
    const { container } = render(
      <TimeLabels windowStart={550} windowEnd={590} />
    );

    // Should be empty div
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  // --- 2. Positioning Logic ---

  it("calculates 'top' style correctly relative to windowStart", () => {
    // Window: 10:00 (600) to 12:00 (720).
    // Mock: 1 Hour = 100px height.

    render(<TimeLabels windowStart={600} windowEnd={720} />);

    // 10:00 is exactly at window start -> top: 0px
    const label10 = screen.getByText(/10:00/i).closest("div");
    expect(label10).toHaveStyle({ top: "0px" });

    // 11:00 is 60 mins after start -> top: 100px
    const label11 = screen.getByText(/11:00/i).closest("div");
    expect(label11).toHaveStyle({ top: "100px" });

    // 12:00 is 120 mins after start -> top: 200px
    const label12 = screen.getByText(/12:00/i).closest("div");
    expect(label12).toHaveStyle({ top: "200px" });
  });

  it("calculates 'top' correctly when window starts on a half hour", () => {
    // Window: 09:30 (570) to 11:30.
    // First label is 10:00 (600 mins).
    // Diff: 600 - 570 = 30 mins.
    // 30 mins / 60 (step) = 0.5 steps.
    // 0.5 * 100px (pixels per step) = 50px.

    render(<TimeLabels windowStart={570} windowEnd={690} />);

    const label10 = screen.getByText(/10:00/i).closest("div");
    expect(label10).toHaveStyle({ top: "50px" });
  });
});
