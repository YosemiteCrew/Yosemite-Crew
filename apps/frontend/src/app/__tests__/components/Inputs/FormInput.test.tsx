import React from 'react';
import { render, screen } from '@testing-library/react';
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
