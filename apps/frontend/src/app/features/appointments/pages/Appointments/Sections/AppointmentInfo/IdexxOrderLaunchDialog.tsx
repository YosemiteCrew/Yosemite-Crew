import React, { useId } from 'react';
import { IoOpenOutline } from 'react-icons/io5';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';

type IdexxOrderLaunchDialogProps = {
  open: boolean;
  url: string | null | undefined;
  source: 'order' | 'followup';
  onClose: () => void;
};

/**
 * IDEXX ordering runs in its own browser tab, where it keeps its own session.
 * This dialog stays open while the order is in progress so the screen behind it
 * can refresh once IDEXX reports the order as submitted.
 */
const IdexxOrderLaunchDialog = ({ open, url, source, onClose }: IdexxOrderLaunchDialogProps) => {
  const titleId = useId();
  const href = getSafeIdexxIframeUrl(url);
  if (!open || !href) return null;
  const isFollowUp = source === 'followup';

  return (
    <CenterModal showModal setShowModal={onClose} ariaLabelledBy={titleId}>
      <ModalHeader
        title={isFollowUp ? 'IDEXX follow-up ordering' : 'IDEXX ordering'}
        titleId={titleId}
        onClose={onClose}
      />
      <p className="text-body-4 text-text-primary">
        IDEXX opens in a new browser tab. This screen updates on its own once the order is
        submitted.
      </p>
      {isFollowUp ? (
        <p className="text-caption-1 text-text-secondary">
          If IDEXX shows the order was submitted and this dialog stays open, select Done to refresh
          this appointment.
        </p>
      ) : null}
      <ModalFooter>
        <Secondary text="Done" onClick={onClose} />
        <Primary
          href={href}
          target="_blank"
          text="Open IDEXX"
          icon={<IoOpenOutline />}
          iconPosition="right"
        />
      </ModalFooter>
    </CenterModal>
  );
};

export default IdexxOrderLaunchDialog;
