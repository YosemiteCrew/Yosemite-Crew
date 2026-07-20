import React from 'react';
import Close from '@/app/ui/primitives/Icons/Close';

type ModalHeaderProps = {
  title: string;
  onClose: () => void;
};

const ModalHeader = ({ title, onClose }: ModalHeaderProps) => (
  <div className="flex justify-between items-center">
    <div className="text-[18px] font-bold tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>
      {title}
    </div>
    <Close onClick={onClose} />
  </div>
);

export default ModalHeader;
