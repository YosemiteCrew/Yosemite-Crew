import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhoneFab from '@/app/ui/layout/PhoneShell/PhoneFab';
import type { FabAction } from '@/app/ui/layout/PhoneShell/phoneShellConfig';

const action: FabAction = {
  key: 'appointment',
  label: 'New appointment',
  ariaLabel: 'New appointment',
  routeName: 'Appointments',
  matchHref: '/appointments',
};

describe('PhoneFab', () => {
  it('renders nothing when there is no primary action', () => {
    const { container } = render(<PhoneFab action={null} onAction={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an accessible button carrying the action label', () => {
    render(<PhoneFab action={action} onAction={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'New appointment' })).toBeInTheDocument();
  });

  it('invokes onAction with the current action when tapped', () => {
    const onAction = jest.fn();
    render(<PhoneFab action={action} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'New appointment' }));
    expect(onAction).toHaveBeenCalledWith(action);
  });
});
