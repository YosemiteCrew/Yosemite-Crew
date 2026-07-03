import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DashboardSteps from '@/app/ui/widgets/DashboardSteps';

const usePrimaryOrgMock = jest.fn();
const useSubscriptionMock = jest.fn();
const useServicesMock = jest.fn();
const useTeamMock = jest.fn();
const mockCan = jest.fn();

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => useSubscriptionMock(),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useServicesForPrimaryOrgSpecialities: () => useServicesMock(),
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
    useServicesMock.mockReturnValue([]);
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
    useServicesMock.mockReturnValue([]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }]);
    mockCan.mockImplementation((input: any) => input === 'specialities:edit:any');

    render(<DashboardSteps />);

    expect(screen.getByText('Add services')).toBeInTheDocument();
    expect(screen.queryByText('Invite team')).not.toBeInTheDocument();
    expect(screen.queryByText('Connect Stripe')).not.toBeInTheDocument();
  });

  it('returns null when all steps are completed', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org1', isVerified: true });
    useSubscriptionMock.mockReturnValue({
      connectAccountId: 'acct_1',
      connectChargesEnabled: true,
    });
    useServicesMock.mockReturnValue([{ id: 'svc' }]);
    useTeamMock.mockReturnValue([{ _id: 'u1' }, { _id: 'u2' }]);

    const { container } = render(<DashboardSteps />);
    expect(container.firstChild).toBeNull();
  });
});
