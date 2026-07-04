import React from 'react';
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
    expect(screen.getByText(/A FHIR-native API, a plugin marketplace/i)).toBeInTheDocument();

    const readDocs = screen.getByRole('link', { name: /Read the docs/i });
    expect(readDocs).toHaveAttribute('href', '/developers/signup');

    const cloneRepo = screen.getByRole('link', { name: /Clone the repo/i });
    expect(cloneRepo).toHaveAttribute('href', 'https://github.com/YosemiteCrew/Yosemite-Crew');
    expect(cloneRepo).toHaveAttribute('target', '_blank');
    expect(cloneRepo).toHaveAttribute('rel', 'noopener');
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
    expect(screen.getByText('One animal, many authorities.')).toBeInTheDocument();
    expect(screen.getByText('FHIR-native, all the way down.')).toBeInTheDocument();
    expect(screen.getByText('MedicationRequest')).toBeInTheDocument();
    expect(screen.getByText('DiagnosticReport')).toBeInTheDocument();
  });

  it('renders the marketplace plugin rows', () => {
    expect(screen.getByText('Publish once. Reach every clinic.')).toBeInTheDocument();
    expect(screen.getByText('AI Scribe')).toBeInTheDocument();
    expect(screen.getByText('Triage Agent')).toBeInTheDocument();
    expect(screen.getByText('Voice Reminders')).toBeInTheDocument();
    expect(screen.getByText('Your plugin here')).toBeInTheDocument();

    const portalLink = screen.getByRole('link', { name: /Open the developer portal/i });
    expect(portalLink).toHaveAttribute('href', '/developers/signup');
  });

  it('renders the economics section with a 0% platform cut and blue keep-all copy', () => {
    expect(screen.getByText('The economics')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Keep all of it.')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('every euro is yours')).toBeInTheDocument();
    expect(screen.getByText('Bring your own model')).toBeInTheDocument();
    expect(screen.getByText('Sell to every clinic')).toBeInTheDocument();
    expect(screen.getByText('Paid direct')).toBeInTheDocument();
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
    expect(starLink).toHaveAttribute('rel', 'noopener');

    const portalLinks = screen.getAllByRole('link', { name: /Developer portal/i });
    expect(portalLinks.length).toBeGreaterThan(0);
    expect(portalLinks[portalLinks.length - 1]).toHaveAttribute('href', '/developers/signup');
  });

  it('marks headings with the Newsreader serif display font', () => {
    const heading = screen.getByRole('heading', { name: 'One animal, many authorities.' });
    expect(heading.style.fontFamily).toContain('var(--font-newsreader)');
  });

  it('contains no em dashes in visible copy', () => {
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('—');
  });

  it('renders the FHIR response codes with cyan keys', () => {
    // Hero Patient response key uses the cream-cyan text tone.
    const heroKey = screen.getByText('"species"');
    expect(heroKey.style.color).toBe('rgb(56, 204, 216)');

    // The bundle.json block keys use the dark-section cyan fill.
    const bundleKeys = within(document.body).getAllByText('"authority"');
    expect(bundleKeys.length).toBeGreaterThanOrEqual(2);
    bundleKeys.forEach((key) => {
      expect(key.style.color).toBe('rgb(92, 225, 230)');
    });
  });
});
