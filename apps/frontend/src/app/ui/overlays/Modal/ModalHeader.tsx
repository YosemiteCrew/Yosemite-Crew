import React from 'react';
import Close from '@/app/ui/primitives/Icons/Close';

type ModalHeaderProps = {
  title: string;
  onClose: () => void;
};

const ModalHeader = ({ title, onClose }: ModalHeaderProps) => (
  <div className="flex justify-between items-center">
    <div className="opacity-0" aria-hidden="true" tabIndex={-1}>
      <Close onClick={() => {}} tabIndex={-1} />
    </div>
    <div className="flex justify-center items-center gap-2">
      <div className="text-body-1 text-text-primary">{title}</div>
    </div>
    <Close onClick={onClose} />
  </div>
);

export default ModalHeader;
