import React from 'react';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';

type ModalProps = {
  children: React.ReactNode;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
  canClose?: () => boolean;
};

const Modal = ({ children, showModal, setShowModal, onClose, canClose }: ModalProps) => (
  <ModalBase
    showModal={showModal}
    setShowModal={setShowModal}
    onClose={onClose}
    canClose={canClose}
    ignoreOutsideClick={(target) => Boolean(target?.closest("[data-signing-overlay='true']"))}
    overlayClassName={`fixed backdrop-blur-[2px] inset-0 bg-[#302f2e80] z-[1100] transition-opacity duration-300 ease-in-out ${
      showModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}
    containerClassName={`fixed top-0 right-0 bottom-0 m-3 p-3 h-[calc(100%-2rem)] w-[calc(100%-2rem)] sm:w-[530px]
        bg-white border border-card-border rounded-2xl z-[1200]
        transition-transform duration-300 ease-in-out
        ${showModal ? 'translate-x-0' : 'translate-x-[120%]'}`}
  >
    {children}
  </ModalBase>
);

export default Modal;
