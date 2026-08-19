'use client';

import React from 'react';
import { IoCreateOutline, IoSendOutline, IoTrashOutline } from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  PassportRecordStatus,
  canAttestStatus,
} from '@/app/features/petPassport/components/attestation/attestationModel';

export type AttestationBusy = 'SIGN' | 'ATTEST' | 'REVOKE' | null;

type AttestationActionsProps = {
  status: PassportRecordStatus;
  /** Set once the service reports the practice has no Documenso configured. */
  documensoUnavailable: boolean;
  confirmed: boolean;
  busy: AttestationBusy;
  onSign: () => void;
  onAttest: () => void;
  onRevoke: () => void;
};

const SIGN_LABEL = 'Send for signature';
const MANUAL_LABEL = 'Attest manually';

/**
 * E-signature is the preferred route, so it is the primary action and manual
 * attestation reads as the alternative. When the practice has no Documenso
 * configured the service cannot sign at all, and manual attestation takes the
 * primary slot rather than leaving the vet with a button that always fails.
 */
const SignActions = ({
  documensoUnavailable,
  confirmed,
  busy,
  onSign,
  onAttest,
}: Omit<AttestationActionsProps, 'status' | 'onRevoke'>) => {
  const blocked = !confirmed || busy !== null;

  if (documensoUnavailable) {
    return (
      <Primary
        text={busy === 'ATTEST' ? 'Attesting...' : MANUAL_LABEL}
        icon={<IoCreateOutline aria-hidden="true" />}
        isDisabled={blocked}
        onClick={onAttest}
      />
    );
  }

  return (
    <>
      <Secondary
        text={busy === 'ATTEST' ? 'Attesting...' : `${MANUAL_LABEL} instead`}
        icon={<IoCreateOutline aria-hidden="true" />}
        isDisabled={blocked}
        onClick={onAttest}
      />
      <Primary
        text={busy === 'SIGN' ? 'Sending...' : SIGN_LABEL}
        icon={<IoSendOutline aria-hidden="true" />}
        isDisabled={blocked}
        onClick={onSign}
      />
    </>
  );
};

const AttestationActions = ({
  status,
  documensoUnavailable,
  confirmed,
  busy,
  onSign,
  onAttest,
  onRevoke,
}: AttestationActionsProps) => {
  if (canAttestStatus(status)) {
    return (
      <SignActions
        documensoUnavailable={documensoUnavailable}
        confirmed={confirmed}
        busy={busy}
        onSign={onSign}
        onAttest={onAttest}
      />
    );
  }

  if (status === 'SIGNED') {
    return (
      <Secondary
        danger
        text="Revoke attestation"
        icon={<IoTrashOutline aria-hidden="true" />}
        isDisabled={busy !== null}
        onClick={onRevoke}
      />
    );
  }

  return null;
};

export default AttestationActions;
