import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SigningOverlay from '@/app/ui/overlays/SigningOverlay';

const useSigningOverlayStoreMock = jest.fn();

jest.mock('@/app/stores/signingOverlayStore', () => ({
  useSigningOverlayStore: () => useSigningOverlayStoreMock(),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <span>close</span>,
}));

describe('SigningOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a hardened iframe for allowed Documenso URLs', () => {
    useSigningOverlayStoreMock.mockReturnValue({
      open: true,
      pending: false,
      url: 'https://ds.yosemitecrew.com//sign//abc',
      close: jest.fn(),
    });

    render(<SigningOverlay />);

    const iframe = screen.getByTitle('Document signing');
    expect(iframe).toHaveAttribute('src', 'https://ds.yosemitecrew.com/sign/abc');
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts'
    );
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin');
  });

  it('shows a fallback message for untrusted Documenso URLs', () => {
    useSigningOverlayStoreMock.mockReturnValue({
      open: true,
      pending: false,
      url: 'https://evil.example.com/sign/abc',
      close: jest.fn(),
    });

    render(<SigningOverlay />);

    expect(screen.getByText('Signing session could not be loaded safely.')).toBeInTheDocument();
    expect(screen.queryByTitle('Document signing')).not.toBeInTheDocument();
  });
});
