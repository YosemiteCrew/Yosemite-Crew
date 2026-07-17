import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import FormInput from '@/app/ui/inputs/FormInput/FormInput';

expect.extend(toHaveNoViolations);

describe('FormInput', () => {
  test('renders label and value', () => {
    render(
      <FormInput
        intype="text"
        inname="firstName"
        inlabel="First name"
        value="Jane"
        onChange={jest.fn()}
      />
    );

    const input = screen.getByLabelText('First name');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'firstName');
    expect((input as HTMLInputElement).value).toBe('Jane');
  });

  test('renders a static top label associated with the input', () => {
    render(
      <FormInput
        intype="text"
        inname="prefilled"
        inlabel="Prefilled value"
        value="Template value"
        onChange={jest.fn()}
      />
    );

    const label = screen.getByText('Prefilled value');
    // Static top label (not a floating overlay) tied to the field via htmlFor.
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveClass('text-[12.5px]', 'font-semibold');
    const input = screen.getByLabelText('Prefilled value');
    expect(label).toHaveAttribute('for', input.getAttribute('id') ?? '');
  });

  test('emits changes and honours readonly + tabIndex', () => {
    const handleChange = jest.fn();
    render(
      <FormInput
        intype="text"
        inname="city"
        inlabel="City"
        value=""
        onChange={handleChange}
        readonly
        tabIndex={3}
        className="custom-field"
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>('City');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('tabindex', '3');
    expect(input.className).toContain('custom-field');

    fireEvent.change(input, { target: { value: 'Munich' } });
    expect(handleChange).toHaveBeenCalled();
  });

  test('opens the native picker for date/time inputs on click', () => {
    const handleClick = jest.fn();
    render(
      <FormInput
        intype="date"
        inname="dob"
        inlabel="Date of birth"
        value=""
        onChange={jest.fn()}
        onClick={handleClick}
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>('Date of birth');
    const showPicker = jest.fn();
    (input as unknown as { showPicker: () => void }).showPicker = showPicker;

    fireEvent.click(input);
    expect(handleClick).toHaveBeenCalled();
    expect(showPicker).toHaveBeenCalled();
  });

  test('does not open a picker for text inputs on click', () => {
    render(<FormInput intype="text" inname="note" inlabel="Note" value="" onChange={jest.fn()} />);

    const input = screen.getByLabelText<HTMLInputElement>('Note');
    const showPicker = jest.fn();
    (input as unknown as { showPicker: () => void }).showPicker = showPicker;

    // No onClick handler and non-date type: must not throw or call showPicker.
    fireEvent.click(input);
    expect(showPicker).not.toHaveBeenCalled();
  });

  test('renders an undefined value as empty and fires focus/blur', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(
      <FormInput
        intype="text"
        inname="empty"
        inlabel="Empty"
        value={undefined as unknown as string}
        onChange={jest.fn()}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>('Empty');
    expect(input.value).toBe('');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });

  test('shows validation error helper text', () => {
    render(
      <FormInput
        intype="text"
        inname="postal"
        inlabel="Postal code"
        value=""
        onChange={jest.fn()}
        error="Postal code is required"
      />
    );

    const input = screen.getByLabelText('Postal code');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent('Postal code is required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  test('has no axe accessibility violations in default state', async () => {
    const { container } = render(
      <FormInput
        intype="text"
        inname="email"
        inlabel="Email address"
        value=""
        onChange={jest.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no axe accessibility violations in error state', async () => {
    const { container } = render(
      <FormInput
        intype="text"
        inname="email"
        inlabel="Email address"
        value=""
        onChange={jest.fn()}
        error="Email is required"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
