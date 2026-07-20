'use client';
import React, { useEffect, useState } from 'react';
import {
  IoArrowForward,
  IoClose,
  IoExpandOutline,
  IoLinkOutline,
  IoPlay,
  IoTextOutline,
  IoVolumeHighOutline,
} from 'react-icons/io5';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import { buildGuideDeepLink, copyToClipboard } from '@/app/ui/overlays/Modal/guideDeepLink';
import { GuideVideo } from '@/app/features/guides/types/guides';

type GuidePlayerModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  guide: GuideVideo | null;
  nextGuide: GuideVideo | null;
  onNext: () => void;
};

const GuidePlayerModal = ({
  showModal,
  setShowModal,
  guide,
  nextGuide,
  onNext,
}: GuidePlayerModalProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  // Reset the "Copied" affordance whenever the modal closes or the guide changes,
  // at render time via the prev-prop pattern rather than in an effect.
  const [prevKey, setPrevKey] = useState(`${guide?.id}|${showModal}`);
  const key = `${guide?.id}|${showModal}`;
  if (key !== prevKey) {
    setPrevKey(key);
    setCopied(false);
  }

  const handleClose = () => setShowModal(false);

  const handleCopyLink = async () => {
    /* v8 ignore next -- the copy button only renders once guide is non-null */
    if (!guide) return;
    const ok = await copyToClipboard(buildGuideDeepLink(guide.id));
    setCopied(ok);
  };

  if (!guide) return null;

  const scrubberPercent = Math.max(0, Math.min(100, guide.progressPercent ?? 0));
  const currentTime = guide.currentTime ?? '0:00';

  return (
    <ModalBase
      showModal={showModal}
      setShowModal={setShowModal}
      onClose={() => setCopied(false)}
      aria-label={`Guide: ${guide.title}`}
      overlayClassName={`fixed inset-0 z-[1100] backdrop-blur-[2px] transition-opacity duration-200 ${
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      overlayStyle={{ backgroundColor: 'var(--color-overlay-backdrop)' }}
      containerClassName={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200] flex w-[95vw] max-w-[920px] flex-col overflow-hidden rounded-[22px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_8px_20px_var(--sh10),0_36px_90px_var(--sh12)] transition-opacity duration-100 ${
        showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-3.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="shrink-0 rounded-full px-[9px] py-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em]"
            style={{ backgroundColor: 'var(--blue-soft)', color: 'var(--blue-text)' }}
          >
            {guide.category}
          </span>
          <span className="truncate text-[14.5px] font-bold text-[var(--ink)]">{guide.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--ink-body)] transition-colors hover:bg-[var(--inset)]"
          >
            <IoLinkOutline size={12} aria-hidden="true" />
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)] transition-colors hover:bg-[var(--inset)]"
          >
            <IoClose size={14} aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* Video surface (presentational) */}
      <div
        className="relative flex aspect-video items-center justify-center"
        style={{ backgroundColor: '#1d1c1b' }}
      >
        <span
          aria-hidden="true"
          className="flex size-[68px] items-center justify-center rounded-full"
          style={{
            backgroundColor: 'rgba(247,243,236,0.94)',
            color: '#1d1c1b',
            boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
          }}
        >
          <IoPlay size={28} className="ml-1" />
        </span>
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-[18px] pb-3 pt-3.5"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}
        >
          <span
            className="h-1 overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(247,243,236,0.28)' }}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${scrubberPercent}%`, backgroundColor: '#f7f3ec' }}
            />
          </span>
          <span className="flex items-center gap-3" style={{ color: '#f7f3ec' }}>
            <IoPlay size={16} aria-hidden="true" />
            <IoVolumeHighOutline size={16} aria-hidden="true" />
            <span className="text-[11px] font-semibold tabular-nums">
              {currentTime} / {guide.duration}
            </span>
            <span className="ml-auto flex items-center gap-3">
              <span
                className="rounded-md border px-1.5 py-px text-[10.5px] font-bold"
                style={{ borderColor: 'rgba(247,243,236,0.4)' }}
              >
                1.5×
              </span>
              <IoTextOutline size={15} aria-hidden="true" />
              <IoExpandOutline size={15} aria-hidden="true" />
            </span>
          </span>
        </div>
      </div>

      {/* Footer: chapters + next */}
      <div className="flex flex-col items-start justify-between gap-4 px-5 pb-4 pt-3.5 sm:flex-row sm:items-start">
        {guide.chapters && guide.chapters.length > 0 && (
          <span className="max-w-[520px] text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
            Chapters:{' '}
            {guide.chapters.map((chapter, index) => (
              <React.Fragment key={`${chapter.label}-${chapter.time}`}>
                {index > 0 ? ' · ' : ''}
                <span
                  style={
                    chapter.highlight ? { color: 'var(--blue-text)', fontWeight: 600 } : undefined
                  }
                >
                  {chapter.label} {chapter.time}
                </span>
              </React.Fragment>
            ))}
          </span>
        )}
        {nextGuide && (
          <button
            type="button"
            onClick={onNext}
            className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-[var(--blue-text)]"
          >
            Next: {nextGuide.title}
            <IoArrowForward size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </ModalBase>
  );
};

export default GuidePlayerModal;
