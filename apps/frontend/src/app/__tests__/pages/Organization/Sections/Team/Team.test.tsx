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

jest.mock('@/app/ui/tables/AvailabilityTable', () => () => (
  <div data-testid="availability-table" />
));

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

  it('renders the team table and member count', () => {
    render(<Team isVerified={true} />);

    expect(screen.getByTestId('availability-table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Team/ })).toHaveTextContent('(1)');
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

    expect(screen.getByTestId('availability-table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite member/ })).not.toBeInTheDocument();
  });

  it('hides the invite button when the user cannot edit the team', () => {
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => false) });
    render(<Team isVerified={true} />);

    expect(screen.queryByRole('button', { name: /Invite member/ })).not.toBeInTheDocument();
  });
});
