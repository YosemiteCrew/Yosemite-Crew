import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <span>close</span>,
}));

describe('PdfPreviewOverlay', () => {
  it('renders iframe for allowed HTTPS IDEXX URL', () => {
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="https://integration.vetconnectplus.com/acknowledgment/1"
        title="Preview"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTitle('Preview')).toHaveAttribute(
      'src',
      'https://integration.vetconnectplus.com/acknowledgment/1'
    );
  });

  it('renders iframe for blob URL', () => {
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="blob:https://app.yosemitecrew.com/abc"
        title="Blob Preview"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTitle('Blob Preview')).toHaveAttribute(
      'src',
      'blob:https://app.yosemitecrew.com/abc'
    );
  });

  it('does not render iframe for unsafe URL schemes', () => {
    render(
      <PdfPreviewOverlay open pdfUrl="javascript:alert(1)" title="Blocked" onClose={jest.fn()} />
    );

    expect(screen.queryByTitle('Blocked')).not.toBeInTheDocument();
  });
});
