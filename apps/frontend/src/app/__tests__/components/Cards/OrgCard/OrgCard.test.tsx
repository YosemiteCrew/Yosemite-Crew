import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrgCard from '@/app/ui/cards/OrgCard/OrgCard';
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
});
