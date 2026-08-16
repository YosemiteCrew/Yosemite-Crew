import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AvailabilityCard from '@/app/ui/cards/AvailabilityCard';
import { Team } from '@/app/features/organization/types/team';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: any) => <div data-testid="team-image" data-alt={alt} data-src={src} />,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const baseTeam = {
  name: 'Dr Jane',
  role: 'vet',
  todayAppointment: 3,
  weeklyWorkingHours: 40,
  status: 'Available',
  image: '',
} as unknown as Team;

describe('AvailabilityCard', () => {
  it('renders team info and speciality list of strings', () => {
    const handleViewTeam = jest.fn();
    render(
      <AvailabilityCard
        team={{ ...baseTeam, speciality: ['Surgery', 'Dental'] } as unknown as Team}
        handleViewTeam={handleViewTeam}
      />
    );

    expect(screen.getByText('Dr Jane')).toBeInTheDocument();
    expect(screen.getByText('Vet')).toBeInTheDocument();
    expect(screen.getByText('Surgery, Dental')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Available')).toHaveStyle({
      backgroundColor: 'var(--color-pill-success-bg)',
    });
  });

  it('renders speciality objects using their name field', () => {
    render(
      <AvailabilityCard
        team={
          {
            ...baseTeam,
            speciality: [{ name: 'Cardiology' }],
          } as unknown as Team
        }
        handleViewTeam={jest.fn()}
      />
    );
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
  });

  it('falls back to the code when a speciality record has no name', () => {
    render(
      <AvailabilityCard
        team={
          {
            ...baseTeam,
            speciality: [{ code: 'X1' }],
          } as unknown as Team
        }
        handleViewTeam={jest.fn()}
      />
    );
    // This used to render the literal `{"code":"X1"}` at a clinician.
    expect(screen.getByText('X1')).toBeInTheDocument();
    expect(screen.queryByText('{"code":"X1"}')).not.toBeInTheDocument();
  });

  it('keeps an unidentifiable speciality visible rather than dropping it', () => {
    render(
      <AvailabilityCard
        team={
          {
            ...baseTeam,
            speciality: [{ name: 'Cardiology' }, {}],
          } as unknown as Team
        }
        handleViewTeam={jest.fn()}
      />
    );
    // Dropping it would silently understate how many specialities a team holds.
    expect(screen.getByText('Cardiology, Unnamed speciality')).toBeInTheDocument();
  });

  it('renders "-" when speciality is missing or empty', () => {
    render(
      <AvailabilityCard
        team={{ ...baseTeam, speciality: [] } as unknown as Team}
        handleViewTeam={jest.fn()}
      />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders "-" when speciality is not an array', () => {
    render(
      <AvailabilityCard
        team={{ ...baseTeam, speciality: undefined } as unknown as Team}
        handleViewTeam={jest.fn()}
      />
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('calls handleViewTeam with the team when the button is clicked', () => {
    const handleViewTeam = jest.fn();
    render(
      <AvailabilityCard
        team={{ ...baseTeam, speciality: [] } as unknown as Team}
        handleViewTeam={handleViewTeam}
      />
    );
    screen.getByText('View').click();
    expect(handleViewTeam).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dr Jane' }));
  });
});
