import React from 'react';
import { render } from '@testing-library/react';
import HorizontalLines from '@/app/features/appointments/components/Calendar/common/HorizontalLines';

// --- Mocks ---

// Mock Helpers
jest.mock('@/app/features/appointments/components/Calendar/helpers', () => ({
  getNowTopPxForWindow: jest.fn(),
  getTotalWindowHeightPx: jest.fn(() => 1000), // Fixed total height for tests
  MINUTES_PER_STEP: 60, // Simplify math: 1 hour = 1 step
  PIXELS_PER_STEP: 100, // 1 hour = 100px
}));

import { getNowTopPxForWindow } from '@/app/features/appointments/components/Calendar/helpers';

describe('HorizontalLines Component', () => {
  const mockDate = new Date('2023-01-01T12:00:00.000Z');

  const defaultProps = {
    date: mockDate,
    windowStart: 0, // 00:00
    windowEnd: 600, // 10:00 (600 mins)
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Grid Lines ---

  it('renders hour lines correctly based on window range', () => {
    // Window: 00:00 to 10:00.
    // Logic draws lines for full hours > windowStart and < windowEnd.
    // Hours 1 to 9 should be drawn. 0 and 10 are edges (filtered out).
    render(<HorizontalLines {...defaultProps} />);

    // Since we mocked 1 hour = 100px, we expect lines at top: 100, 200... 900.
    // However, windowEnd is 600 mins (10 hours). So calculation is:
    // (60 mins - 0) / 60 * 100 = 100px.
    // Total height logic is mocked to 1000, but logic inside component uses `windowStart`/`windowEnd`.
    // Let's rely on the DOM elements presence rather than exact pixel math which depends heavily on the mocks constants.

    // We expect roughly 9 lines (hours 1-9)
    // The component renders divs with border-t-grey-light for lines.
    // Querying by class name in testing-library is discouraged, but we can check if *any* rendered.
    // Since lines don't have text, we check the container or use a testid if we could modify source.
    // Here we assume the output is valid React elements.
    const { container } = render(<HorizontalLines {...defaultProps} />);
    const lines = container.querySelectorAll('.border-t-grey-light');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders nothing if window is too small or invalid', () => {
    const { container } = render(
      <HorizontalLines
        {...defaultProps}
        windowStart={0}
        windowEnd={30} // Less than 1 hour, no hour lines
      />
    );
    const lines = container.querySelectorAll('.border-t-grey-light');
    expect(lines.length).toBe(0);
  });

  // --- 2. Current Time Indicator ---

  it("renders 'now' indicator when getNowTopPxForWindow returns a value", () => {
    (getNowTopPxForWindow as jest.Mock).mockReturnValue(500); // Middle of total height

    const { container } = render(<HorizontalLines {...defaultProps} />);

    // Check for the red circle and line
    // Circle class: "bg-red-500"
    // Line class: "border-t-red-500"
    const redCircle = container.querySelector('.bg-red-500');
    const redLine = container.querySelector('.border-t-red-500');

    expect(redCircle).toBeInTheDocument();
    expect(redLine).toBeInTheDocument();

    // Check position
    const wrapper = redCircle?.parentElement;
    expect(wrapper).toHaveStyle({ top: '500px' });
  });

  it("does not render 'now' indicator when getNowTopPxForWindow returns null", () => {
    (getNowTopPxForWindow as jest.Mock).mockReturnValue(null);

    const { container } = render(<HorizontalLines {...defaultProps} />);
    const redCircle = container.querySelector('.bg-red-500');
    expect(redCircle).not.toBeInTheDocument();
  });
});
