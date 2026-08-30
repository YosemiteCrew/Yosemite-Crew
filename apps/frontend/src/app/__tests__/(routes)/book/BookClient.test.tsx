import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const replaceMock = jest.fn();
const getPracticeMock = jest.fn();
const getSlotsMock = jest.fn();
const submitMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('@/app/features/publicBooking/services/publicBooking.service', () => {
  class PublicBookingRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    PublicBookingRequestError,
    getPublicPractice: (...args: unknown[]) => getPracticeMock(...args),
    getPublicSlots: (...args: unknown[]) => getSlotsMock(...args),
    submitBookingRequest: (...args: unknown[]) => submitMock(...args),
  };
});

import BookClient from '@/app/(routes)/(book)/book/[slug]/BookClient';
import { PublicBookingRequestError } from '@/app/features/publicBooking/services/publicBooking.service';

const practice = (over: Record<string, unknown> = {}) => ({
  slug: 'park-vets',
  name: 'Park Veterinary',
  logoUrl: null,
  welcomeMessage: 'Book a visit.',
  city: 'Berlin',
  country: 'DE',
  bookingWindowDays: 28,
  requiresConfirmation: true,
  services: [
    { id: 'svc-1', name: 'Wellness consultation', description: null, durationMinutes: 30 },
  ],
  ...over,
});

const renderPage = async () => {
  render(<BookClient slug="park-vets" />);
  // Two flushes, not one. The practice load settles on the first; the slot load
  // it triggers settles on the second. Leaving the second in flight means it
  // resolves during whichever test runs next, where React reports it as an
  // unwrapped update.
  await act(async () => {});
  await act(async () => {});
};

/**
 * Clicking submit starts a promise chain that ends in `setSubmitting(false)`.
 * Flushing it inside `act` keeps that final update from landing after the test
 * body, which React reports as an unwrapped state update.
 */
const submitForm = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Request this time/ }));
  });
};

const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam Owner' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
  fireEvent.change(screen.getByLabelText('Pet name'), { target: { value: 'Rex' } });
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'Dog' } });
};

describe('BookClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPracticeMock.mockResolvedValue({ kind: 'practice', practice: practice() });
    getSlotsMock.mockResolvedValue({
      date: '2026-09-01',
      serviceId: 'svc-1',
      durationMinutes: 30,
      windows: [
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '10:00', endTime: '10:30' },
      ],
    });
    submitMock.mockResolvedValue(undefined);
  });

  it('renders the practice, its welcome message and its services', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Park Veterinary' })).toBeInTheDocument();
    expect(screen.getByText('Book a visit.')).toBeInTheDocument();
    expect(screen.getByText('Berlin, DE')).toBeInTheDocument();
    expect(screen.getByText('Wellness consultation')).toBeInTheDocument();
  });

  it('never tells the visitor anything is booked', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: /Request this time/ })).toBeInTheDocument();
    expect(screen.getByText(/sends a request, not a booking/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Book$/ })).not.toBeInTheDocument();
  });

  it('follows a retired slug to the current address without adding history', async () => {
    getPracticeMock.mockResolvedValue({ kind: 'redirect', slug: 'new-name' });
    await renderPage();

    expect(replaceMock).toHaveBeenCalledWith('/book/new-name');
  });

  it('shows an unavailable state rather than an error page', async () => {
    getPracticeMock.mockRejectedValue(new PublicBookingRequestError('Not found', 404));
    await renderPage();

    expect(screen.getByRole('heading', { name: /not available/i })).toBeInTheDocument();
  });

  it('says so when the practice offers nothing publicly', async () => {
    getPracticeMock.mockResolvedValue({
      kind: 'practice',
      practice: practice({ services: [] }),
    });
    await renderPage();

    expect(screen.getByText(/not offering online booking/)).toBeInTheDocument();
  });

  it('loads and lists times for the selected service and day', async () => {
    await renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument());
    expect(getSlotsMock).toHaveBeenCalledWith('park-vets', 'svc-1', expect.any(String));
  });

  it('bounds the date picker to the practice booking window', async () => {
    await renderPage();

    const input = screen.getByLabelText('Preferred day') as HTMLInputElement;
    expect(input.min).toBe(new Date().toISOString().slice(0, 10));
    expect(input.max).not.toBe('');
  });

  it('reports a slot loading failure without pretending there are no times', async () => {
    getSlotsMock.mockRejectedValue(
      new PublicBookingRequestError('Date outside the booking window', 400)
    );
    await renderPage();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Date outside the booking window')
    );
  });

  it('falls back to a generic message when the slot failure is not ours', async () => {
    getSlotsMock.mockRejectedValue(new Error('network'));
    await renderPage();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load available times.')
    );
  });

  it('says when a day has no times at all', async () => {
    getSlotsMock.mockResolvedValue({
      date: '2026-09-01',
      serviceId: 'svc-1',
      durationMinutes: 30,
      windows: [],
    });
    await renderPage();

    await waitFor(() => expect(screen.getByText(/No times available/)).toBeInTheDocument());
  });

  it('ignores a practice that loads after the visitor has left', async () => {
    let resolve: (value: unknown) => void = () => {};
    getPracticeMock.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      })
    );
    const { unmount } = render(<BookClient slug="park-vets" />);
    unmount();

    await act(async () => {
      resolve({ kind: 'practice', practice: practice() });
    });

    // No redirect, no render against an unmounted tree.
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Park Veterinary')).not.toBeInTheDocument();
  });

  it('ignores a slot failure that lands after the visitor has left', async () => {
    let fail: (reason: unknown) => void = () => {};
    getSlotsMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      })
    );
    const { unmount } = render(<BookClient slug="park-vets" />);
    await act(async () => {});
    unmount();

    await act(async () => {
      fail(new Error('network'));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses a submit event raised without a chosen time', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));
    fillForm();
    fireEvent.click(screen.getByRole('checkbox'));

    // The button is disabled in this state, but a submit event can still reach
    // the form; the handler has to refuse it rather than post a request with no
    // time in it.
    const form = screen.getByRole('button', { name: /Request this time/ }).closest('form');
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    expect(submitMock).not.toHaveBeenCalled();
  });

  it('deselects a chosen time when the day changes', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'true');

    getSlotsMock.mockResolvedValue({
      date: '2026-09-02',
      serviceId: 'svc-1',
      durationMinutes: 30,
      windows: [{ startTime: '11:00', endTime: '11:30' }],
    });
    fireEvent.change(screen.getByLabelText('Preferred day'), {
      target: { value: '2026-09-02' },
    });

    // The old time is gone from the new day's list, so it cannot remain chosen.
    await waitFor(() => expect(screen.getByRole('button', { name: '11:00' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('will not submit without a time or without consent', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));
    fillForm();

    const submit = screen.getByRole('button', { name: /Request this time/ });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();

    // This test never submits, so it is the one place a render can still be
    // queued when the tree unmounts. Settle it here rather than letting it
    // surface as an unwrapped update in the next test.
    await act(async () => {});
  });

  it('submits the request and tells the visitor to check their email', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    fillForm();
    fireEvent.change(screen.getByLabelText(/What is the visit for/), {
      target: { value: '  Limping  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await submitForm();

    expect(submitMock).toHaveBeenCalled();
    expect(submitMock.mock.calls[0][1]).toMatchObject({
      serviceId: 'svc-1',
      startTime: '09:00',
      ownerName: 'Sam Owner',
      ownerEmail: 'sam@example.com',
      ownerPhone: null,
      petName: 'Rex',
      petSpecies: 'Dog',
      concern: 'Limping',
      consent: true,
    });

    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is booked yet/)).toBeInTheDocument();
  });

  it('sends an entered phone number through', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    fillForm();
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: ' +49 30 1 ' } });
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await submitForm();

    expect(submitMock).toHaveBeenCalled();
    expect(submitMock.mock.calls[0][1].ownerPhone).toBe('+49 30 1');
  });

  it('clears a taken slot so the visitor must pick again', async () => {
    submitMock.mockRejectedValue(
      new PublicBookingRequestError('That time is no longer available', 409)
    );
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent('That time is no longer available');
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports a generic submit failure without claiming anything was sent', async () => {
    submitMock.mockRejectedValue(new Error('network'));
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await submitForm();

    expect(screen.getByRole('alert')).toHaveTextContent(/Could not send your request/);
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('switches service and refetches times', async () => {
    getPracticeMock.mockResolvedValue({
      kind: 'practice',
      practice: practice({
        services: [
          { id: 'svc-1', name: 'Wellness', description: null, durationMinutes: 30 },
          { id: 'svc-2', name: 'Dental', description: null, durationMinutes: 60 },
        ],
      }),
    });
    await renderPage();
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('radio', { name: /Dental/ }));

    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledTimes(2));
    expect(getSlotsMock.mock.calls[1][1]).toBe('svc-2');
  });

  it('offers the next few days as chips so most readers never open the calendar', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    const tomorrow = screen.getByRole('button', { name: 'Tomorrow' });
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    expect(tomorrow).toHaveAttribute('aria-pressed', 'false');

    await act(async () => {
      fireEvent.click(tomorrow);
    });

    // A different day means a fresh availability lookup, same as the date input.
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledTimes(2));
    expect(getSlotsMock.mock.calls[1][2]).not.toBe(getSlotsMock.mock.calls[0][2]);
  });

  it('heads the day parts only when a day actually spans more than one', async () => {
    getSlotsMock.mockResolvedValue({
      date: '2026-09-01',
      serviceId: 'svc-1',
      durationMinutes: 30,
      windows: [
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '14:00', endTime: '14:30' },
      ],
    });
    await renderPage();

    // The heading sits inside the group's <legend>, and it is the legend that
    // carries the visibility, so that is what to assert on.
    await waitFor(() => expect(screen.getByRole('button', { name: '14:00' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Morning' }).closest('legend')).not.toHaveClass(
      'sr-only'
    );
    expect(screen.getByRole('heading', { name: 'Afternoon' }).closest('legend')).not.toHaveClass(
      'sr-only'
    );
  });

  it('hides a lone day-part heading rather than captioning one grid', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    // The default fixture is 09:00 and 10:00 - one part, so the group keeps its
    // name for assistive technology and the caption disappears for everyone else.
    expect(screen.getByRole('heading', { name: 'Morning' }).closest('legend')).toHaveClass(
      'sr-only'
    );
  });

  it('shows what a service is when the practice has said', async () => {
    getPracticeMock.mockResolvedValue({
      kind: 'practice',
      practice: practice({
        services: [
          {
            id: 'svc-1',
            name: 'Wellness consultation',
            description: 'Nose-to-tail exam and a plan for the year.',
            durationMinutes: 30,
          },
        ],
      }),
    });
    await renderPage();

    // Fetched and thrown away before this change, which is why the rows had
    // nothing to say but "30 min".
    expect(screen.getByText('Nose-to-tail exam and a plan for the year.')).toBeInTheDocument();
  });

  it('names the missing precondition, then recaps the choice', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    expect(screen.getByText(/Choose a time above/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    expect(screen.getByText(/Tick the box above/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    // A compound line, never a bare service name: a second element whose exact
    // direct text is 'Wellness consultation' would break the singular
    // getByText in the first test.
    expect(screen.getByText(/Wellness consultation . 30 min .* 09:00/)).toBeInTheDocument();

    await act(async () => {});
  });

  it('announces the wait for times as a status, never as an alert', async () => {
    let settle: (value: unknown) => void = () => {};
    getSlotsMock.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );
    await renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Checking availability');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      settle({ date: '2026-09-01', serviceId: 'svc-1', durationMinutes: 30, windows: [] });
    });
  });

  it('moves focus to the confirmation instead of dropping it on the body', async () => {
    await renderPage();
    await waitFor(() => screen.getByRole('button', { name: '09:00' }));

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await submitForm();

    // The form unmounts on success. Without this the reader is left on <body>
    // with nothing announcing that the request went.
    const heading = screen.getByRole('heading', { name: 'Check your email' });
    expect(heading.closest('[tabindex="-1"]')).toBe(document.activeElement);
  });

  it('tolerates a practice with no city', async () => {
    getPracticeMock.mockResolvedValue({
      kind: 'practice',
      practice: practice({ city: null, welcomeMessage: null }),
    });
    await renderPage();

    expect(screen.queryByText('Berlin, DE')).not.toBeInTheDocument();
    expect(screen.queryByText('Book a visit.')).not.toBeInTheDocument();
  });
});
