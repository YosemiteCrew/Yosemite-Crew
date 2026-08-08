import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NowIndicator from '@/app/features/appointments/components/Calendar/common/NowIndicator';

describe('NowIndicator', () => {
  it('renders the time label using the blue accent when provided', () => {
    render(<NowIndicator topPx={120} timeLabel="09:40" />);

    const label = screen.getByText('09:40');
    expect(label).toBeInTheDocument();
    expect(label).toHaveStyle({ color: 'var(--blue-text)' });
  });

  it('omits the time label when none is provided', () => {
    const { container } = render(<NowIndicator topPx={80} timeLabel={null} />);

    expect(container.textContent).toBe('');
  });

  it('paints the dot and line with the blue now-line token, not the emergency red', () => {
    const { container } = render(<NowIndicator topPx={200} timeLabel="10:15" />);

    const dot = container.querySelector('.rounded-full') as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: 'var(--blue)' });

    const line = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
      (el) => el.style.borderTopColor === 'var(--blue)'
    );
    expect(line).toBeTruthy();
    expect(line).toHaveStyle({ opacity: '0.75', borderTopWidth: '2px' });
  });

  it('positions the indicator at the supplied vertical offset', () => {
    const { container } = render(<NowIndicator topPx={321} timeLabel="11:00" />);

    const positioned = container.querySelector('[style*="top: 321px"]');
    expect(positioned).toBeTruthy();
  });
});
