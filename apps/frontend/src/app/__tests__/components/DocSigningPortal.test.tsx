import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
      'allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts'
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
});
