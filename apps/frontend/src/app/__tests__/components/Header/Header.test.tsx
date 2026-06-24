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

  it('floats through the first section, then docks into the full-width glass bar past it', async () => {
    const main = document.createElement('main');
    main.className = 'yc-public-page';
    const SECTION_ABSOLUTE_BOTTOM = 600;
    const firstSection = document.createElement('section');
    // getBoundingClientRect is viewport-relative: bottom shrinks as the page scrolls.
    firstSection.getBoundingClientRect = jest.fn(() => ({
      bottom: SECTION_ABSOLUTE_BOTTOM - globalThis.window.scrollY,
      height: 600,
      left: 0,
      right: 1200,
      top: -globalThis.window.scrollY,
      width: 1200,
      x: 0,
      y: -globalThis.window.scrollY,
      toJSON: jest.fn(),
    }));
    main.appendChild(firstSection);
    document.body.appendChild(main);

    const { container } = render(<Header />);
    const header = container.querySelector('header');

    // Scrolled, but still within the first section — stays a floating pill.
    setWindowScrollY(400);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
    expect(header).not.toHaveClass('yc-public-header-docked');

    // Scrolled past the first section — docks into the full-width bar.
    setWindowScrollY(620);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
    await waitFor(() => expect(header).toHaveClass('yc-public-header-docked'));

    // Back within the first section — reverts to the floating pill.
    setWindowScrollY(400);
    act(() => {
      fireEvent.scroll(globalThis.window);
    });
    await waitFor(() => expect(header).not.toHaveClass('yc-public-header-docked'));
  });
});
