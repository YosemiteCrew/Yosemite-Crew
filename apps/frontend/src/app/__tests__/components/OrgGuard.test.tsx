import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { usePathname, useRouter } from 'next/navigation';

const replaceMock = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const useOrgStoreMock = jest.fn();
const orgStoreGetStateMock = jest.fn();
const useSpecialityStoreMock = jest.fn();
const useAvailabilityStoreMock = jest.fn();
const useUserProfileStoreMock = jest.fn();
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
      expect(replaceMock).toHaveBeenCalledWith('/organizations');
    });
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('renders children when auth guard is disabled', () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';

    render(
      <OrgGuard>
        <div data-testid="child">Child</div>
      </OrgGuard>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
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
      expect(replaceMock).toHaveBeenCalledWith('/organizations');
    });
  });

  it('redirects owners to create org when onboarding is incomplete', async () => {
    const orgId = 'org-1';
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
      expect(replaceMock).toHaveBeenCalledWith('/create-org?orgId=org-1');
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
      expect(replaceMock).toHaveBeenCalledWith('/team-onboarding?orgId=org-2');
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
      expect(replaceMock).toHaveBeenCalledWith('/team-onboarding?orgId=org-owner-profile');
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
            effectivePermissions: ['analytics:view:any'],
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
    expect(replaceMock).not.toHaveBeenCalledWith(expect.stringContaining('/team-onboarding'));
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
      expect(replaceMock).toHaveBeenCalledWith('/organization');
    });
  });
});
