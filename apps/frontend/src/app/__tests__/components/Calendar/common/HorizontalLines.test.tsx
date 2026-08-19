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
    const { container } = render(<HorizontalLines {...defaultProps} slotStepMinutes={60} />);
    const hourLineCount = Array.from(container.querySelectorAll('div[style]')).filter((line) => {
      const style = line.getAttribute('style') || '';
      return style.includes('top:') && !style.includes('top: 1000px');
    }).length;
    expect(hourLineCount).toBe(9);
  });

  it('renders nothing if window is too small or invalid', () => {
    const { container } = render(
      <HorizontalLines
        {...defaultProps}
        windowStart={0}
        windowEnd={30} // Less than 1 hour, no hour lines
        slotStepMinutes={60}
      />
    );
    const hourLines = Array.from(container.querySelectorAll('div[style]')).filter((line) => {
      const style = line.getAttribute('style') || '';
      return style.includes('top:') && !style.includes('top: 50px');
    });
    expect(hourLines.length).toBe(0);
  });

  // --- 2. Current Time Indicator ---

  it("renders 'now' indicator when getNowTopPxForWindow returns a value", () => {
    (getNowTopPxForWindow as jest.Mock).mockReturnValue(500); // Middle of total height

    const { container } = render(<HorizontalLines {...defaultProps} />);

    // The now-line is the frame's --blue 2px rule with a 7px --blue dot; the old
    // red-500 treatment was pre-design-system.
    const nowDot = Array.from(container.querySelectorAll('div')).find((el) =>
      el.getAttribute('style')?.includes('background-color: var(--blue)')
    );
    const nowLine = Array.from(container.querySelectorAll('div')).find((el) =>
      el.getAttribute('style')?.includes('border-top-color: var(--blue)')
    );

    expect(nowDot).toBeInTheDocument();
    expect(nowDot).toHaveClass('size-[7px]');
    expect(nowLine).toBeInTheDocument();
    // The 2px solid rule is a utility class now, not an inline style; only the
    // themed colour and the opacity stay inline.
    expect(nowLine).toHaveClass('border-t-2');
    expect(nowLine?.getAttribute('style')).toContain('border-top-color: var(--blue)');

    // Check position
    const wrapper = nowDot?.parentElement;
    expect(wrapper).toHaveStyle({ top: '500px' });
  });

  it("does not render 'now' indicator when getNowTopPxForWindow returns null", () => {
    (getNowTopPxForWindow as jest.Mock).mockReturnValue(null);

    const { container } = render(<HorizontalLines {...defaultProps} />);
    const nowDot = Array.from(container.querySelectorAll('div')).find((el) =>
      el.getAttribute('style')?.includes('background-color: var(--blue)')
    );
    expect(nowDot).toBeUndefined();
  });
});
