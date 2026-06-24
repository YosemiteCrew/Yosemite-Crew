import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StaffField from '@/app/features/appointments/pages/AppointmentWorkspace/components/StaffField';

describe('StaffField', () => {
  it('renders the label and the assigned name', () => {
    render(<StaffField label="Assigned Lead" name="Dr. Tim Apple" />);
    expect(screen.getByText('Assigned Lead')).toBeInTheDocument();
    expect(screen.getByText('Dr. Tim Apple')).toBeInTheDocument();
  });

  it('shows an Unassigned placeholder and no avatar when empty', () => {
    render(<StaffField label="Support Staff" />);
    expect(screen.getByText('Support Staff')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    // No avatar image/initials are rendered when there is no name.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
