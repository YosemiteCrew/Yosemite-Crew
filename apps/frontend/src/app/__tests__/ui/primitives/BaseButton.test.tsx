import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BaseButton from '@/app/ui/primitives/Buttons/BaseButton';

const sizeClasses = { default: 'size-default', large: 'size-large' };
const baseClasses = 'base-classes';

describe('BaseButton', () => {
  it('renders a native button when no href is provided', () => {
    render(<BaseButton text="Click" sizeClasses={sizeClasses} baseClasses={baseClasses} />);
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  });

  it.each(['', '#', undefined])('renders a button (not a link) when href is %s', (href) => {
    render(
      <BaseButton text="Click" href={href} sizeClasses={sizeClasses} baseClasses={baseClasses} />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders a Link when href is a real path', () => {
    render(
      <BaseButton text="Go" href="/dashboard" sizeClasses={sizeClasses} baseClasses={baseClasses} />
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('trims whitespace-only href down to a button', () => {
    render(<BaseButton text="Go" href="   " sizeClasses={sizeClasses} baseClasses={baseClasses} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders the icon before the text by default', () => {
    render(
      <BaseButton
        text="Save"
        icon={<span data-testid="icon" />}
        sizeClasses={sizeClasses}
        baseClasses={baseClasses}
      />
    );
    const button = screen.getByRole('button');
    const icon = screen.getByTestId('icon');
    expect(button.firstElementChild).toContainElement(icon);
  });

  it('renders the icon after the text when iconPosition is right', () => {
    render(
      <BaseButton
        text="Next"
        icon={<span data-testid="icon" />}
        iconPosition="right"
        sizeClasses={sizeClasses}
        baseClasses={baseClasses}
      />
    );
    const button = screen.getByRole('button');
    expect(button.lastElementChild).toContainElement(screen.getByTestId('icon'));
  });

  it('calls onClick when a plain button is clicked', () => {
    const onClick = jest.fn();
    render(
      <BaseButton
        text="Click"
        onClick={onClick}
        sizeClasses={sizeClasses}
        baseClasses={baseClasses}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables a plain button and adds disabled styling when isDisabled', () => {
    render(
      <BaseButton text="Click" isDisabled sizeClasses={sizeClasses} baseClasses={baseClasses} />
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.className).toContain('opacity-60');
  });

  it('prevents navigation and skips onClick on a disabled link', () => {
    const onClick = jest.fn();
    render(
      <BaseButton
        text="Go"
        href="/dashboard"
        onClick={onClick}
        isDisabled
        sizeClasses={sizeClasses}
        baseClasses={baseClasses}
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick on an enabled link click', () => {
    const onClick = jest.fn();
    render(
      <BaseButton
        text="Go"
        href="/dashboard"
        onClick={onClick}
        sizeClasses={sizeClasses}
        baseClasses={baseClasses}
      />
    );
    fireEvent.click(screen.getByRole('link'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('navigates normally on an enabled link with no onClick handler', () => {
    render(
      <BaseButton text="Go" href="/dashboard" sizeClasses={sizeClasses} baseClasses={baseClasses} />
    );
    const link = screen.getByRole('link');
    expect(() => fireEvent.click(link)).not.toThrow();
  });

  it('sets pointer interaction position custom properties on pointerdown/pointermove', () => {
    render(<BaseButton text="Click" sizeClasses={sizeClasses} baseClasses={baseClasses} />);
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { clientX: 10, clientY: 20 });
    fireEvent.pointerMove(button, { clientX: 15, clientY: 25 });
    expect(button.style.getPropertyValue('--yc-button-x')).not.toBe('');
    expect(button.style.getPropertyValue('--yc-button-y')).not.toBe('');
  });
});
