import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('next/link', () => {
  const Link = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = 'Link';
  return { __esModule: true, default: Link };
});

jest.mock('react-icons/io5', () => ({
  IoArrowBack: () => <span data-testid="i-back" />,
  IoBulbOutline: () => <span data-testid="i-bulb" />,
  IoCopyOutline: () => <span data-testid="i-copy" />,
  IoLogoGithub: () => <span data-testid="i-github" />,
  IoSearchOutline: () => <span data-testid="i-search" />,
}));

import DeveloperDocs from '@/app/features/developers/pages/DeveloperDocs/DeveloperDocs';

const setClipboard = (writeText: ((v: string) => Promise<void>) | undefined) => {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
};

describe('DeveloperDocs reader', () => {
  afterEach(() => setClipboard(undefined));

  it('renders the reader chrome and the Appointments seed article by default', () => {
    render(<DeveloperDocs />);

    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to portal/i })).toHaveAttribute(
      'href',
      '/developers/home'
    );
    const openLink = screen.getByRole('link', { name: /Open full docs/i });
    expect(openLink).toHaveAttribute('href', '/dev-docs/index.html');
    expect(openLink).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /Edit on GitHub/i })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/fhir/v1/appointment/pms')).toBeInTheDocument();
    expect(screen.getByText('REQUEST · cURL')).toBeInTheDocument();
    expect(screen.getByText('RESPONSE · 201')).toBeInTheDocument();
  });

  it('switches the active article and hides the code samples for non-appointment docs', () => {
    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByText('REQUEST · cURL')).not.toBeInTheDocument();
    expect(screen.getByText(/This reference is seed content/)).toBeInTheDocument();
  });

  /*
   * These pages documented an API that did not exist: POST /v2/appointments
   * behind `Authorization: Bearer $YC_KEY`, badged "v2 - STABLE", plus a
   * Webhooks page. The mounted prefixes are /fhir, /v1, /public and /ap, no
   * route accepts an API key, and there is no WebhookSubscription model - so a
   * developer following the sample got a 404 from a documented stable endpoint.
   */
  it('does not document surfaces the API does not serve', () => {
    const { container } = render(<DeveloperDocs />);
    const text = container.textContent ?? '';

    expect(text).not.toContain('/v2/');
    expect(text).not.toContain('Bearer $YC_KEY');
    expect(screen.queryByRole('button', { name: 'Webhooks' })).not.toBeInTheDocument();
  });

  /* The pill and the copyable sample are separate strings, so they can drift.
     They did: the pill was corrected to /pms while the curl still posted to the
     collection root, which no route serves. Assert the sample itself. */
  it('gives a curl sample that targets a route that exists', () => {
    const { container } = render(<DeveloperDocs />);
    const text = container.textContent ?? '';
    expect(text).toContain('/fhir/v1/appointment/pms');
    expect(text).not.toMatch(/appointment\s+\\/);
  });

  it('shows the appointment route the API actually serves', () => {
    render(<DeveloperDocs />);
    expect(screen.getByText('/fhir/v1/appointment/pms')).toBeInTheDocument();
  });

  /* Matching the rail label alone made search only as good as the shortest name
     in it: "api" returned "No matches" in an API reference, because no label
     happened to contain the word once "Appointments API" became "Appointments". */
  it('finds pages by their content, not just their nav label', () => {
    render(<DeveloperDocs />);
    const search = screen.getByRole('searchbox', { name: 'Search docs' });

    fireEvent.change(search, { target: { value: 'api' } });
    expect(screen.queryByText('No matches')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Appointments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Companions' })).toBeInTheDocument();

    // A term that appears only in an article body, never in a label.
    fireEvent.change(search, { target: { value: 'multi-species' } });
    expect(screen.getByRole('button', { name: 'Companions' })).toBeInTheDocument();
  });

  it('filters the navigation and shows a no-matches message', () => {
    render(<DeveloperDocs />);
    const search = screen.getByRole('searchbox', { name: 'Search docs' });

    fireEvent.change(search, { target: { value: 'companion' } });
    expect(screen.getByRole('button', { name: 'Companions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('copies the page and code samples when the clipboard is available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: /Copy page/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Appointments'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it('copies the response code sample', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<DeveloperDocs />);

    // At the initial state both code buttons read "Copy"; [1] is the RESPONSE panel.
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[1]);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('proposed'))
    );
  });

  it('degrades gracefully when the clipboard API is missing', async () => {
    setClipboard(undefined);
    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: /Copy page/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Copy page/i })).toBeInTheDocument()
    );
  });

  it('degrades gracefully when clipboard writeText rejects', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('blocked'));
    setClipboard(writeText);
    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: /Copy page/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Copy page/i })).toBeInTheDocument();
  });
});
