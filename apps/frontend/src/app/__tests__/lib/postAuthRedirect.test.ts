import {
  hasDeveloperRole,
  resolveHeldRoles,
  resolvePostAuthRedirect,
  sanitizeNextPath,
} from '@/app/lib/postAuthRedirect';
import { loadOrgs } from '@/app/features/organization/services/orgService';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { loadSpecialitiesForOrg } from '@/app/features/organization/services/specialityService';
import { loadInvites } from '@/app/features/organization/services/teamService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';

jest.mock('@/app/features/organization/services/orgService', () => ({
  loadOrgs: jest.fn(),
}));

jest.mock('@/app/features/organization/services/profileService', () => ({
  loadProfiles: jest.fn(),
}));

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  loadAvailability: jest.fn(),
}));

jest.mock('@/app/features/organization/services/specialityService', () => ({
  loadSpecialitiesForOrg: jest.fn(),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  loadInvites: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/stores/profileStore', () => ({
  useUserProfileStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/stores/specialityStore', () => ({
  useSpecialityStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/lib/defaultOpenScreen', () => ({
  resolveDefaultOpenScreenRoute: jest.fn((role?: string | null) =>
    String(role ?? '').toLowerCase() === 'owner' ? '/dashboard' : '/appointments'
  ),
  resolveDefaultOpenScreenRouteForProfile: jest.fn(() => '/appointments'),
}));

jest.mock('@/app/lib/orgOnboarding', () => ({
  computeOrgOnboardingStep: jest.fn(() => 0),
}));

jest.mock('@/app/lib/teamOnboarding', () => ({
  computeTeamOnboardingStep: jest.fn(() => 3),
}));

describe('resolvePostAuthRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // sessionStorage survives clearAllMocks, so a `devAuth` set by one case
    // would silently decide the next one.
    globalThis.sessionStorage.clear();
    (loadOrgs as jest.Mock).mockResolvedValue(undefined);
    (loadProfiles as jest.Mock).mockResolvedValue(undefined);
    (loadAvailability as jest.Mock).mockResolvedValue(undefined);
    (loadSpecialitiesForOrg as jest.Mock).mockResolvedValue(undefined);
    (loadInvites as jest.Mock).mockResolvedValue([]);
    (useOrgStore.getState as jest.Mock).mockReturnValue({
      membershipsByOrgId: {},
      orgIds: [],
      orgsById: {},
      primaryOrgId: null,
    });
    (useUserProfileStore.getState as jest.Mock).mockReturnValue({
      profilesByOrgId: {},
    });
    (useAvailabilityStore.getState as jest.Mock).mockReturnValue({
      availabilityIdsByOrgId: {},
      availabilitiesById: {},
    });
    (useSpecialityStore.getState as jest.Mock).mockReturnValue({
      getSpecialitiesByOrgId: jest.fn(() => []),
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

  it('routes users with no orgs but pending invites to the organizations page', async () => {
    (loadInvites as jest.Mock).mockResolvedValue([{ _id: 'invite-1' }]);
    await expect(resolvePostAuthRedirect({ fallbackRole: 'member' })).resolves.toBe(
      '/organizations'
    );
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

  // One account can hold both the practice and the developer role. Before this,
  // holding `developer` returned before any organization was loaded, so the
  // practice was unreachable for exactly the accounts that had both.
  describe('accounts holding both a practice role and the developer role', () => {
    const withPractice = () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({
        membershipsByOrgId: { 'org-1': { roleDisplay: 'Member' } },
        orgIds: ['org-1'],
        orgsById: { 'org-1': { _id: 'org-1', isVerified: true, type: 'clinic' } },
        primaryOrgId: 'org-1',
      });
    };

    it('routes to the practice when the developer door was not used', async () => {
      withPractice();
      await expect(
        resolvePostAuthRedirect({ fallbackRole: 'member', roles: ['member', 'developer'] })
      ).resolves.toBe('/appointments');
    });

    it('routes the same account to the portal when the developer door was used', async () => {
      withPractice();
      globalThis.sessionStorage.setItem('devAuth', 'true');
      await expect(
        resolvePostAuthRedirect({ fallbackRole: 'member', roles: ['member', 'developer'] })
      ).resolves.toBe('/developers/home');
    });

    // `role` is whichever one the role store happened to return first, so the
    // practice role arriving there must not hide the developer membership.
    it('honours the developer door even when the single role reads as the practice one', async () => {
      withPractice();
      globalThis.sessionStorage.setItem('devAuth', 'true');
      await expect(
        resolvePostAuthRedirect({ fallbackRole: 'member', roles: ['developer', 'member'] })
      ).resolves.toBe('/developers/home');
    });

    it('keeps sending a developer with no practice to the portal', async () => {
      await expect(
        resolvePostAuthRedirect({ fallbackRole: 'developer', roles: ['developer'] })
      ).resolves.toBe('/developers/home');
    });

    it('sends a developer with no practice to the portal when orgs fail to load', async () => {
      (loadOrgs as jest.Mock).mockRejectedValue(new Error('network'));
      await expect(
        resolvePostAuthRedirect({ fallbackRole: 'developer', roles: ['developer'] })
      ).resolves.toBe('/developers/home');
    });

    // Using the developer form is not itself an entitlement.
    it('does not divert a practice-only account that used the developer door', async () => {
      withPractice();
      globalThis.sessionStorage.setItem('devAuth', 'true');
      await expect(
        resolvePostAuthRedirect({ fallbackRole: 'member', roles: ['member'] })
      ).resolves.toBe('/appointments');
    });

    it('falls back to the single role when no role list is supplied', async () => {
      withPractice();
      globalThis.sessionStorage.setItem('devAuth', 'true');
      await expect(resolvePostAuthRedirect({ fallbackRole: 'developer' })).resolves.toBe(
        '/developers/home'
      );
    });
  });
});

describe('hasDeveloperRole', () => {
  it.each([
    [['developer'], true],
    [['member', 'developer'], true],
    [['Developer'], true],
    [['  developer  '], true],
    [['member'], false],
    [['member', 'owner'], false],
    [[], false],
  ])('reads %j as %s', (roles, expected) => {
    expect(hasDeveloperRole(roles as string[])).toBe(expected);
  });

  it('treats a missing role set as not a developer', () => {
    expect(hasDeveloperRole(undefined)).toBe(false);
    expect(hasDeveloperRole(null)).toBe(false);
  });
});

describe('sanitizeNextPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard?tab=1#top', '/dashboard?tab=1#top'],
    ['/a/../b', '/b'],
  ])('keeps the same-origin path %s', (input, expected) => {
    expect(sanitizeNextPath(input)).toBe(expected);
  });

  // Each of these reaches a foreign origin once the browser normalises it, and
  // every one of them survived the previous `startsWith` check.
  it.each([
    ['//evil.example'],
    ['/\\evil.example'],
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['/\r\n//evil.example'],
    ['/..//evil.example'],
    ['/../..//evil.example'],
    ['https://evil.example'],
    ['javascript:alert(1)'],
    [''],
    [null],
  ])('drops the off-origin destination %j', (input) => {
    expect(sanitizeNextPath(input as string | null)).toBeUndefined();
  });
});

describe('resolveHeldRoles', () => {
  it('uses the role list when the API supplied one', () => {
    expect(resolveHeldRoles(['member', 'developer'], 'member')).toEqual(['member', 'developer']);
  });

  /* An empty list is what a session stored before the API served `roles` looks
     like. Reading it as "holds nothing" told real developers they were not
     developers, so it has to fall back rather than answer no. */
  it('falls back to the single role when the list is empty', () => {
    expect(resolveHeldRoles([], 'developer')).toEqual(['developer']);
    expect(resolveHeldRoles(undefined, 'developer')).toEqual(['developer']);
    expect(resolveHeldRoles(null, 'developer')).toEqual(['developer']);
  });

  it('drops blanks and falls back when nothing named survives', () => {
    expect(resolveHeldRoles([null, undefined], 'developer')).toEqual(['developer']);
    expect(resolveHeldRoles([null, 'developer'], 'member')).toEqual(['developer']);
  });

  it('answers with nothing when neither source names a role', () => {
    expect(resolveHeldRoles([], null)).toEqual([]);
    expect(resolveHeldRoles(undefined, undefined)).toEqual([]);
  });
});
