import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Organizations from '@/app/features/organizations/pages/Organizations';
import { useOrgStore } from '@/app/stores/orgStore';
import { useOrgWithMemberships } from '@/app/hooks/useOrgSelectors';
import { getData } from '@/app/services/axios';

expect.extend(toHaveNoViolations);

// --- Mocks ---

// Mock Hooks & Services
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  useOrgWithMemberships: jest.fn(),
}));

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

// Mock UI Components
jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected-route">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid="create-org-btn">
      {text}
    </a>
  ),
}));

// Use absolute paths for components imported relatively in source
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
  const mockOrgs = [
    { id: 'org-1', name: 'Org One' },
    { id: 'org-2', name: 'Org Two' },
  ];

  const mockInvitesResponse = {
    data: [
      {
        _id: 'inv-1',
        status: 'PENDING',
        invite: { email: 'test@test.com', role: 'ADMIN' },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Loading State ---

  it('renders loader while loading', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'loading' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue([]);

    // FIX: Return a pending promise. This prevents the 'loadInvites' async function
    // from resolving and calling 'setInvites' after the test finishes, avoiding "act" warnings.
    (getData as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<Organizations />);

    expect(screen.getByTestId('organizations-loader')).toBeInTheDocument();
  });

  // --- 2. Successful Rendering ---

  it('renders the page structure, orgs, and invites when loaded', async () => {
    // Mock Store to not be loading
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    // Mock Orgs
    (useOrgWithMemberships as jest.Mock).mockReturnValue(mockOrgs);
    // Mock Invites API
    (getData as jest.Mock).mockResolvedValue(mockInvitesResponse);

    render(<Organizations />);

    // Check Headers & Buttons
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('create-org-btn')).toHaveAttribute('href', '/create-org');
    expect(screen.getByText('Existing organisations')).toBeInTheDocument();
    expect(screen.getByText('Invites')).toBeInTheDocument();

    // Check Organization List
    expect(screen.getByTestId('org-list')).toHaveTextContent('Orgs: 2');

    // Check Invites Load
    await waitFor(() => {
      expect(getData).toHaveBeenCalledWith('/fhir/v1/organisation-invites/me/pending');
      expect(screen.getByTestId('org-invites-list')).toHaveTextContent('Invites: 1');
    });
  });

  // --- 3. Error Handling ---

  it('handles invite fetch errors gracefully', async () => {
    // Suppress console error for this specific test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue([]);

    // Mock API Failure
    (getData as jest.Mock).mockRejectedValue(new Error('Network Error'));

    render(<Organizations />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load invites:', expect.any(Error));
    });

    // Should render empty invites list
    expect(screen.getByTestId('org-invites-list')).toHaveTextContent('No Invites');

    consoleSpy.mockRestore();
  });

  it('has no axe violations when loaded', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue(mockOrgs);
    (getData as jest.Mock).mockResolvedValue({ data: [] });

    const { container } = render(<Organizations />);
    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // --- 4. Empty State ---

  it('renders empty lists correctly', async () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'succeeded' })
    );
    (useOrgWithMemberships as jest.Mock).mockReturnValue([]);
    (getData as jest.Mock).mockResolvedValue({ data: [] });

    render(<Organizations />);

    await waitFor(() => {
      expect(screen.getByTestId('org-list')).toHaveTextContent('No Orgs');
      expect(screen.getByTestId('org-invites-list')).toHaveTextContent('No Invites');
    });
  });
});
