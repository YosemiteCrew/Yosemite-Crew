import React from 'react';
import Close from '@/app/ui/primitives/Icons/Close';

type ModalHeaderProps = {
  title: string;
  onClose: () => void;
};

const ModalHeader = ({ title, onClose }: ModalHeaderProps) => (
  <div className="flex justify-between items-center">
    <div className="text-body-1 text-text-primary">{title}</div>
    <Close onClick={onClose} />
  </div>
);

export default ModalHeader;
