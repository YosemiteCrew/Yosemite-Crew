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

type LoadState = 'loading' | 'ready' | 'error';
type WalletTarget = 'apple' | 'google' | null;

const PetPassportModal = ({ open, companionId, companionName, onClose }: PetPassportModalProps) => {
  const [passport, setPassport] = useState<PetPassportDTO | null>(null);
  // Which companion the current passport / failure belongs to, so the load
  // state can be derived rather than reset synchronously inside the effect.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<WalletTarget>(null);
  const { notify } = useNotify();
  // useNotify returns a fresh `notify` each render; hold it in a ref so the
  // effect below does not re-fire on every render.
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getPetPassport(companionId)
      .then((data) => {
        if (!active) return;
        setPassport(data);
        setLoadedFor(companionId);
      })
      .catch(() => {
        if (!active) return;
        setFailedFor(companionId);
        notifyRef.current('error', {
          title: 'Passport unavailable',
          text: 'The pet passport could not be loaded.',
        });
      });
    return () => {
      active = false;
    };
  }, [open, companionId]);

  let state: LoadState = 'loading';
  if (failedFor === companionId) state = 'error';
  else if (loadedFor === companionId) state = 'ready';

  if (!open) return null;

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
    <CenterModal showModal={open} setShowModal={() => onClose()} onClose={onClose}>
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
          </>
        )}
      </div>
    </CenterModal>
  );
};

export default PetPassportModal;
