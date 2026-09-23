import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DevelopersPage } from '@/app/features/marketing/pages/DevelopersPage/DevelopersPage';

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: React.forwardRef<HTMLAnchorElement, React.PropsWithChildren<{ href: string }>>(
      function MockLink({ href, children, ...rest }, ref) {
        return (
          <a ref={ref} href={href} {...rest}>
            {children}
          </a>
        );
      }
    ),
  };
});

jest.mock('@/app/features/marketing/site', () => {
  const React2 = jest.requireActual<typeof import('react')>('react');
  type WrapProps = React.PropsWithChildren<{ style?: React.CSSProperties; className?: string }>;
  return {
    __esModule: true,
    GITHUB_REPO_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew',
    useMagnet: () => React2.useRef(null),
    useParallax: () => React2.useRef(null),
    HeroGlow: () => null,
    InkAnnotate: ({ children }: any) => children,
    Reveal: ({ children, style, className }: WrapProps) =>
      React2.createElement('div', { style, className }, children),
    Tilt: ({ children, style, className }: WrapProps) =>
      React2.createElement('div', { style, className }, children),
    Spotlight: ({ children, style, className }: WrapProps) =>
      React2.createElement('section', { style, className }, children),
  };
});

describe('DevelopersPage', () => {
  beforeEach(() => {
    render(<DevelopersPage />);
  });

  it('renders the hero headline with the cyan em-word', () => {
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('clinic,')).toBeInTheDocument();
    expect(screen.getByText(/in\s*an\s*afternoon\./)).toBeInTheDocument();
  });

  it('renders the hero subcopy and primary CTAs', () => {
    expect(screen.getByText(/authenticated, read-only developer API/i)).toBeInTheDocument();

    const readDocs = screen.getByRole('link', { name: /Read the docs/i });
    expect(readDocs).toHaveAttribute('href', '/docs');

    const cloneRepo = screen.getByRole('link', { name: /Clone the repo/i });
    expect(cloneRepo).toHaveAttribute('href', 'https://github.com/YosemiteCrew/Yosemite-Crew');
    expect(cloneRepo).toHaveAttribute('target', '_blank');
    expect(cloneRepo).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the machine-user dark editorial statement', () => {
    expect(screen.getByText(/The user is changing/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /We built a warm face for the human and a clean, exposed spine for the machine\./i
      )
    ).toBeInTheDocument();
  });

  it('renders the FHIR-native API feature section', () => {
    expect(screen.getByText('Read the data plane that exists today.')).toBeInTheDocument();
    expect(screen.getByText('FHIR-native, all the way down.')).toBeInTheDocument();
    expect(screen.getByText('MedicationRequest')).toBeInTheDocument();
    expect(screen.getByText('DiagnosticReport')).toBeInTheDocument();
  });

  it('renders the marketplace plugin rows', () => {
    expect(screen.getByText('Build now. Distribute it yourself.')).toBeInTheDocument();
    expect(screen.getByText('AI Scribe')).toBeInTheDocument();
    expect(screen.getByText('Triage Agent')).toBeInTheDocument();
    expect(screen.getByText('Voice Reminders')).toBeInTheDocument();
    expect(screen.getByText('Your plugin here')).toBeInTheDocument();

    const portalLink = screen.getByRole('link', { name: /Open the developer portal/i });
    expect(portalLink).toHaveAttribute('href', '/developers/signup');

    const roadmapLink = screen.getByRole('link', { name: /Follow the capability roadmap/i });
    expect(roadmapLink).toHaveAttribute(
      'href',
      'https://github.com/YosemiteCrew/Yosemite-Crew/issues/1582'
    );
  });

  it('labels marketplace economics as planned', () => {
    expect(screen.getByText('The economics')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Choose your own terms.')).toBeInTheDocument();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
    expect(screen.getByText('terms to be confirmed')).toBeInTheDocument();
    expect(screen.getByText('Bring your own model')).toBeInTheDocument();
    expect(screen.getByText('Deploy practice by practice')).toBeInTheDocument();
    expect(screen.getByText('Choose your terms')).toBeInTheDocument();
  });

  it('renders the open source proof cards', () => {
    expect(
      screen.getByText('Read every line. Change any of it. Leave with all of it.')
    ).toBeInTheDocument();
    expect(screen.getByText('The whole repo')).toBeInTheDocument();
    expect(screen.getByText('FHIR standard')).toBeInTheDocument();
    expect(screen.getByText('Audit trail')).toBeInTheDocument();
    expect(screen.getByText('A real community')).toBeInTheDocument();
  });

  it('renders the closing CTA with GitHub and developer portal links', () => {
    const closing = screen.getByRole('heading', { name: 'Clone it tonight.' });
    expect(closing).toBeInTheDocument();

    const starLink = screen.getByRole('link', { name: /Star on GitHub/i });
    expect(starLink).toHaveAttribute('href', 'https://github.com/YosemiteCrew/Yosemite-Crew');
    expect(starLink).toHaveAttribute('target', '_blank');
    expect(starLink).toHaveAttribute('rel', 'noopener noreferrer');

    const portalLinks = screen.getAllByRole('link', { name: /Developer portal/i });
    expect(portalLinks.length).toBeGreaterThan(0);
    expect(portalLinks[portalLinks.length - 1]).toHaveAttribute('href', '/developers/signup');
  });

  it('marks headings with the Newsreader serif display font', () => {
    const heading = screen.getByRole('heading', { name: 'Read the data plane that exists today.' });
    expect(heading.style.fontFamily).toContain('var(--font-newsreader)');
  });

  it('contains no em dashes in visible copy', () => {
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('—');
  });

  it('renders the hero response with readable semantic tokens', () => {
    const heroKey = screen.getByText('"id"');
    expect(heroKey.style.color).toBe('var(--blue-text)');
    const heroResponse = heroKey.closest('div') as HTMLElement;
    expect(within(heroResponse).getByText('GET')).toHaveStyle({ color: 'var(--success-text)' });
    expect(within(heroResponse).getByText('200 OK')).toHaveStyle({ color: 'var(--success-text)' });

    // The bundle.json block keys sit on an always-dark code card, so they keep the
    // same cyan fill in both themes - now the --cyan token, which resolves to the
    // same #5ce1e6 in both the light and dark globals.css blocks.
    const bundleKeys = within(document.body).getAllByText('"authority"');
    expect(bundleKeys.length).toBeGreaterThanOrEqual(2);
    bundleKeys.forEach((key) => {
      expect(key.style.color).toBe('var(--cyan)');
    });
  });

  it('shows runnable setup and only mounted developer API routes', () => {
    const body = document.body.textContent ?? '';
    expect(body).toContain('git clone https://github.com/YosemiteCrew/Yosemite-Crew.git');
    expect(body).toContain('cd Yosemite-Crew');
    expect(body).toContain('pnpm install --frozen-lockfile');
    expect(body).toContain('pnpm --filter frontend run dev');
    expect(body).toContain('http://localhost:3000/docs');
    expect(body).toContain('/v1/developer/organizations');
    expect(screen.getAllByText('/v1/developer/organizations')).toHaveLength(2);
    expect(body).toContain('/v1/developer/usage');
    expect(body).toContain('/v1/developer/appointments');
    expect(body).not.toContain('/fhir/Patient/bella');
    expect(body).not.toContain('/fhir/subscriptions');
    expect(body).not.toContain('Publish once. Reach every clinic.');
    expect(body).not.toContain('typed SDKs');
  });

  it('keeps the Economics column titles on the --spot-ink token', () => {
    // EconColumn sits on the Economics section's always-dark --spot background,
    // reached via a sibling function rather than a direct JSX wrap - easy to get
    // wrong, so pinned here rather than trusted from reading the source alone.
    const title = screen.getByText('Bring your own model');
    expect(title.style.color).toBe('var(--spot-ink)');
  });
});

describe('marketplace row and hero glow read from real tokens', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/app/features/marketing/pages/DevelopersPage/DevelopersPage.tsx'),
    'utf8'
  );

  it('does not hardcode the Triage Agent icon colour as a frozen light-mode literal', () => {
    // --avatar-green-bg flips (a pale mint in light, a translucent dark-green
    // tint in dark), so the icon ink pinned against it must flip too - the
    // sibling amber row already reads var(--avatar-amber-ink) correctly.
    expect(source).not.toContain('iconColor="#006642"');
  });

  it('routes the Triage Agent icon colour through --avatar-green-ink', () => {
    expect(source).toContain('iconColor="var(--avatar-green-ink)"');
  });

  it('does not hardcode the second hero glow as a frozen rgba literal', () => {
    expect(source).not.toContain('color="rgba(130,175,236,0.08)"');
  });

  it('routes the second hero glow through --spot-blue via color-mix', () => {
    expect(source).toContain('color="color-mix(in srgb, var(--spot-blue) 8%, transparent)"');
  });
});
