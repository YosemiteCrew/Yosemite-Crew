import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

jest.mock('next/image', () => {
  return ({ alt = '', ...props }: any) => <img alt={alt} {...props} />;
});

import FormInputPass from '@/app/ui/inputs/FormInputPass/FormInputPass';

expect.extend(toHaveNoViolations);

describe('FormInputPass', () => {
  test('renders password field with label', () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value="secret"
        onChange={jest.fn()}
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>('Password');
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');
  });

  test('toggle button switches between password and text', () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value="secret"
        onChange={jest.fn()}
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  test('displays error text', () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value=""
        onChange={jest.fn()}
        error="Required"
      />
    );

    const input = screen.getByLabelText('Password');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent('Required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  test('renders an undefined value as empty and fires focus/blur', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value={undefined as unknown as string}
        onChange={jest.fn()}
        onFocus={onFocus}
        onBlur={onBlur}
        autoComplete="new-password"
      />
    );

    const input = screen.getByLabelText<HTMLInputElement>('Password');
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('autocomplete', 'new-password');

    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });

  test('renders a static top label tied to the field', () => {
    render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value=""
        onChange={jest.fn()}
      />
    );

    const label = screen.getByText('Password');
    expect(label.tagName).toBe('LABEL');
    const input = screen.getByLabelText('Password');
    expect(label).toHaveAttribute('for', input.getAttribute('id') ?? '');
  });

  test('has no axe accessibility violations in default state', async () => {
    const { container } = render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value=""
        onChange={jest.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no axe accessibility violations in error state', async () => {
    const { container } = render(
      <FormInputPass
        intype="password"
        inname="password"
        inlabel="Password"
        value=""
        onChange={jest.fn()}
        error="Password is required"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
