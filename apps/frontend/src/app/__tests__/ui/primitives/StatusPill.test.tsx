import { render, screen } from '@testing-library/react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

describe('StatusPill', () => {
  it('renders the label', () => {
    render(<StatusPill label="Enabled" />);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('colours from a tone token set by default', () => {
    render(<StatusPill label="Paid" tone="success" />);
    expect(screen.getByText('Paid')).toHaveStyle({
      backgroundColor: 'var(--color-pill-success-bg)',
    });
  });

  it('falls back to the neutral tone when none is given', () => {
    render(<StatusPill label="Draft" />);
    expect(screen.getByText('Draft')).toHaveStyle({
      backgroundColor: 'var(--color-pill-neutral-bg)',
    });
  });

  it('lets explicit tokens override the tone', () => {
    render(
      <StatusPill
        label="Custom"
        tone="success"
        tokens={{ bg: 'rgb(1, 2, 3)', text: 'rgb(4, 5, 6)', border: 'rgb(7, 8, 9)' }}
      />
    );
    expect(screen.getByText('Custom')).toHaveStyle({ backgroundColor: 'rgb(1, 2, 3)' });
  });

  it('renders a live dot only when showDot is set', () => {
    const { container, rerender } = render(<StatusPill label="Online" showDot />);
    expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    rerender(<StatusPill label="Offline" />);
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('appends layout classes from className', () => {
    render(<StatusPill label="Fit" className="w-fit" />);
    expect(screen.getByText('Fit').closest('span')).toHaveClass('w-fit');
  });
});
