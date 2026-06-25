'use client';

import { useEffect, useRef, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Text } from '@/app/ui';
import PetPassportView from '@/app/ui/cards/PetPassport/PetPassportView';
import { getPetPassport } from '@/app/features/petPassport/services/petPassport.service';
import { useNotify } from '@/app/hooks/useNotify';
import type { PetPassportDTO } from '@yosemite-crew/types';

type PetPassportModalProps = {
  open: boolean;
  companionId: string;
  companionName: string;
  onClose: () => void;
};

type LoadState = 'loading' | 'ready' | 'error';

const PetPassportModal = ({ open, companionId, companionName, onClose }: PetPassportModalProps) => {
  const [passport, setPassport] = useState<PetPassportDTO | null>(null);
  const [state, setState] = useState<LoadState>('loading');
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
        {state === 'ready' && passport && <PetPassportView passport={passport} />}
      </div>
    </CenterModal>
  );
};

export default PetPassportModal;
