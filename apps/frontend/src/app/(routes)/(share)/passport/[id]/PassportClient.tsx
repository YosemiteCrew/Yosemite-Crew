'use client';

import { useEffect, useState } from 'react';
import { Text } from '@/app/ui';
import PetPassportView from '@/app/ui/cards/PetPassport/PetPassportView';
import { getPublicPassport } from '@/app/features/petPassport/services/petPassport.service';
import type { PetPassportDTO } from '@yosemite-crew/types';

type PassportClientProps = { id: string };
type LoadState = 'loading' | 'ready' | 'unavailable';

const PassportClient = ({ id }: PassportClientProps) => {
  const [passport, setPassport] = useState<PetPassportDTO | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    getPublicPassport(id)
      .then((data) => {
        if (!active) return;
        setPassport(data);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('unavailable');
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 p-6"
    >
      {state === 'loading' && (
        <Text variant="caption-1" className="text-text-secondary">
          Loading pet passport...
        </Text>
      )}
      {state === 'unavailable' && (
        <Text variant="caption-1" className="text-text-primary">
          This passport could not be found.
        </Text>
      )}
      {state === 'ready' && passport && (
        <div className="w-full">
          <PetPassportView passport={passport} />
        </div>
      )}
    </main>
  );
};

export default PassportClient;
