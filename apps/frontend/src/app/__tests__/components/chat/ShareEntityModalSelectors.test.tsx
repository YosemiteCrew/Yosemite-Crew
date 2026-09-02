import { render, screen } from '@testing-library/react';
import { ShareEntityModal } from '@/app/features/chat/components/ShareEntityModal';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';

/**
 * The sibling ShareEntityModal test mocks the three stores as plain selector
 * calls, which is the right shape for asserting what the picker offers - but it
 * replaces the very mechanism this file is about. Zustand runs a selector as a
 * `useSyncExternalStore` snapshot and compares results with `Object.is`, so a
 * selector that builds its own fallback value hands React a new identity on
 * every render and never converges. These tests use the real stores so that
 * path is exercised.
 */

jest.mock('@/app/features/chat/services/chatService', () => ({
  shareEntityToChannel: jest.fn().mockResolvedValue({ id: 'share1' }),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (s: string) => s,
}));

const noop = () => {};

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  useCompanionStore.setState({ companionsById: {}, companionsIdsByOrgId: {} });
  useAppointmentStore.setState({ appointmentsById: {}, appointmentIdsByOrgId: {} });
  useOrgStore.setState({ primaryOrgId: 'org-1' });
});

afterEach(() => {
  errorSpy.mockRestore();
});

/** React's own words when a `useSyncExternalStore` snapshot is a fresh value. */
const unstableSnapshot = () =>
  errorSpy.mock.calls.some((call) =>
    call.some(
      (arg: unknown) => typeof arg === 'string' && arg.includes('getSnapshot should be cached')
    )
  );

describe('ShareEntityModal store selectors', () => {
  it('renders with a stable snapshot when the active org has no index entry', () => {
    // The realistic case: the picker is opened before the companion and
    // appointment lists have loaded, so neither index has a row for this org.
    render(<ShareEntityModal channelId="ch1" onClose={noop} />);

    expect(screen.getByText('Nothing to share here yet')).toBeInTheDocument();
    expect(unstableSnapshot()).toBe(false);
  });

  it('renders with a stable snapshot when there is no active org at all', () => {
    useOrgStore.setState({ primaryOrgId: null });

    render(<ShareEntityModal channelId="ch1" onClose={noop} />);

    expect(screen.getByText('Nothing to share here yet')).toBeInTheDocument();
    expect(unstableSnapshot()).toBe(false);
  });

  it('still offers the active org its own records', () => {
    useCompanionStore.setState({
      companionsById: { c1: { name: 'Bella', species: 'Dog' } as never },
      companionsIdsByOrgId: { 'org-1': ['c1'] },
    });

    render(<ShareEntityModal channelId="ch1" onClose={noop} />);

    expect(screen.getByText('Bella')).toBeInTheDocument();
    expect(unstableSnapshot()).toBe(false);
  });
});
