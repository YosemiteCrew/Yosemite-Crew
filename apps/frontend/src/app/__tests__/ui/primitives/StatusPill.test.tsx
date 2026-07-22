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
  it('applies a CSS style passthrough over the tone colours', () => {
    render(
      <StatusPill
        label="Overdue"
        tone="neutral"
        style={{ backgroundColor: 'rgb(10, 20, 30)', color: 'rgb(1, 1, 1)' }}
      />
    );
    expect(screen.getByText('Overdue')).toHaveStyle({ backgroundColor: 'rgb(10, 20, 30)' });
  });
  it('draws the danger tone from the --danger-* scale, not warning', () => {
    render(<StatusPill label="Overdue" tone="danger" />);
    expect(screen.getByText('Overdue')).toHaveStyle({ backgroundColor: 'var(--danger-bg)' });
  });
  it('hugs its content so a flex column cannot stretch it into a band', () => {
    render(<StatusPill label="Low stock" />);
    // The class this replaced set width:fit-content; without it the badge is
    // stretched by a flex column's default align-items: stretch.
    expect(screen.getByText('Low stock')).toHaveClass('w-fit');
  });
});
