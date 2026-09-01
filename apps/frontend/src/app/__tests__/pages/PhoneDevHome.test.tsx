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

const renderPhone = (displayName = 'Ada Lovelace') =>
  render(<PhoneDevHome displayName={displayName} />);

describe('PhoneDevHome', () => {
  test('renders the greeting with the display name as the page heading', () => {
    renderPhone();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Welcome back,');
    expect(heading).toHaveTextContent('Ada Lovelace');
  });

  test('renders the live platform-status pill', () => {
    renderPhone();
    expect(screen.getByText('Platform status')).toBeInTheDocument();
    // The label reflects the real status feed. jsdom has no fetch, so the hook
    // degrades to `unknown` rather than asserting health.
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
  });

  test('states no throughput, latency or error-rate figures', () => {
    // These were three fixed strings with nothing measuring them, and the
    // request count did not even agree with the desktop card's.
    renderPhone();
    expect(screen.queryByText('Requests · 24h')).not.toBeInTheDocument();
    expect(screen.queryByText('4,182')).not.toBeInTheDocument();
    expect(screen.queryByText('P95')).not.toBeInTheDocument();
    expect(screen.queryByText('212 ms')).not.toBeInTheDocument();
    expect(screen.queryByText('Errors')).not.toBeInTheDocument();
    expect(screen.queryByText('0.2%')).not.toBeInTheDocument();
  });

  test('renders nav tiles to keys and billing without inventing counts', () => {
    renderPhone();
    const keys = screen.getByText('API keys').closest('a');
    expect(keys).toHaveAttribute('href', '/developers/api-keys');
    expect(within(keys as HTMLElement).getByText('Create and revoke keys')).toBeInTheDocument();
    expect(screen.queryByText('2 active · 1 sandbox')).not.toBeInTheDocument();

    const billing = screen.getByText('Billing').closest('a');
    expect(billing).toHaveAttribute('href', '/developers/billing');
    expect(within(billing as HTMLElement).getByText('Plan and API usage')).toBeInTheDocument();
  });

  test('shows no plugin, because the platform has no plugin model', () => {
    renderPhone();
    expect(screen.queryByText('Anesthesia monitor sync')).not.toBeInTheDocument();
    expect(screen.queryByText('In review')).not.toBeInTheDocument();
    expect(screen.queryByText(/review usually takes/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Plugins')).not.toBeInTheDocument();
  });

  test('shows no request log, because nothing records one', () => {
    renderPhone();
    expect(screen.queryByText('Recent requests')).not.toBeInTheDocument();
    expect(screen.queryByText(/\/fhir\/Appointment/)).not.toBeInTheDocument();
    expect(screen.queryByText('422')).not.toBeInTheDocument();
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
