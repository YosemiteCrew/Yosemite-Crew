import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IoCalendarOutline } from 'react-icons/io5';

let starsValue: string | null = '2.4k';
jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useGithubStats: () => ({ stars: starsValue }),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextImageMock,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextLinkMock,
}));

import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site/AuthShell';

describe('AuthBrandContent', () => {
  beforeEach(() => {
    starsValue = '2.4k';
  });

  it('renders eyebrow, title, subtitle, points and the live star count', () => {
    render(
      <AuthBrandContent
        eyebrow="Open-source operating system for animal health"
        title={<>See the whole animal.</>}
        subtitle="The operating system veterinary clinics run on."
        points={[
          { icon: <IoCalendarOutline aria-hidden="true" />, text: 'Appointments on one screen.' },
        ]}
      />
    );
    expect(screen.getByText('Open-source operating system for animal health')).toBeInTheDocument();
    expect(screen.getByText('Appointments on one screen.')).toBeInTheDocument();
    expect(screen.getByText(/Star on GitHub · 2\.4k/)).toBeInTheDocument();
  });

  it('shows the plain GitHub label when the star count is unresolved', () => {
    starsValue = null;
    render(<AuthBrandContent eyebrow="e" title="t" subtitle="s" points={[]} />);
    expect(screen.getByText('Star on GitHub')).toBeInTheDocument();
  });
});

describe('AuthShell', () => {
  it('renders the brand panel, switch prompt, cert badges and the main form region', () => {
    render(
      <AuthShell
        brand={<div data-testid="brand-slot" />}
        topRight={<span>Already have an account?</span>}
      >
        <form aria-label="signup-form" />
      </AuthShell>
    );
    expect(screen.getByTestId('brand-slot')).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to home/i })).toBeInTheDocument();
    expect(screen.getByAltText('GDPR')).toBeInTheDocument();
    expect(screen.getByAltText('SOC 2')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('form', { name: 'signup-form' })).toBeInTheDocument();
  });
});
