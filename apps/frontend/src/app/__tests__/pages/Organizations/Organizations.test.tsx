import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Organizations from '@/app/features/organizations/pages/Organizations';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgWithMemberships } from '@/app/hooks/useOrgSelectors';
import { loadInvites } from '@/app/features/organization/services/teamService';

expect.extend(toHaveNoViolations);

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  useOrgWithMemberships: jest.fn(),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  loadInvites: jest.fn(),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected-route">{children}</div>,
}));

jest.mock('@/app/features/organizations/components/OrgGreeting/OrgGreeting', () => ({
  __esModule: true,
  default: ({ orgCount }: any) => <h1 data-testid="org-greeting">Belongs to {orgCount}</h1>,
}));

jest.mock('@/app/ui/cards/CreateOrgCard/CreateOrgCard', () => ({
  __esModule: true,
  default: () => <div data-testid="create-org-card" />,
}));

jest.mock('@/app/ui/tables/OrgInvites', () => ({
  __esModule: true,
  default: ({ invites }: any) => (
    <div data-testid="org-invites-list">
      {invites.length > 0 ? `Invites: ${invites.length}` : 'No Invites'}
    </div>
  ),
}));

jest.mock('@/app/ui/tables/OrganizationList', () => ({
  __esModule: true,
  default: ({ orgs }: any) => (
    <div data-testid="org-list">{orgs.length > 0 ? `Orgs: ${orgs.length}` : 'No Orgs'}</div>
  ),
}));

describe('Organizations Page', () => {
  const mockOrgs = [{ org: { name: 'Org One' } }, { org: { name: 'Org Two' } }];

  const mockInvites = [{ _id: 'inv-1', organisationId: 'org-1' }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loader while orgs are loading', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'loading' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue([]);
    // Keep loadInvites pending so no post-unmount state update fires
    (loadInvites as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<Organizations />);

    expect(screen.getByTestId('organizations-loader')).toBeInTheDocument();
  });

  it('renders greeting, org list, invites and the create card when loaded', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue(mockOrgs);
    (loadInvites as jest.Mock).mockResolvedValue(mockInvites);

    render(<Organizations />);

    expect(screen.getByTestId('org-greeting')).toHaveTextContent('Belongs to 2');
    expect(screen.getByTestId('org-list')).toHaveTextContent('Orgs: 2');
    expect(screen.getByTestId('create-org-card')).toBeInTheDocument();

    await waitFor(() => {
      expect(loadInvites).toHaveBeenCalled();
      expect(screen.getByTestId('org-invites-list')).toHaveTextContent('Invites: 1');
    });
  });

  it('handles invite fetch errors gracefully (empty invites)', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue([]);
    (loadInvites as jest.Mock).mockRejectedValue(new Error('Network Error'));

    render(<Organizations />);

    await waitFor(() => {
      expect(screen.getByTestId('org-invites-list')).toHaveTextContent('No Invites');
    });
  });

  it('has no axe violations when loaded', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue(mockOrgs);
    (loadInvites as jest.Mock).mockResolvedValue([]);

    const { container } = render(<Organizations />);
    await screen.findByTestId('org-greeting');
    // Let the invites promise settle so the inline loader is replaced
    await screen.findByTestId('org-invites-list');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
