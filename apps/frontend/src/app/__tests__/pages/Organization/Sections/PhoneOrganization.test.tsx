import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import PhoneOrganization from '@/app/features/organization/pages/Organization/Sections/PhoneOrganization';
import { Organisation } from '@yosemite-crew/types';

const mockBack = jest.fn();
const useTeamMock = jest.fn();
const useSpecialitiesMock = jest.fn();
const useSubscriptionMock = jest.fn();
const canMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesWithServiceNamesForPrimaryOrg: () => useSpecialitiesMock(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useSubscriptionForPrimaryOrg: () => useSubscriptionMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: canMock }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: jest.fn() }),
}));

jest.mock('@/app/features/organization/services/orgService', () => ({
  updateOrg: jest.fn(),
}));

const mockLoadServicesForOrg = jest.fn();
jest.mock('@/app/features/organization/services/serviceService', () => ({
  loadServicesForOrg: (...args: unknown[]) => mockLoadServicesForOrg(...args),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Team/AddTeam', () => ({
  __esModule: true,
  default: ({ showModal }: { showModal: boolean }) =>
    showModal ? <div data-testid="add-team" /> : null,
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Team/TeamInfo', () => ({
  __esModule: true,
  default: ({ showModal }: { showModal: boolean }) =>
    showModal ? <div data-testid="team-info" /> : null,
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/OrgProfileEditCards', () => ({
  __esModule: true,
  default: () => <div data-testid="edit-cards" />,
}));

const org: Organisation = {
  _id: 'org-1',
  name: 'Alpenblick Animal Clinic',
  type: 'HOSPITAL',
  phoneNo: '+49 8821',
  taxId: 'DE1',
  website: 'alpenblick.vet',
  isVerified: true,
  address: { addressLine: 'Bergweg 3', postalCode: '82467', city: 'Garmisch' },
};

const renderPhone = () => render(<PhoneOrganization primaryOrg={org} />);

describe('PhoneOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadServicesForOrg.mockResolvedValue([]);
    canMock.mockReturnValue(true);
    useTeamMock.mockReturnValue([
      {
        _id: 't1',
        name: 'Dr. Sarah Weber',
        role: 'ADMIN',
        status: 'Available',
        employmentType: 'FULL_TIME',
        speciality: [{ name: 'Small animals' }],
      },
    ]);
    useSpecialitiesMock.mockReturnValue([
      {
        _id: 'sp1',
        name: 'Small animals',
        activeServiceCount: 2,
        services: [{ id: 's1', name: 'Annual check-up', durationMinutes: 45, cost: 68 }],
      },
      { _id: 'sp2', name: 'Equine', activeServiceCount: 6, services: [] },
    ]);
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', connectChargesEnabled: true });
  });

  it('renders the phone top bar, profile card, team list, specialities and stripe row', () => {
    renderPhone();

    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Alpenblick Animal Clinic')).toBeInTheDocument();
    expect(screen.getByText('Team · 1')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Weber')).toBeInTheDocument();
    expect(screen.getByText('Specialities & services')).toBeInTheDocument();
    // First speciality is expanded by default, revealing its service.
    expect(screen.getByText('Annual check-up')).toBeInTheDocument();
    expect(screen.getByText('45 min · €68')).toBeInTheDocument();
    expect(screen.getByText('Stripe payments connected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/stripe-onboarding?orgId=org-1'
    );
  });

  it('loads the org services on mount so the specialities accordion has bodies', () => {
    renderPhone();
    expect(mockLoadServicesForOrg).toHaveBeenCalledWith('org-1');
  });

  it('keeps rendering when the service load fails', async () => {
    mockLoadServicesForOrg.mockRejectedValueOnce(new Error('boom'));
    renderPhone();
    await waitFor(() => expect(mockLoadServicesForOrg).toHaveBeenCalledWith('org-1'));
    expect(screen.getByText('Specialities & services')).toBeInTheDocument();
  });

  it('navigates back when the back button is pressed', () => {
    renderPhone();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('opens the member info modal when a team row is tapped', () => {
    renderPhone();
    expect(screen.queryByTestId('team-info')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Dr. Sarah Weber'));
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('opens the invite modal from the invite row', () => {
    renderPhone();
    expect(screen.queryByTestId('add-team')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Invite team member/ }));
    expect(screen.getByTestId('add-team')).toBeInTheDocument();
  });

  it('toggles into the edit surface from the top bar', () => {
    renderPhone();
    expect(screen.queryByTestId('edit-cards')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit organization' }));
    expect(screen.getByTestId('edit-cards')).toBeInTheDocument();
    // Profile card is hidden while editing.
    expect(screen.queryByText('Team · 1')).not.toBeInTheDocument();
  });

  it('collapses an expanded speciality when its header is tapped', () => {
    renderPhone();
    expect(screen.getByText('Annual check-up')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /2 services/ }));
    expect(screen.queryByText('Annual check-up')).not.toBeInTheDocument();
  });

  it('shows the not-connected stripe state with a Connect link', () => {
    useSubscriptionMock.mockReturnValue({ orgId: 'org-1', connectChargesEnabled: false });
    renderPhone();

    expect(screen.getByText('Stripe not connected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect' })).toBeInTheDocument();
  });

  it('renders logo/photo images and an observation-tool service meta', () => {
    useTeamMock.mockReturnValue([
      { _id: 't1', name: 'Elif Kaya', image: 'https://example.com/elif.png' },
    ]);
    useSpecialitiesMock.mockReturnValue([
      {
        _id: 'sp1',
        name: 'Diagnostics',
        activeServiceCount: 1,
        services: [{ id: 's1', name: 'Ultrasound review', serviceType: 'OBSERVATION_TOOL' }],
      },
    ]);
    const { container } = render(
      <PhoneOrganization primaryOrg={{ ...org, imageURL: 'https://example.com/logo.png' }} />
    );

    expect(container.querySelectorAll('img').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('observation tool')).toBeInTheDocument();
    // A member with no role/speciality/employment shows an em dash subline.
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('keeps the active team member in sync as the team list refreshes', () => {
    useTeamMock.mockReturnValue([{ _id: 't1', name: 'Sarah' }]);
    const { rerender } = renderPhone();
    expect(screen.getByText('Sarah')).toBeInTheDocument();

    // Same id present after refresh -> keeps (updated) member.
    useTeamMock.mockReturnValue([{ _id: 't1', name: 'Sarah Renamed' }]);
    rerender(<PhoneOrganization primaryOrg={org} />);
    expect(screen.getByText('Sarah Renamed')).toBeInTheDocument();

    // Active member disappears -> falls back to the first member.
    useTeamMock.mockReturnValue([{ _id: 't2', name: 'Blair' }]);
    rerender(<PhoneOrganization primaryOrg={org} />);
    expect(screen.getByText('Blair')).toBeInTheDocument();

    // Empty list -> no active member.
    useTeamMock.mockReturnValue([]);
    rerender(<PhoneOrganization primaryOrg={org} />);
    expect(screen.getByText('No team members yet.')).toBeInTheDocument();
  });

  it('handles blank names, string specialities and unknown service counts', () => {
    useTeamMock.mockReturnValue([{ _id: 't1', name: '', speciality: ['Cardiology'] }]);
    useSpecialitiesMock.mockReturnValue([{ _id: 'sp1', name: 'Cardio' }]);
    useSubscriptionMock.mockReturnValue(null);
    render(
      <PhoneOrganization primaryOrg={{ name: '', type: 'GROOMER', phoneNo: '', taxId: '' }} />
    );

    expect(screen.getByText('Team member')).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText(/0 services/)).toBeInTheDocument();
    expect(screen.getByText('Stripe not connected')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the specialities empty state', () => {
    useSpecialitiesMock.mockReturnValue([]);
    renderPhone();

    expect(screen.getByText('No specialities added yet.')).toBeInTheDocument();
  });

  it('renders the team empty state and hides the invite row without edit rights', () => {
    canMock.mockReturnValue(false);
    useTeamMock.mockReturnValue([]);
    renderPhone();

    expect(screen.getByText('No team members yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite team member/ })).not.toBeInTheDocument();
    // Edit + manage affordances are also gated off.
    expect(screen.queryByRole('button', { name: 'Edit organization' })).not.toBeInTheDocument();
  });
});
