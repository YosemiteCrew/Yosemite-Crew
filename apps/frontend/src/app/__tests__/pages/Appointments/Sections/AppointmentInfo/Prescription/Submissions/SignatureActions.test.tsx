import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import SignatureActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/SignatureActions';
import {
  fetchSignedDocumentIfReady,
  startFormSigning,
} from '@/app/features/forms/services/formSigningService';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';

jest.mock('@/app/features/forms/services/formSigningService', () => ({
  startFormSigning: jest.fn(),
  fetchSignedDocumentIfReady: jest.fn(),
}));

jest.mock('@/app/stores/signingOverlayStore', () => ({
  useSigningOverlayStore: jest.fn(),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

describe('SignatureActions', () => {
  const openOverlay = jest.fn();
  const setUrl = jest.fn();
  const onStatusChange = jest.fn();

  const baseSubmission: any = {
    _id: 'submission-1',
    signatureRequired: true,
    signing: {
      required: true,
      provider: 'DOCUMENSO',
      status: 'IN_PROGRESS',
      signer: 'VET',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSigningOverlayStore as unknown as jest.Mock).mockImplementation(() => ({
      openOverlay,
      setUrl,
      open: false,
      submissionId: null,
    }));
    (startFormSigning as jest.Mock).mockResolvedValue({
      documentId: 'doc-1',
      signingUrl: 'https://sign.example/doc-1',
    });
    (fetchSignedDocumentIfReady as jest.Mock).mockResolvedValue({
      pdf: { downloadUrl: 'https://signed.example/doc-1.pdf' },
    });
    Object.defineProperty(globalThis, 'open', {
      value: jest.fn(),
      configurable: true,
    });
  });

  it('returns null when signature actions should not be shown', () => {
    const { container } = render(
      <SignatureActions
        submission={{ _id: 'submission-1', signatureRequired: false, signing: undefined } as any}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('starts signing and updates overlay/url/state', async () => {
    render(<SignatureActions submission={baseSubmission} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign' }));

    await waitFor(() => {
      expect(startFormSigning).toHaveBeenCalledWith('submission-1');
      expect(openOverlay).toHaveBeenCalledWith('submission-1');
      expect(setUrl).toHaveBeenCalledWith('https://sign.example/doc-1');
    });
    expect(onStatusChange).toHaveBeenCalledWith(
      'submission-1',
      expect.objectContaining({
        signing: expect.objectContaining({
          status: 'IN_PROGRESS',
          documentId: 'doc-1',
        }),
      })
    );
  });

  it('shows error when signing link is missing', async () => {
    (startFormSigning as jest.Mock).mockResolvedValueOnce({ documentId: 'doc-2' });
    render(<SignatureActions submission={baseSubmission} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign' }));
    expect(
      await screen.findByText('Signing link not available. Please retry.')
    ).toBeInTheDocument();
  });

  it('opens signed document in new tab for signed submission', async () => {
    render(
      <SignatureActions
        submission={{
          ...baseSubmission,
          signing: {
            ...baseSubmission.signing,
            status: 'SIGNED',
            pdf: { url: 'https://signed.example/already.pdf' },
          },
        }}
        onStatusChange={onStatusChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    await waitFor(() => {
      expect(globalThis.open).toHaveBeenCalledWith(
        'https://signed.example/already.pdf',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
