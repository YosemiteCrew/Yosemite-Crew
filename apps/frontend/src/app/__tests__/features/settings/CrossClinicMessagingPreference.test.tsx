import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    setOrg(undefined);
    render(<CrossClinicMessagingPreference />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
