import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import CrossClinicMessagingPreference from '@/app/features/settings/pages/Settings/Sections/CrossClinicMessagingPreference';
import { useOrgStore } from '@/app/stores/orgStore';
import { updateOrg } from '@/app/features/organization/services/orgService';

jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: jest.fn(),
}));
const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUpdateOrg = updateOrg as unknown as jest.Mock;

const setOrg = (org: unknown) =>
  mockUseOrgStore.mockImplementation((sel: (s: { getPrimaryOrg: () => unknown }) => unknown) =>
    sel({ getPrimaryOrg: () => org })
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateOrg.mockResolvedValue({});
});

describe('CrossClinicMessagingPreference', () => {
  it('reflects the disabled state', () => {
    setOrg({ _id: 'o1', crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects the enabled state', () => {
    setOrg({ _id: 'o1', crossOrgMessagingEnabled: true });
    render(<CrossClinicMessagingPreference />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('enables cross-clinic messaging on toggle and notifies', async () => {
    setOrg({ _id: 'o1', name: 'Clinic', crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() =>
      expect(mockUpdateOrg).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'o1', crossOrgMessagingEnabled: true })
      )
    );
    expect(mockNotify).toHaveBeenCalledWith('success', expect.anything());
  });

  it('disables cross-clinic messaging when toggling off', async () => {
    setOrg({ _id: 'o1', crossOrgMessagingEnabled: true });
    render(<CrossClinicMessagingPreference />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() =>
      expect(mockUpdateOrg).toHaveBeenCalledWith(
        expect.objectContaining({ crossOrgMessagingEnabled: false })
      )
    );
  });

  it('notifies on failure', async () => {
    setOrg({ _id: 'o1', crossOrgMessagingEnabled: false });
    mockUpdateOrg.mockRejectedValue(new Error('boom'));
    render(<CrossClinicMessagingPreference />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('error', expect.anything()));
  });

  it('is disabled when there is no primary org', () => {
    setOrg({ crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  // The org-list load path omits crossOrgMessagingEnabled, so an absent field means
  // "not loaded". Rendering it as off would tell a clinic that has this ON that it is
  // undiscoverable, and the first click would re-send `true` rather than turning it off.
  it('does not render a switch when the stored setting is unknown', () => {
    setOrg({ _id: 'o1', name: 'Clinic' });
    render(<CrossClinicMessagingPreference />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText('Current setting unavailable')).toBeInTheDocument();
  });

  it('does not render a switch when there is no primary org at all', () => {
    setOrg(undefined);
    render(<CrossClinicMessagingPreference />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText('Current setting unavailable')).toBeInTheDocument();
  });

  // A primary org object that has no _id -> `primaryOrg?._id` resolves to undefined (no nullish
  // short-circuit) so the switch is still disabled.
  it('is disabled when the primary org has no id', () => {
    setOrg({ crossOrgMessagingEnabled: true });
    render(<CrossClinicMessagingPreference />);
    const sw = screen.getByRole('switch');
    // enabled reflects crossOrgMessagingEnabled, but the control is disabled without an id
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toBeDisabled();
  });

  // While the update is in flight, `saving` is true so the switch disables itself
  // (saving || !primaryOrg?._id) and re-enables in the finally block once it settles.
  it('disables the switch while a toggle is in flight then re-enables it', async () => {
    let resolveUpdate!: () => void;
    mockUpdateOrg.mockReturnValue(
      new Promise<void>((res) => {
        resolveUpdate = () => res();
      })
    );
    setOrg({ _id: 'o1', crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference />);
    const sw = screen.getByRole('switch');

    fireEvent.click(sw);
    await waitFor(() => expect(sw).toBeDisabled());

    await act(async () => {
      resolveUpdate();
    });
    await waitFor(() => expect(sw).not.toBeDisabled());
    expect(mockNotify).toHaveBeenCalledWith('success', expect.anything());
  });
});

// The page-level suite mocks this component and only checks the prop is
// forwarded, so without these the disabled switch and the early return could
// both be removed while every focused test stayed green - restoring the exact
// unauthorised updateOrg request readOnly exists to prevent.
describe('CrossClinicMessagingPreference (read-only)', () => {
  it('disables the switch when read-only', () => {
    setOrg({ _id: 'o1', crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference readOnly />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('does not call updateOrg when a read-only switch is clicked', async () => {
    setOrg({ _id: 'o1', name: 'Clinic', crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference readOnly />);

    fireEvent.click(screen.getByRole('switch'));
    await Promise.resolve();

    expect(mockUpdateOrg).not.toHaveBeenCalled();
  });

  it('still calls updateOrg when not read-only', async () => {
    setOrg({ _id: 'o1', name: 'Clinic', crossOrgMessagingEnabled: false });
    render(<CrossClinicMessagingPreference />);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(mockUpdateOrg).toHaveBeenCalled());
  });
});
