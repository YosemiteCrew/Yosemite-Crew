import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const notifyMock = jest.fn();
const listMock = jest.fn();
const setStatusMock = jest.fn();
let primaryOrgId: string | null = 'org-1';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string | null }) => unknown) =>
    selector({ primaryOrgId }),
}));

jest.mock('@/app/hooks/useNotify', () => ({ useNotify: () => ({ notify: notifyMock }) }));

jest.mock('@/app/features/organization/services/bookingRequestsApiService', () => ({
  bookingRequestsApi: {
    list: (...args: unknown[]) => listMock(...args),
    setStatus: (...args: unknown[]) => setStatusMock(...args),
  },
}));

jest.mock('@/app/ui/primitives/SectionCard/SectionCard', () => {
  const MockSectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
  MockSectionCard.displayName = 'MockSectionCard';
  return { __esModule: true, default: MockSectionCard };
});

import BookingRequests from '@/app/features/organization/pages/Organization/Sections/BookingRequests';

const request = (over: Record<string, unknown> = {}) => ({
  id: 'req-1',
  serviceName: 'Wellness consultation',
  requestedStart: '2026-09-01T09:00:00.000Z',
  requestedEnd: '2026-09-01T09:30:00.000Z',
  durationMinutes: 30,
  ownerName: 'Sam Owner',
  ownerEmail: 'sam@example.com',
  ownerPhone: '+49 30 1234',
  petName: 'Rex',
  petSpecies: 'Dog',
  concern: 'Limping',
  status: 'CONFIRMED' as const,
  confirmedAt: '2026-08-30T10:00:00.000Z',
  createdAt: '2026-08-30T09:00:00.000Z',
  ...over,
});

/**
 * Returns the render's own container. Asserting on `document.body` would read
 * every container the file has ever mounted, which silently matched an earlier
 * test's markup.
 */
const renderSection = async () => {
  const view = render(<BookingRequests />);
  await act(async () => {});
  return view.container;
};

describe('BookingRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    listMock.mockResolvedValue([request()]);
    setStatusMock.mockResolvedValue(undefined);
  });

  it('lists a confirmed request with the details the practice needs to call back', async () => {
    const container = await renderSection();

    // Assert on the rendered text as a whole: each line is several JSX
    // expressions, so it is not one text node.
    const text = container.textContent ?? '';
    expect(text).toContain('Rex (Dog) · Wellness consultation');
    expect(text).toContain('Sam Owner · sam@example.com · +49 30 1234');
    expect(text).toContain('Limping');
  });

  it('says plainly that these are requests, not appointments', async () => {
    await renderSection();
    expect(screen.getByText(/requests, not appointments/)).toBeInTheDocument();
  });

  it('shows an empty state rather than nothing at all', async () => {
    listMock.mockResolvedValue([]);
    await renderSection();

    expect(screen.getByText(/No booking requests yet/)).toBeInTheDocument();
  });

  it('reports a load failure instead of pretending the queue is empty', async () => {
    listMock.mockRejectedValue(new Error('403'));
    await renderSection();

    expect(screen.getByRole('alert')).toHaveTextContent(/Could not load booking requests/);
    expect(screen.queryByText(/No booking requests yet/)).not.toBeInTheDocument();
  });

  it('renders nothing at all without a primary organisation', async () => {
    primaryOrgId = null;
    const container = await renderSection();

    expect(listMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('marks a request booked and reflects it without a reload', async () => {
    const container = await renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Mark booked' }));

    await waitFor(() => expect(setStatusMock).toHaveBeenCalledWith('org-1', 'req-1', 'BOOKED'));
    await waitFor(() => expect(container.textContent).toContain('Booked'));
    expect(screen.queryByRole('button', { name: 'Mark booked' })).not.toBeInTheDocument();
  });

  it('declines a request', async () => {
    const container = await renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(setStatusMock).toHaveBeenCalledWith('org-1', 'req-1', 'DECLINED'));
    await waitFor(() => expect(container.textContent).toContain('Declined'));
  });

  it('updates only the row that was acted on', async () => {
    listMock.mockResolvedValue([
      request(),
      request({ id: 'req-2', petName: 'Mila', ownerName: 'Alex Owner' }),
    ]);
    const container = await renderSection();

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark booked' })[0]);

    await waitFor(() => expect(container.textContent).toContain('Booked'));
    // The second row still has its actions: a status change must not sweep the
    // whole list.
    expect(screen.getAllByRole('button', { name: 'Mark booked' })).toHaveLength(1);
    expect(container.textContent).toContain('Mila');
  });

  it('ignores a second click while an update is in flight', async () => {
    let release: () => void = () => {};
    setStatusMock.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );
    await renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Mark booked' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark booked' }));

    expect(setStatusMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
  });

  it('reports a failed update without moving the row', async () => {
    setStatusMock.mockRejectedValue(new Error('500'));
    await renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Mark booked' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not update the request' })
      )
    );
    expect(screen.getByRole('button', { name: 'Mark booked' })).toBeInTheDocument();
  });

  it('offers no actions on a row the practice already handled', async () => {
    listMock.mockResolvedValue([request({ status: 'DECLINED' })]);
    const container = await renderSection();

    expect(container.textContent).toContain('Declined');
    expect(screen.queryByRole('button', { name: 'Mark booked' })).not.toBeInTheDocument();
  });

  it('tolerates a request with no phone and no reason', async () => {
    listMock.mockResolvedValue([request({ ownerPhone: null, concern: null })]);
    const container = await renderSection();

    const text = container.textContent ?? '';
    expect(text).toContain('Sam Owner · sam@example.com');
    expect(text).not.toContain('+49 30 1234');
    expect(text).not.toContain('Limping');
  });

  it('shows an unparseable date as given rather than as Invalid Date', async () => {
    listMock.mockResolvedValue([request({ requestedStart: 'not-a-date' })]);
    const container = await renderSection();

    expect(container.textContent).toContain('not-a-date');
  });
});
