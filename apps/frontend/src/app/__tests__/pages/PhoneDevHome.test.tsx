import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('@/app/ui/icons/Icon', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

import PhoneDevHome from '@/app/features/developers/pages/DeveloperPortalHome/PhoneDevHome';

const RECENT_ACTIVITY = [
  { method: 'POST', path: '/fhir/Appointment', status: '201', ok: true },
  { method: 'GET', path: '/fhir/Patient?name=poppy', status: '200', ok: true },
  { method: 'POST', path: '/fhir/DocumentReference', status: '422', ok: false },
];

const renderPhone = (displayName = 'Ada Lovelace') =>
  render(<PhoneDevHome displayName={displayName} recentActivity={RECENT_ACTIVITY} />);

describe('PhoneDevHome', () => {
  test('renders the greeting with the display name as the page heading', () => {
    renderPhone();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Welcome back,');
    expect(heading).toHaveTextContent('Ada Lovelace');
  });

  test('renders the platform-status metrics card', () => {
    renderPhone();
    expect(screen.getByText('Platform status')).toBeInTheDocument();
    // The label now reflects the real status feed. jsdom has no fetch, so
    // the hook degrades to `unknown` rather than asserting health.
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('Requests · 24h')).toBeInTheDocument();
    expect(screen.getByText('4,182')).toBeInTheDocument();
    expect(screen.getByText('P95')).toBeInTheDocument();
    expect(screen.getByText('212 ms')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('0.2%')).toBeInTheDocument();
  });

  test('renders the two nav tiles linking to keys and plugins', () => {
    renderPhone();
    const keys = screen.getByText('API keys').closest('a');
    expect(keys).toHaveAttribute('href', '/developers/api-keys');
    expect(within(keys as HTMLElement).getByText('2 active · 1 sandbox')).toBeInTheDocument();

    const plugins = screen.getByText('Plugins').closest('a');
    expect(plugins).toHaveAttribute('href', '/developers/plugins');
    expect(
      within(plugins as HTMLElement).getByText('1 published · 1 in review')
    ).toBeInTheDocument();
  });

  test('renders the in-review plugin card with a review badge', () => {
    renderPhone();
    expect(screen.getByText('Anesthesia monitor sync')).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByText(/review usually takes 2–3 working days/i)).toBeInTheDocument();
  });

  test('renders the recent-requests log with each supplied entry', () => {
    renderPhone();
    expect(screen.getByText('Recent requests')).toBeInTheDocument();
    expect(screen.getByText(/POST \/fhir\/Appointment/)).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
    expect(screen.getByText(/POST \/fhir\/DocumentReference/)).toBeInTheDocument();
    expect(screen.getByText('422')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(RECENT_ACTIVITY.length);
  });

  test('renders the desktop-only website-builder note', () => {
    renderPhone();
    expect(
      screen.getByText(/The website builder is desktop-only\. Docs read great here though\./i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('icon-ion:desktop-outline')).toBeInTheDocument();
  });

  test('falls back to the provided display name string', () => {
    renderPhone('test@example.com');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('test@example.com');
  });

  test('has no axe violations', async () => {
    const { container } = renderPhone();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
