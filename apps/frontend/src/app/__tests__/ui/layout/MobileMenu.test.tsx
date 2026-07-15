import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileMenu from '@/app/ui/layout/Header/MobileMenu';

describe('MobileMenu', () => {
  it('renders children inside a nav element', () => {
    render(
      <MobileMenu isOpen>
        <span>Menu content</span>
      </MobileMenu>
    );
    expect(screen.getByText('Menu content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('applies open styling and is not hidden/inert when isOpen is true', () => {
    render(
      <MobileMenu isOpen id="mobile-nav">
        <span>Menu content</span>
      </MobileMenu>
    );
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('opacity-100');
    expect(nav).not.toHaveAttribute('hidden');
    expect(nav.id).toBe('mobile-nav');
  });

  it('applies closed styling and is hidden/inert when isOpen is false', () => {
    render(
      <MobileMenu isOpen={false}>
        <span>Menu content</span>
      </MobileMenu>
    );
    const nav = document.querySelector('nav')!;
    expect(nav.className).toContain('opacity-0');
    expect(nav).toHaveAttribute('hidden');
  });

  it('calls onClose when Escape is pressed while open', () => {
    const onClose = jest.fn();
    render(
      <MobileMenu isOpen onClose={onClose}>
        <span>Menu content</span>
      </MobileMenu>
    );
    fireEvent.keyDown(globalThis.window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for a non-Escape key', () => {
    const onClose = jest.fn();
    render(
      <MobileMenu isOpen onClose={onClose}>
        <span>Menu content</span>
      </MobileMenu>
    );
    fireEvent.keyDown(globalThis.window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not attach a listener (and does not throw on Escape) when isOpen is false', () => {
    const onClose = jest.fn();
    render(
      <MobileMenu isOpen={false} onClose={onClose}>
        <span>Menu content</span>
      </MobileMenu>
    );
    fireEvent.keyDown(globalThis.window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not throw when open with no onClose handler and Escape is pressed', () => {
    render(
      <MobileMenu isOpen>
        <span>Menu content</span>
      </MobileMenu>
    );
    expect(() => fireEvent.keyDown(globalThis.window, { key: 'Escape' })).not.toThrow();
  });
});
