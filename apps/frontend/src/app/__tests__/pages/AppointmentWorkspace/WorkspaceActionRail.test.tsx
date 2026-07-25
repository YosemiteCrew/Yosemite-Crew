import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceActionRail from '@/app/features/appointments/pages/AppointmentWorkspace/components/WorkspaceActionRail';

describe('WorkspaceActionRail', () => {
  it('renders every quick-action launcher', () => {
    render(<WorkspaceActionRail activeAction={null} onSelect={jest.fn()} />);
    [
      'Record vitals',
      'Tasks',
      'Documents',
      'Chat',
      'Activity',
      'MSD Manual',
      'Calculators',
    ].forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
  });

  it('marks the active action as pressed and leaves the others unpressed', () => {
    render(<WorkspaceActionRail activeAction="DOCUMENTS" onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Documents' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Record vitals' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('opens the matching panel when an icon is clicked', () => {
    const onSelect = jest.fn();
    render(<WorkspaceActionRail activeAction={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    expect(onSelect).toHaveBeenCalledWith('CALCULATORS');
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(onSelect).toHaveBeenCalledWith('CHAT');
  });
});
