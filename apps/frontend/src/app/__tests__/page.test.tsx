import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  MarketingShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-shell">{children}</div>
  ),
}));

jest.mock('@/app/features/marketing/pages/Home/Home', () => ({
  __esModule: true,
  Home: () => <div data-testid="home-mock">Home Mock</div>,
}));

import Home, * as HomeModule from '@/app/(routes)/(public)/page';

describe('Home page (root route)', () => {
  test('renders the Home marketing page inside the shell', () => {
    render(<Home />);
    expect(screen.getByTestId('marketing-shell')).toBeInTheDocument();
    expect(screen.getByTestId('home-mock')).toBeInTheDocument();
  });

  test('exposes page metadata with the brand suffix', () => {
    expect(HomeModule.metadata?.title).toContain('Yosemite Crew');
  });

  test('default export is a function', () => {
    expect(typeof Home).toBe('function');
    expect(typeof HomeModule.default).toBe('function');
  });
});
