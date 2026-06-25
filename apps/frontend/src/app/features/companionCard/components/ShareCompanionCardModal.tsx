'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { Text } from '@/app/ui';
import CompanionIdCard from '@/app/ui/cards/CompanionIdCard/CompanionIdCard';
import { useNotify } from '@/app/hooks/useNotify';
import {
  getCompanionCard,
  issueShareToken,
  listShareTokens,
  revokeShareToken,
} from '@/app/features/companionCard/services/companionCard.service';
import type {
  CompanionCardDTO,
  IssueShareTokenResultDTO,
  ShareTokenResponseDTO,
} from '@yosemite-crew/types';

type ShareCompanionCardModalProps = {
  open: boolean;
  companionId: string;
  companionName: string;
  onClose: () => void;
};

const firstName = (name: string): string => name.split(' ')[0] || name;

const audienceLabel = (audience: ShareTokenResponseDTO['audience']): string =>
  audience === 'REFERRAL_CLINIC' ? 'Referral link' : 'Public link';

const ShareCompanionCardModal = ({
  open,
  companionId,
  companionName,
  onClose,
}: ShareCompanionCardModalProps) => {
  const { notify } = useNotify();
  // useNotify returns a fresh `notify` each render; keep it in a ref so the load
  // callback stays stable and the effect does not re-fire fetches in a loop.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [card, setCard] = useState<CompanionCardDTO | null>(null);
  const [tokens, setTokens] = useState<ShareTokenResponseDTO[]>([]);
  const [issued, setIssued] = useState<IssueShareTokenResultDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cardData, tokenList] = await Promise.all([
        getCompanionCard(companionId),
        listShareTokens(companionId),
      ]);
      setCard(cardData);
      setTokens(tokenList);
    } catch {
      notifyRef.current('error', {
        title: 'Card unavailable',
        text: 'Could not load the companion card.',
      });
    } finally {
      setLoading(false);
    }
  }, [companionId]);

  useEffect(() => {
    if (!open) return;
    setIssued(null);
    void refresh();
  }, [open, refresh]);

  const handleIssue = async () => {
    setBusy(true);
    try {
      const result = await issueShareToken(companionId, { audience: 'PUBLIC' });
      setIssued(result);
      await refresh();
      notify('success', { title: 'Link created', text: 'A shareable card link is ready.' });
    } catch {
      notify('error', { title: 'Share failed', text: 'Could not create the shareable link.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!issued) return;
    try {
      await globalThis.navigator.clipboard.writeText(issued.qrPayload);
      notify('success', { title: 'Copied', text: 'Link copied to clipboard.' });
    } catch {
      notify('error', { title: 'Copy failed', text: 'Could not copy the link.' });
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setBusy(true);
    try {
      await revokeShareToken(tokenId);
      await refresh();
      notify('success', { title: 'Revoked', text: 'The share link is no longer accessible.' });
    } catch {
      notify('error', { title: 'Revoke failed', text: 'Could not revoke the link.' });
    } finally {
      setBusy(false);
    }
  };

  const liveTokens = tokens.filter((token) => !token.revokedAt);

  return (
    <CenterModal showModal={open} setShowModal={() => onClose()} onClose={onClose}>
      <ModalHeader title={`Share ${firstName(companionName)}'s card`} onClose={onClose} />
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
        {loading && !card && (
          <Text variant="caption-1" className="text-text-secondary">
            Loading the card...
          </Text>
        )}

        {card && <CompanionIdCard card={card} />}

        {issued ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card-bg p-4">
            <QRCodeSVG value={issued.qrPayload} size={160} />
            <Text variant="caption-1" className="break-all text-center text-text-secondary">
              {issued.qrPayload}
            </Text>
            <Secondary text="Copy link" onClick={handleCopy} />
          </div>
        ) : (
          <Primary
            text={busy ? 'Creating...' : 'Create shareable card link'}
            onClick={handleIssue}
          />
        )}

        {liveTokens.length > 0 && (
          <div className="flex flex-col gap-2">
            <Text variant="caption-1" className="text-text-extra">
              Active share links
            </Text>
            {liveTokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-card-border p-3"
              >
                <Text variant="caption-1" className="text-text-primary">
                  {`${audienceLabel(token.audience)} - ${token.viewCount} views`}
                </Text>
                <Secondary text="Revoke" onClick={() => handleRevoke(token.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </CenterModal>
  );
};

export default ShareCompanionCardModal;
