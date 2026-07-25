import React from 'react';
import {
  IoArrowForward,
  IoChatbubbleEllipsesOutline,
  IoEllipsisHorizontal,
  IoPulseOutline,
} from 'react-icons/io5';
import {
  WORKSPACE_STEP_LABELS,
  type WorkspaceStep,
} from '@/app/features/appointments/types/workspace';
import { getNextStep } from '@/app/lib/appointmentWorkspace';

type PhonePrimaryCta = {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  icon?: React.ReactNode;
};

type PhoneWorkspaceActionBarProps = {
  activeStep: WorkspaceStep;
  /** Step-specific CTA (Summary terminal / Treatment "Skip to Summary"), when present. */
  primaryCta?: PhonePrimaryCta;
  /** Advance to the next step — the default CTA when no step-specific one applies. */
  onAdvance: () => void;
  advanceDisabled?: boolean;
  onRecords: () => void;
  onChat: () => void;
  onMore: () => void;
  /** Shows the pink unread dot on the chat button. */
  chatUnread?: boolean;
};

const ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-(--hairline) text-(--ink-soft) transition-colors duration-150 hover:bg-(--screen-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--blue)';

/**
 * Sticky phone action bar: a cluster of records / chat / more icon buttons and a
 * large --cta pill. The CTA advances to the next step ("Diagnostics →" …) unless a
 * step-specific primary action (Summary terminal, Treatment skip) is supplied —
 * mirroring the desktop meta bar's save button, so the flow is identical.
 */
const PhoneWorkspaceActionBar = ({
  activeStep,
  primaryCta,
  onAdvance,
  advanceDisabled = false,
  onRecords,
  onChat,
  onMore,
  chatUnread = false,
}: PhoneWorkspaceActionBarProps) => {
  const nextStep = getNextStep(activeStep);

  let cta: PhonePrimaryCta | undefined;
  if (primaryCta) {
    cta = primaryCta;
  } else if (nextStep) {
    cta = {
      label: WORKSPACE_STEP_LABELS[nextStep],
      onClick: onAdvance,
      isDisabled: advanceDisabled,
    };
  }

  return (
    <div className="flex flex-none items-center gap-2 border-t border-(--hairline) bg-(--screen) px-4 pt-2.5 pb-2">
      <button type="button" aria-label="Records" onClick={onRecords} className={ICON_BUTTON}>
        <IoPulseOutline size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Chat"
        onClick={onChat}
        className={`relative ${ICON_BUTTON}`}
      >
        <IoChatbubbleEllipsesOutline size={17} aria-hidden="true" />
        {chatUnread && (
          <span
            aria-hidden="true"
            className="absolute right-[9px] top-[9px] size-1.5 rounded-full bg-(--pink)"
          />
        )}
      </button>
      <button type="button" aria-label="More" onClick={onMore} className={ICON_BUTTON}>
        <IoEllipsisHorizontal size={17} aria-hidden="true" />
      </button>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          disabled={cta.isDisabled}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-(--cta) text-[13.5px] font-bold text-(--cta-text) transition-opacity duration-150 hover:bg-(--cta-hover) disabled:opacity-50"
        >
          {cta.label}
          {cta.icon ?? <IoArrowForward size={14} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
};

export default PhoneWorkspaceActionBar;
