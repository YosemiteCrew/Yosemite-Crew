import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentLinkStatus from '@/app/features/appointments/pages/AppointmentWorkspace/components/PaymentLinkStatus';

describe('PaymentLinkStatus', () => {
  it('pulses the ring off the --success token, not a frozen literal', () => {
    // jsdom does not run @keyframes, so this checks the declaration itself
    // rather than a rendered computed style: the ring has to track
    // var(--success) (which flips in dark mode) rather than a hardcoded
    // rgba(0, 143, 93, ...) that would freeze at the light-mode value.
    const css = readFileSync(
      join(
        process.cwd(),
        'src/app/features/appointments/pages/AppointmentWorkspace/components/PaymentLinkStatus.css'
      ),
      'utf8'
    );
    expect(css).not.toMatch(/rgba\(\s*0\s*,\s*143\s*,\s*93/);
    expect(css).toContain('color-mix(in srgb, var(--success) 35%, transparent)');
  });

  it('renders the design’s pulsing dot beside a ready-link status', () => {
    const { container } = render(
      <PaymentLinkStatus status={{ isSent: false, label: 'Stripe · payment link ready' }} />
    );
    expect(screen.getByText('Stripe · payment link ready')).toBeInTheDocument();
    expect(container.querySelector('.yc-workspace-pulse-dot')).toBeInTheDocument();
  });

  it('renders the sent wording when the backend confirmed delivery', () => {
    render(<PaymentLinkStatus status={{ isSent: true, label: 'Stripe · payment link sent' }} />);
    expect(screen.getByText('Stripe · payment link sent')).toBeInTheDocument();
  });

  it('renders nothing when there is no payment-link status', () => {
    const { container } = render(<PaymentLinkStatus status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
