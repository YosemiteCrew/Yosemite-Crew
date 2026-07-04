import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock('@/app/features/marketing/site', () => ({
  HeroVideo: () => <div data-testid="hero-video" />,
  Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Spotlight: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReleasePill: ({ label, version }: { label: string; version: string }) => (
    <div data-testid="release-pill">
      {label} {version}
    </div>
  ),
  useMagnet: () => ({ current: null }),
  HERO_VIDEOS: { petParents: 'petParents.mp4' },
  APP_STORE_URL: 'https://apps.apple.com/app',
  PLAY_STORE_URL: 'https://play.google.com/store',
}));

import { PetParents } from '@/app/features/marketing/pages/PetParents/PetParents';

describe('PetParents page', () => {
  test('renders the hero with release pill, headline and store badges', () => {
    render(<PetParents />);

    expect(screen.getByTestId('release-pill')).toHaveTextContent('Mobile app v1.2 beta');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent("companion's");
    expect(heading).toHaveTextContent('whole');
    expect(heading).toHaveTextContent('story.');
    expect(screen.getByText('App Store')).toBeInTheDocument();
    expect(screen.getByText('Google Play')).toBeInTheDocument();

    const appleLink = screen.getByText('App Store').closest('a');
    expect(appleLink).toHaveAttribute('href', 'https://apps.apple.com/app');
    expect(appleLink).toHaveAttribute('target', '_blank');
    expect(appleLink).toHaveAttribute('rel', 'noopener');
  });

  test('renders the hero video layer and phone mockup content', () => {
    render(<PetParents />);

    expect(screen.getByTestId('hero-video')).toBeInTheDocument();
    expect(screen.getByText('Your companions')).toBeInTheDocument();
    expect(screen.getByText('Next appointment')).toBeInTheDocument();
    expect(screen.getByText('Bella · Dr. Weber · Alpenblick')).toBeInTheDocument();
    expect(screen.getByText('Sent to the new clinic')).toBeInTheDocument();
  });

  test('renders the dark ownership story with the pink punchline', () => {
    render(<PetParents />);

    expect(screen.getByText('Whose history is it, anyway')).toBeInTheDocument();
    expect(
      screen.getByText(/Your companion is yours\. The record of their life should be too\./i)
    ).toBeInTheDocument();
  });

  test('renders every feature card', () => {
    render(<PetParents />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Less chasing. More knowing.' })
    ).toBeInTheDocument();
    expect(screen.getByText('Everyone who cares for them, in one place')).toBeInTheDocument();
    expect(screen.getByText('Share the care with your household')).toBeInTheDocument();
    expect(screen.getByText('Book without the phone call')).toBeInTheDocument();
    expect(screen.getByText('Ask your vet, keep the thread')).toBeInTheDocument();
    expect(screen.getByText("Reminders you don't hold in your head")).toBeInTheDocument();
    expect(screen.getByText('Report a reaction, protect the next animal')).toBeInTheDocument();
    expect(screen.getByText('Notice trouble sooner')).toBeInTheDocument();
    expect(screen.getByText('See what they really cost')).toBeInTheDocument();
    expect(screen.getByText('Every document in one drawer')).toBeInTheDocument();
  });

  test('renders the closing CTA with the two calls to action', () => {
    render(<PetParents />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Get the app. Keep the record.' })
    ).toBeInTheDocument();

    const getApp = screen.getByRole('link', { name: /Get the app/i });
    expect(getApp).toHaveAttribute('href', '/signup');

    const clinic = screen.getByRole('link', { name: 'I run a clinic' });
    expect(clinic).toHaveAttribute('href', '/pet-businesses');
  });
});
