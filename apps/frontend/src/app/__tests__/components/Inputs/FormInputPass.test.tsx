/* eslint-disable @next/next/no-img-element */
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
