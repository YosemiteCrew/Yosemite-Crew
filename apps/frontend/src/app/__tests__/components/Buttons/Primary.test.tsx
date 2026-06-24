import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import Primary from '@/app/ui/primitives/Buttons/Primary';

describe('Primary button', () => {
  test('renders the provided text and href', () => {
    render(<Primary text="Book onboarding call" href="/book-demo" />);

    const link = screen.getByRole('link', { name: 'Book onboarding call' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/book-demo');
  });

  test('prevents default navigation and calls onClick handler', () => {
    const handleClick = jest.fn();

    render(<Primary text="Next" href="/next" onClick={handleClick} />);

    const link = screen.getByRole('link', { name: 'Next' });
    fireEvent.click(link);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick.mock.calls[0][0].defaultPrevented).toBe(true);
  });

  test('renders an icon alongside the button text', () => {
    render(<Primary text="Add Appointment" icon={<span data-testid="primary-icon" />} />);

    expect(screen.getByRole('button', { name: 'Add Appointment' })).toBeInTheDocument();
    expect(screen.getByTestId('primary-icon')).toBeInTheDocument();
  });

  test('renders the icon after the text when iconPosition is right', () => {
    render(
      <Primary
        text="Save & Next"
        icon={<span data-testid="trailing-icon" />}
        iconPosition="right"
      />
    );

    const button = screen.getByRole('button', { name: 'Save & Next' });
    const icon = screen.getByTestId('trailing-icon');
    // The trailing icon is the button's last child element (after the text).
    expect(button).toContainElement(icon);
    expect(button.lastElementChild).toContainElement(icon);
  });

  test('applies the shared token-backed primary background color', () => {
    render(<Primary text="Continue" />);

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveStyle({
      backgroundColor: 'var(--color-text-primary)',
    });
  });

  test('uses the shared primary feedback class without shadow or scale utilities', () => {
    render(<Primary text="Save" />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('yc-primary-button');
    expect(button.className).not.toContain('hover:shadow-');
    expect(button.className).not.toContain('hover:scale');
  });
});
