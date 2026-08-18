'use client';

import { useEffect, useRef, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Button, Text } from '@/app/ui';
import PetPassportView from '@/app/ui/cards/PetPassport/PetPassportView';
import {
  downloadApplePass,
  getGoogleWalletUrl,
  getPetPassport,
} from '@/app/features/petPassport/services/petPassport.service';
import { useNotify } from '@/app/hooks/useNotify';
import type { PetPassportDTO } from '@yosemite-crew/types';

type PetPassportModalProps = {
  open: boolean;
  companionId: string;
  companionName: string;
  onClose: () => void;
};

type PetPassportModalContentProps = Omit<PetPassportModalProps, 'open'>;

type LoadState = 'loading' | 'ready' | 'error';
type WalletTarget = 'apple' | 'google' | null;

const PetPassportModalContent = ({
  companionId,
  companionName,
  onClose,
}: PetPassportModalContentProps) => {
  const [passport, setPassport] = useState<PetPassportDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<WalletTarget>(null);
  const { notify } = useNotify();
  // useNotify returns a fresh `notify` each render; hold it in a ref so the
  // effect below does not re-fire on every render.
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => {
    let active = true;
    getPetPassport(companionId)
      .then((data) => {
        if (!active) return;
        setPassport(data);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        notifyRef.current('error', {
          title: 'Passport unavailable',
          text: 'The pet passport could not be loaded.',
        });
      });
    return () => {
      active = false;
    };
  }, [companionId]);

  let state: LoadState = 'loading';
  if (failed) state = 'error';
  else if (passport) state = 'ready';

  const petName = companionName.split(' ')[0] || companionName;

  const handleAddToApple = () => {
    setBusy('apple');
    downloadApplePass(companionId, petName)
      .catch(() => {
        notifyRef.current('error', {
          title: 'Wallet pass unavailable',
          text: 'This pet passport could not be added to Apple Wallet yet.',
        });
      })
      .finally(() => setBusy(null));
  };

  const handleAddToGoogle = () => {
    setBusy('google');
    getGoogleWalletUrl(companionId)
      .then((url) => {
        globalThis.window.open(url, '_blank', 'noopener');
      })
      .catch(() => {
        notifyRef.current('error', {
          title: 'Wallet pass unavailable',
          text: 'This pet passport could not be added to Google Wallet yet.',
        });
      })
      .finally(() => setBusy(null));
  };

  return (
    <CenterModal showModal setShowModal={() => onClose()} onClose={onClose}>
      <ModalHeader title={`${petName}'s passport`} onClose={onClose} />
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
        {state === 'loading' && (
          <Text variant="caption-1" className="text-text-secondary">
            Loading passport...
          </Text>
        )}
        {state === 'error' && (
          <Text variant="caption-1" className="text-text-primary">
            This passport could not be loaded.
          </Text>
        )}
        {state === 'ready' && passport && (
          <>
            <PetPassportView passport={passport} />
            {/* A wallet pass is built from an ISSUED passport: its QR carries the
                public token, and a pet without one has nothing to verify against,
                so the wallet endpoints 404. Offering the buttons regardless would
                guarantee a failed download, so gate them on issuance. */}
            {passport.issuance ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="primary"
                  text={busy === 'apple' ? 'Adding to Apple Wallet...' : 'Add to Apple Wallet'}
                  onClick={handleAddToApple}
                  isDisabled={busy !== null}
                />
                <Button
                  variant="secondary"
                  text={busy === 'google' ? 'Adding to Google Wallet...' : 'Add to Google Wallet'}
                  onClick={handleAddToGoogle}
                  isDisabled={busy !== null}
                />
              </div>
            ) : (
              <Text variant="caption-1" className="text-text-secondary">
                Wallet passes become available once a vet issues this passport.
              </Text>
            )}
          </>
        )}
      </div>
    </CenterModal>
  );
};

// The load state lives in the content component so it cannot outlive a single
// viewing: closing unmounts it, and the companion key remounts it when the user
// switches pets. Keeping the state here instead would latch a failed load - a
// passport that 500s once would keep showing the error on every later open.
const PetPassportModal = ({ open, companionId, ...rest }: PetPassportModalProps) => {
  if (!open) return null;
  return <PetPassportModalContent key={companionId} companionId={companionId} {...rest} />;
};

export default PetPassportModal;
