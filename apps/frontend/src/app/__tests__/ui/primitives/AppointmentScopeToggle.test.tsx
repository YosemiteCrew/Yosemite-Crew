import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppointmentScopeToggle from '@/app/ui/primitives/AppointmentScopeToggle/AppointmentScopeToggle';

describe('AppointmentScopeToggle', () => {
  it('renders all mode and requests mine mode on click', () => {
    const onChange = jest.fn();

    render(<AppointmentScopeToggle showMineOnly={false} onChange={onChange} />);

    const toggle = screen.getByRole('button', { name: 'Show my appointments' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Mine')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders mine mode and requests all mode on click', () => {
    const onChange = jest.fn();

    render(<AppointmentScopeToggle showMineOnly={true} onChange={onChange} />);

    const toggle = screen.getByRole('button', { name: 'Show all appointments' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mine')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not change value when disabled', () => {
    const onChange = jest.fn();

    render(<AppointmentScopeToggle showMineOnly={false} disabled onChange={onChange} />);

    const toggle = screen.getByRole('button', { name: 'Show my appointments' });
    expect(toggle).toBeDisabled();

    fireEvent.click(toggle);

    expect(onChange).not.toHaveBeenCalled();
  });
});
