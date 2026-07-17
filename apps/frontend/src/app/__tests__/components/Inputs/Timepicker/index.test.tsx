import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import Timepicker from '@/app/ui/inputs/Timepicker';

jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: ({ customInput, onChange, portalId }: any) => (
    <div>
      <span data-testid="timepicker-portal-id">{portalId ?? 'none'}</span>
      {React.cloneElement(customInput)}
      <button type="button" onClick={() => onChange(new Date(2000, 0, 1, 9, 45))}>
        pick-time
      </button>
      <button type="button" onClick={() => onChange(null)}>
        clear-time
      </button>
    </div>
  ),
}));

expect.extend(toHaveNoViolations);

describe('Timepicker', () => {
  it('emits HH:mm value on selection', () => {
    const onChange = jest.fn();

    render(<Timepicker value="08:30" onChange={onChange} label="Due time" />);

    fireEvent.click(screen.getByText('pick-time'));

    expect(onChange).toHaveBeenCalledWith('09:45');
  });

  it('emits an empty string when the time is cleared', () => {
    const onChange = jest.fn();

    render(<Timepicker value="08:30" onChange={onChange} label="Due time" name="due" />);

    fireEvent.click(screen.getByText('clear-time'));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders trigger with label', () => {
    render(<Timepicker value="" onChange={jest.fn()} label="Due time" />);

    expect(screen.getByLabelText('Due time')).toBeInTheDocument();
  });

  it('shows the selected value and an error message', () => {
    render(<Timepicker value="08:30" onChange={jest.fn()} label="Due time" error="Pick a time" />);

    // aria-label switches to the "<label>: <value>" form once a value is present.
    expect(screen.getByRole('button', { name: 'Due time: 08:30' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a time');
  });

  it('treats an unparseable value as an empty time selection', () => {
    render(<Timepicker value="ab:cd" onChange={jest.fn()} label="Due time" />);

    // Invalid value still renders as text but parses to null internally.
    expect(screen.getByRole('button', { name: 'Due time: ab:cd' })).toBeInTheDocument();
  });

  it('uses the shared portal to avoid modal clipping', () => {
    render(<Timepicker value="" onChange={jest.fn()} label="Due time" />);

    expect(screen.getByTestId('timepicker-portal-id')).toHaveTextContent('yc-datepicker-portal');
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<Timepicker value="" onChange={jest.fn()} label="Due time" />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
