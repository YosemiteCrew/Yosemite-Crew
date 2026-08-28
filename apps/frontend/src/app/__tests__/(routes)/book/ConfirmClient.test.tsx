import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const confirmMock = jest.fn();
let searchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

jest.mock('@/app/features/publicBooking/services/publicBooking.service', () => ({
  confirmBookingRequest: (...args: unknown[]) => confirmMock(...args),
}));

import ConfirmClient from '@/app/(routes)/(book)/book/[slug]/confirm/ConfirmClient';

const renderPage = async () => {
  render(<ConfirmClient />);
  await act(async () => {});
};

describe('ConfirmClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParams = new URLSearchParams('token=abc123');
    confirmMock.mockResolvedValue({ practiceName: 'Park Veterinary', slug: 'park-vets' });
  });

  it('confirms the token from the query and names the practice', async () => {
    await renderPage();

    expect(confirmMock).toHaveBeenCalledWith('abc123');
    expect(screen.getByRole('heading', { name: 'Request confirmed' })).toBeInTheDocument();
    expect(screen.getByText(/Park Veterinary can now see your request/)).toBeInTheDocument();
  });

  it('still says nothing is booked', async () => {
    await renderPage();
    expect(screen.getByText(/Nothing is booked yet/)).toBeInTheDocument();
  });

  it('confirms once and does not repeat it on re-render', async () => {
    const { rerender } = render(<ConfirmClient />);
    await act(async () => {});

    // Change the query so the effect's dependency changes and it genuinely
    // re-runs; the guard, not the dependency list, is what stops a second post.
    searchParams = new URLSearchParams('token=def456');
    rerender(<ConfirmClient />);
    await act(async () => {});

    // Confirming is a write, and React re-runs effects on remount in
    // development. The ref is what makes "exactly once" a property rather than
    // luck.
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it('treats a link with no token as invalid without calling the API', async () => {
    searchParams = new URLSearchParams();
    await renderPage();

    expect(confirmMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /not valid/i })).toBeInTheDocument();
  });

  it('explains an expired or used link rather than failing silently', async () => {
    confirmMock.mockRejectedValue(new Error('Not found'));
    await renderPage();

    expect(screen.getByRole('heading', { name: /not valid/i })).toBeInTheDocument();
    expect(screen.getByText(/48\s*hours/)).toBeInTheDocument();
  });

  it('falls back when the API returns no practice name', async () => {
    confirmMock.mockResolvedValue({ practiceName: '', slug: null });
    await renderPage();

    expect(screen.getByText(/The practice can now see your request/)).toBeInTheDocument();
  });
});
