import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { loadOrgs } from '@/app/features/organization/services/orgService';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/features/organization/services/orgService', () => ({
  loadOrgs: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/lib/defaultOpenScreen', () => ({
  resolveDefaultOpenScreenRoute: jest.fn((role?: string | null) =>
    String(role ?? '').toLowerCase() === 'owner' ? '/dashboard' : '/appointments'
  ),
}));

describe('resolvePostAuthRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadOrgs as jest.Mock).mockResolvedValue(undefined);
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      membershipsByOrgId: {},
      orgIds: [],
      orgsById: {},
      primaryOrgId: null,
    });
  });

  it('returns the explicit redirect path when provided', async () => {
    await expect(resolvePostAuthRedirect({ redirectPath: '/custom' })).resolves.toBe('/custom');
  });

  it('routes developers to the developer home', async () => {
    await expect(resolvePostAuthRedirect({ fallbackRole: 'developer' })).resolves.toBe(
      '/developers/home'
    );
  });

  it('routes users with no orgs directly to create org', async () => {
    await expect(resolvePostAuthRedirect({ fallbackRole: 'member' })).resolves.toBe('/create-org');
  });

  it('routes owners with an unverified org back into create org', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      membershipsByOrgId: {
        'org-1': { roleDisplay: 'Owner' },
      },
      orgIds: ['org-1'],
      orgsById: {
        'org-1': { _id: 'org-1', isVerified: false },
      },
      primaryOrgId: 'org-1',
    });

    await expect(resolvePostAuthRedirect({ fallbackRole: 'owner' })).resolves.toBe(
      '/create-org?orgId=org-1'
    );
  });

  it('falls back to the default open screen when org loading fails', async () => {
    (loadOrgs as jest.Mock).mockRejectedValue(new Error('network'));
    await expect(resolvePostAuthRedirect({ fallbackRole: 'member' })).resolves.toBe(
      '/appointments'
    );
  });
});
