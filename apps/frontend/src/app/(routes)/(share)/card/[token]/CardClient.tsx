'use client';

import { useEffect, useState } from 'react';
import { Text } from '@/app/ui';
import CompanionIdCard from '@/app/ui/cards/CompanionIdCard/CompanionIdCard';
import { getPublicCompanionCard } from '@/app/features/companionCard/services/companionCard.service';
import type { CompanionCardDTO } from '@yosemite-crew/types';

type CardClientProps = { token: string };
type LoadState = 'loading' | 'ready' | 'unavailable';

const CardClient = ({ token }: CardClientProps) => {
  const [card, setCard] = useState<CompanionCardDTO | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    getPublicCompanionCard(token)
      .then((data) => {
        if (!active) return;
        setCard(data);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('unavailable');
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 p-6"
    >
      {state === 'loading' && (
        <Text variant="caption-1" className="text-text-secondary">
          Loading companion card...
        </Text>
      )}
      {state === 'unavailable' && (
        <Text variant="caption-1" className="text-text-primary">
          This card is no longer available.
        </Text>
      )}
      {state === 'ready' && card && (
        <div className="w-full">
          <CompanionIdCard card={card} />
        </div>
      )}
    </main>
  );
};

export default CardClient;
