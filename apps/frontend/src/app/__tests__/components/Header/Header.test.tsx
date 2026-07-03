import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/app/ui/layout/Header/GuestHeader/GuestHeader', () => () => (
  <div data-testid="guest-header">Guest Header</div>
));

jest.mock('@/app/ui/layout/Header/UserHeader/UserHeader', () => () => (
  <div data-testid="user-header">User Header</div>
));

import Header from '@/app/ui/layout/Header/Header';

const setWindowScrollY = (value: number) => {
  Object.defineProperty(globalThis.window, 'scrollY', {
    value,
    configurable: true,
  });
};

describe('Header', () => {
  beforeEach(() => {
    setWindowScrollY(0);
    jest
      .spyOn(globalThis.window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders GuestHeader by default', () => {
    const { container } = render(<Header />);

    expect(screen.getByTestId('guest-header')).toBeInTheDocument();
    expect(screen.queryByTestId('user-header')).not.toBeInTheDocument();

    const header = container.querySelector('header');
    expect(header).toHaveClass('yc-liquid-header-shell');
    expect(header).toHaveClass('yc-guest-header-shell');
    expect(header).toHaveClass('sticky');
  });

  it('renders UserHeader when user is true', () => {
    const { container } = render(<Header user />);

    expect(screen.getByTestId('user-header')).toBeInTheDocument();
    expect(screen.queryByTestId('guest-header')).not.toBeInTheDocument();

    const header = container.querySelector('header');
    expect(header).toHaveClass('yc-liquid-header-shell');
    expect(header).toHaveClass('yc-user-header-shell');
    expect(header).toHaveClass('sticky');
  });

  it('floats through the first section, then docks once scrolled past ~60% of the viewport', async () => {
    Object.defineProperty(globalThis.window, 'innerHeight', {
      value: 800,
      configurable: true,
    });
    // threshold = round(800 * 0.6) = 480px

    const { container } = render(<Header />);
    const header = container.querySelector('header');

    // Scrolled, but still within the first section — stays a floating pill.
    // This works regardless of page structure (no dependence on the first
    // section's height), so every public page transforms consistently.
    setWindowScrollY(400);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
    expect(header).not.toHaveClass('yc-public-header-docked');

    // Scrolled past the threshold — docks into the full-width bar.
    setWindowScrollY(520);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
    await waitFor(() => expect(header).toHaveClass('yc-public-header-docked'));

    // Back above the threshold — reverts to the floating pill.
    setWindowScrollY(400);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
    await waitFor(() => expect(header).not.toHaveClass('yc-public-header-docked'));
  });
});
