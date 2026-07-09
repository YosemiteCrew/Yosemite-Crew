import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Team } from '@/app/features/organization/types/team';

const useAuthStoreMock = jest.fn();

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => useAuthStoreMock(),
}));

describe('UserLabels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders team labels', () => {
    useAuthStoreMock.mockReturnValue({
      attributes: { sub: 'user-1' },
    });

    const team: Team[] = [
      {
        _id: 't1',
        name: 'Alex',
        practionerId: 'user-1',
        organisationId: 'org-1',
        role: 'ADMIN',
        speciality: [],
        status: 'Available',
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
      {
        _id: 't2',
        name: 'Sam',
        practionerId: 'user-2',
        organisationId: 'org-1',
        role: 'TECHNICIAN',
        speciality: [],
        status: 'Available',
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
    ];

    render(<UserLabels team={team} />);

    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('highlights the current user', () => {
    useAuthStoreMock.mockReturnValue({
      attributes: { email: 'user-2' },
    });

    const team: Team[] = [
      {
        _id: 't1',
        name: 'Alex',
        practionerId: 'user-1',
        organisationId: 'org-1',
        role: 'ADMIN',
        speciality: [],
        status: 'Available',
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
      {
        _id: 't2',
        name: 'Sam',
        practionerId: 'user-2',
        organisationId: 'org-1',
        role: 'TECHNICIAN',
        speciality: [],
        status: 'Available',
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
    ];

    render(<UserLabels team={team} />);

    expect(screen.getByText('Sam')).toHaveClass('text-(--color-primary-700)');
    expect(screen.getByText('Alex')).toHaveClass('text-text-secondary');
  });
});

describe('UserLabels (team-day planner header)', () => {
  const team: Team[] = [
    {
      _id: 't1',
      name: 'Alex Kim',
      practionerId: 'user-1',
      organisationId: 'org-1',
      role: 'VETERINARIAN',
      speciality: [{ organisationId: 'org-1', name: 'Cardiology' }],
      status: 'Available',
      revokedPermissions: [],
      effectivePermissions: [],
      extraPerissions: [],
    },
    {
      _id: 't2',
      name: 'Sam Lee',
      practionerId: 'user-2',
      organisationId: 'org-1',
      role: 'TECHNICIAN',
      speciality: [],
      status: 'Available',
      revokedPermissions: [],
      effectivePermissions: [],
      extraPerissions: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStoreMock.mockReturnValue({ attributes: { sub: 'user-1' } });
  });

  it('renders avatar initials, name, specialty and today count when counts are provided', () => {
    render(<UserLabels team={team} appointmentCounts={{ 'user-1': 3, 'user-2': 0 }} />);

    expect(screen.getByText('Alex Kim')).toBeInTheDocument();
    expect(screen.getByText('AK')).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('3 today')).toBeInTheDocument();
    expect(screen.getByText('0 today')).toBeInTheDocument();
  });

  it('falls back to the humanized role when a practitioner has no specialty', () => {
    render(<UserLabels team={team} appointmentCounts={{}} />);

    expect(screen.getByText('Technician')).toBeInTheDocument();
  });

  it('defaults the count to zero when a practitioner is absent from the counts map', () => {
    render(<UserLabels team={team} appointmentCounts={{}} />);

    expect(screen.getAllByText('0 today')).toHaveLength(2);
  });

  it('highlights the current user name and leaves others as primary text', () => {
    useAuthStoreMock.mockReturnValue({ attributes: { email: 'user-2' } });

    render(<UserLabels team={team} appointmentCounts={{ 'user-1': 1, 'user-2': 2 }} />);

    expect(screen.getByText('Sam Lee')).toHaveClass('text-(--color-primary-700)');
    expect(screen.getByText('Alex Kim')).toHaveClass('text-text-primary');
  });

  it('handles a member without a name and falls back to _id for the count key', () => {
    const teamWithGaps: Team[] = [
      {
        _id: 't3',
        practionerId: '',
        organisationId: 'org-1',
        role: 'RECEPTIONIST',
        speciality: [],
        status: 'Available',
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
    ];

    render(<UserLabels team={teamWithGaps} appointmentCounts={{ t3: 7 }} />);

    expect(screen.getByText('Receptionist')).toBeInTheDocument();
    expect(screen.getByText('7 today')).toBeInTheDocument();
  });
});
