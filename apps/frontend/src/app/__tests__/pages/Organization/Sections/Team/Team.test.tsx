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

jest.mock(
  '@/app/ui/tables/AvailabilityTable',
  () =>
    ({ setActive, setView, filteredList }: any) => (
      <div data-testid="availability-table">
        <button
          type="button"
          onClick={() => {
            setActive(filteredList[0]);
            setView(true);
          }}
        >
          open-first
        </button>
      </div>
    )
);

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

  it('defaults isVerified to false when the prop is omitted', () => {
    render(<Team />);

    // Default false → invite hidden even though the user can edit.
    expect(screen.queryByRole('button', { name: /Invite member/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('availability-table')).toBeInTheDocument();
  });

  it('renders no member-info modal when the team list is empty', () => {
    useTeamMock.mockReturnValue([]);
    render(<Team isVerified={true} />);

    // teams[0] ?? null → null initial and the effect returns null → activeTeam stays null.
    expect(screen.getByRole('heading', { name: /Team/ })).toHaveTextContent('(0)');
    expect(screen.queryByTestId('team-info')).not.toBeInTheDocument();
  });

  it('adopts the first team member once a previously empty list is populated', () => {
    useTeamMock.mockReturnValue([]);
    const { rerender } = render(<Team isVerified={true} />);
    expect(screen.queryByTestId('team-info')).not.toBeInTheDocument();

    // Re-render with a populated list: prev is null (prev?._id falsy) → returns teams[0].
    useTeamMock.mockReturnValue([{ _id: 'team-9', name: 'Nova' }]);
    rerender(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('falls back to the first member when the active member disappears from the list', () => {
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex' }]);
    const { rerender } = render(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();

    // Active was team-1; new list no longer contains it → updated is undefined → returns teams[0].
    useTeamMock.mockReturnValue([{ _id: 'team-2', name: 'Blair' }]);
    rerender(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('keeps the same active member when it is still present after a refresh', () => {
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex' }]);
    const { rerender } = render(<Team isVerified={true} />);

    // Same _id present but object identity changed → updated found → returns updated.
    useTeamMock.mockReturnValue([{ _id: 'team-1', name: 'Alex Renamed' }]);
    rerender(<Team isVerified={true} />);
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });

  it('opens the member-info modal from the availability table', () => {
    render(<Team isVerified={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'open-first' }));
    expect(screen.getByTestId('team-info')).toBeInTheDocument();
  });
});
