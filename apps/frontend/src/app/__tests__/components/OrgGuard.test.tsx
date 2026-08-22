import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { redirect, usePathname, useRouter } from 'next/navigation';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';

const replaceMock = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  redirect: jest.fn(),
}));

const useOrgStoreMock = jest.fn();
const orgStoreGetStateMock = jest.fn();
const useSpecialityStoreMock = jest.fn();
const useAvailabilityStoreMock = jest.fn();
const useUserProfileStoreMock = jest.fn();
const useTeamStoreMock = jest.fn();
const originalTestHostname = process.env.YC_TEST_HOSTNAME;

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: Object.assign((selector: any) => useOrgStoreMock(selector), {
    getState: (...args: any[]) => orgStoreGetStateMock(...args),
  }),
}));

jest.mock('@/app/stores/specialityStore', () => ({
  useSpecialityStore: (selector: any) => useSpecialityStoreMock(selector),
}));

jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: (selector: any) => useAvailabilityStoreMock(selector),
}));

jest.mock('@/app/stores/profileStore', () => ({
  useUserProfileStore: (selector: any) => useUserProfileStoreMock(selector),
}));

jest.mock('@/app/stores/teamStore', () => ({
  useTeamStore: (selector: any) => useTeamStoreMock(selector),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useLoadTeam: jest.fn(),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useLoadCompanionsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useDocuments', () => ({
  useLoadDocumentsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useForms', () => ({
  useLoadFormsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useInventory', () => ({
  useInventoryModule: jest.fn(),
}));

jest.mock('@/app/hooks/useTask', () => ({
  useLoadTasksForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useLoadSubscriptionCounterForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useInvoices', () => ({
  useLoadInvoicesForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useLoadSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useFullscreenLoader', () => ({
  useFullscreenLoader: jest.fn(),
}));

const computeOrgOnboardingStepMock = jest.fn();
const computeTeamOnboardingStepMock = jest.fn();

jest.mock('@/app/lib/orgOnboarding', () => ({
  computeOrgOnboardingStep: (...args: any[]) => computeOrgOnboardingStepMock(...args),
}));

jest.mock('@/app/lib/teamOnboarding', () => ({
  computeTeamOnboardingStep: (...args: any[]) => computeTeamOnboardingStepMock(...args),
}));

describe('OrgGuard', () => {
  const baseOrgState = {
    status: 'succeeded',
    primaryOrgId: null,
    orgsById: {},
    membershipsByOrgId: {},
  };

  const baseSpecialityState = {
    status: 'succeeded',
    specialityIdsByOrgId: {},
    getSpecialitiesByOrgId: jest.fn(() => []),
  };

  const baseAvailabilityState = {
    status: 'succeeded',
    getAvailabilitiesByOrgId: jest.fn(() => []),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'false';
    process.env.YC_TEST_HOSTNAME = 'localhost';
    mockPathname = '/dashboard';
    (useRouter as jest.Mock).mockReturnValue({
      replace: replaceMock,
      push: jest.fn(),
      prefetch: jest.fn(),
    });
    (usePathname as jest.Mock).mockReturnValue(mockPathname);
    useOrgStoreMock.mockImplementation((selector: any) => selector(baseOrgState));
    orgStoreGetStateMock.mockReturnValue(baseOrgState);
    useSpecialityStoreMock.mockImplementation((selector: any) => selector(baseSpecialityState));
    useAvailabilityStoreMock.mockImplementation((selector: any) => selector(baseAvailabilityState));
    useUserProfileStoreMock.mockImplementation((selector: any) =>
      selector({
        profilesByOrgId: {},
      })
    );
    useTeamStoreMock.mockImplementation((selector: any) =>
      selector({
        status: 'succeeded',
        teamIdsByOrgId: {},
      })
    );
    computeOrgOnboardingStepMock.mockReturnValue(3);
    computeTeamOnboardingStepMock.mockReturnValue(3);
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  });

  afterAll(() => {
    process.env.YC_TEST_HOSTNAME = originalTestHostname;
  });

  it('redirects to organizations when no primary org is set', async () => {
    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith('/organizations');
    });
  });

  it('renders children when auth guard is disabled', () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(useFullscreenLoader).toHaveBeenCalledWith('org-guard', false);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('ignores the auth guard override outside localhost', async () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = 'dev.yosemitecrew.com';

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith('/organizations');
    });
  });

  it('redirects owners to create org when onboarding is incomplete', async () => {
    const orgId = 'org-1';
    useSpecialityStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseSpecialityState,
        specialityIdsByOrgId: { [orgId]: [] },
      })
    );
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: false, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: { roleDisplay: 'Owner' },
        },
      })
    );
    computeOrgOnboardingStepMock.mockReturnValue(1);

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith('/create-org?orgId=org-1');
    });
  });

  it('waits for selected org specialities before redirecting an unverified owner', async () => {
    const orgId = 'org-pending';
    const getSpecialitiesByOrgId = jest.fn(() => []);
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: false, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: { roleDisplay: 'Owner', effectivePermissions: [] },
        },
      })
    );
    useSpecialityStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseSpecialityState,
        specialityIdsByOrgId: {},
        getSpecialitiesByOrgId,
      })
    );

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(getSpecialitiesByOrgId).not.toHaveBeenCalled();
    });
    expect(redirect).not.toHaveBeenCalledWith(`/create-org?orgId=${orgId}`);
  });

  it('does not hang forever when speciality fetch errors for an unverified owner', async () => {
    const orgId = 'org-speciality-error';
    const getSpecialitiesByOrgId = jest.fn(() => []);
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: false, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: { roleDisplay: 'Owner', effectivePermissions: [] },
        },
      })
    );
    useSpecialityStoreMock.mockImplementation((selector: any) =>
      selector({
        // status is error and org key is absent — simulates a failed fetch
        status: 'error',
        specialityIdsByOrgId: {},
        getSpecialitiesByOrgId,
      })
    );
    computeOrgOnboardingStepMock.mockReturnValue(1);

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    // Guard should proceed (redirect to create-org) rather than stay stuck
    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith(`/create-org?orgId=${orgId}`);
    });
  });

  it('redirects non-owners to team onboarding when profile incomplete', async () => {
    const orgId = 'org-2';
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: true, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: { roleDisplay: 'Member' },
        },
      })
    );
    computeTeamOnboardingStepMock.mockReturnValue(1);

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith('/team-onboarding?orgId=org-2');
    });
  });

  it('redirects owners to team-onboarding when org is done but profile is incomplete', async () => {
    const orgId = 'org-owner-profile';
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: true, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: { roleDisplay: 'Owner', effectivePermissions: [] },
        },
      })
    );
    computeOrgOnboardingStepMock.mockReturnValue(3);
    computeTeamOnboardingStepMock.mockReturnValue(1);

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith('/team-onboarding?orgId=org-owner-profile');
    });
  });

  it('allows owners through when profile is complete', async () => {
    const orgId = 'org-owner-done';
    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: true, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: {
            roleDisplay: 'Owner',
            // Permissions derive from roleCode, mirroring a real mapping.
            roleCode: 'OWNER',
          },
        },
      })
    );
    computeOrgOnboardingStepMock.mockReturnValue(3);
    computeTeamOnboardingStepMock.mockReturnValue(3);

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining('/team-onboarding'));
  });

  it('redirects when current route requires a permission the user does not have', async () => {
    const orgId = 'org-3';
    mockPathname = '/integrations';
    (usePathname as jest.Mock).mockReturnValue(mockPathname);

    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        primaryOrgId: orgId,
        orgsById: {
          [orgId]: { id: orgId, isVerified: true, type: 'GROOMER' },
        },
        membershipsByOrgId: {
          [orgId]: {
            roleDisplay: 'Admin',
            roleCode: 'ADMIN',
            effectivePermissions: ['appointments:view:any'],
            // Permissions resolve from the role, so the integrations grant the
            // ADMIN baseline carries has to be revoked explicitly for this
            // membership to genuinely lack access to /integrations.
            revokedPermissions: ['integrations:view:any'],
          },
        },
      })
    );

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    await waitFor(() => {
      // Redirected off /integrations, and the ADMIN baseline makes the dashboard
      // the first route this membership can actually reach.
      expect(redirect).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('does not render a permission-gated route from the cached org pass', async () => {
    // The cache is keyed by organisation only. A previous pass on some other
    // path must not stand in for the permission check on this one, or the
    // protected page mounts and loads its data during the window before the
    // membership resolves.
    const orgId = 'org-4';
    globalThis.sessionStorage.setItem(`yc_org_guard_passed:${orgId}`, '1');
    mockPathname = '/integrations';
    (usePathname as jest.Mock).mockReturnValue(mockPathname);

    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        // Still loading: no membership is available to check against yet.
        status: 'loading',
        primaryOrgId: orgId,
      })
    );

    render(
      <OrgGuard skeleton={<div data-testid="skeleton">Loading</div>}>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    globalThis.sessionStorage.clear();
  });

  it('still uses the cached org pass for a route with no permission requirement', async () => {
    const orgId = 'org-5';
    globalThis.sessionStorage.setItem(`yc_org_guard_passed:${orgId}`, '1');
    mockPathname = '/organizations';
    (usePathname as jest.Mock).mockReturnValue(mockPathname);

    useOrgStoreMock.mockImplementation((selector: any) =>
      selector({
        ...baseOrgState,
        status: 'loading',
        primaryOrgId: orgId,
      })
    );

    render(
      <OrgGuard skeleton={<div data-testid="skeleton">Loading</div>}>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    globalThis.sessionStorage.clear();
  });
});
