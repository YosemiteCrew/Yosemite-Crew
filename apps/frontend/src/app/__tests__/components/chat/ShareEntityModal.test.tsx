import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ShareEntityModal } from '@/app/features/chat/components/ShareEntityModal';
import { shareEntityToChannel } from '@/app/features/chat/services/chatService';

/**
 * Share-from-PIMS picker tests. The companion/appointment stores and the
 * terminology hook are mocked; chatService.shareEntityToChannel is mocked so we
 * can assert the payload and drive resolve/reject. @/app/ui, react-icons, and
 * ChatAvatar render for real per the testing conventions.
 */

const companionsById: Record<string, unknown> = {
  c1: { name: 'Bella', species: 'Dog', breed: 'Lab' },
};
const appointmentsById: Record<string, unknown> = {
  a1: { startTime: new Date('2026-06-25T15:00:00Z'), patient: { name: 'Bella' } },
};

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: (sel: (s: { companionsById: Record<string, unknown> }) => unknown) =>
    sel({ companionsById }),
}));

jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: (sel: (s: { appointmentsById: Record<string, unknown> }) => unknown) =>
    sel({ appointmentsById }),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (s: string) => s,
}));

jest.mock('@/app/features/chat/services/chatService', () => ({
  shareEntityToChannel: jest.fn().mockResolvedValue({ id: 'share1' }),
}));

const mockedShare = shareEntityToChannel as jest.Mock;

function setCompanions(next: Record<string, unknown>) {
  for (const key of Object.keys(companionsById)) delete companionsById[key];
  Object.assign(companionsById, next);
}

function setAppointments(next: Record<string, unknown>) {
  for (const key of Object.keys(appointmentsById)) delete appointmentsById[key];
  Object.assign(appointmentsById, next);
}

beforeEach(() => {
  mockedShare.mockReset();
  mockedShare.mockResolvedValue({ id: 'share1' });
  setCompanions({ c1: { name: 'Bella', species: 'Dog', breed: 'Lab' } });
  setAppointments({
    a1: { startTime: new Date('2026-06-25T15:00:00Z'), patient: { name: 'Bella' } },
  });
});

describe('ShareEntityModal', () => {
  it('renders the Companion tab list by default', () => {
    render(<ShareEntityModal channelId="ch1" onClose={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Share from PIMS' })).toBeInTheDocument();
    expect(screen.getByText('Bella')).toBeInTheDocument();
    expect(screen.getByText('Dog · Lab')).toBeInTheDocument();
  });

  it('shares a companion with the expected payload and then closes', async () => {
    const onClose = jest.fn();
    render(<ShareEntityModal channelId="ch1" onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Bella'));
    });

    expect(mockedShare).toHaveBeenCalledWith({
      channelId: 'ch1',
      entityType: 'COMPANION',
      entityId: 'c1',
      title: 'Bella',
      snapshot: { subtitle: 'Dog · Lab' },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('switches to the Appointments tab and shares an appointment', async () => {
    const onClose = jest.fn();
    render(<ShareEntityModal channelId="ch1" onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Appointments/ }));
    });

    // appointment patient name renders in the list
    const rows = screen.getAllByText('Bella');
    expect(rows.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(rows[0]);
    });

    expect(mockedShare).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'ch1',
        entityType: 'APPOINTMENT',
        entityId: 'a1',
        title: 'Bella',
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('filters records by the search input', async () => {
    render(<ShareEntityModal channelId="ch1" onClose={jest.fn()} />);

    const input = screen.getByLabelText('Search records');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzz' } });
    });

    expect(screen.queryByText('Bella')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing to share here yet')).toBeInTheDocument();

    // a matching query (by subtitle) keeps the row
    await act(async () => {
      fireEvent.change(input, { target: { value: 'lab' } });
    });
    expect(screen.getByText('Bella')).toBeInTheDocument();
  });

  it('calls onClose from the close button', () => {
    const onClose = jest.fn();
    render(<ShareEntityModal channelId="ch1" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from the backdrop', () => {
    const onClose = jest.fn();
    render(<ShareEntityModal channelId="ch1" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close picker' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when the share rejects', async () => {
    mockedShare.mockRejectedValueOnce(new Error('nope'));
    const onClose = jest.fn();
    render(<ShareEntityModal channelId="ch1" onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Bella'));
    });

    expect(mockedShare).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // sharing state is reset (label returns to "Share")
    await waitFor(() => expect(screen.getByText('Share')).toBeInTheDocument());
  });

  it('shows the "Sharing…" label while a share is in flight', async () => {
    let resolveShare: (v: unknown) => void = () => {};
    mockedShare.mockReturnValueOnce(
      new Promise((res) => {
        resolveShare = res;
      })
    );
    render(<ShareEntityModal channelId="ch1" onClose={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Bella'));
    });

    expect(screen.getByText('Sharing…')).toBeInTheDocument();

    await act(async () => {
      resolveShare({ id: 'share1' });
    });
  });

  it('falls back to default companion title and omits subtitle when fields are missing', async () => {
    setCompanions({ c9: {} });
    const onClose = jest.fn();
    render(<ShareEntityModal channelId="ch1" onClose={onClose} />);

    expect(screen.getByText('Companion')).toBeInTheDocument();
    // no species/breed -> subtitle undefined -> share without snapshot
    await act(async () => {
      fireEvent.click(screen.getByText('Companion'));
    });
    expect(mockedShare).toHaveBeenCalledWith({
      channelId: 'ch1',
      entityType: 'COMPANION',
      entityId: 'c9',
      title: 'Companion',
      snapshot: undefined,
    });
  });

  it('renders the companion empty state when there are no companions', () => {
    setCompanions({});
    render(<ShareEntityModal channelId="ch1" onClose={jest.fn()} />);
    expect(screen.getByText('Nothing to share here yet')).toBeInTheDocument();
  });

  it('uses companion.name fallback and omits subtitle when an appointment has no startTime', async () => {
    setAppointments({ a2: { companion: { name: 'Rex' } } });
    render(<ShareEntityModal channelId="ch1" onClose={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Appointments/ }));
    });

    expect(screen.getByText('Rex')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText('Rex'));
    });
    expect(mockedShare).toHaveBeenCalledWith({
      channelId: 'ch1',
      entityType: 'APPOINTMENT',
      entityId: 'a2',
      title: 'Rex',
      snapshot: undefined,
    });
  });

  it('falls back to the default appointment title when neither patient nor companion has a name', async () => {
    setAppointments({ a3: {} });
    render(<ShareEntityModal channelId="ch1" onClose={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Appointments/ }));
    });

    expect(screen.getByText('Appointment')).toBeInTheDocument();
  });
});
