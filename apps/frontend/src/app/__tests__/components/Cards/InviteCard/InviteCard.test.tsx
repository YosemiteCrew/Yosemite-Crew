import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InviteCard from '@/app/ui/cards/InviteCard/InviteCard';

const baseInvite: any = {
  organisationName: 'Good Pets',
  organisationType: 'HOSPITAL',
  role: 'SUPERVISOR',
  employmentType: 'FULL_TIME',
};

describe('InviteCard', () => {
  it('renders invite details, INVITED badge and subline', () => {
    render(<InviteCard invite={baseInvite} handleAccept={jest.fn()} handleReject={jest.fn()} />);

    expect(screen.getByText('Good Pets')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('INVITED')).toBeInTheDocument();
    expect(screen.getByText('Supervisor · Full time · accept to join')).toBeInTheDocument();
  });

  it('wires the Accept and Decline buttons', () => {
    const handleAccept = jest.fn().mockResolvedValue(undefined);
    const handleReject = jest.fn();

    render(
      <InviteCard invite={baseInvite} handleAccept={handleAccept} handleReject={handleReject} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(handleAccept).toHaveBeenCalledWith(baseInvite);

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(handleReject).toHaveBeenCalledWith(baseInvite);
  });

  it('disables both action buttons when disabled is true', () => {
    render(
      <InviteCard invite={baseInvite} handleAccept={jest.fn()} handleReject={jest.fn()} disabled />
    );

    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
  });
});
