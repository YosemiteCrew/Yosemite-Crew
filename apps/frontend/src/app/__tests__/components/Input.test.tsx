import '@testing-library/jest-dom';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import Input, { Textarea } from '@/app/ui/Input';

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

  test('renders a multiline control without requiring placeholder copy', () => {
    const handleChange = jest.fn();
    render(<Textarea aria-label="Notes" onChange={handleChange} />);

    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    fireEvent.change(textarea, { target: { value: 'Follow-up needed' } });

    expect(handleChange).toHaveBeenCalled();
    expect(textarea).not.toHaveAttribute('placeholder');
    expect(textarea).toHaveClass('min-h-22', 'rounded-xl', 'bg-[var(--field-bg)]');
  });

  test('hands a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Work email" placeholder="name@clinic.com" />);

    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Work email' }));
  });

  test('hands a ref to the underlying textarea element', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Notes" />);

    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Notes' }));
  });
});
