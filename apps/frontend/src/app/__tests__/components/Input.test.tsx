import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import Input from '@/app/ui/Input';

describe('Input', () => {
  test('forwards native input attributes and changes', () => {
    const handleChange = jest.fn();
    render(
      <Input
        aria-label="Work email"
        name="email"
        placeholder="name@clinic.com"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Work email' });
    fireEvent.change(input, { target: { value: 'team@clinic.com' } });

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveAttribute('placeholder', 'name@clinic.com');
    expect(input).toHaveClass('h-10', 'rounded-xl', 'bg-[var(--field-bg)]');
  });

  test('exposes error and disabled states', () => {
    render(<Input aria-label="Room" error disabled placeholder="Enter a room" />);

    const input = screen.getByRole('textbox', { name: 'Room' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('border-[var(--danger)]');
  });
});
