import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentLinkStatus from '@/app/features/appointments/pages/AppointmentWorkspace/components/PaymentLinkStatus';

describe('PaymentLinkStatus', () => {
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
