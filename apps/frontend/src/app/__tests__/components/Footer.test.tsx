/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Footer from '@/app/ui/widgets/Footer/Footer';

jest.mock('next/image', () => {
  const MockImage = (props: any) => {
    return <img {...props} alt={props.alt} />;
  };
  MockImage.displayName = 'MockNextImage';
  return {
    __esModule: true,
    default: MockImage,
  };
});

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
  MockLink.displayName = 'MockNextLink';
  return MockLink;
});

jest.mock('framer-motion', () => {
  const motion = {
    footer: (props: any) => <footer {...props} />,
    div: (props: any) => <div {...props} />,
    nav: (props: any) => <nav {...props} />,
  };

  return {
    ...jest.requireActual('framer-motion'),
    useInView: () => true,
    motion: motion,
  };
});

const mockPlatformStatusFetch = (status?: string) => {
  if (status === undefined) {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as jest.Mock;
    return;
  }

  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ status }),
  }) as jest.Mock;
};

describe('Footer Component', () => {
  const renderFooter = (status?: string) => {
    mockPlatformStatusFetch(status);
    render(<Footer />);
  };

  it('should render the main logo and certification images', () => {
    renderFooter();

    expect(screen.getByAltText('Yosemite Crew Logo')).toBeInTheDocument();
    expect(screen.getByAltText('GDPR')).toBeInTheDocument();
    expect(screen.getByAltText('SOC2')).toBeInTheDocument();
    expect(screen.getByAltText('FHIR')).toBeInTheDocument();
    expect(screen.getByAltText('ISO')).toBeInTheDocument();
  });

  it('should render all navigation section titles', () => {
    renderFooter();

    expect(screen.getByText('Developers')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
  });

  it('should render all navigation links with correct href attributes', () => {
    renderFooter();

    const gettingStartedLink = screen.getByRole('link', { name: 'Developer portal' });
    expect(gettingStartedLink).toBeInTheDocument();
    expect(gettingStartedLink).toHaveAttribute('href', '/developers/signup');

    const discordLink = screen.getByRole('link', { name: 'Discord' });
    expect(discordLink).toBeInTheDocument();
    expect(discordLink).toHaveAttribute('href', 'https://discord.gg/yosemitecrew');

    const aboutUsLink = screen.getByRole('link', { name: 'About us' });
    expect(aboutUsLink).toBeInTheDocument();
    expect(aboutUsLink).toHaveAttribute('href', '/about');
  });

  it('should render the copyright and contact information', () => {
    renderFooter();

    expect(screen.getByText('© 2026 DuneXploration UG (haftungsbeschränkt)')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Yosemite Crew™ is a trademark of DuneXploration UG (haftungsbeschränkt) in the EU, Australia, Great Britain, India, New Zealand, and the USA.'
      )
    ).toBeInTheDocument();

    const emailLink = screen.getByRole('link', { name: 'support@yosemitecrew.com' });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute('href', 'mailto:support@yosemitecrew.com');

    const phoneLink = screen.getByRole('link', { name: '+49 152 277 63275' });
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink).toHaveAttribute('href', 'tel:+4915227763275');
  });

  it('should render the platform status link', async () => {
    renderFooter('operational');

    const statusLink = await screen.findByRole('link', { name: 'All systems operational' });

    expect(statusLink).toHaveAttribute('href', 'https://yosemite-crew.openstatus.dev/');
    expect(statusLink).toHaveAttribute('target', '_blank');
    expect(statusLink).toHaveClass('platform-status-link-success');
  });
});
