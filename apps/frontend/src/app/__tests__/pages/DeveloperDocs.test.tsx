import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import { join } from 'path';

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
    expect(openLink).toHaveAttribute('href', '/docs');
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
   * Webhooks page. The API-key data plane now lives under /v1/developer, but the
   * old /v2 sample still never existed and there is no WebhookSubscription model.
   */
  it('does not document surfaces the API does not serve', () => {
    const { container } = render(<DeveloperDocs />);
    const text = container.textContent ?? '';

    expect(text).not.toContain('/v2/');
    expect(text).not.toContain('Bearer $YC_KEY');
    expect(screen.queryByRole('button', { name: 'Webhooks' })).not.toBeInTheDocument();
  });

  it('documents the mounted read-only API-key surface and its auth boundaries', () => {
    const { container } = render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(container.textContent).toContain('API-key-authenticated data plane is read-only');
    for (const path of [
      '/v1/developer/organizations',
      '/v1/developer/usage',
      '/v1/developer/appointments',
      '/v1/developer/appointments/:appointmentId',
    ]) {
      expect(container.textContent).toContain(path);
    }
    expect(container.textContent).toContain(
      'FHIR examples elsewhere in this reader use signed-in sessions'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Authentication' }));
    expect(container.textContent).toContain('Authorization: Bearer');
    expect(container.textContent).toContain('appointments:read');
    expect(container.textContent).toContain('x-org-id');
    expect(container.textContent).toContain('live active membership');
    expect(container.textContent).toContain('rather than one permanent practice');
  });

  /* The pill and the copyable sample are separate strings, so they can drift.
     They did: the pill was corrected to /pms while the curl still posted to the
     collection root, which no route serves. Assert the sample itself. */
  /* Three ways this sample was wrong even after the route was corrected:
     the org is read from an Organization PARTICIPANT (x-org-id is only the
     permission middleware's input, and fromFHIRAppointment falls back to
     'unknown-org' which 404s); the submitted status is discarded because
     createAppointmentFromPms calls createAppointment(dto, 'UPCOMING'); and the
     host must not be pinned to one environment when the session is issued for
     whichever origin NEXT_PUBLIC_BASE_URL names. */
  it('gives a sample that would actually be accepted', () => {
    const { container } = render(<DeveloperDocs />);
    const text = container.textContent ?? '';

    expect(text).toContain('Organization/<practice-id>');
    expect(text).toContain('"status": "UPCOMING"');
    expect(text).not.toContain('"status": "proposed"');
    expect(text).not.toContain('devapi.yosemitecrew.com');
  });

  /* The endpoint needs a practice membership and appointments:edit:any. There is
     no developer role in the permission model, so the portal's own audience
     cannot call it - saying so is the difference between a reference and a
     misdirection. */
  it('says plainly that a developer-only account cannot call the org-scoped routes', () => {
    const { container } = render(<DeveloperDocs />);
    expect(container.textContent).toMatch(/practice surface, not a developer one/i);
  });

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
  /* searchTerms duplicates strings that live in JSX, so it can drift from what is
     actually on screen - the same failure mode as the curl sample drifting from
     the endpoint pill. Bind it: every indexed term must really render. */
  it('indexes only terms the article actually renders', () => {
    const { container } = render(<DeveloperDocs />);
    const text = container.textContent ?? '';
    for (const term of [
      '/fhir/v1/appointment/pms',
      'appointments:edit:any',
      'x-org-id',
      'UPCOMING',
    ]) {
      expect(text).toContain(term);
    }
  });

  it('finds a page by a term that appears only in its rendered detail', () => {
    render(<DeveloperDocs />);
    const search = screen.getByRole('searchbox', { name: 'Search docs' });

    fireEvent.change(search, { target: { value: 'appointments:edit:any' } });
    expect(screen.queryByText('No matches')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Appointments' })).toBeInTheDocument();
  });

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

  /* ARTICLES.appointments has no `detail` field - the endpoint, scope, and
     restrictions live only in JSX below `pageText`. Copy page must still carry
     them, or an agent pasting the page misses the integration instructions
     that are already on screen. Assert the copied string itself, not the
     rendered DOM, since the DOM already had this text before the fix. */
  it('carries the endpoint, scope, restriction and both samples into the copied page text', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: /Copy page/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('POST /fhir/v1/appointment/pms');
    expect(copied).toContain('appointments:edit:any');
    expect(copied).toMatch(/practice surface, not a developer one/i);
    expect(copied).toContain('Organization/<practice-id>');
    expect(copied).toContain('RelatedPerson/<parent-id>');
    expect(copied).toContain('"status": "UPCOMING"');
  });

  /* Mutation guard for the `if (isAppointments)` branch: flipping it to `if (true)`
     must fail here. Overview already mentions /v1/developer/appointments in its
     own summary, so assert only the appointment-write payload that this PR adds. */
  it('does not leak appointment-write copy into a non-appointments article', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: /Copy page/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Overview');
    expect(copied).not.toContain('POST /fhir/v1/appointment/pms');
    expect(copied).not.toContain('appointments:edit:any');
    expect(copied).not.toMatch(/practice surface, not a developer one/i);
    expect(copied).not.toContain('Organization/<practice-id>');
    expect(copied).not.toContain('RelatedPerson/<parent-id>');
    expect(copied).not.toContain('Request (cURL)');
    expect(copied).not.toContain('Response (201)');
  });

  it('copies the response code sample', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<DeveloperDocs />);

    // At the initial state both code buttons read "Copy"; [1] is the RESPONSE panel.
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[1]);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('UPCOMING'))
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

describe('code panel reads ink from the fixed --spot-ink token', () => {
  // .DocsCodePanel is painted from --spot, which stays dark in both themes.
  // Its header border, label and code ink must come from --spot-ink (fixed
  // the same way), not a frozen cream literal - otherwise light mode shows
  // the dark-mode ink shade instead of the light-tuned one. .DocsMethod's
  // ink stays a literal, justified in the baseline: it is pinned to
  // --color-cyan's fixed fill, not --spot, so --spot-ink does not apply.
  const css = readFileSync(
    join(process.cwd(), 'src/app/features/developers/pages/DeveloperDocs/DeveloperDocs.css'),
    'utf8'
  );

  it('does not hardcode the code panel chrome as frozen cream literals', () => {
    expect(css).not.toMatch(/\.DocsCodePanelHead\s*{[^}]*rgba\(\s*244,\s*239,\s*230/);
    expect(css).not.toMatch(/\.DocsCodePanelLabel\s*{[^}]*color:\s*rgba\(\s*244,\s*239,\s*230/);
    expect(css).not.toMatch(/\.DocsCodePre\s*{[^}]*color:\s*#f4efe6/);
  });

  it('routes the code panel chrome through --spot-ink', () => {
    expect(css).toMatch(
      /\.DocsCodePanelHead\s*{[^}]*border-bottom:\s*1px solid color-mix\(in srgb, var\(--spot-ink\) 10%/
    );
    expect(css).toMatch(
      /\.DocsCodePanelLabel\s*{[^}]*color:\s*color-mix\(in srgb, var\(--spot-ink\) 55%/
    );
    expect(css).toMatch(/\.DocsCodePre\s*{[^}]*color:\s*var\(--spot-ink\)/);
  });

  it('keeps .DocsMethod ink pinned to --color-cyan as a justified literal', () => {
    expect(css).toMatch(/\.DocsMethod\s*{[^}]*background:\s*var\(--color-cyan\)/);
    expect(css).toMatch(/\.DocsMethod\s*{[^}]*color:\s*#1d1c1b/);
  });
});
