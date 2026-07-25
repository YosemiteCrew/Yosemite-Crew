import React from 'react';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';

type ModalProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
  containerClassName?: string;
};

const ignorePortalDropdownClick = (target: HTMLElement | null) =>
  Boolean(target?.closest('[data-portal-dropdown]'));

const CenterModal = ({
  children,
  showModal,
  setShowModal,
  onClose,
  containerClassName,
}: ModalProps) => (
  <ModalBase
    showModal={showModal}
    setShowModal={setShowModal}
    onClose={onClose}
    ignoreOutsideClick={ignorePortalDropdownClick}
    overlayClassName={`fixed backdrop-blur-[6px] inset-0 z-[1100] transition-opacity duration-200 ease-in-out ${
      showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}
    overlayStyle={{ backgroundColor: 'var(--sh55)' }}
    containerClassName={`fixed top-1/2 left-1/2 -translate-x-1/2 transition-opacity duration-100 ease-out -translate-y-1/2 w-[90%] sm:w-[500px] z-[1200] bg-neutral-0 p-3 flex flex-col gap-3 rounded-[20px] border border-card-border shadow-[0_2px_6px_var(--sh05),0_18px_48px_var(--sh08)] ${
      showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
    } ${containerClassName ?? ''}`}
  >
    {children}
  </ModalBase>
);

export default CenterModal;
