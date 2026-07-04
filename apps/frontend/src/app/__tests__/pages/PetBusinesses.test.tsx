import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt = '', ...props }: any) => {
    const { width: _w, height: _h, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...rest} />;
  },
}));

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
  HERO_VIDEOS: { petBusinesses: 'petBusinesses.mp4' },
  RELEASES_LATEST_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/latest',
}));

import { PetBusinesses } from '@/app/features/marketing/pages/PetBusinesses/PetBusinesses';

describe('PetBusinesses page', () => {
  test('renders the hero with release pill, word-by-word headline and CTAs', () => {
    render(<PetBusinesses />);

    expect(screen.getByTestId('release-pill')).toHaveTextContent('Platform PIMS v2.0 beta');

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('The');
    expect(heading).toHaveTextContent('practice,');
    expect(heading).toHaveTextContent('one');
    expect(heading).toHaveTextContent('screen.');

    expect(
      screen.getByText(/the whole clinic in one system instead of six tabs/i)
    ).toBeInTheDocument();

    const getStarted = screen.getAllByRole('link', { name: /Get started free/i })[0];
    expect(getStarted).toHaveAttribute('href', '/signup');

    const walkthroughs = screen.getAllByRole('link', { name: 'Book a walkthrough' });
    expect(walkthroughs[0]).toHaveAttribute('href', '/contact-us');
  });

  test('renders the hero video layer and the desktop app download buttons', () => {
    render(<PetBusinesses />);

    expect(screen.getByTestId('hero-video')).toBeInTheDocument();

    const mac = screen.getByRole('link', { name: 'Download the macOS desktop app' });
    expect(mac).toHaveAttribute(
      'href',
      'https://github.com/YosemiteCrew/Yosemite-Crew/releases/latest'
    );
    expect(mac).toHaveAttribute('target', '_blank');
    expect(mac).toHaveAttribute('rel', 'noopener');

    const win = screen.getByRole('link', { name: 'Download the Windows desktop app' });
    expect(win).toHaveAttribute(
      'href',
      'https://github.com/YosemiteCrew/Yosemite-Crew/releases/latest'
    );
    expect(win).toHaveAttribute('target', '_blank');
    expect(win).toHaveAttribute('rel', 'noopener');
  });

  test('renders the PIMS window mockup content', () => {
    render(<PetBusinesses />);

    expect(screen.getByText('alpenblick.yosemitecrew.app')).toBeInTheDocument();
    expect(screen.getByText("Today's schedule")).toBeInTheDocument();
    expect(screen.getByText('Bella · Labrador')).toBeInTheDocument();
    expect(screen.getByText('Miso · Shorthair')).toBeInTheDocument();
    expect(screen.getByText('Fjord · Icelandic Horse')).toBeInTheDocument();
    expect(screen.getByText('Wifi dropped, still typing')).toBeInTheDocument();
  });

  test('renders the dark notebook section with the blue punchline', () => {
    render(<PetBusinesses />);

    expect(screen.getByText('The real incumbent')).toBeInTheDocument();
    expect(
      screen.getByText(/We built the software so you can finally close the notebook\./i)
    ).toBeInTheDocument();
  });

  test('renders the records / SOAP feature with its checklist', () => {
    render(<PetBusinesses />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'One patient. Every slice, in one place.' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('SOAP notes that write to the timeline, not a silo')
    ).toBeInTheDocument();
    expect(screen.getByText('Bloodwork panel, all clear')).toBeInTheDocument();
    expect(screen.getByText('Hip X-ray · mild arthritis')).toBeInTheDocument();
  });

  test('renders the finance feature with the zero-fee message and pricing link', () => {
    render(<PetBusinesses />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'You pay your vet. Your statement should say your vet.',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('We take zero cut of your payments')).toBeInTheDocument();
    expect(screen.getByText('Invoice · #YC-2041')).toBeInTheDocument();

    const pricing = screen.getByRole('link', { name: /See how pricing works/i });
    expect(pricing).toHaveAttribute('href', '/pricing');
  });

  test('renders the offline-first band with its four cards', () => {
    render(<PetBusinesses />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'The wifi blinks mid-emergency. Nothing you typed is lost.',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Works offline')).toBeInTheDocument();
    expect(screen.getByText("Syncs when it's back")).toBeInTheDocument();
    expect(screen.getByText('Data stays home')).toBeInTheDocument();
    // "Leaving is free" also appears as a caption elsewhere on the page.
    expect(screen.getAllByText('Leaving is free').length).toBeGreaterThan(0);
  });

  test('renders the clinical calculators section', () => {
    render(<PetBusinesses />);

    expect(
      screen.getByRole('heading', { level: 2, name: "The math you don't want to get wrong." })
    ).toBeInTheDocument();
    expect(screen.getByText('CRI')).toBeInTheDocument();
    expect(screen.getByText('IRIS stage')).toBeInTheDocument();
    expect(screen.getByText('Anion gap')).toBeInTheDocument();
    expect(
      screen.getByText(/Decision support, not a substitute for clinical judgement/i)
    ).toBeInTheDocument();
  });

  test('renders every module card', () => {
    render(<PetBusinesses />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Everything the clinic runs on.' })
    ).toBeInTheDocument();
    // Titles shared with the hero sidebar appear twice; assert on unique module copy.
    expect(screen.getByText(/A calendar the whole team trusts/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Stock and controlled medicines tracked in the system/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Talk to pet parents and to each other in one thread/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/One screen of what matters today/i)).toBeInTheDocument();
    // Titles unique to the modules grid.
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Team and roles')).toBeInTheDocument();
    expect(screen.getByText('Templates & forms')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Universal search')).toBeInTheDocument();
  });

  test('renders the closing CTA with both actions', () => {
    render(<PetBusinesses />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Close the notebook.' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Self-host free forever, or let us run it pay-as-you-go/i)
    ).toBeInTheDocument();
  });
});
