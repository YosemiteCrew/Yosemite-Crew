import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SpecialitiesCard from '@/app/ui/cards/SpecialitiesCard';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';

// --- Mocks ---

// Mock helper function from SpecialitiesTable
jest.mock('@/app/ui/tables/tableUtils', () => ({
  getServiceNames: jest.fn(() => 'Service A, Service B'),
}));

import { getServiceNames } from '@/app/ui/tables/tableUtils';

// --- Test Data ---

const mockSpeciality: SpecialityWeb = {
  _id: 'spec-1',
  name: 'Cardiology',
  services: [{ name: 'Service A' }, { name: 'Service B' }],
  teamMemberIds: ['member-1', 'member-2', 'member-3'],
  headName: 'Dr. Heart',
} as any;

describe('SpecialitiesCard Component', () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it('renders speciality details correctly', () => {
    render(<SpecialitiesCard speciality={mockSpeciality} handleViewSpeciality={mockHandleView} />);

    // Name
    expect(screen.getByText('Cardiology')).toBeInTheDocument();

    // Services (via Helper Mock)
    expect(screen.getByText('Services:')).toBeInTheDocument();
    expect(getServiceNames).toHaveBeenCalledWith(mockSpeciality.services);
    expect(screen.getByText('Service A, Service B')).toBeInTheDocument();

    // Team Count
    expect(screen.getByText('Assigned team members:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Length of teamMemberIds

    // Head Name
    expect(screen.getByText('Head:')).toBeInTheDocument();
    expect(screen.getByText('Dr. Heart')).toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it('calls handleViewSpeciality when View button is clicked', () => {
    render(<SpecialitiesCard speciality={mockSpeciality} handleViewSpeciality={mockHandleView} />);

    const viewBtn = screen.getByText('View');
    fireEvent.click(viewBtn);

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(mockSpeciality);
  });

  // --- 3. Edge Cases ---

  it('handles empty team members array correctly', () => {
    const emptyTeamSpec = { ...mockSpeciality, teamMemberIds: [] } as any;

    render(<SpecialitiesCard speciality={emptyTeamSpec} handleViewSpeciality={mockHandleView} />);

    // Should render "0"
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows zero when team members are missing', () => {
    const noTeamSpec = { ...mockSpeciality, teamMemberIds: undefined } as any;

    render(<SpecialitiesCard speciality={noTeamSpec} handleViewSpeciality={mockHandleView} />);

    expect(screen.getByText('Assigned team members:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('uses resolved mobile labels when provided', () => {
    render(
      <SpecialitiesCard
        speciality={{ ...mockSpeciality, services: [], headName: undefined }}
        serviceLabel="3"
        headLabel="Dr. Team"
        handleViewSpeciality={mockHandleView}
      />
    );

    expect(screen.getByText('Services:').parentElement).toHaveTextContent('Services:3');
    expect(screen.getByText('Dr. Team')).toBeInTheDocument();
  });
});
