import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid={`primary-${text}`}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/icons/Icon', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => (
    <span data-testid="species-photo" data-src={src} data-alt={alt} />
  ),
}));

import DeveloperPlugins from '@/app/features/developers/pages/DeveloperPlugins/DeveloperPlugins';

describe('DeveloperPlugins page', () => {
  test('renders the header, preview note and submit action', () => {
    render(<DeveloperPlugins />);
    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Plugins' })).toBeInTheDocument();
    expect(
      screen.getByText(/plugin catalog and submission flow are coming soon/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('primary-Submit a plugin')).toHaveAttribute('href', '/contact-us');
  });

  test('renders three sample cards, every one badged as a sample', () => {
    render(<DeveloperPlugins />);
    expect(screen.getByRole('heading', { name: 'Lab result bridge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clinical reference' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monitor sync' })).toBeInTheDocument();
    expect(screen.getAllByText('Sample')).toHaveLength(3);
  });

  test('claims no installs, and names no third party as having one', () => {
    // Nothing counts installs - there is no plugin model and no plugin
    // endpoint - and two of these named real companies.
    render(<DeveloperPlugins />);
    expect(screen.queryByText(/Installed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/412 clinics/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,208 clinics/)).not.toBeInTheDocument();
    expect(screen.queryByText(/IDEXX/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MSD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jonas Timm/)).not.toBeInTheDocument();
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });

  test('says on the page that the cards are illustrations', () => {
    render(<DeveloperPlugins />);
    expect(
      screen.getByText(/cards below are illustrations, not installed integrations/i)
    ).toBeInTheDocument();
  });

  test('renders the website builder promo card linking to the builder route', () => {
    render(<DeveloperPlugins />);
    expect(screen.getByText(/A clinic website with booking built in/i)).toBeInTheDocument();
    const openBuilder = screen.getByText('Open builder').closest('a');
    expect(openBuilder).toHaveAttribute('href', '/developers/website-builder');
    const seeTemplates = screen.getByText('See templates').closest('a');
    expect(seeTemplates).toHaveAttribute('href', '/developers/website-builder');
    expect(screen.getByText('alpenblick.vet')).toBeInTheDocument();
    expect(screen.getByText(/Bookings sync to the PIMS in real time/i)).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    const { container } = render(<DeveloperPlugins />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
