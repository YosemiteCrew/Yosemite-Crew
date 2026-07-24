import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DashboardSteps from '@/app/ui/widgets/DashboardSteps';

const usePrimaryOrgMock = jest.fn();
const useSubscriptionMock = jest.fn();
const useSpecialitiesMock = jest.fn();
const useTeamMock = jest.fn();
const mockCan = jest.fn();

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => useSubscriptionMock(),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: () => useSpecialitiesMock(),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ href, text, isDisabled }: any) => (
    <a href={href} aria-disabled={isDisabled}>
      {text}
    </a>
  ),
}));

describe('DashboardSteps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
  });

  it('renders steps with computed button text', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 0 }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);

    render(<DashboardSteps />);

    expect(screen.getByText('Get started')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument();
    expect(screen.getByText('Add services')).toBeInTheDocument();
    expect(screen.getByText('Add services')).toHaveAttribute('href', '/organization/specialities');
    expect(screen.getByText('Invite team')).toBeInTheDocument();
    expect(screen.getByText('Continue setup')).toBeInTheDocument();
  });

  it('hides actions the user cannot manage', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: null,
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 0 }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);
    mockCan.mockImplementation((input: any) => input === 'specialities:edit:any');

    render(<DashboardSteps />);

    expect(screen.getByText('Add services')).toBeInTheDocument();
    expect(screen.queryByText('Invite team')).not.toBeInTheDocument();
    expect(screen.queryByText('Connect Stripe')).not.toBeInTheDocument();
  });

  it('marks completed steps with a check and pending steps with a ring', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 3 }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);

    render(<DashboardSteps />);

    expect(screen.getByText('1 of 3 done')).toBeInTheDocument();
    expect(screen.getByTitle('Step complete')).toBeInTheDocument();
    expect(screen.getAllByTitle('Step incomplete')).toHaveLength(2);
  });

  it('returns null when all steps are completed', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: true,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 3 }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }, { _id: 'u2' }]);

    const { container } = render(<DashboardSteps />);
    expect(container.firstChild).toBeNull();
  });

  it('completes Step 1 when any speciality has activeServiceCount > 0 (survives refresh)', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([
      { _id: 'sp1', activeServiceCount: 0 },
      { _id: 'sp2', activeServiceCount: 4 },
    ]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);

    render(<DashboardSteps />);

    expect(screen.getByText('View services')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument();
  });

  it('leaves Step 1 incomplete when no speciality has active services', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 0 }, { _id: 'sp2' }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);

    render(<DashboardSteps />);

    expect(screen.getByText('Add services')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument();
  });

  it('renders nothing when there is no primary org', () => {
    usePrimaryOrgMock.mockReturnValue(null);
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 0 }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);

    const { container } = render(<DashboardSteps />);
    expect(container.firstChild).toBeNull();
  });

  it('treats a missing team list as an incomplete team step', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: false,
    });
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', activeServiceCount: 0 }]);
    useTeamMock.mockReturnValue(undefined);

    render(<DashboardSteps />);

    expect(screen.getByText('Invite team')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument();
  });
});
