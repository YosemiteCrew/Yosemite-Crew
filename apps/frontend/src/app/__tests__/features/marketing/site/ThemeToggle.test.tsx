import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const toggle = jest.fn();
let mockTheme: 'light' | 'dark' = 'light';
jest.mock('@/app/features/marketing/site/useTheme', () => ({
  useTheme: () => ({ theme: mockTheme, toggle }),
}));

import { ThemeToggle } from '@/app/features/marketing/site/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    toggle.mockClear();
    mockTheme = 'light';
  });

  it('shows the "switch to dark" affordance in light mode', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to dark theme/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('title', 'Switch to dark');
  });

  it('shows the "switch to light" affordance in dark mode', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to light theme/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('title', 'Switch to light');
  });

  it('flips the theme on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('merges style overrides', () => {
    render(<ThemeToggle style={{ width: 40, height: 40 }} />);
    expect(screen.getByRole('button')).toHaveStyle({ width: '40px' });
  });
});
