import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';

describe('CircleIconButton', () => {
  const icon = <span data-testid="icon" aria-hidden="true" />;

  it('renders the outline recipe: 38px hairline circle with an ink-soft icon', () => {
    render(<CircleIconButton icon={icon} label="Edit" variant="outline" onClick={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.className).toContain('size-[38px]');
    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('border-neutral-200');
    expect(button.className).toContain('text-neutral-800');
  });

  it('defaults to the outline variant when none is provided', () => {
    render(<CircleIconButton icon={icon} label="Reschedule" onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Reschedule' }).className).toContain(
      'border-neutral-200'
    );
  });

  it('renders the dark filled variant', () => {
    render(<CircleIconButton icon={icon} label="View" variant="dark" onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'View' }).className).toContain('bg-neutral-900');
  });

  it('renders the danger variant', () => {
    render(<CircleIconButton icon={icon} label="Delete" variant="danger" onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('border-danger-600');
  });

  // Nothing in globals.css gives a bare <button> the pointer cursor, so all 19
  // call sites of this primitive showed an arrow over a clickable circle. The
  // disabled state must still read not-allowed - it is the more specific
  // selector, so it wins over cursor-pointer whatever the declaration order.
  it('shows a pointer cursor, and not-allowed once disabled', () => {
    const { rerender } = render(<CircleIconButton icon={icon} label="Edit" onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('cursor-pointer');

    rerender(<CircleIconButton icon={icon} label="Edit" onClick={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain(
      'disabled:cursor-not-allowed'
    );
  });

  it('calls onClick when pressed', () => {
    const onClick = jest.fn();
    render(<CircleIconButton icon={icon} label="Edit" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick while disabled', () => {
    const onClick = jest.fn();
    render(<CircleIconButton icon={icon} label="Edit" onClick={onClick} disabled />);
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows the tooltip content on hover, defaulting to the label', () => {
    render(<CircleIconButton icon={icon} label="Edit" onClick={jest.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Edit' }).parentElement as HTMLElement;
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Edit');
  });

  it('renders a custom tooltip node on a chosen side when provided', () => {
    render(
      <CircleIconButton
        icon={icon}
        label="Edit"
        onClick={jest.fn()}
        tooltip={<span>Custom tip</span>}
        tooltipSide="right"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Edit' }).parentElement as HTMLElement;
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Custom tip');
  });

  it('renders a bare button without a tooltip wrapper when showTooltip is false', () => {
    const { container } = render(
      <CircleIconButton icon={icon} label="Edit" onClick={jest.fn()} showTooltip={false} />
    );
    expect(container.querySelector('.glass-tooltip')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('renders a bare button when there is no tooltip content', () => {
    const { container } = render(<CircleIconButton icon={icon} label="" onClick={jest.fn()} />);
    expect(container.querySelector('.glass-tooltip')).toBeNull();
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});
