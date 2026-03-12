import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import PaymentStatusPage from '@/app/(routes)/(public)/payment-status/page';

const getParamMock = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => getParamMock(key),
  }),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe('payment-status public page', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getParamMock.mockReturnValue(null);
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValue({
      json: async () => ({ status: 'paid', total: 100 }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders missing session state when session_id is absent', () => {
    render(<PaymentStatusPage />);

    expect(screen.getByText('Missing payment session')).toBeInTheDocument();
    expect(screen.getByText('We could not find a payment session in the URL.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders paid state after successful fetch', async () => {
    getParamMock.mockReturnValue('sess_1234567890ABCDE');
    fetchMock.mockResolvedValue({
      json: async () => ({ status: 'paid', total: 100 }),
    });

    render(<PaymentStatusPage />);

    await waitFor(() => expect(screen.getByText('Payment complete')).toBeInTheDocument());
    expect(screen.getByText('Status paid')).toBeInTheDocument();
    expect(screen.getByText('Session sess_1...BCDE')).toBeInTheDocument();
  });

  it('renders cancelled state when no payment is required', async () => {
    getParamMock.mockReturnValue('sess_cancelled_1111');
    fetchMock.mockResolvedValue({
      json: async () => ({ status: 'no_payment_required', total: 0 }),
    });

    render(<PaymentStatusPage />);

    await waitFor(() => expect(screen.getByText('Payment cancelled')).toBeInTheDocument());
    expect(
      screen.getByText('This payment did not complete. If this looks wrong, contact support.')
    ).toBeInTheDocument();
  });

  it('renders waiting state for unpaid status', async () => {
    getParamMock.mockReturnValue('sess_pending_2222');
    fetchMock.mockResolvedValue({
      json: async () => ({ status: 'unpaid', total: 200 }),
    });

    render(<PaymentStatusPage />);

    await waitFor(() => expect(screen.getByText('Waiting for confirmation')).toBeInTheDocument());
    expect(
      screen.getByText('We are still waiting on confirmation. You can safely close this tab.')
    ).toBeInTheDocument();
  });

  it('shows auto-check stopped after max polling attempts', async () => {
    jest.useFakeTimers();
    getParamMock.mockReturnValue('sess_polling_3333');
    fetchMock.mockResolvedValue({
      json: async () => ({ status: 'unpaid', total: 10 }),
    });

    render(<PaymentStatusPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => expect(screen.getByText('Auto-check stopped')).toBeInTheDocument());
  });

  it('handles fetch failure gracefully', async () => {
    getParamMock.mockReturnValue('sess_error_4444');
    fetchMock.mockRejectedValue(new Error('network failed'));

    render(<PaymentStatusPage />);

    await waitFor(() => expect(screen.getByText('Missing payment session')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalled();
  });
});
