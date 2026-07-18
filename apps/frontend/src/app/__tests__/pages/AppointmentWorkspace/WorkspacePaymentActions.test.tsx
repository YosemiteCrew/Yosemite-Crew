import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PaymentActions } from '@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep';

jest.mock('@/app/ui/primitives/GlassTooltip/GlassTooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const base = {
  isInpatient: false,
  depositDisabled: false,
  paymentDisabled: false,
  dueCents: 10750,
  currency: 'USD',
  onCollect: jest.fn(),
  onSendToClient: jest.fn(),
};

describe('PaymentActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('collects the due amount via the selected method (Online default, then Cash)', () => {
    const onCollect = jest.fn();
    render(<PaymentActions {...base} onCollect={onCollect} />);

    const collect = screen.getByRole('button', { name: /Collect \$/ });
    fireEvent.click(collect);
    expect(onCollect).toHaveBeenLastCalledWith('ONLINE');

    fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
    fireEvent.click(screen.getByRole('button', { name: /Collect \$/ }));
    expect(onCollect).toHaveBeenLastCalledWith('CASH');
  });

  it('keeps deposit collection as a distinct action', () => {
    const onCollect = jest.fn();
    render(<PaymentActions {...base} onCollect={onCollect} />);
    fireEvent.click(screen.getByRole('button', { name: /Collect Deposit/ }));
    expect(onCollect).toHaveBeenCalledWith('DEPOSIT');
  });

  it('shows Send to Client only for inpatient encounters', () => {
    const onSendToClient = jest.fn();
    const { rerender } = render(<PaymentActions {...base} onSendToClient={onSendToClient} />);
    expect(screen.queryByRole('button', { name: /Send to Client/ })).not.toBeInTheDocument();

    rerender(<PaymentActions {...base} isInpatient onSendToClient={onSendToClient} />);
    fireEvent.click(screen.getByRole('button', { name: /Send to Client/ }));
    expect(onSendToClient).toHaveBeenCalledTimes(1);
  });

  it('still renders the collect action when a disabled reason tooltip is present', () => {
    render(<PaymentActions {...base} paymentDisabledReason="Mark ready for billing first" />);
    expect(screen.getByRole('button', { name: /Collect \$/ })).toBeInTheDocument();
  });
});
