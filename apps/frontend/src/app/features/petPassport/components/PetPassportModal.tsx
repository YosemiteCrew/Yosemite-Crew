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
  const [state, setState] = useState<LoadState>('loading');
  const [busy, setBusy] = useState<WalletTarget>(null);
  const { notify } = useNotify();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setState('loading');
    getPetPassport(companionId)
      .then((data) => {
        if (!active) return;
        setPassport(data);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
        notifyRef.current('error', {
          title: 'Passport unavailable',
          text: 'The pet passport could not be loaded.',
        });
      });
    return () => {
      active = false;
    };
  }, [open, companionId]);

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
