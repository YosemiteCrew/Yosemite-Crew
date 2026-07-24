import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgCard from '@/app/ui/cards/OrgCard/OrgCard';
import { useOrgStore } from '@/app/stores/orgStore';
import { OrgWithMembership } from '@/app/features/organization/types/org';

const mockOrg: OrgWithMembership = {
  org: {
    _id: 'org-1',
    name: 'Acme Corp',
    type: 'HOSPITAL',
    isVerified: true,
  },
  membership: {
    roleDisplay: 'Owner',
  },
} as any;

describe('OrgCard Component', () => {
  const mockHandleClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStore.setState({ primaryOrgId: null });
  });

  it('renders the org name, avatar initial, role and type subline', () => {
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    // Avatar initial (first letter of the name)
    expect(screen.getByText('A')).toBeInTheDocument();
    // Subline combines role + title-cased type
    expect(screen.getByText('Owner · Hospital')).toBeInTheDocument();
  });

  it('shows a VERIFIED badge when the organization is verified', () => {
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
  });

  it('shows a PENDING badge when the organization is not verified', () => {
    const pendingOrg = { ...mockOrg, org: { ...mockOrg.org, isVerified: false } } as any;
    render(<OrgCard org={pendingOrg} handleOrgClick={mockHandleClick} />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.queryByText('VERIFIED')).not.toBeInTheDocument();
  });

  it('calls handleOrgClick when the card is clicked', () => {
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockHandleClick).toHaveBeenCalledTimes(1);
    expect(mockHandleClick).toHaveBeenCalledWith(mockOrg);
  });

  it('handles missing membership role gracefully (subline is just the type)', () => {
    const orgNoRole = { ...mockOrg, membership: null } as any;
    render(<OrgCard org={orgNoRole} handleOrgClick={mockHandleClick} />);
    expect(screen.getByText('Hospital')).toBeInTheDocument();
  });

  it('highlights the org the user is currently working in', () => {
    useOrgStore.setState({ primaryOrgId: 'org-1' });
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);
    expect(screen.getByRole('button')).toHaveClass('org-picker-card--current');
    expect(screen.getByText('A')).toHaveClass('org-picker-avatar--blue');
  });

  it('leaves other orgs unhighlighted', () => {
    useOrgStore.setState({ primaryOrgId: 'another-org' });
    render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);
    expect(screen.getByRole('button')).not.toHaveClass('org-picker-card--current');
  });

  it('falls back to the org name when the org has no id', () => {
    const orgNoId = { ...mockOrg, org: { ...mockOrg.org, _id: undefined } } as any;
    useOrgStore.setState({ primaryOrgId: 'Acme Corp' });
    render(<OrgCard org={orgNoId} handleOrgClick={mockHandleClick} />);
    expect(screen.getByRole('button')).toHaveClass('org-picker-card--current');
  });

  it('tints the avatar from the palette, keyed off the org name', () => {
    const { unmount } = render(<OrgCard org={mockOrg} handleOrgClick={mockHandleClick} />);
    // "A" (65) -> 65 % 3 === 2 -> amber
    expect(screen.getByText('A')).toHaveClass('org-picker-avatar--amber');
    unmount();

    const blueOrg = { ...mockOrg, org: { ...mockOrg.org, name: 'Bravo Vets' } } as any;
    // "B" (66) -> 66 % 3 === 0 -> blue
    render(<OrgCard org={blueOrg} handleOrgClick={mockHandleClick} />);
    expect(screen.getByText('B')).toHaveClass('org-picker-avatar--blue');
  });

  it('tints an unnamed org with the first palette entry', () => {
    const unnamed = { ...mockOrg, org: { ...mockOrg.org, name: '' } } as any;
    render(<OrgCard org={unnamed} handleOrgClick={mockHandleClick} />);
    expect(
      screen.getByRole('button').querySelector('.org-picker-avatar--blue')
    ).toBeInTheDocument();
  });
});
