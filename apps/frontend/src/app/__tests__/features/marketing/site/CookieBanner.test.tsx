import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { CookieBanner } from '@/app/features/marketing/site/CookieBanner';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const setReducedMotion = (reduced: boolean) => {
  (globalThis as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue({
    matches: reduced,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
};

describe('CookieBanner', () => {
  beforeEach(() => {
    setReducedMotion(false);
    globalThis.localStorage.clear();
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows the notice with both choices when no consent is stored', () => {
    render(<CookieBanner />);
    expect(screen.getByText('A note on cookies')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject non-essential' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
      'href',
      '/privacy-policy'
    );
  });

  it('does not render once a decision is already stored', () => {
    globalThis.localStorage.setItem('yc-cookie-consent', 'all');
    render(<CookieBanner />);
    expect(screen.queryByText('A note on cookies')).not.toBeInTheDocument();
  });

  it('persists "all" and dismisses on Accept', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(globalThis.localStorage.getItem('yc-cookie-consent')).toBe('all');
    expect(screen.queryByText('A note on cookies')).not.toBeInTheDocument();
  });

  it('persists "essential" and dismisses on Reject', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject non-essential' }));
    expect(globalThis.localStorage.getItem('yc-cookie-consent')).toBe('essential');
    expect(screen.queryByText('A note on cookies')).not.toBeInTheDocument();
  });

  it('renders immediately visible under reduced motion', () => {
    setReducedMotion(true);
    render(<CookieBanner />);
    expect(screen.getByText('A note on cookies')).toBeInTheDocument();
  });

  it('still works when localStorage is unavailable (private mode)', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<CookieBanner />);
    expect(screen.getByText('A note on cookies')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(screen.queryByText('A note on cookies')).not.toBeInTheDocument();
  });
});
