import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserLabels from '@/app/features/appointments/components/Calendar/Task/UserLabels';

const team = [{ name: 'Avery' }, { name: 'Blake' }] as any;

describe('UserLabels', () => {
  it('renders team names', () => {
    render(<UserLabels team={team} />);

    expect(screen.getByText('Avery')).toBeInTheDocument();
    expect(screen.getByText('Blake')).toBeInTheDocument();
  });
});
