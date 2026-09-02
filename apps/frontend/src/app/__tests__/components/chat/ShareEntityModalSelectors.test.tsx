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

/**
 * No `console.error` spy here on purpose. `jest.setup.ts` installs a handler
 * that THROWS on any console.error, and that handler is the assertion: an
 * unstable selector makes React log "The result of getSnapshot should be cached
 * to avoid an infinite loop" and then exceed its update depth, so the render
 * throws and the test fails without needing to match the message.
 *
 * Spying here to look for that one string would have replaced the global
 * handler and quietly accepted every OTHER console error - a DOM-nesting
 * warning or a stray `act()` complaint in these real-store renders would have
 * passed unnoticed. Those are test failures in this repo.
 */
beforeEach(() => {
  useCompanionStore.setState({ companionsById: {}, companionsIdsByOrgId: {} });
  useAppointmentStore.setState({ appointmentsById: {}, appointmentIdsByOrgId: {} });
  useOrgStore.setState({ primaryOrgId: 'org-1' });
});

describe('ShareEntityModal store selectors', () => {
  it('renders with a stable snapshot when the active org has no index entry', () => {
    // The realistic case: the picker is opened before the companion and
    // appointment lists have loaded, so neither index has a row for this org.
    render(<ShareEntityModal channelId="ch1" onClose={noop} />);

    expect(screen.getByText('Nothing to share here yet')).toBeInTheDocument();
  });

  it('renders with a stable snapshot when there is no active org at all', () => {
    useOrgStore.setState({ primaryOrgId: null });

    render(<ShareEntityModal channelId="ch1" onClose={noop} />);

    expect(screen.getByText('Nothing to share here yet')).toBeInTheDocument();
  });

  it('still offers the active org its own records', () => {
    useCompanionStore.setState({
      companionsById: { c1: { name: 'Bella', species: 'Dog' } as never },
      companionsIdsByOrgId: { 'org-1': ['c1'] },
    });

    render(<ShareEntityModal channelId="ch1" onClose={noop} />);

    expect(screen.getByText('Bella')).toBeInTheDocument();
  });
});
