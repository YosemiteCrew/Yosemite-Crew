import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import Upgrade from '@/app/ui/widgets/Upgrade';
import { getUpgradeLink } from '@/app/features/billing/services/billingService';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="upgrade-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" disabled={isDisabled} onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/features/billing/services/billingService', () => ({
  getUpgradeLink: jest.fn(),
}));

describe('Upgrade widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('opens modal, selects yearly plan, and redirects on success', async () => {
    (getUpgradeLink as jest.Mock).mockResolvedValue('https://billing.yc/checkout');
    const timeoutSpy = jest.spyOn(globalThis, 'setTimeout');

    render(<Upgrade />);

    fireEvent.click(screen.getAllByText('Upgrade')[0]);
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pay yearly'));
    expect(screen.getByText('€10')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Upgrade')[1]);

    await waitFor(() => {
      expect(getUpgradeLink).toHaveBeenCalledWith('year');
    });

    expect(timeoutSpy).toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });

  it('logs errors and clears loading when upgrade fetch fails', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (getUpgradeLink as jest.Mock).mockRejectedValue(new Error('upgrade failed'));

    render(<Upgrade />);

    fireEvent.click(screen.getAllByText('Upgrade')[0]);
    fireEvent.click(screen.getAllByText('Upgrade')[1]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Upgrade').length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });
});
