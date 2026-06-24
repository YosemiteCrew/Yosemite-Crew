import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PastItemsList from '@/app/features/appointments/pages/AppointmentWorkspace/components/PastItemsList';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';

describe('PastItemsList', () => {
  it('renders the empty label when there are no items', () => {
    render(<PastItemsList title="All SOAP notes" items={[]} emptyLabel="None yet" />);
    expect(screen.getByText('None yet')).toBeInTheDocument();
  });

  it('renders rows and toggles expandable detail', () => {
    render(
      <PastItemsList
        title="All SOAP notes"
        items={[
          { id: '1', title: 'By Dr A', date: 'Apr 21', time: '09:45', detail: <p>Detail body</p> },
        ]}
      />
    );
    expect(screen.getByText('By Dr A')).toBeInTheDocument();
    expect(screen.queryByText('Detail body')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view by dr a/i }));
    expect(screen.getByText('Detail body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hide by dr a/i }));
    expect(screen.queryByText('Detail body')).not.toBeInTheDocument();
  });
});

describe('CircleIconButton', () => {
  it('fires onClick and exposes its label', () => {
    const onClick = jest.fn();
    render(
      <CircleIconButton
        icon={<span>x</span>}
        label="Delete row"
        variant="danger"
        onClick={onClick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const onClick = jest.fn();
    render(<CircleIconButton icon={<span>x</span>} label="Edit" onClick={onClick} disabled />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  });
});
