import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import YourOrganizations from '@/app/features/settings/pages/Settings/Sections/YourOrganizations';
import { useOrgWithMemberships } from '@/app/hooks/useOrgSelectors';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  useOrgWithMemberships: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

const mockUseOrgWithMemberships = useOrgWithMemberships as unknown as jest.Mock;
const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const setPrimaryOrg = jest.fn();

const bindStore = (primaryOrgId: string | null) =>
  mockUseOrgStore.mockImplementation(
    (selector: (s: { primaryOrgId: string | null; setPrimaryOrg: jest.Mock }) => unknown) =>
      selector({ primaryOrgId, setPrimaryOrg })
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('YourOrganizations', () => {
  it('renders nothing when there are no organizations', () => {
    mockUseOrgWithMemberships.mockReturnValue([]);
    bindStore('org-1');

    const { container } = render(<YourOrganizations />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the primary org with a PRIMARY badge and shows Switch on the others', () => {
    mockUseOrgWithMemberships.mockReturnValue([
      {
        org: { _id: 'org-1', name: 'Alpenblick Animal Clinic' },
        membership: { roleDisplay: 'Owner' },
      },
      {
        org: { _id: 'org-2', name: 'Lindenhof Petcare' },
        membership: { roleDisplay: 'Veterinarian' },
      },
    ]);
    bindStore('org-1');

    render(<YourOrganizations />);

    expect(screen.getByRole('heading', { name: 'Your organizations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New organization' })).toHaveAttribute(
      'href',
      '/create-org'
    );
    expect(screen.getByText('Alpenblick Animal Clinic')).toBeInTheDocument();
    expect(screen.getByText('Owner · primary')).toBeInTheDocument();
    expect(screen.getByText('PRIMARY')).toBeInTheDocument();
    expect(screen.getByText('Veterinarian · secondary')).toBeInTheDocument();
    // Avatar initial for the primary org.
    expect(screen.getByText('A')).toBeInTheDocument();

    const switchButton = screen.getByRole('button', { name: 'Switch' });
    expect(switchButton).toBeInTheDocument();
  });

  it('switches the primary org when Switch is clicked', () => {
    mockUseOrgWithMemberships.mockReturnValue([
      { org: { _id: 'org-1', name: 'Alpha' }, membership: { roleDisplay: 'Owner' } },
      { org: { _id: 'org-2', name: 'Beta' }, membership: { roleDisplay: 'Vet' } },
    ]);
    bindStore('org-1');

    render(<YourOrganizations />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

    expect(setPrimaryOrg).toHaveBeenCalledWith('org-2');
  });

  it('falls back to the org name for the id and to a Member role / dash initial', () => {
    mockUseOrgWithMemberships.mockReturnValue([
      { org: { name: 'Namekeyed Clinic' }, membership: null },
      // No name at all -> the `name ?? ''` guard falls through to the dash initial.
      { org: { _id: 'org-blank' }, membership: {} },
    ]);
    bindStore('Namekeyed Clinic');

    render(<YourOrganizations />);

    // First org: keyed by name, primary, role falls back to 'Member'.
    expect(screen.getByText('Member · primary')).toBeInTheDocument();
    // Second org: empty name -> dash initial, secondary, Switch available.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Member · secondary')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(setPrimaryOrg).toHaveBeenCalledWith('org-blank');
  });

  it('treats a null primary id as no primary org', () => {
    mockUseOrgWithMemberships.mockReturnValue([
      { org: { _id: 'org-1', name: 'Alpha' }, membership: { roleDisplay: 'Owner' } },
    ]);
    bindStore(null);

    render(<YourOrganizations />);
    // No primary -> no PRIMARY badge, Switch offered instead.
    expect(screen.queryByText('PRIMARY')).not.toBeInTheDocument();
    expect(screen.getByText('Owner · secondary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch' })).toBeInTheDocument();
  });
});
