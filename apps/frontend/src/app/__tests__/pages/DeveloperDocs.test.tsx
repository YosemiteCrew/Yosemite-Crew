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

    expect(screen.getByRole('heading', { name: 'Create an appointment' })).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/v2/appointments')).toBeInTheDocument();
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

  it('filters the navigation and shows a no-matches message', () => {
    render(<DeveloperDocs />);
    const search = screen.getByRole('searchbox', { name: 'Search docs' });

    fireEvent.change(search, { target: { value: 'webhook' } });
    expect(screen.getByRole('button', { name: 'Webhooks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('copies the page and code samples when the clipboard is available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    render(<DeveloperDocs />);

    fireEvent.click(screen.getByRole('button', { name: /Copy page/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Create an appointment'));

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
