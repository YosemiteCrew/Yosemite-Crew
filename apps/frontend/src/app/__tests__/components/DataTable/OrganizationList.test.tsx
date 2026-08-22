import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrganizationList from '@/app/ui/tables/OrganizationList';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRouter } from 'next/navigation';
import { resolveOrgScopedRedirect } from '@/app/lib/postAuthRedirect';
import { isCurrentRoute, startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { OrgWithMembership } from '@/app/features/organization/types/org';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolveOrgScopedRedirect: jest.fn(),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
  stopRouteLoader: jest.fn(),
  // Must be mocked too. Left out, it is undefined, the success path throws on
  // calling it, and the catch swallows that - so every "successful" switch
  // silently runs the error branch while the assertions still pass.
  isCurrentRoute: jest.fn(() => false),
}));

const mockShow = jest.fn();
const mockHide = jest.fn();
jest.mock('@/app/stores/fullscreenLoaderStore', () => ({
  useFullscreenLoaderStore: {
    getState: jest.fn(() => ({ show: mockShow, hide: mockHide })),
  },
}));

// Mock OrgCard to expose the org name and a click affordance
jest.mock('@/app/ui/cards/OrgCard/OrgCard', () => ({
  __esModule: true,
  default: ({ org, handleOrgClick }: any) => (
    <button data-testid={`org-card-${org.org.name}`} onClick={() => handleOrgClick(org)}>
      {org.org.name}
    </button>
  ),
}));

const verifiedOrg: OrgWithMembership = {
  org: { _id: 'org-1', name: 'Verified Corp', type: 'HOSPITAL', isVerified: true },
  membership: { roleDisplay: 'Owner' },
} as unknown as OrgWithMembership;

const noIdOrg: OrgWithMembership = {
  org: { name: 'Pending Inc', type: 'GROOMER', isVerified: false },
  membership: { roleDisplay: 'Staff' },
} as unknown as OrgWithMembership;

describe('OrganizationList', () => {
  const mockSetPrimaryOrg = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ setPrimaryOrg: mockSetPrimaryOrg })
    );
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('renders nothing when there are no organizations', () => {
    const { container } = render(<OrganizationList orgs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a card for each organization', () => {
    render(<OrganizationList orgs={[verifiedOrg, noIdOrg]} />);
    expect(screen.getByTestId('org-card-Verified Corp')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-Pending Inc')).toBeInTheDocument();
  });

  it('sets the primary org and navigates to the resolved route on click', async () => {
    (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/appointments');
    render(<OrganizationList orgs={[verifiedOrg]} />);

    fireEvent.click(screen.getByTestId('org-card-Verified Corp'));

    expect(mockSetPrimaryOrg).toHaveBeenCalledWith('org-1');
    expect(mockShow).toHaveBeenCalledWith('org-switch');
    expect(startRouteLoader).toHaveBeenCalled();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/appointments'));
  });

  it('falls back to the org name as id when _id is missing', async () => {
    (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/create-org');
    render(<OrganizationList orgs={[noIdOrg]} />);

    fireEvent.click(screen.getByTestId('org-card-Pending Inc'));

    expect(mockSetPrimaryOrg).toHaveBeenCalledWith('Pending Inc');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/create-org'));
  });

  it('hides the loader and stops the route loader when redirect resolution fails', async () => {
    (resolveOrgScopedRedirect as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<OrganizationList orgs={[verifiedOrg]} />);

    fireEvent.click(screen.getByTestId('org-card-Verified Corp'));

    await waitFor(() => expect(mockHide).toHaveBeenCalledWith('org-switch'));
    expect(stopRouteLoader).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // resolveOrgScopedRedirect falls back to '/organizations' when the org or its
  // membership is missing from the store, and this picker IS '/organizations'.
  // Pushing the route we are already on changes neither pathname nor query, so
  // RouteLoaderOverlay's effect never fires: without releasing the loader here
  // the user is left on an opaque full-screen spinner indefinitely.
  it('releases the loader when the resolved route is the one already displayed', async () => {
    (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/organizations');
    (isCurrentRoute as jest.Mock).mockReturnValue(true);
    render(<OrganizationList orgs={[verifiedOrg]} />);

    fireEvent.click(screen.getByTestId('org-card-Verified Corp'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/organizations'));
    await waitFor(() => expect(mockHide).toHaveBeenCalledWith('org-switch'));
    expect(stopRouteLoader).toHaveBeenCalled();
  });

  // The mirror case: a real navigation must NOT release the loader early, or it
  // flickers away before the destination has rendered. RouteLoaderOverlay owns
  // it from here. This is also what catches the success path silently falling
  // into the catch block.
  it('leaves the loader up when navigating somewhere else', async () => {
    (resolveOrgScopedRedirect as jest.Mock).mockResolvedValue('/appointments');
    (isCurrentRoute as jest.Mock).mockReturnValue(false);
    render(<OrganizationList orgs={[verifiedOrg]} />);

    fireEvent.click(screen.getByTestId('org-card-Verified Corp'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/appointments'));
    expect(mockHide).not.toHaveBeenCalled();
    expect(stopRouteLoader).not.toHaveBeenCalled();
  });
});
