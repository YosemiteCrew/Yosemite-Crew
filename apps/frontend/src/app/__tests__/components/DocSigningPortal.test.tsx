import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import DocSigningPortal from '@/app/features/docSigning/components/DocSigningPortal';
import { useOrgStore } from '@/app/stores/orgStore';
import { fetchDocumensoRedirectUrl } from '@/app/features/documents/services/documensoService';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/features/documents/services/documensoService', () => ({
  fetchDocumensoRedirectUrl: jest.fn(),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label }: any) => <div>{label}</div>,
}));

describe('DocSigningPortal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1' })
    );
  });

  it('renders iframe with normalized URL after fetch success', async () => {
    (fetchDocumensoRedirectUrl as jest.Mock).mockResolvedValue({
      redirectUrl: 'https://ds.yosemitecrew.com//portal//home',
    });

    const { container } = render(<DocSigningPortal />);

    await waitFor(() => {
      expect(fetchDocumensoRedirectUrl).toHaveBeenCalledWith('org-1');
    });

    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe('https://ds.yosemitecrew.com/portal/home');
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-downloads allow-forms allow-modals allow-popups allow-scripts allow-same-origin'
    );
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin');
  });

  it('shows fallback when portal url is unavailable', async () => {
    (fetchDocumensoRedirectUrl as jest.Mock).mockResolvedValue({ redirectUrl: '' });

    render(<DocSigningPortal embedded />);

    expect(await screen.findByText('Portal link not available')).toBeInTheDocument();
  });

  it('shows fallback when redirect URL points to an untrusted host', async () => {
    (fetchDocumensoRedirectUrl as jest.Mock).mockResolvedValue({
      redirectUrl: 'https://evil.example.com/portal/home',
    });

    render(<DocSigningPortal />);

    expect(await screen.findByText('Portal link not available')).toBeInTheDocument();
  });

  it('shows backend error message when fetch fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (fetchDocumensoRedirectUrl as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Doc portal disabled' } },
    });

    render(<DocSigningPortal />);

    expect(await screen.findByText('Doc portal disabled')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('ignores a response for an organisation the user has already switched away from', async () => {
    const resolvers: Record<string, (value: { redirectUrl: string }) => void> = {};
    (fetchDocumensoRedirectUrl as jest.Mock).mockImplementation(
      (orgId: string) =>
        new Promise<{ redirectUrl: string }>((resolve) => {
          resolvers[orgId] = resolve;
        })
    );
    let currentOrgId = 'org-1';
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: currentOrgId })
    );

    const { container, rerender } = render(<DocSigningPortal />);
    await waitFor(() => {
      expect(fetchDocumensoRedirectUrl).toHaveBeenCalledWith('org-1');
    });

    currentOrgId = 'org-2';
    rerender(<DocSigningPortal />);
    await waitFor(() => {
      expect(fetchDocumensoRedirectUrl).toHaveBeenCalledWith('org-2');
    });

    // The first organisation's request lands late: it must neither frame its
    // portal nor clear the spinner the second request is still earning.
    await act(async () => {
      resolvers['org-1']({ redirectUrl: 'https://ds.yosemitecrew.com/stale' });
    });
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('Loading Doc Signing')).toBeInTheDocument();

    await act(async () => {
      resolvers['org-2']({ redirectUrl: 'https://ds.yosemitecrew.com/fresh' });
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://ds.yosemitecrew.com/fresh');
  });

  it('ignores a failure from an organisation the user has already switched away from', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const rejecters: Record<string, (reason: unknown) => void> = {};
    (fetchDocumensoRedirectUrl as jest.Mock).mockImplementation(
      (orgId: string) =>
        new Promise<never>((_resolve, reject) => {
          rejecters[orgId] = reject;
        })
    );
    let currentOrgId = 'org-1';
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ primaryOrgId: currentOrgId })
    );

    const { rerender } = render(<DocSigningPortal />);
    await waitFor(() => {
      expect(fetchDocumensoRedirectUrl).toHaveBeenCalledWith('org-1');
    });

    currentOrgId = 'org-2';
    rerender(<DocSigningPortal />);
    await waitFor(() => {
      expect(fetchDocumensoRedirectUrl).toHaveBeenCalledWith('org-2');
    });

    // The abandoned organisation's failure is logged but must not surface as the
    // current organisation's error.
    await act(async () => {
      rejecters['org-1'](new Error('org-1 portal is gone'));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Loading Doc Signing')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
