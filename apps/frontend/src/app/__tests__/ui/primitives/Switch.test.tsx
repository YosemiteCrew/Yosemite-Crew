import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Switch from '@/app/ui/primitives/Switch/Switch';

describe('Switch', () => {
  it('announces its state rather than only filling in blue', () => {
    render(<Switch checked onChange={jest.fn()} label="Visible in inventory" />);

    const control = screen.getByRole('switch', { name: 'Visible in inventory' });
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('reports the off state too', () => {
    render(<Switch checked={false} onChange={jest.fn()} label="Mute notifications" />);

    expect(screen.getByRole('switch', { name: 'Mute notifications' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('hands the caller the NEXT value, not the current one', () => {
    /* The eight hand-rolled copies this replaced each did their own
       `onClick={() => onChange(!checked)}`, and one of them passed the current
       value instead. Making the primitive own the flip removes that class of
       bug from the call sites. */
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Publish" />);

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);

    onChange.mockClear();
    render(<Switch checked onChange={onChange} label="Publish again" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Publish again' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not fire while disabled', () => {
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} disabled label="Open booking page" />);

    const control = screen.getByRole('switch');
    expect(control).toBeDisabled();
    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the one geometry the design system fixes', () => {
    /* jsdom does not run Tailwind, so the class is the handle here; the
       Storybook play functions measure the rendered pixels. 40x24 track, 18px
       knob, 3px inset, 19px of travel. */
    const { rerender } = render(<Switch checked={false} onChange={jest.fn()} label="Geometry" />);

    const control = screen.getByRole('switch');
    expect(control).toHaveClass('h-6', 'w-10');
    const knob = control.firstElementChild as HTMLElement;
    expect(knob).toHaveClass('size-[18px]', 'translate-x-[3px]');

    rerender(<Switch checked onChange={jest.fn()} label="Geometry" />);
    expect(screen.getByRole('switch').firstElementChild).toHaveClass('translate-x-[19px]');
  });

  it('merges a caller class onto the track without losing the geometry', () => {
    render(<Switch checked={false} onChange={jest.fn()} label="Spaced" className="ml-auto" />);

    const control = screen.getByRole('switch');
    expect(control).toHaveClass('ml-auto', 'h-6', 'w-10');
  });
});
