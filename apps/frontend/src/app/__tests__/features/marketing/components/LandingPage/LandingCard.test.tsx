import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LandingCard from '@/app/features/marketing/components/LandingPage/LandingCard';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: any) => <div role="img" aria-label={alt} {...props} />,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, href }: any) => <a href={href}>{text}</a>,
}));

jest.mock('@/app/ui/widgets/Animations/TextFade', () => ({
  TextFade: ({ children }: any) => <div>{children}</div>,
}));

describe('LandingCard', () => {
  it('renders marketing card content and CTA link', () => {
    const { container } = render(
      <LandingCard
        item={
          {
            target: 'Clinics',
            title: 'All-in-one workflow',
            description: 'Manage appointments and records',
            href: '/learn-more',
            image: '/assets/hero.png',
            background: 'linear-gradient(red, blue)',
          } as any
        }
      />
    );

    expect(screen.getByText('Clinics')).toBeInTheDocument();
    expect(screen.getByText('All-in-one workflow')).toBeInTheDocument();
    expect(screen.getByText('Manage appointments and records')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '/learn-more');
    expect(container.querySelector('[aria-label=\"landingimg1\"]')).toBeInTheDocument();
  });
});
