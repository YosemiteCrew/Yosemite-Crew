import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { logger } from '@/app/lib/logger';

/**
 * `window.location` and its `href` accessor are both non-configurable in jsdom,
 * so the redirect cannot be stubbed. jsdom instead reports the attempted
 * navigation as a "Not implemented: navigation" jsdomError on console.error,
 * which jest.setup turns into a thrown failure. Swap in a collector for the
 * duration of the redirect timer, restore the strict mock afterwards, and
 * return whatever jsdom reported so the test can assert on the attempt.
 */
const runTimersCollectingJsdomErrors = (): string[] => {
  const errorMock = console.error as jest.Mock;
  const strictImpl = errorMock.getMockImplementation();
  const collected: string[] = [];
  errorMock.mockImplementation((...args: unknown[]) => {
    collected.push(String(args[0]));
  });
  try {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  } finally {
    errorMock.mockImplementation(strictImpl as (...args: unknown[]) => void);
  }
  return collected;
};

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
    (getUpgradeLink as jest.Mock).mockResolvedValue(
      'https://checkout.stripe.com/c/pay/cs_test_123'
    );
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
    (getUpgradeLink as jest.Mock).mockRejectedValue(new Error('upgrade failed'));

    render(<Upgrade />);

    fireEvent.click(screen.getAllByText('Upgrade')[0]);
    fireEvent.click(screen.getAllByText('Upgrade')[1]);

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Upgrade').length).toBeGreaterThan(0);
  });

  it('navigates to the checkout URL once the redirect timeout elapses', async () => {
    (getUpgradeLink as jest.Mock).mockResolvedValue(
      'https://checkout.stripe.com/c/pay/cs_test_456'
    );

    render(<Upgrade />);

    fireEvent.click(screen.getAllByText('Upgrade')[0]);
    fireEvent.click(screen.getAllByText('Upgrade')[1]);

    await waitFor(() => {
      expect(getUpgradeLink).toHaveBeenCalledWith('month');
    });
    // The modal closes as soon as a safe URL is resolved, before the redirect.
    await waitFor(() => {
      expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
    });

    const jsdomErrors = runTimersCollectingJsdomErrors();

    // Exactly one navigation was attempted out of the redirect timer.
    expect(jsdomErrors).toHaveLength(1);
    expect(jsdomErrors[0]).toContain('Not implemented: navigation');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws and logs when the upgrade URL is not a trusted Stripe URL', async () => {
    (getUpgradeLink as jest.Mock).mockResolvedValue('https://evil.example.com/checkout');

    render(<Upgrade />);

    fireEvent.click(screen.getAllByText('Upgrade')[0]);
    fireEvent.click(screen.getAllByText('Upgrade')[1]);

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start upgrade checkout',
        expect.objectContaining({ message: 'Received an unexpected upgrade URL.' })
      );
    });

    // The modal stays open and no redirect is scheduled for a rejected URL.
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
    expect(runTimersCollectingJsdomErrors()).toHaveLength(0);
  });

  it('closes the modal when the header close button is clicked', () => {
    render(<Upgrade />);

    fireEvent.click(screen.getAllByText('Upgrade')[0]);
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();

    // The centring spacer is inert markup, so there is exactly one `close`
    // control and it runs handleCancel.
    fireEvent.click(screen.getByText('close'));

    expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
  });
});
