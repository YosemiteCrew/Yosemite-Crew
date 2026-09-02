import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import Team from '@/app/features/organization/pages/Organization/Sections/Team/Team';

const useTeamMock = jest.fn();
const usePermissionsMock = jest.fn();

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => useTeamMock(),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Team/AddTeam', () => () => (
  <div data-testid="add-team" />
));

jest.mock('@/app/features/organization/pages/Organization/Sections/Team/TeamInfo', () => () => (
  <div data-testid="team-info" />
));

describe('Team section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex' }]);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it('renders the design team table with member count and a member row', () => {
    render(<Team isVerified={true} />);

    expect(screen.getByRole('heading', { name: /Team/ })).toHaveTextContent('(1)');
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Employment')).toBeInTheDocument();
  });

  it('renders role, employment and a status pill for a member', () => {
    useTeamMock.mockReturnValue([
      {
        _id: 'team-1',
        name: 'Dr. Sarah Weber',
        role: 'VETERINARIAN',
        status: 'Available',
        employmentType: 'FULL_TIME',
        speciality: [{ name: 'Small animals' }],
      },
    ]);
    render(<Team isVerified={true} />);

    expect(screen.getByText('Veterinarian')).toBeInTheDocument();
    expect(screen.getByText('Full time')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Small animals')).toBeInTheDocument();
  });

  it('maps a requested member to an INVITED status pill', () => {
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Jules', status: 'Requested' }]);
    render(<Team isVerified={true} />);

    expect(screen.getByText('INVITED')).toBeInTheDocument();
  });

  it('renders a photo avatar and supports string specialities', () => {
    useTeamMock.mockReturnValue([
      {
        _id: 'team-1',
        name: 'Elif Kaya',
        role: 'TECHNICIAN',
        status: 'Available',
        image: 'https://example.com/elif.png',
        speciality: ['Vet tech'],
      },
    ]);
    const { container } = render(<Team isVerified={true} />);

    expect(container.querySelector('img')).toBeInTheDocument();
    expect(screen.getByText('Vet tech')).toBeInTheDocument();
  });

  // Design rule: the initials fallback is mandatory, never an empty circle. A
  // member photo whose URL stopped resolving must degrade to the initials disc.
  it('swaps a dead photo for the initials disc', () => {
    useTeamMock.mockReturnValue([
      {
        _id: 'team-1',
        name: 'Elif Kaya',
        role: 'TECHNICIAN',
        status: 'Available',
        image: 'https://example.com/gone.png',
      },
    ]);
    const { container } = render(<Team isVerified={true} />);
    const photo = container.querySelector('img') as HTMLImageElement;
    expect(photo).toBeInTheDocument();
    expect(screen.queryByText('EK')).not.toBeInTheDocument();

    fireEvent.error(photo);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('EK')).toBeInTheDocument();
  });

  it('falls back to placeholder labels when member fields are missing', () => {
    useTeamMock.mockReturnValue([{ _id: 'team-1' }]);
    render(<Team isVerified={true} />);

    expect(screen.getByText('Team member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open team member details' })).toBeInTheDocument();
  });

  it('shows the invite button when verified and permitted', () => {
    render(<Team isVerified={true} />);

    const invite = screen.getByRole('button', { name: /Invite member/ });
    expect(invite).toBeInTheDocument();
    fireEvent.click(invite);
    expect(screen.getByTestId('add-team')).toBeInTheDocument();
  });

  it('hides the invite button when not verified', () => {
    render(<Team isVerified={false} />);

    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite member/ })).not.toBeInTheDocument();
  });

  it('hides the invite button when the user cannot edit the team', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    render(<Team isVerified={true} />);

    expect(screen.queryByRole('button', { name: /Invite member/ })).not.toBeInTheDocument();
  });

  it('defaults isVerified to false when the prop is omitted', () => {
    render(<Team />);

    expect(screen.queryByRole('button', { name: /Invite member/ })).not.toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('renders the empty state and no member-info modal when the team list is empty', () => {
    useTeamMock.mockReturnValue([]);
    render(<Team isVerified={true} />);

    expect(screen.getByRole('heading', { name: /Team/ })).toHaveTextContent('(0)');
    expect(screen.getByText('No team members yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('team-info')).not.toBeInTheDocument();
  });

  it('adopts the first team member once a previously empty list is populated', () => {
    useTeamMock.mockReturnValue([]);
    const { rerender } = render(<Team isVerified={true} />);
    expect(screen.queryByTestId('team-info')).not.toBeInTheDocument();

    useTeamMock.mockReturnValue([{ _id: 'team-9', name: 'Nova' }]);
    rerender(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('falls back to the first member when the active member disappears from the list', () => {
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex' }]);
    const { rerender } = render(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();

    useTeamMock.mockReturnValue([{ _id: 'team-2', name: 'Blair' }]);
    rerender(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('keeps the same active member when it is still present after a refresh', () => {
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex' }]);
    const { rerender } = render(<Team isVerified={true} />);

    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex Renamed' }]);
    rerender(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('opens the member-info modal from the row ellipsis action', () => {
    render(<Team isVerified={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Alex details' }));
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });
});
